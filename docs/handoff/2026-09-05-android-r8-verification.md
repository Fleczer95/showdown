# Handoff: verify the R8 release build on an Android emulator

**Date:** 2026-09-05
**Branch:** `chore/android-r8-dex-optimization`
**Audience:** an AI agent picking this up with no prior context.
**Goal:** prove that enabling R8 did not break the app at runtime, and that R8 actually ran.

---

## Why this exists

`android.enableMinifyInReleaseBuilds=true` was added in `app.json` (via
`expo-build-properties`) and `android/gradle.properties`. Google Play's DEX code
optimization threshold (enforced February 2027) requires ≥25% coverage across
shrinking, optimization and obfuscation; R8 had never run on this project.

R8 rewrites, renames and deletes code. **It fails at runtime, not at build time.**
A build that succeeds tells you almost nothing. Anything reached by reflection, JNI,
or class-name string lookup can compile fine and then throw `ClassNotFoundException`
the moment a user touches that screen. That is what this run-through is for.

## Two rules that make or break this

1. **Release build only.** R8 runs on the `release` build type and nowhere else.
   `npm run android` / `expo run:android` builds `debug`, where `minifyEnabled` is
   irrelevant. A debug build proves nothing here. Every command below is release.
2. **Android only.** This change touches no iOS code path — the
   `expo-build-properties` block declares an `android` key and nothing else. Do not
   spend time in the iOS simulator; there is nothing to see.

---

## Step 0 — preflight

Run these before anything else and **stop if the SDK is missing** rather than
improvising around it.

```bash
java -version                      # JDK 17 expected
echo "${ANDROID_HOME:-unset}"      # must point at an Android SDK
adb version
emulator -list-avds                # must list at least one AVD
```

⚠️ **As of 2026-09-05 this project's usual dev machine had no Android SDK at all** —
`ANDROID_HOME` unset, nothing at `~/Library/Android/sdk`, no Android Studio, no AVDs,
and `adb`/`emulator` not on `PATH`. The same condition is recorded in
`docs/handoff/2026-07-30-sentry-android-verification.md`. If that is still true, the
Android SDK + platform-tools + emulator + at least one system image must be installed
first. Do not try to substitute an iOS simulator, a physical-device-free "static
check", or a debug build.

**Signing.** `android/app/build.gradle` falls back to `android/app/debug.keystore`
when `android/local.properties` has no `MYAPP_UPLOAD_*` entries — which is the normal
state here, since `*.keystore` is gitignored. That fallback is what makes a locally
installable release build possible. If `android/app/debug.keystore` is absent, the
prebuild in Step 1 regenerates it; failing that:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/debug.keystore \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
```

A debug-signed release APK is correct for emulator testing. It is **not** the Play
artifact — do not upload it anywhere.

---

## Step 1 — build a release APK

`npm run aab` produces an **AAB**, which cannot be installed on an emulator without
bundletool. Build an APK instead, mirroring the same prebuild sequence that script uses:

```bash
rm -rf android/app/build android/.gradle android/build android/app/.cxx
npx expo prebuild --platform android --no-install   # never --clean (see AGENTS.md)
npm run prebuild                                     # symlinks + patch-build-gradle.js
cd android && ./gradlew assembleRelease
```

Expected artifacts:

| Path                                                                        | Meaning                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------- |
| `android/app/build/outputs/apk/release/app-release.apk`                     | the installable build                          |
| `android/app/build/outputs/mapping/release/mapping.txt`                     | R8 rename map                                  |
| `android/app/build/outputs/mapping/release/{seeds,usage,configuration}.txt` | what was kept / stripped / which rules applied |

After the prebuild, confirm the flag survived and the compliance plugin re-applied:

```bash
grep enableMinifyInReleaseBuilds android/gradle.properties   # must print =true
aapt dump permissions android/app/build/outputs/apk/release/app-release.apk \
  | grep -iE "ad_id|activity_recognition|media_playback|record_audio"   # must be empty
```

---

## Step 2 — prove R8 actually ran

Release builds use `proguard-android-optimize.txt`; the legacy default includes
`-dontoptimize`. `npm run prebuild` repairs the default after Expo regenerates it.
Run the regression checks with `npm run test:r8`, then confirm no dependency has
reintroduced a global disable flag in the effective release configuration:

```bash
test -s android/app/build/outputs/mapping/release/configuration.txt || exit 1
if rg -n '^-(dontoptimize|dontshrink|dontobfuscate)(\s|$)' \
  android/app/build/outputs/mapping/release/configuration.txt; then
  echo "R8 processing is disabled by a global rule"
  exit 1
fi
```

Three cheap checks. **If any fails, stop — the rest of the testing is meaningless
because you would be exercising an unminified build.**

```bash
# 1. The mapping file exists and contains renames
test -s android/app/build/outputs/mapping/release/mapping.txt && \
  grep -c ' -> ' android/app/build/outputs/mapping/release/mapping.txt

# 2. DEX shrank — measure this build
unzip -l android/app/build/outputs/apk/release/app-release.apk \
  | grep '\.dex' | awk '{s+=$1} END {print s/1048576 " MB DEX"}'
```

```bash
# 3. Baseline for comparison: same build from the base branch
git stash list                       # note anything you might disturb
git switch main
cd android && ./gradlew assembleRelease && cd ..
unzip -l android/app/build/outputs/apk/release/app-release.apk \
  | grep '\.dex' | awk '{s+=$1} END {print s/1048576 " MB DEX (baseline)"}'
git switch chore/android-r8-dex-optimization
```

Expect a substantial drop — R8 typically removes 40–60% of DEX from a React Native
app — and **no** `mapping.txt` on the baseline build. If the two DEX figures match,
the flag did not take effect; re-check that `expo prebuild` did not overwrite
`android/gradle.properties`.

Record both numbers in your report. They also answer the open question of whether
this app is even in scope: as a **Games**-category title the exemption is <50 MB of
DEX, and the baseline figure is the first real measurement anyone has of it.

---

## Step 3 — install and launch

```bash
emulator -avd <avd-name> -no-snapshot-load &
adb wait-for-device
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb shell monkey -p com.showdown.app -c android.intent.category.LAUNCHER 1
```

Then keep a filtered logcat running in a second shell for the whole session — this is
where R8 damage shows up:

```bash
adb logcat | grep -iE "ClassNotFound|NoClassDefFound|NoSuchMethod|NoSuchField|ReflectiveOperation|Unable to instantiate|UnsatisfiedLinkError|FATAL EXCEPTION|AndroidRuntime"
```

An immediate crash on launch usually means a core module lost a class it looks up
reflectively. A crash on one specific screen means that feature's library needs a
keep rule.

---

## Step 4 — exercise the surfaces R8 is most likely to have broken

Reflection, JNI and serialization are the risk. `android/app/proguard-rules.pro`
carries only the stock keep rules (reanimated + turbomodule); everything else relies
on consumer ProGuard rules shipped inside each library's AAR. Most well-maintained
libraries do ship them — this list is how you find the ones that don't.

- [ ] Cold launch to the home screen, no crash in logcat
- [ ] **Firebase Analytics** — events still dispatch (Firebase resolves handlers reflectively)
- [ ] **Firebase App Check** — attestation succeeds, no `403` on Firestore calls
- [ ] **Firestore challenge flow** — create a challenge, reopen it (`src/game/challenge/store.ts`); serialized model classes are a classic R8 casualty
- [ ] **MMKV stores** — `showdown-progression`, `showdown-settings`, `showdown-profile` read and write; kill and relaunch, confirm progression persisted (JNI-backed)
- [ ] **Skia rendering** — every screen that draws
- [ ] **Play Games Services** — sign-in, score submit, achievement unlock (`modules/game-services`, `src/services/gameServices/sync.ts`)
- [ ] **IAP** — product list loads and a purchase completes against a test account
- [ ] **Deep links** — `adb shell am start -a android.intent.action.VIEW -d "https://showdown.lebene.pl/c/<id>"`
- [ ] **Sentry** — force a test error and confirm it arrives readable (see below)
- [ ] Full game round start → finish, EN and PL

Unit tests (`npm test`) do **not** cover any of this. They run against source, never
against a minified APK.

---

## Step 5 — when something breaks

Stack traces from a minified build are obfuscated. Deobfuscate before diagnosing:

```bash
adb logcat -d > /tmp/crash.txt
retrace android/app/build/outputs/mapping/release/mapping.txt /tmp/crash.txt
# or: java -jar $ANDROID_HOME/cmdline-tools/latest/lib/r8.jar retrace ...
```

Sentry crash reports stay readable here without that step — `android/app/build.gradle`
already sets `includeProguardMapping = true` with auto-upload, so mappings ship with
each build.

The fix is a **targeted** keep rule in `android/app/proguard-rules.pro`, naming the
specific class or package the trace points at:

```proguard
-keep class com.example.thing.** { *; }
```

Then rebuild from Step 1 and re-verify Step 2 — a keep rule that is too broad will
quietly undo the DEX savings.

**Three things not to do:**

- **Do not revert `enableMinifyInReleaseBuilds`.** That reintroduces the compliance
  gap this branch exists to close.
- **Do not add a blanket `-keep class ** { \*; }`.\*\* It makes the build pass and drives
  optimization coverage back toward zero — a green test run that fails the actual Play
  requirement.
- **Do not disable R8 for one build type only** to make a test pass.

---

## Step 6 — report back

State plainly:

1. Whether an Android SDK/emulator was available, and which AVD + API level was used.
2. DEX size **before and after**, and the `mapping.txt` rename count.
3. Which checklist items in Step 4 passed, which failed, and which you could not
   reach (e.g. IAP without a test account) — say so rather than marking them done.
4. Any keep rules added, with the stack trace that justified each one.

Final compliance confirmation cannot happen locally: it comes from **Play Console →
App bundle explorer**, which reports DEX optimization coverage per uploaded bundle.
Upload an AAB (`npm run aab`) to an internal testing track and read the figure there
once this branch merges.

## Optimization regression found during verification (2026-09-06)

The optimized release initially crashed at startup in Expo Audio. A diagnostic
build traced the NPE to `RecordTypeConverter` reading `fieldAnnotation.key`; R8
had removed the annotation reference. The non-optimizing baseline launched.
Keep `expo.modules.kotlin.records.Field` explicitly in native ProGuard rules and
`expo-build-properties.android.extraProguardRules` so regeneration preserves the
fix. This keeps global optimization enabled. Cold-launch the release and exercise
a game with audio after changes; the configuration tests alone cannot prove
reflection works at runtime.

### Verified locally — 2026-09-06

- 99 Jest suites / 983 tests, 8 existing plugin checks, 4 R8 regression checks: passed.
- Optimized x86_64 release APK builds: passed. Effective R8 configuration has
  no global optimization, shrinking, or obfuscation disable directives.
- Android API 33 emulator: cold launch, free gameplay/scoring, store screen,
  and haptic setting persistence across process restart passed. Crash buffer
  remained empty after the annotation fix.
- Existing native permission exclusions and unrelated local edits preserved.
- Purchases, online services, other games, physical devices, and other ABIs
  were not verified in this run. No all-ABI AAB was built for this change.
