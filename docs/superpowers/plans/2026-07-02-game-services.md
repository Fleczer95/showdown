# Game Services (Play Games + Game Center) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Mirror ShowDown's 31 in-app achievements and 3 best-score leaderboards to Google Play Games Services (Android) and Apple Game Center (iOS), including store-side provisioning via the App Store Connect API and the Google Play Games Configuration API.

**Architecture:** A tiny local Expo Module (`modules/game-services`) wraps Play Games v2 (Kotlin) and GameKit (Swift) behind one JS API that no-ops when the native module is absent (Jest) or the player is unauthenticated. A pure TS mapping derives platform IDs from the existing local achievement ids. Sync is "replay derived truth": after every finished run and once at app start, unlock all currently-earned achievements and submit current best scores — idempotent, retroactive, throttled by an MMKV digest. Store-side config is created by two Python scripts under `.agents/game-services/` sharing one definitions module.

**Tech Stack:** Expo Modules API (Kotlin/Swift), `com.google.android.gms:play-services-games-v2:21.0.0`, GameKit, App Store Connect REST API (JWT/ES256), `gamesConfiguration` v1configuration (service account), MMKV.

## Global Constraints

- Package/bundle id: `com.showdown.app`; ASC app id `6774886649`; ASC key `AuthKey_TYBAQ9XDGV.p8` (Key ID `TYBAQ9XDGV`, Issuer `2d8516f5-a643-4741-88a9-28bfe52778fd`); Google service account key `google-play-key.json`.
- Do not use `expo start` / Expo Go. Dev builds only (`npx expo run:*`).
- Both locales (`en.json`, `pl.json`) must stay in sync; run `npm run i18n:check`.
- Do not touch the hand-edited manifest permission removals (AGENTS.md) — the module ships its own library manifest instead.
- Sign-in UX (Codex-reviewed): never present the iOS Game Center sign-in sheet on cold start; auth silently, present UI only on user intent. Android PGS v2 auto-signs-in by itself.
- No GKAccessPoint (visual conflict with custom UI).
- Apple achievement/leaderboard display names ≤ 30 chars; vendor ids only `[A-Za-z0-9._]` (locals ids' `-` → `_`).
- Points: bronze 10, silver 25, gold 50, one-offs 25 → Apple total 845 ≤ 1000; Google values are multiples of 5 ✓.
- All three leaderboards: integer, higher-is-better, best-score submission. Local game ids: `the-ladder`, `the-drop`, `the-wheel`.

## The 31 achievements

7 tiered families × 3 (`<family>-bronze|silver|gold`) from `ACHIEVEMENT_FAMILIES` (thresholds in `src/game/progression/achievements.ts:32`):
contestant 10/50/200 runs · on-a-roll 3/7/30-day streak · regular 5/15/40 days · winner 5/25/100 wins · ladder-scorer 8000/15000/22000 · drop-scorer 200k/600k/1.2M · wheel-scorer 5000/10000/18000.
10 one-offs (`ONE_OFF_IDS`): well-rounded, triple-threat, to-the-top, spotless, survivor, iron-bank, vowel-free, clean-sweep, quick-wit, comeback.
Names/descriptions: EN/PL from `src/i18n/locales/*.json` `progression.family|requirement|oneoff|requirementOneoff`, thresholds interpolated, tier suffix ` · Bronze|Silver|Gold` (PL ` · Brąz|Srebro|Złoto`; PL scorer family names shortened to `Wynik: <game>` to stay ≤ 30 chars).

---

### Task 1: Native module `modules/game-services`

**Files:**
- Create: `modules/game-services/expo-module.config.json`, `index.ts`, `ios/GameServices.podspec`, `ios/GameServicesModule.swift`, `android/build.gradle`, `android/src/main/AndroidManifest.xml`, `android/src/main/res/values/games-ids.xml`, `android/src/main/java/expo/modules/gameservices/GameServicesModule.kt`

**Interfaces (produces — consumed by Task 2):**
```ts
// modules/game-services/index.ts
export const gameServicesAvailable: boolean;
export function isAuthenticated(): Promise<boolean>;
export function signIn(): Promise<boolean>;            // Android: GamesSignInClient.signIn; iOS: presents held auth VC
export function unlockAchievement(id: string): Promise<void>;
export function submitScore(leaderboardId: string, score: number): Promise<void>;
export function showAchievements(): Promise<void>;
export function showLeaderboard(leaderboardId: string): Promise<void>;
```
All functions resolve harmlessly (no throw to caller-visible crash) when unauthenticated; `index.ts` wraps `requireNativeModule('GameServices')` in try/catch → JS no-op fallback (keeps Jest green with zero mocks).

- [x] Kotlin: `OnCreate { PlayGamesSdk.initialize(context) }`; clients via `PlayGames.get*Client(currentActivity)`; `unlock`, `submitScore`, `achievementsIntent`/`getLeaderboardIntent` + `startActivityForResult`.
- [x] Library manifest carries `<meta-data com.google.android.gms.games.APP_ID = @string/game_services_project_id>` + `games-ids.xml` (placeholder `0` until provisioning fills it; Kotlin guards init).
- [x] Swift: `GKLocalPlayer.local.authenticateHandler` set once at `OnCreate`, stores pending VC without presenting; `GKAchievement.report`; `GKLeaderboard.submitScore`; `GKGameCenterViewController` (.achievements / .leaderboards) with dismiss delegate.
- [x] Verify: `npx tsc --noEmit` passes; module autolinks (checked in Task 6 builds).

### Task 2: TS service + wiring

**Files:**
- Create: `src/services/gameServices/ids.ts` (pure id mapping), `src/services/gameServices/sync.ts`, `src/services/gameServices/index.ts`, `src/services/gameServices/playIds.generated.ts` (filled by Task 5 script; committed with empty map first), `src/services/gameServices/ids.test.ts`, `src/services/gameServices/sync.test.ts`
- Modify: `src/game/progression/recordRun.ts` (fire-and-forget sync after persist), `App.tsx` (startup sync), `src/screens/ProgressScreen.tsx` (platform buttons), `src/i18n/locales/en.json` + `pl.json`

**Interfaces:**
- Consumes Task 1 JS API.
- Produces: `appleAchievementId(localId): string` → `com.showdown.app.ach.<id with _>`; `appleLeaderboardId(gameId)` → `com.showdown.app.lb.<id with _>`; `googleAchievementId(localId): string | undefined` (generated map); `syncGameServices(stats: ProgressionStats): Promise<void>`; `openAchievementsUi()`, `openLeaderboardUi(gameId)` (sign in on demand, then show).

- [x] Digest throttle: MMKV store id `showdown-game-services`, key `digest` = JSON of sorted earned ids + bestScoreByGame; skip sync when digest unchanged; write digest only after all calls resolved.
- [x] `recordRun`: after `store.set(...)`, `void syncGameServices(stats)` (guarded so tests unaffected — module no-ops under Jest).
- [x] App start: fire-and-forget `syncGameServices(loadStats())` next to the existing `initAppCheck()` pattern in `App.tsx`.
- [x] ProgressScreen achievements tab: one row button — "View in Game Center" / iOS, "View in Google Play Games" / Android (i18n: `progression.gameServices.open`, + `openLeaderboards` on scores context if trivially placeable; keep minimal).
- [x] Tests: pure id mapping (`-`→`_`, prefixes) and digest behaviour (skip on same stats, resend on new achievement).
- [x] Verify: `npm test`, `npm run i18n:check`, `npm run type-check`.

### Task 3: iOS entitlement + capability

**Files:**
- Modify: `ios/ShowDown/ShowDown.entitlements` (+`com.apple.developer.game-center` = true), `app.json` (`ios.entitlements`)

- [x] Check bundle id capability via ASC API (`/v1/bundleIds?filter[identifier]`); Game Center is on by default for explicit App IDs — enable via `/v1/bundleIdCapabilities` only if missing.
- [x] Verify: `xcodebuild`/pod build in Task 6.

### Task 4: Game Center provisioning script (run it)

**Files:**
- Create: `.agents/game-services/SKILL.md`, `definitions.py` (31 achievements + 3 leaderboards, EN/PL, points, thresholds — single source for both stores), `create_game_center.py`, `gen_images.py` (512×512 PNG badges via Pillow: tier-colored roundrect + monogram)

- [x] `create_game_center.py`: ensure `gameCenterDetail` exists → create achievements (`referenceName`, `vendorIdentifier`, `points`, `showBeforeEarned:true`, `repeatable:false`) → localizations en-US + pl → reserve/upload/commit achievement images → 3 leaderboards (INTEGER, DESC, BEST_SCORE, range 0..10^9) + localizations. Idempotent: GET-first, skip existing.
- [x] Run against live ASC; record resulting state in script output; safe because GC config goes live only with the next app release.

### Task 5: Play Games provisioning (API + browser fallback)

**Files:**
- Create: `.agents/game-services/create_play_games.py`
- Modify: `src/services/gameServices/playIds.generated.ts`, `modules/game-services/android/src/main/res/values/games-ids.xml`

- [x] Discover games `applicationId`: attempt known sources; if no Play Games Services project exists, create it via Play Console browser automation (claude-in-chrome; user's session), link cloud project, add Android OAuth credentials (upload + Play App Signing SHA-1s).
- [x] `create_play_games.py`: `gamesConfiguration.achievementConfigurations.insert` ×31 (STANDARD, REVEALED, en-US + pl translations, pointValue) + `leaderboardConfigurations.insert` ×3 (LARGER_IS_BETTER, NUMERIC 0dp); idempotent via list-first; write generated ids to `playIds.generated.ts` + `games-ids.xml` (APP_ID).
- [x] If console automation is impossible, leave `docs/superpowers/plans/2026-07-02-game-services.LEFTOVERS.md` with the exact 5-minute manual checklist and make the script re-runnable.

### Task 6: Verification + commits

- [x] `npm run static` (type-check + lint + format:check), `npm test`, `npm run i18n:check`.
- [x] Android compile: `cd android && ./gradlew :app:assembleDebug` (or expo run:android build phase).
- [x] iOS compile: `pod install` + `xcodebuild -workspace ShowDown.xcworkspace -scheme ShowDown -configuration Debug -sdk iphonesimulator build`.
- [x] Conventional commits per task; memory note; final summary for the user.
