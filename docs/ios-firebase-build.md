# iOS build bring-up — Firebase / App Check (findings)

Status as of 2026-06-13. The committed `ios/` project has **never built successfully
on this toolchain** (Xcode 26.2, RN new architecture, Hermes, Firebase iOS 12.x,
`@react-native-firebase` 24, CocoaPods 1.16.2). Below is what was tried, what works,
and the two unresolved walls, so a future focused effort doesn't re-derive it.

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

> Not yet runtime-verified — the iOS project does not link (see §3). The crash is
> near-certain from FirebaseCore behavior, not observed.

## 2. gRPC module map — FIXED

Under `use_modular_headers!` on CocoaPods 1.16+, the build referenced
`Pods/Headers/Private/grpc/gRPC-Core.modulemap`, which that CocoaPods version no
longer generates → `module map file ... not found` (the gRPC-C++ target, ~38 errors).

**Fix** (Podfile, inside the `ShowDown` target — currently reverted, document only):

```ruby
pod 'gRPC-Core', :modular_headers => false
pod 'gRPC-C++', :modular_headers => false
# in post_install, for those two targets:
config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
config.build_settings['DEFINES_MODULE'] = 'NO'
```

Verified: this drops the stale `-fmodule-map-file` reference and the build then
compiles **all** of gRPC/Firebase and reaches the link stage. Ref: invertase/react-native-firebase#7805.

## 3. The two unresolved walls (a linkage catch-22)

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

## Recommendation

A focused native bring-up, not quick Podfile patches. Likely needs `patch-package`
and/or Firebase/RNFB version pinning, possibly upstream fixes. Worth checking whether the
team's real iOS build path is EAS Build (note: EAS uses the same prebuild + Podfile, so it
would hit the same errors unless its config differs). Re-apply §1 and §2 as the known-good
starting point.
