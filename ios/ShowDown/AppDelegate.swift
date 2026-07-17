import Expo
import FirebaseCore
import React
import ReactAppDependencyProvider

// @generated begin showdown-ios-mmkv-backup-policy-helper - expo prebuild (DO NOT MODIFY) sync-75fd0a60317c0548de095d2f6cf23803b3b1e4f2
private final class ShowDownMMKVBackupPolicy {
    static let shared = ShowDownMMKVBackupPolicy()

    // iOS backs up Documents by default. Keep only durable user state eligible;
    // every other current or future MMKV namespace is device-local.
    private static let backedUpNamespaces: Set<String> = [
        "showdown-progression",
        "showdown-settings",
        "showdown-profile",
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
}
// @generated end showdown-ios-mmkv-backup-policy-helper
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
// @generated begin showdown-ios-mmkv-backup-policy-start - expo prebuild (DO NOT MODIFY) sync-557d9a9e8b48d2c9398a881c529bdd81f9d4637d
    ShowDownMMKVBackupPolicy.shared.start()
// @generated end showdown-ios-mmkv-backup-policy-start

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    // ⚠️ MANUAL FIX — RE-APPLY AFTER EVERY `expo prebuild` (prebuild reverts this).
    // The @react-native-firebase/app config plugin emits a `FirebaseApp.configure()`
    // inside a generated block here, and the @react-native-firebase/app-check plugin
    // then appends ANOTHER `RNFBAppCheckModule.sharedInstance()` + `FirebaseApp.configure()`.
    // Two `configure()` calls crash at launch — FirebaseCore throws
    // "Default app has already been configured." on the second. Keep exactly ONE
    // configure(), with App Check's provider factory installed immediately before it.
    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
