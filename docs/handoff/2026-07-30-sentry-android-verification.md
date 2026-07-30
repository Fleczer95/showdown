# Handoff: verify Sentry source-map / dSYM upload on Android

**Date:** 2026-07-30
**Branch:** `fix/sentry-crash-fixes-and-sourcemaps`
**Goal:** confirm the Android release build wires Sentry correctly and actually uploads
source maps + debug symbols. iOS is already verified; Android never has been.

---

## Why this exists

Production stack traces were unsymbolicated — every JS frame read as
`main.jsbundle:1:...`. The two highest-volume Sentry issues both grouped under the
useless title `captureMessage` because the only resolvable symbol was the function
name. Source-map upload was added to fix that.

**iOS is verified end-to-end** on a Release build: source maps uploaded to
`com.showdown.app@1.3.1+33` (dist 33) as an artifact bundle, and dSYMs uploaded from
the "Upload Debug Symbols to Sentry" build phase.

**Android was never verified.** The machine the work was done on has no Android SDK
at all — `ANDROID_HOME` unset, nothing at `~/Library/Android/sdk`, no
`android/local.properties`. `./gradlew assembleRelease` there dies while evaluating
root `build.gradle`, long before Sentry is reached. There is no `eas.json`, and CI
only runs `npm test` on ubuntu. So this is the one open question.

## What was changed (commit `ac767fb`)

- `app.json` — added the `@sentry/react-native/expo` config plugin with
  `organization: breathing-app`, `project: showdown`
- `app.json` — pinned `expo-audio` to `microphonePermission: false`; prebuild
  otherwise injects `NSMicrophoneUsageDescription`, and the app only plays audio,
  never records
- `android/app/build.gradle` — one line, `apply from: ... sentry.gradle` (line ~84)
- `android/sentry.properties` — org/project/url only, **no token** (safe to commit)
- iOS: new dSYM upload build phase + bundle phase wrapped with `sentry-xcode.sh`

Sentry org/project: **`breathing-app` / `showdown`**, DE region.

---

## Prerequisites on this machine

**1. Sentry credentials.** Should already be done (`npx sentry-cli login` writes
`~/.sentryclirc`). Verify:

```bash
npx sentry-cli info
```

Expect `Method: Auth Token`. The token has the DE region embedded, so **no
`SENTRY_URL` is needed** — sentry-cli routes automatically. A `WARN` about
`https://sentry.io` vs a manually-configured URL is expected and harmless.

Scope is `org:ci`: it can create releases and upload, but **cannot delete** them.

**2. `local.properties` at the REPO ROOT** (not `android/`). It is gitignored, so it
did not arrive with the branch. `scripts/prebuild.js` symlinks it to
`android/local.properties`. It must contain:

- `sdk.dir` — Android SDK path
- `MYAPP_UPLOAD_STORE_FILE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD`

Without it, `patch-build-gradle.js` falls back to debug signing and the build fails
early with `SDK location not found`. That failure is **environment, not Sentry**.

**3. Dependencies.** `npm ci` now works (commit `89540a8` resynced the lockfile —
it had been broken since ~2026-07-18, which is why CI was red). Do **not** use
`npm install`; it rewrites the lockfile.

---

## How to verify

### Use `npm run aab`, not `npm run android`

This matters. `npm run android` is `expo run:android`, which builds **debug**, and
`sentry.gradle` deliberately skips upload for debug configurations. It will tell you
nothing about upload.

```bash
npm run aab 2>&1 | tee /tmp/aab.log
```

`npm run aab` wipes the Android build dirs, runs `expo prebuild --platform android`,
runs `npm run prebuild` (symlinks + `patch-build-gradle.js`), then
`react-native build-android --mode=release`.

Note that prebuild regenerates `android/app/build.gradle`, so expect churn in that
file. The Sentry `apply from:` line is re-injected by the plugin, and
`patch-build-gradle.js` only does targeted signing-config insertions — it does not
strip it. Confirm after the build:

```bash
grep -n sentry android/app/build.gradle
```

### What success looks like

Search the build log for these:

```bash
grep -nE "artifact bundle|Bundle ID:|debug id|Uploaded .* debug information|Source Map Upload Report|error: sentry-cli" /tmp/aab.log
```

A successful source-map upload prints a block like:

```
> Bundled 2 files for upload
> Bundle ID: <uuid>
> Organization: breathing-app
> Projects: showdown
> Release: com.showdown.app@1.3.1+33
> Dist: 33
> Upload type: artifact bundle

Source Map Upload Report
  Scripts
    ~/index.android.bundle (sourcemap at index.android.bundle.map, debug id <uuid>)
```

A successful debug-file upload prints:

```
> Found N debug information files
> Uploaded N missing debug information file
```

**Check the `Release` and `Dist` values match the app's version/build** (currently
`1.3.1` / `33`) — a mismatch there means uploads land on a release the events will
never be attributed to, which looks like success but symbolicates nothing.

`Nothing to upload, all files are on the server` is also success — it means an
identical bundle was already uploaded.

---

## Traps — please avoid these, they cost time already

1. **`sentry-cli releases files <release> list` is useless here.** Modern uploads go
   to *artifact bundles*, which do not appear in that listing. It returns empty for
   uploads that definitely succeeded. Do not read an empty result as a failed
   upload. Trust the build log, not that command.

2. **Do not pipe the build through `tail`/`head` and then check `$?`.** You get the
   pager's exit status, not the build's. Two builds were misread as succeeding this
   way. Use `tee` (as above) or redirect to a file.

3. **`set -x` output from the Sentry scripts goes to stderr.** Always capture with
   `2>&1`, or the script trace vanishes and the phase looks like it did nothing.

4. **A failure before `:app:bundleReleaseJsAndAssets` is not Sentry's fault.** Before
   that task = SDK/signing/environment. After = Sentry is implicated. State which
   when reporting.

## If upload fails

- `SENTRY_DISABLE_AUTO_UPLOAD=true npm run aab` — builds fine, skips upload. Use to
  confirm the failure is upload-specific and not a general build break.
- `SENTRY_ALLOW_FAILURE=true` — lets upload failures warn instead of erroring.
- Credentials are the most likely cause: `sentry.properties` intentionally has no
  token, so this machine needs `~/.sentryclirc` or `SENTRY_AUTH_TOKEN`.

---

## Please report back

1. Did `npm run aab` succeed? (exit code from an unpiped run)
2. Did the source-map upload block appear, and what `Release` / `Dist` did it show?
3. Did the debug-files upload appear, and how many files?
4. Any `error: sentry-cli` lines?
5. Whether `grep -n sentry android/app/build.gradle` still shows the line post-prebuild.

## Known-unrelated issues — do not try to fix here

- **CI is red at `format:check`.** `prettier --check` flags ~790 files, pre-existing
  formatting drift. `type-check`, `lint`, `i18n:check` and all 876 tests pass. Needs
  its own branch and a `.git-blame-ignore-revs` entry; not this one's problem.
- **A stray `sourcemap-pipeline-check` release** exists in Sentry from a pipeline
  test. `org:ci` cannot delete it; needs a UI delete. Harmless, 0 events.
- **App Check failures** (`SHOWDOWN-C` / `SHOWDOWN-D`) are still live on build
  `1.3.2+34` — separate outstanding work (iOS App Attest + enforce flip).

**Correction (2026-07-30):** an earlier revision of this doc claimed `1.3.2+34`
"exists in Sentry but in no branch or tag", implying something shipped from an
untracked tree. That was wrong — it is commit `c95e1e2` on `main`, which bumped
`1.3.1/33` to `1.3.2/34`. The original check used `git log --all` against a stale
local `main` without fetching first. Nothing untracked was shipped.

---

## Verification results (2026-07-30)

Android release verification was run on branch
`fix/sentry-crash-fixes-and-sourcemaps` using:

```bash
set -o pipefail
npm run aab 2>&1 | tee /tmp/aab.log
```

### Result

- `npm run aab` succeeded with exit code 0 (`BUILD SUCCESSFUL in 5m 18s`; 839
  actionable tasks executed).
- The release AAB was generated at
  `android/app/build/outputs/bundle/release/app-release.aab` (115,978,881 bytes).
- Sentry authentication was confirmed as an auth token with `org:ci` scope.
- The source-map upload succeeded:
  - Organization/project: `breathing-app` / `showdown`
  - Release: `com.showdown.app@1.3.1+33`
  - Dist: `33`
  - Artifact bundle ID: `0ba1f393-f83a-5d67-a949-e6f738a51cff`
  - Bundle/source-map debug ID: `2aa12c6e-4466-4030-97fb-aa78fb5bc7a3`
- No `error: sentry-cli` lines appeared.
- `android/app/build.gradle` still contained the Sentry `apply from:` line at
  line 84 after Expo prebuild.
- The built AAB contained none of the restricted permissions listed in
  `AGENTS.md` (`AD_ID`, activity recognition, media playback foreground service,
  or record audio).
- Expo prebuild caused only line-ending status noise in
  `android/app/src/main/AndroidManifest.xml` and `android/sentry.properties`; an
  ignore-EOL diff confirmed no substantive content changes.

### Native debug-symbol finding

Native Android debug symbols were **not uploaded**. The log contained no
`Found N debug information files` or `Uploaded N ... debug information` block.

Root cause: the current `@sentry/react-native/expo` configuration enables the
React Native source-map integration, but the Sentry Android Gradle Plugin is
opt-in in `@sentry/react-native@7.2.0`. `app.json` does not set
`experimental_android.enableAndroidGradlePlugin`, so generated Gradle files do
not apply `io.sentry.android.gradle` and have no `uploadNativeSymbols` /
`autoUploadNativeSymbols` configuration.

Therefore, Android JavaScript source-map upload is verified and working for
`1.3.1+33`, but native Android symbol upload remains an open follow-up. Enable
and configure the Sentry Android Gradle Plugin, then repeat this release-build
verification to close it.

---

# ROUND 2: verify native Android symbol upload

**Added 2026-07-30, same branch.** The Sentry Android Gradle Plugin is now enabled
in response to the finding above. **This has NOT been verified on any machine** —
it cannot be, on the Mac this was authored on (no Android SDK). Round 1's JS
source-map result stands; this is strictly additive on top of it.

Also note the branch has since **merged `main`, so the version is now `1.3.2` /
build `34`**, not `1.3.1+33`. Expect uploads to target
`com.showdown.app@1.3.2+34`, dist `34`.

## What changed

`app.json` — the Sentry plugin now carries:

```json
"experimental_android": {
  "enableAndroidGradlePlugin": true,
  "includeNativeSources": false
}
```

`includeNativeSources` is deliberately `false` so third-party native source (Skia,
Reanimated internals) is not shipped to Sentry. Everything else stays at plugin
defaults.

Prebuild was run locally to capture what this injects. Two gradle files:

**`android/build.gradle`** (root, buildscript dependencies):
```groovy
classpath("io.sentry:sentry-android-gradle-plugin:5.11.0")
```

**`android/app/build.gradle`** — `apply plugin: "io.sentry.android.gradle"` at line 1,
plus this block appended at the end:
```groovy
sentry {
    autoUploadProguardMapping = shouldSentryAutoUpload()
    includeProguardMapping = true
    dexguardEnabled = false
    uploadNativeSymbols = shouldSentryAutoUpload()
    autoUploadNativeSymbols = shouldSentryAutoUpload()
    includeNativeSources = false
    includeSourceContext = false
    tracingInstrumentation { enabled = false }
    autoInstallation { enabled = false }
}
```

Both `tracingInstrumentation` and `autoInstallation` are **off**, so this is
upload-only — no bytecode rewriting, no runtime behaviour change, no implicit
dependencies. Every upload is gated behind `shouldSentryAutoUpload()`, so
`SENTRY_DISABLE_AUTO_UPLOAD=true` still disables all of it.

There are now **three** Sentry references in `android/app/build.gradle`: the AGP at
line 1, `apply from: … sentry.gradle` around line 85 (JS source maps, round 1), and
the `sentry { }` block near line 209. All three are expected.

## Verify

```bash
git pull
npm ci
set -o pipefail
npm run aab 2>&1 | tee /tmp/aab-native.log; echo "EXIT: $?"
```

Then:

```bash
grep -nE "Found [0-9]+ debug information|Uploaded [0-9]+ .*debug information|uploadNative|artifact bundle|Release:|Dist:|error: sentry-cli|BUILD SUCCESSFUL|BUILD FAILED" /tmp/aab-native.log
```

### Success criteria

1. `BUILD SUCCESSFUL` and `EXIT: 0`.
2. **JS source maps still work** (must not regress from round 1) — an
   `Upload type: artifact bundle` block with `Release: com.showdown.app@1.3.2+34`
   and `Dist: 34`.
3. **Native symbols now upload** — a `Found N debug information files` /
   `Uploaded N missing debug information file` block, or a
   `:app:sentryUploadNativeSymbolsForRelease`-style task running successfully.
4. No `error: sentry-cli` lines.
5. All three Sentry references still present after prebuild:
   `grep -n "sentry\|Sentry" android/app/build.gradle`

### Expect this to be slower and heavier

Native debug symbols for Skia, Hermes, Reanimated and MMKV/Nitro are large —
plausibly hundreds of MB. Round 1 built in 5m18s; this will be longer, and the
upload itself may take a while. That is expected, not a hang.

## Known hazard, please check if the build fails

`apply plugin: "io.sentry.android.gradle"` is injected at **line 1, before**
`apply plugin: "com.android.application"`. That is what the official Expo plugin
generates, but if Gradle complains about the Android extension being unavailable or
the plugin failing to configure, try moving the Sentry apply line to just after
`com.android.application` and rebuild. Report it if so — it means the generated
output needs a patch in `scripts/patch-build-gradle.js` to survive prebuild.

## If it breaks, this is cheap to revert

Remove the `experimental_android` block from `app.json`, re-run
`npx expo prebuild --platform android --no-install`, and Android is back to
round 1's verified JS-only state. Round 1's result does not depend on this.

Interim workaround if you need a release out regardless:
`SENTRY_DISABLE_AUTO_UPLOAD=true npm run aab`.

## Report back

1. `BUILD SUCCESSFUL`? Exit code from the `pipefail` run above.
2. Did native symbol upload appear, and how many files?
3. Did JS source-map upload still appear, with what `Release` / `Dist`?
4. Total build duration vs round 1's 5m18s.
5. Any `error: sentry-cli` lines, or the line-1 ordering hazard above.

---

## Round 2 verification results (2026-07-30)

Round 2 was verified on Linux with an Android SDK and a `Pixel_6_API_33`
emulator. Dependencies were refreshed with `npm ci`, then the release bundle was
built using the `pipefail` command above.

### Build and uploads

- `npm run aab` succeeded with exit code 0 (`BUILD SUCCESSFUL in 5m 39s`; 842
  actionable tasks executed). This was 21 seconds slower than Round 1.
- The release AAB was generated at
  `android/app/build/outputs/bundle/release/app-release.aab` (115,981,894 bytes).
- The JavaScript source-map upload still succeeded:
  - Organization/project: `breathing-app` / `showdown`
  - Release: `com.showdown.app@1.3.2+34`
  - Dist: `34`
  - Upload type: artifact bundle
  - Artifact bundle ID: `0ba1f393-f83a-5d67-a949-e6f738a51cff`
  - Bundle/source-map debug ID: `2aa12c6e-4466-4030-97fb-aa78fb5bc7a3`
- Native symbol upload succeeded through
  `:app:uploadSentryNativeSymbolsForRelease`:
  - Found 112 debug information files
  - Uploaded 112 missing debug information files
- No `error: sentry-cli` lines appeared.
- All three expected Sentry references remained in
  `android/app/build.gradle` after prebuild: the Android Gradle Plugin at line 1,
  `sentry.gradle` around line 85, and the `sentry { }` block around line 209.
- Applying `io.sentry.android.gradle` before `com.android.application` emitted
  the anticipated ordering warning, but it was non-fatal: the plugin configured
  its release tasks and completed the native upload. No ordering patch is needed
  based on this build.
- The built AAB contained none of the restricted permissions listed in
  `AGENTS.md`.
- Expo prebuild again caused only line-ending status noise in
  `android/app/src/main/AndroidManifest.xml` and `android/sentry.properties`; an
  ignore-EOL diff confirmed no substantive changes.

### AAB emulator smoke test

The exact release AAB was converted into device-specific split APKs with Google
Bundletool 1.18.3, signed with the configured upload key, and installed on a
`Pixel_6_API_33` emulator.

- Installed package: `com.showdown.app`
- Installed version: `1.3.2` (`versionCode=34`)
- Cold launch succeeded and the app was manually inspected in the visible
  emulator.
- Sentry initialized with the production DE-region DSN.
- The Sentry NDK integration loaded and the app showed no startup crash.

This verifies the release build, artifact uploads, AAB installation, and normal
startup. It does **not** constitute a controlled end-to-end symbolication test:
the production binary has no callable JS/native test-crash endpoint. Proving the
rendered stack traces would require a separate diagnostic build that emits an
identifiable JS exception and native crash, followed by inspection of those
events in Sentry with event-reading access.
