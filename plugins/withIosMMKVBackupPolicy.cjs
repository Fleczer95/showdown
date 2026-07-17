const { createRunOncePlugin, withAppDelegate, withInfoPlist } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PLUGIN_NAME = 'with-ios-mmkv-backup-policy';
const PLUGIN_VERSION = '1.0.0';
const HELPER_TAG = 'showdown-ios-mmkv-backup-policy-helper';
const START_TAG = 'showdown-ios-mmkv-backup-policy-start';

const DEFAULT_MMKV_STORE_IDS = ['showdown-progression', 'showdown-settings', 'showdown-profile'];
const REMOVED_PURPOSE_STRINGS = ['NSMicrophoneUsageDescription', 'NSMotionUsageDescription'];

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

function renderSwiftPolicy(storeIds = DEFAULT_MMKV_STORE_IDS) {
    const allowlist = validatedStoreIds(storeIds)
        .map((id) => `        "${id}",`)
        .join('\n');

    return `private final class ShowDownMMKVBackupPolicy {
    static let shared = ShowDownMMKVBackupPolicy()

    // iOS backs up Documents by default. Keep only durable user state eligible;
    // every other current or future MMKV namespace is device-local.
    private static let backedUpNamespaces: Set<String> = [
${allowlist}
    ]

    private var backgroundObserver: NSObjectProtocol?

    private init() {}

    deinit {
        if let backgroundObserver {
            NotificationCenter.default.removeObserver(backgroundObserver)
        }
    }

    func start() {
        apply()

        if backgroundObserver == nil {
            backgroundObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: nil
            ) { [weak self] _ in
                self?.apply()
            }
        }

        // React initializes MMKV after AppDelegate. Re-apply on the next main-loop
        // turn to catch stores created during startup; backgrounding catches later writes.
        DispatchQueue.main.async { [weak self] in
            self?.apply()
        }
    }

    private func apply() {
        let fileManager = FileManager.default
        guard let documentsDirectory = fileManager.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            return
        }

        let mmkvDirectory = documentsDirectory.appendingPathComponent(
            "mmkv",
            isDirectory: true
        )
        guard let items = try? fileManager.contentsOfDirectory(
            at: mmkvDirectory,
            includingPropertiesForKeys: nil,
            options: []
        ) else {
            return
        }

        for item in items {
            let fileName = item.lastPathComponent
            let namespace = fileName.hasSuffix(".crc")
                ? String(fileName.dropLast(4))
                : fileName
            var values = URLResourceValues()
            values.isExcludedFromBackup = !Self.backedUpNamespaces.contains(namespace)
            var mutableItem = item

            do {
                try mutableItem.setResourceValues(values)
            } catch {
#if DEBUG
                NSLog(
                    "[ShowDown] Could not update MMKV backup policy for %@: %@",
                    fileName,
                    String(describing: error)
                )
#endif
            }
        }
    }
}`;
}

function injectIosMMKVBackupPolicy(appDelegate, storeIds = DEFAULT_MMKV_STORE_IDS) {
    let contents = mergeContents({
        src: appDelegate,
        newSrc: renderSwiftPolicy(storeIds),
        tag: HELPER_TAG,
        anchor: /^@UIApplicationMain$/m,
        offset: 0,
        comment: '//',
    }).contents;

    contents = mergeContents({
        src: contents,
        newSrc: '    ShowDownMMKVBackupPolicy.shared.start()',
        tag: START_TAG,
        anchor: /bindReactNativeFactory\(factory\)/,
        offset: 1,
        comment: '//',
    }).contents;

    return contents;
}

function applyInfoPlistCompliance(infoPlist) {
    for (const key of REMOVED_PURPOSE_STRINGS) {
        delete infoPlist[key];
    }

    const appTransportSecurity =
        infoPlist.NSAppTransportSecurity && typeof infoPlist.NSAppTransportSecurity === 'object'
            ? infoPlist.NSAppTransportSecurity
            : {};
    infoPlist.NSAppTransportSecurity = {
        ...appTransportSecurity,
        NSAllowsArbitraryLoads: false,
    };

    return infoPlist;
}

function withIosMMKVBackupPolicy(config, props = {}) {
    const storeIds = validatedStoreIds(props.mmkvStoreIds);

    config = withInfoPlist(config, (modConfig) => {
        modConfig.modResults = applyInfoPlistCompliance(modConfig.modResults);
        return modConfig;
    });

    return withAppDelegate(config, (modConfig) => {
        if (modConfig.modResults.language !== 'swift') {
            throw new Error(`${PLUGIN_NAME}: only Swift AppDelegate files are supported`);
        }

        modConfig.modResults.contents = injectIosMMKVBackupPolicy(modConfig.modResults.contents, storeIds);
        return modConfig;
    });
}

module.exports = createRunOncePlugin(withIosMMKVBackupPolicy, PLUGIN_NAME, PLUGIN_VERSION);

// Pure helpers keep the prebuild mutation focused and directly testable.
module.exports._private = {
    DEFAULT_MMKV_STORE_IDS,
    HELPER_TAG,
    REMOVED_PURPOSE_STRINGS,
    START_TAG,
    applyInfoPlistCompliance,
    injectIosMMKVBackupPolicy,
    renderSwiftPolicy,
    validatedStoreIds,
};
