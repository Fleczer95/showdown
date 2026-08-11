# Handoff: compile and verify cloud save + Game Stats on Android

**Date:** 2026-08-06
**Branch:** `feat/play-level-up`
**Plan:** `docs/superpowers/plans/2026-08-05-play-level-up.md`
**Goal:** get the two new native bridges — Play Saved Games and Game Stats — to compile
and actually work on a device, so Level Up Phases 1 and 2 can be called done.

## Blocking prerequisite — CLEARED 2026-08-11

**Saved Games ("Zapisane gry") is enabled in Play Console.** Confirmed by the account
owner in the console UI; it is not verifiable through any API we hold — see the note at
the end of this section. The cloud-save device checks in section 3 are now unblocked.

Path kept for reference, and for whoever needs to re-check it. Start from the app
dashboard —

```
https://play.google.com/console/u/0/developers/8291209362117111057/app/4974544417577616151/app-dashboard
```

— then: **Grow users → Play Games Services → Setup and management → Configuration →
Edit properties**, turn **Saved Games** to **ON**, and **Save**.

**Activation takes up to 24 hours to propagate.** It was switched on 2026-08-11, so a
device testing within a day of that may still fail in a way that reads exactly like a
bug in the bridge — do not start debugging working code. Force the refresh instead:

```
Settings → Apps → Google Play services → Manage Space → Clear All Data
```

**This state cannot be verified through any API we have.** For the record, so nobody
burns an afternoon rediscovering it:

- `gamesConfiguration` v1configuration exposes only `achievementConfigurations` and
  `leaderboardConfigurations` — no app-level feature flags.
- The Games API v1 `applications.get` does carry `enabledFeatures` (Saved Games appears
  there as `SNAPSHOTS`), but it **ignores the application id in the path** and resolves
  the app from the calling credential's own Cloud project. Our service account lives in
  `breathing-in-labour` (1011162158987), not the Games project (381435458877), so it
  answers `404 application 1011162158987 not found`. Enabling the Games API in the Cloud
  project does not change this. The same key against `gamesConfiguration` for the same
  game returns 200, which is how we know it is an addressing limitation and not
  permissions.

The console UI is the only source of truth for this toggle.

## Why this exists

Same reason as `2026-07-31-game-services-android-verification.md`: the work was written
on a Mac with **no Android SDK**. The JS side has 961 passing tests and a clean
`tsc`; the Kotlin has never been through a compiler.

What is different this time is that the three most likely compile errors were already
found and fixed *without* a build, by downloading the published AARs from Google's
Maven and reading them with `javap`:

- `play-services-games-v2:21.0.0` contains **neither** `GameStatsClient` **nor**
  `PlayerGameEvent`. The dependency is now `22.0.0` (released 2026-07-29), which has
  both. Every API already in use — `PlayGamesSdk.initialize`, `getGamesSignInClient`,
  `getAchievementsClient`, `getLeaderboardsClient`, `unlockImmediate`,
  `submitScoreImmediate`, `getAchievementsIntent` — was confirmed present in 22.0.0.
- `PlayerGameEvent` lives in `com.google.android.gms.games.playergameevent`, not
  `com.google.android.gms.games`. The import was wrong against either version.
- `SnapshotContents.readFully()` declares `IOException`. Kotlin does not force the
  catch, and a throw inside `addOnSuccessListener` escapes the promise and crashes the
  app. It is now wrapped.

Confirmed correct against the AAR, so do not "fix" these: `open(String, boolean, int)`,
`commitAndClose(Snapshot, SnapshotMetadataChange)`,
`RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED`, `writeBytes(byte[])`,
`PlayerGameEvent.Builder(String)` with `addProperty` overloads for
`long` / `double` / `String` / `boolean`, `GameStatsClient.recordEvent` and
`requestEventsUpload`.

---

## 1. Build it

```bash
npx expo prebuild --platform android --no-install
npm run prebuild            # scripts/prebuild.js — re-applies hand edits
npx expo run:android
```

The previous handoff verified this toolchain on Linux/WSL with Android SDK 36 and
Kotlin 2.1.20. If `expo run:android` skips work, re-check autolinking:

```bash
npx expo-modules-autolinking search -p android | grep -A3 game-services
```

---

## 2. Compile-risk checklist

All line references are in
`modules/game-services/android/src/main/java/expo/modules/gameservices/GameServicesModule.kt`.

### 2.1 The dependency bump is the biggest unknown

`modules/game-services/android/build.gradle` moved from `21.0.0` to `22.0.0`. The class
inspection says the APIs are all there, but **version skew across Play Services and
Firebase is not something an AAR listing can rule out.** This project also pulls
`com.google.gms:google-services:4.4.1` and the Firebase BoM. Watch for duplicate-class
or `Could not resolve` failures at merge time. If it explodes, the fallback is *not*
reverting to 21.0.0 — that version cannot compile Game Stats at all. Align the other
Play Services artifacts instead.

### 2.2 `promise.resolve(null)` in `readCloudSave`

Expo's `Promise.resolve` may not accept a bare `null` without a type hint. If Kotlin
reports an ambiguous overload, `promise.resolve(null as String?)` is the fix. Do not
change it to resolve `""` — the JS side treats empty and null differently
(`src/services/gameServices/cloudSave.ts` returns early on falsy).

### 2.3 `Map<String, Any>` as an `AsyncFunction` parameter

`recordStatsEvent(name: String, properties: Map<String, Any>, ...)` assumes Expo can
convert a JS object into `Map<String, Any>`. If it cannot, the likely alternative is
taking a JSON string from JS and parsing it here. The JS side already builds the object
in one tested place (`src/services/gameServices/stats.ts`), so changing the wire format
touches exactly one function on each side.

### 2.4 Number narrowing

JS numbers arrive as `Double`; the bridge narrows with `value.toLong()` because the
console CSV declares these properties as integers. `addProperty(String, double)` also
exists, so if a stat ever needs a fraction the overload is there — but the CSV must
agree, or PGS silently drops the event.

---

## 3. Device checks

Needs a **Google Play** emulator image or a real device, signed into a licensed tester
account, with the build machine's debug SHA-1 registered (see §3 of the previous
handoff for the `keytool` command and where to add it).

### Cloud save

1. Fresh install, play one run, force-stop. Relaunch. Progress must survive — this only
   proves local MMKV, but a failure here means the new startup path broke something.
2. Install on a second device with the same Play Games account. After launch, the
   second device's **Postępy** screen must show the first device's level.
3. **The merge check.** Turn off networking on device B, play two runs, restore
   networking, relaunch. Neither device may lose progress, and — this is the point —
   nothing may *inflate*. `runsPlayed` must equal the higher of the two devices, never
   the sum. Relaunch three or four times and confirm the numbers stand still.
4. **The bonus check.** On a device sitting at a low level, restore a high-level save,
   then level up once. The celebration must grant `BONUS_RUNS_PER_LEVEL` (3) banked
   runs — not one per restored level. Before the `seedBonusLevel` fix this paid 39.

Checks 3 and 4 matter most: both are bugs that were caught in review and fixed blind,
and neither has ever run on hardware.

### Game Stats

5. Upload `.agents/game-services/game_stats.csv` in Play Console → Play Games Services →
   Game Stats. **The column headers are a best guess** — match them to the template
   Console offers and fix the file if they differ.
6. Play one run of each game. In Console, the rejected-events list must be empty. PGS
   validates every event against the schema and drops mismatches silently, so an empty
   rejection list is the only evidence that the properties line up.
7. Confirm `progressUpdate` moves the Level stat when a run crosses a level threshold.

---

## 4. What is already settled

Don't re-litigate these:

- **Sidekick is enabled** (confirmed in the 2026-07-31 handoff). It rides along with
  the next AAB. No code needed.
- **Target audience is 13+**, so none of the Level Up requirements are exempt. The
  declaration is not readable through any API — inferred from the public listing
  carrying content rating "Everyone" with no Designed for Families designation.
- **The merge maxes, never sums.** Every field of `ProgressionStats` merges with max or
  union. This is not a style choice: restore merges local state with a slot holding the
  same history, so a summed counter doubles on every launch (10 → 20 → 40 → 80).
  Idempotence is a hard requirement. `src/game/progression/merge.test.ts` locks it.
- **Restore reads local state twice** — once as merge input, once at write time. The
  second read is deliberate: a run landing during the cloud round-trip was being erased.
- **Play Console is unreachable from this Mac's Chrome** — the signed-in Workspace
  account is blocked from the service at the admin level. All Console steps need
  someone else's session.

---

## 5. Known gaps, none blocking

Found in review, deliberately left alone:

- `recordRun` has no test asserting that `pushToCloud` and `reportRunStats` are called;
  they could be deleted and the whole suite would stay green.
- Cloud push fires after every run with no throttling. `sync.ts` has a digest pattern
  worth copying.
- Restore pushes back even when the merge changed nothing — one redundant write per
  launch.
- `pushToCloud` also runs on iOS, where the native stub always returns false.
- A permanently corrupt slot reports to Sentry on every launch, unsuppressed.
- Reading creates an empty snapshot for a player who never had one (`createIfNotFound`).
- A merge can unlock an achievement neither device had alone (e.g. `regular-silver` from
  16 union days) **without granting its XP**, because restore bypasses `applyRun`. Under-
  credits the player; direction is safe.
- A restore that jumps a player into the near-max band means `approaching_max_level`
  never fires for them — the event is one-shot on the transition.

---

## 6. Android build and emulator verification (2026-08-11)

Verified on Linux/WSL with Android SDK 36, Kotlin 2.1.20, and the
`Pixel_6_PlayStore_API33` Google Play emulator.

### Build result

The native bridge and full debug APK compile successfully:

```bash
cd android
./gradlew :game-services:compileDebugKotlin :app:packageDebug
```

This confirms all compile-risk items in section 2:

- `play-services-games-v2:22.0.0` resolves alongside the Firebase BoM and
  `play-services-auth`; duplicate-class checking passes.
- The Snapshots API calls, nullable promise resolution, `Map<String, Any>` argument,
  `PlayerGameEvent.Builder`, and `GameStatsClient` calls compile as written.
- The resulting debug APK is generated at
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- `aapt dump permissions` reports none of `AD_ID`, `ACTIVITY_RECOGNITION`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, or `RECORD_AUDIO` in the APK.

A forced all-task rebuild briefly produced missing Gradle incremental-cache files in
`mergeDebugJavaResource` and `packageDebug`. Re-running each affected task restored
the generated cache state; the subsequent fresh compile/package command passed without
source or configuration changes. This was build-cache state, not Play Services version
skew.

### Emulator smoke test

The APK installed and launched on `Pixel_6_PlayStore_API33`. With Metro running and
`adb reverse tcp:8081 tcp:8081`, Metro bundled all 4,409 modules and the home screen
rendered correctly. The app process remained alive in the resumed foreground activity,
and logcat contained no fatal exception or native crash.

Non-blocking development warnings observed:

- Existing require cycle:
  `recordRun.ts -> offline/limit.ts -> recordRun.ts`.
- React Native Firebase namespaced-API deprecation warnings.
- `react-native-iap` could not initialize Billing on this offline emulator. The app
  continued rendering normally.

This smoke test proves native initialization and JS startup only. It does **not** close
the cloud-save or Game Stats device checks in section 3: Saved Games still needs to be
enabled in Play Console, the Game Stats CSV still needs to be uploaded, and the checks
need a licensed tester account (plus a second device for the merge test).
