const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { _private } = require('./withAndroidBackupAndCompliance.cjs');

const STORE_IDS = ['showdown-progression', 'showdown-settings', 'showdown-profile'];
const EXPECTED_PATHS = STORE_IDS.flatMap((id) => [`mmkv/${id}`, `mmkv/${id}.crc`]);

test('manifest rules allow backup and preserve native capability removals', () => {
    const androidManifest = {
        manifest: {
            $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
            'uses-permission': [
                { $: { 'android:name': 'android.permission.INTERNET' } },
                { $: { 'android:name': 'android.permission.RECORD_AUDIO' } },
            ],
            application: [
                {
                    $: { 'android:name': '.MainApplication' },
                    service: [
                        {
                            $: {
                                'android:name': 'expo.modules.audio.service.AudioControlsService',
                            },
                        },
                    ],
                },
            ],
        },
    };

    _private.applyAndroidManifestRules(androidManifest);

    const { manifest } = androidManifest;
    const application = manifest.application[0];
    assert.equal(manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
    assert.equal(application.$['android:allowBackup'], 'true');
    assert.equal(application.$['android:fullBackupContent'], '@xml/backup_rules');
    assert.equal(application.$['android:dataExtractionRules'], '@xml/data_extraction_rules');
    assert.ok(manifest['uses-permission'].some((entry) => entry.$['android:name'] === 'android.permission.INTERNET'));

    for (const permission of _private.REMOVED_PERMISSIONS) {
        const matches = manifest['uses-permission'].filter((entry) => entry.$['android:name'] === permission);
        assert.equal(matches.length, 1);
        assert.equal(matches[0].$['tools:node'], 'remove');
    }
    for (const service of _private.REMOVED_SERVICES) {
        const matches = application.service.filter((entry) => entry.$['android:name'] === service);
        assert.equal(matches.length, 1);
        assert.equal(matches[0].$['tools:node'], 'remove');
    }
});

test('both Android rule formats allowlist exactly the approved MMKV file pairs', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'showdown-backup-rules-'));

    try {
        await _private.writeBackupRuleFiles(projectRoot, STORE_IDS);
        const xmlDirectory = path.join(projectRoot, 'android/app/src/main/res/xml');
        const legacy = await readFile(path.join(xmlDirectory, 'backup_rules.xml'), 'utf8');
        const modern = await readFile(path.join(xmlDirectory, 'data_extraction_rules.xml'), 'utf8');

        for (const filePath of EXPECTED_PATHS) {
            assert.equal((legacy.match(new RegExp(`path="${filePath.replace('.', '\\.')}"`, 'g')) ?? []).length, 1);
            assert.equal((modern.match(new RegExp(`path="${filePath.replace('.', '\\.')}"`, 'g')) ?? []).length, 2);
        }

        assert.equal((legacy.match(/<include /g) ?? []).length, EXPECTED_PATHS.length);
        assert.equal((modern.match(/<include /g) ?? []).length, EXPECTED_PATHS.length * 2);
        assert.match(modern, /<cloud-backup>/);
        assert.match(modern, /<device-transfer>/);
        assert.doesNotMatch(`${legacy}\n${modern}`, /showdown-store|showdown-offline-runs|showdown-ranking/);
    } finally {
        await rm(projectRoot, { recursive: true, force: true });
    }
});

test('invalid store IDs cannot escape the MMKV directory', () => {
    assert.throws(() => _private.validatedStoreIds(['../shared_prefs/private']), /invalid MMKV store id/);
});
