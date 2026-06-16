# Agent Instructions

This file contains specific rules and workflows for AI agents working on ShowDown.

## Localization & I18n

When adding new features, game packs, or UI components that require translation:

1.  **Always update both locales**: Ensure `src/i18n/locales/en.json` and `src/i18n/locales/pl.json` are synchronized.
2.  **Naming Convention**: Use the `screen.store.item.*` pattern for items and `screen.store.feature.*` for features to maintain consistency.
3.  **Verification**: After adding or modifying any translation content, **MUST** run the translation analysis script:
    ```bash
    npm run i18n:check
    ```
4.  **Fix Discrepancies**: If the script reports missing keys in `pl.json` or extra keys, fix them immediately before finishing the task.

## Theme Effects

When working with Skia background effects:

- Use `SkRSXform` for `Atlas` transformations to avoid JSI HostObject crashes.
- Ensure all animations use `useSharedValue` from `react-native-reanimated` for 60FPS performance.

## Native Permissions — DO NOT re-add (store compliance)

ShowDown is a quiz game with **no health, fitness, microphone, recording, background-audio,
or advertising features**. Several native dependencies (`expo-sensors`, `expo-audio`,
`@react-native-firebase/analytics`) declare permissions/services that ShowDown does **not**
use. They were **removed by hand** to clear Google Play / App Store policy warnings (e.g.
Health Connect / Activity Recognition, microphone, foreground-service media playback,
Advertising ID). **Do not re-add these, and do not "fix" the manifest by deleting the
`tools:node="remove"` lines.**

### Android — `android/app/src/main/AndroidManifest.xml`
Keep these `tools:node="remove"` entries (and the `xmlns:tools` attribute on `<manifest>`):
- `com.google.android.gms.permission.AD_ID` — no ads; AAID not used
- `android.permission.ACTIVITY_RECOGNITION` — from `expo-sensors` (unused; no pedometer)
- `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK` — from `expo-audio`; SFX play foreground-only
- `android.permission.RECORD_AUDIO` — from `expo-audio`; the app never records
- `<service>` removals: `expo.modules.audio.service.AudioControlsService`,
  `expo.modules.audio.service.AudioRecordingService`

### Android — `firebase.json`
Keep `"react-native": { "google_analytics_adid_collection_enabled": false }` (disables AAID
collection by Firebase Analytics). Pair it with the AD_ID permission removal above.

### iOS — `ios/ShowDown/Info.plist`
Do **not** re-add `NSMicrophoneUsageDescription` or `NSMotionUsageDescription` (unused
purpose strings from `expo-audio` / `expo-sensors`). Keep `NSAllowsArbitraryLoads = false`.

### ⚠️ `expo prebuild` will silently undo all of the above
These are hand-edits to the committed native projects. Running `npx expo prebuild`
(especially `--clean`) regenerates `AndroidManifest.xml` and `Info.plist` and **drops every
removal**, silently re-introducing the permissions. If a prebuild is ever unavoidable,
**re-apply every item in this section afterward** (or move them into a config plugin /
`withAndroidManifest` + `withInfoPlist`). The only prebuild-safe item is the `firebase.json`
flag. After any build, verify:
```bash
aapt dump permissions <app>.aab 2>/dev/null | grep -iE "ad_id|activity_recognition|media_playback|record_audio"   # must be empty
```
Background: these capabilities come only from `createAudioPlayer` (foreground SFX in
`src/hooks/useSound.ts`) and Firebase Analytics — never from app features. `expo-sensors`
is not imported anywhere in `src/`.

## Touch Event Propagation

When using icons or complex layouts inside a `Pressable`, `Button`, or any interactive container:

1.  **Always wrap icons/children in `pointerEvents="none"`**: If the child element (like a Lucide icon) is not intended to be independently clickable, ensure it does not intercept touch events. This prevents "dead zones" where clicking the icon doesn't trigger the button.
2.  **Use the `Icon` component**: Prefer using the project's standard `Icon` component (from `@/components`) which already has `pointerEvents="none"` pre-configured.
3.  **Atomic Interaction**: Atomic components like `Button` and `IconButton` must always have their internal layout containers set to `pointerEvents="none"` so the parent `Pressable` handles all interactions consistently.
