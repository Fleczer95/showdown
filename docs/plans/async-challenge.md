# Build Plan — Async Challenge

Implements **ADR-0003** (`docs/decisions/0003-async-challenge.md`). Read that
first; it holds the decisions and rationale. This file is the sequencing + file
map for implementation, and is meant to seed a fresh implementation context
together with the ADR.

## Current-state facts (verified)

- App scheme `showdown`; bundle id + Android package both `com.showdown.app`
  (`app.json`).
- Firebase already wired: `GoogleService-Info.plist` + `google-services.json`
  present; only `@react-native-firebase/analytics` is used today
  (`src/utils/firebase/init.ts`). **Firestore SDK not yet added.**
- Navigation: native-stack in `src/navigation/RootNavigator.tsx`. **No deep-link
  `linking` config yet.** Param list in `src/navigation/types.ts`.
- A run is driven by an xstate machine `src/game/machines/gameSessionMachine.ts`
  (states include `playing` → `gameOver`). `GameSetupScreen.tsx` sends `START`
  and renders the per-game `PlayScreen`.
- Deck: pure `createDeck(items, history, rng)` (`src/game/deck.ts`); MMKV I/O in
  `src/game/history.ts` (`markShown`, `getHistory`).
- Scoring: unified points in `src/game/scoring.ts`. Ranking + board in
  `src/game/leaderboard.ts` (`rankEntries`, `LeaderboardEntry`,
  `getLastNickname`). Results UI molecule `src/components/molecules/Leaderboard.tsx`.

## External / human prerequisites (not code — gather before or during Phase 0)

- **Firestore**: enable Firestore in the existing Firebase project; deploy
  security rules + TTL policy (Phase 6).
- **Apple Team ID** for the AASA `appID` (`<TeamID>.com.showdown.app`).
- **Android signing SHA-256** fingerprint(s) (debug + release/Play App Signing)
  for `assetlinks.json`.
- **`showdown.lebene.pl`** subdomain on seohost: own static docroot, HTTPS cert,
  served raw (no redirect) for `.well-known/*`. Deploy via the existing rsync/SSH
  pattern with a different `REMOTE_DIR`.

---

## Phase 0 — Infra & deep links

1. Add deps: `@react-native-firebase/firestore`, `expo-network` (optional offline
   pre-check). `expo-linking` already present.
   → verify: `npm run type-check` clean; pods/gradle resolve on a dev build.
2. `app.json`: add iOS `associatedDomains: ["applinks:showdown.lebene.pl"]` and
   Android `intentFilters` for `https://showdown.lebene.pl/c/*` (autoVerify).
3. `RootNavigator.tsx`: add a `linking` config mapping `https://showdown.lebene.pl/c/:id`
   (and `showdown://c/:id`) to a new `Challenge` route.
4. Static files (deploy to subdomain docroot): `.well-known/apple-app-site-association`
   (lists `<TeamID>.com.showdown.app`), `.well-known/assetlinks.json` (package +
   SHA-256), and `index`/`c/` store-redirect fallback page.
   → verify: Apple AASA validator + `https://...` returns JSON with
   `Content-Type: application/json`, no redirect; Android App Links verify;
   tapping a link opens the app to the `Challenge` route on both platforms.

## Phase 1 — Data layer

Files: `src/game/challenge/types.ts`, `src/game/challenge/store.ts`,
`src/game/challenge/deviceId.ts`.

1. `types.ts`: `ChallengeRecord` and `Attempt` per ADR record shape
   (`schemaVersion`, `minAppVersion`, `appVersion`, `lang`, `game`, `settings`,
   `questions:[{id, byLocale}]`, `createdBy:{uuid,nickname}`, `expiresAt`).
   `SCHEMA_VERSION = 1`, `MIN_APP_VERSION` constant.
2. `deviceId.ts`: `getDeviceId()` — read/generate a UUID in MMKV (reuse a store
   id, e.g. the `showdown` prefs store).
3. `store.ts`: Firestore wrappers — `createChallenge(record) -> id`,
   `getChallenge(id)`, `submitAttempt(id, uuid, attempt)` (create-only doc at
   `c/{id}/attempts/{uuid}`), `getAttempts(id)`. Each wraps try/catch + timeout
   and throws a typed `OfflineError` for the UI guard.
   → verify: unit tests for pure parts; manual write/read against Firestore.

## Phase 2 — Challenge builder (freeze the round)

File: `src/game/challenge/build.ts`.

1. `buildChallenge(gameId, settings)`: build the deck for the game from local
   history (`createDeck`), take the run's N questions, and resolve each id to its
   payload **in every locale** via a unified resolver spanning free `content.ts`
   and pack content (`getPackContent(id, locale)`). Stamp versions, `lang`,
   `expiresAt = now + 30d`, `createdBy`.
2. Add the **id → payload(locale)** resolver (new helper) covering both free and
   pack content for each game.
   → verify: unit test — built record is self-contained, every question has
   `byLocale.en` + `byLocale.pl`, ordered, length matches the game's run size.

## Phase 3 — Create flow

Files: `GameSetupScreen.tsx`, share util.

1. Add a **Create challenge** button beside Play (setup/idle state). On press:
   ensure a nickname (`getLastNickname`, prompt if empty) → `buildChallenge` →
   `createChallenge` → native share sheet with
   `https://showdown.lebene.pl/c/{id}`. Guard with the offline screen.
2. Creator then plays the frozen round as the first attempt (Phase 4 path), not a
   fresh deck.
   → verify: creating a challenge writes a doc, share sheet opens with the URL;
   offline shows the connect+retry guard, nothing lost.

## Phase 4 — Play a challenge (frozen deck + attempt)

Files: new `ChallengeScreen.tsx`, `gameSessionMachine.ts` (inject deck),
`history.ts` (owned-ids-only `markShown`).

1. `Challenge` route: on mount, `getChallenge(id)`; if missing/expired → expired
   state; if app `< minAppVersion` or unknown `schemaVersion` → "Update to take
   this challenge" → store. If this device's UUID already has an attempt → skip
   to Results (Phase 5).
2. Feed the **frozen questions** (in the device's locale, falling back to `lang`)
   into the session machine instead of building from history. Parameterise the
   machine/play screens to accept an injected ordered deck.
3. `markShown`: only for ids the player **owns** (skip embedded non-owned ids).
4. On `gameOver`: build the `Attempt` (`{nickname, progress, score, timestamp}`)
   and `submitAttempt`. Guard with offline screen; hold the result locally so
   Retry re-submits.
   → verify: two devices play the same link, both attempts land; non-owner plays
   embedded premium content; history not polluted by non-owned ids.

## Phase 5 — Bespoke VS intro + result reveal

Files: `ChallengeIntro.tsx`, `ChallengeResult.tsx`.

1. **VS intro** before play: "You vs {createdBy.nickname}" — no scores shown.
2. **Result reveal** after a confirmed attempt write: fetch attempts, rank with
   `rankEntries`, render the ranked board (reuse/extend `Leaderboard` molecule)
   with a reveal animation. Results never shown before the player finishes.
   → verify: results hidden until finish; ranking + tie-break match
   `rankEntries`; opening an already-completed link goes straight to results.

## Phase 6 — Rules, TTL, hardening

1. Firestore security rules: challenge doc **create + read**, no update/delete;
   attempts subcollection **create-only, one doc per UUID**
   (`allow create: if !exists(...)`), no update/delete; validate field shapes +
   size caps.
2. Enable **TTL policy** on `expiresAt`.
3. Offline: confirm all three gated moments (create / open / finish) show the
   connect+retry screen and lose nothing.
   → verify: rules unit tests (emulator) — cannot overwrite a challenge or
   another UUID's attempt, cannot double-submit; expired docs disappear.

## Phase 7 — Tests & analytics

1. Unit: builder, resolver, store mappers, version-gate, deviceId.
2. Analytics events (reuse `SafeAnalytics`): challenge_created, challenge_opened,
   challenge_completed, challenge_update_required.
   → verify: `npm run static` + `npm test` green.

## Suggested context boundaries for implementation

Phase 0 (infra/deep links) and Phase 6 (rules/TTL) each touch external systems
and are good standalone contexts. Phases 1–2 (data + builder) are a clean pure-TS
chunk. Phases 3–5 (create/play/reveal UI) are the app-surface chunk. Seed each
fresh context with ADR-0003 + this plan.
