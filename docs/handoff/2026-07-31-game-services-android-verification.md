# Handoff: compile and verify the Play Games native module on Android

**Date:** 2026-07-31
**Branch:** `game-services-v2`
**Goal:** get `modules/game-services` to compile and actually work on Android. iOS is
verified end to end; the Kotlin has never been through a compiler.

---

## Why this exists

The whole Game Center / Play Games integration was built and reviewed on a Mac with
**no Android SDK** — `ANDROID_HOME` unset, nothing at `~/Library/Android/sdk`. Every
claim about Android in this branch rests on reading documentation, not on a build.

iOS is in good shape: it compiles, cold-starts clean, and survived two independent
review passes. The Kotlin was rewritten twice during that work — once to report
delivery failures, once to stop re-reading the Activity inside a listener — so it is
now _further_ from anything that was ever known to build.

Nothing here is a suspected bug. These are the places where the code makes an
assumption about an API that no compiler has confirmed.

---

## 1. Build it

```bash
npx expo prebuild --platform android --no-install
npm run prebuild            # scripts/prebuild.js — re-applies hand edits
npx expo run:android
```

If `expo run:android` reports no changes and skips work, the local module may not be
linked — the iOS side had exactly this failure mode, where a "successful" build
shipped with no native bridge at all. Confirm autolinking sees it:

```bash
npx expo-modules-autolinking search -p android | grep -A3 game-services
```

It must resolve `expo.modules.gameservices.GameServicesModule` from
`modules/game-services/expo-module.config.json`.

---

## 2. Compile-risk checklist

All line numbers are in
`modules/game-services/android/src/main/java/expo/modules/gameservices/GameServicesModule.kt`.

### 2.1 `appContext.currentActivity` — line 25

```kotlin
private val activityOrNull: Activity?
    get() = appContext.currentActivity
```

Assumed to exist on `AppContext` and to be nullable. If the installed
`expo-modules-core` doesn't expose it, the alternative is
`appContext.activityProvider?.currentActivity`. **Verify the nullability too** — if it
is declared non-null, `?:` becomes a compile error rather than a fallback.

### 2.2 `unlockImmediate` — line 68

```kotlin
PlayGames.getAchievementsClient(activity).unlockImmediate(id)
```

**Highest risk on this list.** Play Games Services **v2** trimmed the client surface
compared with v1, and this code assumes `AchievementsClient.unlockImmediate(String)`
survived and still returns a `Task`. The dependency is
`com.google.android.gms:play-services-games-v2:21.0.0`
(`modules/game-services/android/build.gradle`).

If it is gone, do **not** silently fall back to fire-and-forget `unlock(id)` — that is
the exact defect this replaced. `unlock()` cannot report failure, and
`src/services/gameServices/sync.ts` banks its "already sent" digest only when every
write confirms delivery. Resolving `true` unconditionally would re-introduce silent,
permanent data loss. If the Immediate variants are unavailable, raise it rather than
patching around it.

### 2.3 `submitScoreImmediate` — line 76

```kotlin
PlayGames.getLeaderboardsClient(activity).submitScoreImmediate(leaderboardId, score.toLong())
```

Same assumption, same reasoning. Returns `Task<ScoreSubmissionData>`; only success or
failure is used.

### 2.4 `return@AsyncFunction promise.resolve(false)` — lines 41, 50, 58, 66, 74, 82

Returns the `Unit` from `resolve()` as the lambda's own return value. Legal Kotlin, but
it depends on the `AsyncFunction` overload's lambda actually returning `Unit`. If the
resolved overload expects a value instead, these become type errors.

### 2.5 Java-getter property syntax — lines 43, 44, 52, 61, 84

`.isAuthenticated` on `GamesSignInClient` (a `Task`-returning _method_), `.isAuthenticated`
on `AuthenticationResult` (a boolean), and `.achievementsIntent` on `AchievementsClient`
are all written as Kotlin properties over Java getters. This is the same style the
original code used, so it is likely fine — but it was never compiled either.

Note that line 43 and line 44 are two _different_ `isAuthenticated`: the first is the
client call producing a `Task`, the second is the result field.

### 2.6 Resource + manifest merge

`modules/game-services/android/src/main/AndroidManifest.xml` injects

```xml
<meta-data android:name="com.google.android.gms.games.APP_ID"
           android:value="@string/game_services_project_id" />
```

and the string lives in `modules/game-services/android/src/main/res/values/games-ids.xml`
(value `381435458877`). Confirm the merged manifest in
`android/app/build/intermediates/merged_manifests/` carries the literal id and not an
unresolved reference.

This deliberately does **not** touch `android/app/src/main/AndroidManifest.xml` —
AGENTS.md forbids re-adding permissions there, and prebuild would clobber it anyway.

---

## 3. Runtime gotcha before anything will sign in

**The debug SHA-1 of the machine doing the build must be registered** as an additional
OAuth client on the Play Games Services project, or sign-in fails with an unhelpful
error. Two clients exist already (Play Signing `57:BF:…:32:73`, Upload
`37:74:…:5C:ED`); a new developer machine needs a third.

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
        -storepass android -keypass android | grep SHA1
```

Add it in Play Console → Play Games Services → Configuration → Credentials.

---

## 4. Device checks

The emulator needs a **Google Play** image (not plain AOSP) — Play Games requires
Google Play services.

1. Fresh install, open the app. **No Play Games sign-in prompt should appear**, and no
   crash. Nothing is initialized until there is progress to send.
2. Play one full game. Sync now has something to send, so the SDK authenticates.
3. Open **Postępy → Osiągnięcia**, scroll to the bottom. A row reading
   **"Zobacz w Google Play Games"** must be there. If it is missing,
   `gameServicesAvailable` is `false` — the native module is not linked, and that is a
   build problem, not a Play Games problem.
4. Tap it. The native Play Games dashboard opens on achievements.
5. Background the app _while the dashboard is loading_ — it must resolve quietly rather
   than crash. This is the `NoActivityException` path that was fixed at line 87.
6. Turn off networking, play a game, restore networking, relaunch. Achievements earned
   while offline must appear — the digest is only banked when every write confirms, so
   a failed sync has to retry rather than mark itself done.

Check 6 is the one that matters most: it is the behaviour the whole delivery-reporting
rework exists for, and it cannot be observed on iOS without the same setup.

---

## 5. What is already settled

Don't re-litigate these:

- **Store config is live.** 34 achievements + 3 leaderboards, PUBLISHED on Google,
  provisioned on Apple. Verified through the APIs, not the console UI.
- **Play Games Sidekick** is enabled; it rides along with the next AAB.
- **ID parity is tested.** `src/services/gameServices/ids.test.ts` fails if a local
  achievement has no Google id, so a missing mapping cannot reach a device silently.
- **Play Console is unreachable from the original Mac's Chrome** — the signed-in
  Workspace account is blocked from the service at the admin level.
