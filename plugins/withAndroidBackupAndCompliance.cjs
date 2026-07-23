const fs = require('fs');
const path = require('path');
const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-android-backup-and-compliance';
const PLUGIN_VERSION = '1.0.0';

const DEFAULT_MMKV_STORE_IDS = ['showdown-progression', 'showdown-settings', 'showdown-profile'];

// These capabilities are declared by native dependencies but are not used by
// ShowDown. Keep the removals here so `expo prebuild` cannot reintroduce them.
const REMOVED_PERMISSIONS = [
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_ADSERVICES_AD_ID',
    'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
    'android.permission.ACTIVITY_RECOGNITION',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.RECORD_AUDIO',
];

const REMOVED_SERVICES = [
    'expo.modules.audio.service.AudioControlsService',
    'expo.modules.audio.service.AudioRecordingService',
];

function validatedStoreIds(storeIds = DEFAULT_MMKV_STORE_IDS) {
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
        throw new Error(`${PLUGIN_NAME}: mmkvStoreIds must be a non-empty array`);
    }

    return [...new Set(storeIds)].map((id) => {
        if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id)) {
            throw new Error(`${PLUGIN_NAME}: invalid MMKV store id: ${String(id)}`);
        }
        return id;
    });
}

function mmkvBackupPaths(storeIds) {
    return validatedStoreIds(storeIds).flatMap((id) => [`mmkv/${id}`, `mmkv/${id}.crc`]);
}

function renderIncludes(paths, indentation) {
    return paths.map((filePath) => `${indentation}<include domain="file" path="${filePath}"/>`).join('\n');
}

function renderLegacyBackupRules(storeIds) {
    const paths = mmkvBackupPaths(storeIds);
    return `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 11 and lower. Any <include> makes this an allowlist. -->
<full-backup-content>
${renderIncludes(paths, '  ')}
</full-backup-content>
`;
}

function renderDataExtractionRules(storeIds) {
    const paths = mmkvBackupPaths(storeIds);
    const includes = renderIncludes(paths, '    ');
    return `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 and higher. MMKV requires both its data and .crc metadata files. -->
<data-extraction-rules>
  <cloud-backup>
${includes}
  </cloud-backup>
  <device-transfer>
${includes}
  </device-transfer>
</data-extraction-rules>
`;
}

function upsertRemoval(entries, androidName) {
    const list = Array.isArray(entries) ? entries : [];
    const existing = list.find((entry) => entry?.$?.['android:name'] === androidName);
    const removal = existing ?? { $: {} };
    removal.$ = {
        ...removal.$,
        'android:name': androidName,
        'tools:node': 'remove',
    };

    return [...list.filter((entry) => entry?.$?.['android:name'] !== androidName), removal];
}

function applyAndroidManifestRules(androidManifest) {
    AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);
    const manifest = androidManifest.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    application.$ = {
        ...application.$,
        'android:allowBackup': 'true',
        'android:fullBackupContent': '@xml/backup_rules',
        'android:dataExtractionRules': '@xml/data_extraction_rules',
    };

    for (const permission of REMOVED_PERMISSIONS) {
        manifest['uses-permission'] = upsertRemoval(manifest['uses-permission'], permission);
    }
    for (const service of REMOVED_SERVICES) {
        application.service = upsertRemoval(application.service, service);
    }

    return androidManifest;
}

async function writeBackupRuleFiles(projectRoot, storeIds) {
    const xmlDirectory = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
    await fs.promises.mkdir(xmlDirectory, { recursive: true });
    await Promise.all([
        fs.promises.writeFile(path.join(xmlDirectory, 'backup_rules.xml'), renderLegacyBackupRules(storeIds), 'utf8'),
        fs.promises.writeFile(
            path.join(xmlDirectory, 'data_extraction_rules.xml'),
            renderDataExtractionRules(storeIds),
            'utf8',
        ),
    ]);
}

function withAndroidBackupAndCompliance(config, props = {}) {
    const storeIds = validatedStoreIds(props.mmkvStoreIds);

    config = withAndroidManifest(config, (modConfig) => {
        modConfig.modResults = applyAndroidManifestRules(modConfig.modResults);
        return modConfig;
    });

    return withDangerousMod(config, [
        'android',
        async (modConfig) => {
            await writeBackupRuleFiles(modConfig.modRequest.projectRoot, storeIds);
            return modConfig;
        },
    ]);
}

module.exports = createRunOncePlugin(withAndroidBackupAndCompliance, PLUGIN_NAME, PLUGIN_VERSION);

// Export pure helpers for focused validation without running a destructive prebuild.
module.exports._private = {
    DEFAULT_MMKV_STORE_IDS,
    REMOVED_PERMISSIONS,
    REMOVED_SERVICES,
    applyAndroidManifestRules,
    mmkvBackupPaths,
    renderDataExtractionRules,
    renderLegacyBackupRules,
    validatedStoreIds,
    writeBackupRuleFiles,
};
