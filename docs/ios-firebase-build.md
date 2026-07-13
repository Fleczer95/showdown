# iOS build bring-up — Firebase / App Check (historical findings)

> Update (2026-07-13): the app has used the Cloudflare D1 backend instead of
> Firestore since commit `3ed971e`. The stale React Native Firestore dependency
> has now been removed, so the gRPC module-map and `FirebaseFirestoreInternal`
> linker workarounds described below no longer apply. This document remains as
> historical context for the App Check setup and the manual AppDelegate guard.

Historical status recorded on 2026-06-13: the committed `ios/` project had not built
successfully on this toolchain (Xcode 26.2, RN new architecture, Hermes, Firebase iOS
12.x, `@react-native-firebase` 24, CocoaPods 1.16.2). The sections below preserve what
was tried at that time. They are not instructions for the current dependency graph.

## 1. AppDelegate double `FirebaseApp.configure()` — FIXED (manual, re-apply after prebuild)

`expo prebuild` produces a `didFinishLaunchingWithOptions` with **two** calls:

```swift
// @generated begin @react-native-firebase/app-... (DO NOT MODIFY)
FirebaseApp.configure()          // from @react-native-firebase/app plugin
// @generated end ...
RNFBAppCheckModule.sharedInstance()
FirebaseApp.configure()          // from @react-native-firebase/app-check plugin
```

`FirebaseApp.configure()` is **not idempotent** — FirebaseCore throws an uncaught
`NSException` ("Default app has already been configured.") on the second call, a
guaranteed launch crash. This is the deliberate (conflicting) output of the two RNFB
config plugins, not a local mistake.

**Fix applied** in `ios/ShowDown/AppDelegate.swift`: collapse to a single
`FirebaseApp.configure()` placed immediately after `RNFBAppCheckModule.sharedInstance()`,
behind a `⚠️ MANUAL FIX — RE-APPLY AFTER EVERY expo prebuild` comment. **Prebuild
regenerates this file and reintroduces the duplicate**, so the comment is the durable
artifact; a future improvement is a small Expo config plugin that dedupes it.

> Superseded on 2026-07-13: the app now builds, launches, and reaches its React Native
> UI on the simulator. The single-configure guard remains necessary.

## 2. Historical gRPC module-map workaround — RETIRED

Under `use_modular_headers!` on CocoaPods 1.16+, the build referenced
`Pods/Headers/Private/grpc/gRPC-Core.modulemap`, which that CocoaPods version no
longer generates → `module map file ... not found` (the gRPC-C++ target, ~38 errors).

**Historical fix** (no longer present or needed):

```ruby
pod 'gRPC-Core', :modular_headers => false
pod 'gRPC-C++', :modular_headers => false
# in post_install, for those two targets:
config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
config.build_settings['DEFINES_MODULE'] = 'NO'
```

Verified: this drops the stale `-fmodule-map-file` reference and the build then
compiles **all** of gRPC/Firebase and reaches the link stage. Ref: invertase/react-native-firebase#7805.

## 3. Historical unresolved walls — RETIRED

> These failures belonged to the old Firestore dependency graph. Removing the unused
> mobile Firestore package removed gRPC, BoringSSL, abseil, leveldb, and
> `FirebaseFirestoreInternal` from the iOS build. Do not re-apply §2 for the current app.

**Static libs + `use_modular_headers!`** (the supported RNFB path) — after §2, fails at link with:
- `ld: framework 'FirebaseFirestoreInternal' not found` — Firestore builds from source
  (static lib) but a module autolink emits `-framework FirebaseFirestoreInternal`.
  No documented fix (issue #7454 unresolved); explicit `:modular_headers => true` on
  `FirebaseFirestore` / `FirebaseFirestoreInternal` / `FirebaseCoreExtension` did **not** help.
- `module 'RNFBAppCheck' ... is not defined in any loaded module map file` — the
  app-check plugin's `#import <RNFBAppCheckModule.h>` in the Swift bridging header isn't
  finding `Pods/Headers/Public/RNFBAppCheck/RNFBAppCheck.modulemap` during PCH compile.

**`use_frameworks! :linkage => :static`** — auto-resolves both of the above, but then:
- RNFBFirestore's own ObjC headers can't see React types (`RCTPromiseRejectBlock`,
  `RCTBridgeModule`). Survived both `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES`
  and `$RNFirebaseAsStaticFramework = true`. Root cause: RNFB ObjC headers reference React
  types without importing React — designed for header-search-path (static-lib) compilation,
  not modular frameworks. Only fixable by `patch-package`-ing RNFB headers.

## Historical recommendation — SUPERSEDED

At the time, a focused native bring-up and possible dependency patches were recommended.
That recommendation no longer applies: the unused Firestore chain was the source of the
linkage catch-22. Keep §1's AppDelegate guard, but do not restore the gRPC or Firestore
workarounds.
