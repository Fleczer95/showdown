# Async Challenge progression parity — design

Date: 2026-07-16
Status: Approved

## Goal

A challenge run (ADR-0003) awards XP, achievements, and every other progression
effect exactly like an offline run. Today the challenge branch of each play
screen renders `ChallengeHandoff` instead of the game-over board, so
`recordRun` is never called and a challenge run awards nothing.

Scope decisions made during brainstorming:

- **Parity + one new achievement family** ("Challenger", counted from challenges
  played). A "challenge won" achievement is explicitly **skipped** for now —
  the win state is only knowable at reveal and can flip while the challenge is
  live. A "challenges created" family is also deferred (it would need a second
  seam into progression outside the run pipeline).
- Record at **run end**, not at submit success — a failed or abandoned submit
  never loses XP.

## 1. Data flow

- `ChallengeResult` (`src/game/challenge/ChallengeHandoff.tsx`) gains a
  required `run: GameRunResult` field.
- Each play screen (`LadderPlayScreen`, `DropPlayScreen`, `WheelPlayScreen`)
  already computes everything the offline board needs (score breakdown, `won`,
  per-game facts such as `rungReached`, `lifelinesUsed`, `quickWit`,
  `finalBank`, `roundsSurvived`, `puzzlesSolved`, `cleanPuzzles`,
  `bankruptRecovered`). The challenge branch builds the same `runResult` object
  the offline branch builds and passes it through `ChallengeHandoff` alongside
  `progress` and `score`.
- `GameRunResult` (`src/game/progression/types.ts`) gains an optional
  `challenge?: boolean`. It is set in exactly one place — `ChallengeScreen`
  spreads it in when recording (`recordRun({ ...result.run, challenge: true })`)
  — so no play screen can forget it.

## 2. Recording seam

- `ChallengeScreen.handleComplete` calls `recordRun` **before** the submit
  begins and stores the returned `RecordRunDiff` in state
  (`celebrationDiff`). `ChallengeHandoff`'s ref guard already guarantees
  `onComplete` fires exactly once per run, so:
  - a failed submit / retry loop cannot double-record (retries re-enter
    `submit`, not `handleComplete`'s record step);
  - quitting at the retry screen keeps the earned XP.
- Full parity applies through the existing `applyRun` reducer: run XP,
  `winsByGame` (the game's own win condition, same as offline),
  `bestScoreByGame`, per-run feats, streak dates (`datesPlayed`),
  `todayGameIds` (so a challenge run counts toward Triple Threat), level-ups,
  reward unlocks, and banked offline-run bonuses (`grantLevelBonus`).

## 3. New stat + achievement family

- `ProgressionStats` gains `challengesPlayed?: number`. Additive and
  retroactive-safe: `defaultStats()` seeds `0`, and `loadStats()`'s
  spread-merge already defaults it for previously persisted records. No
  migration.
- `applyRun` increments `challengesPlayed` when `result.challenge` is true.
- New tiered family in `ACHIEVEMENT_FAMILIES`
  (`src/game/progression/achievements.ts`):

  ```ts
  { family: 'challenger', axis: (s) => s.challengesPlayed ?? 0, thresholds: [1, 10, 30] }
  ```

  Bronze at 1 doubles as the "first challenge" moment. Tier XP comes from the
  existing `ACHIEVEMENT_XP_TIERS`, paid into the same `lifetimeXp` spine.
- i18n: add `progression.family.challenger` to **both** `en` and `pl`
  (localization verification per AGENTS.md). The family appears automatically
  in the Progress screen's tiered-family list.

## 4. Celebration UI

- Split `RunCelebration` (`src/components/molecules/RunCelebration.tsx`):
  - `CelebrationCard({ diff, accent })` — presentational: XP rise bar,
    count-up stats (XP gained, bonus runs), level flip + confetti + haptics,
    reward and achievement reveals, level-up analytics events, and the review
    pre-prompt. All of it is diff-driven and fires once per mounted diff.
  - `RunCelebration({ result, accent })` — the existing offline entry point:
    records the run exactly once (unchanged ref-guarded `recordRun` call) and
    renders `CelebrationCard` with the diff. Public API and offline behavior
    unchanged.
- `ChallengeScreen` renders `CelebrationCard` in the **results** phase
  (including the "waiting for opponent" state), below the ranked board, only
  when `celebrationDiff` is set — i.e. only in the session where the run just
  finished. Reopening a link later shows results with no celebration and
  records nothing.

## 5. Out of scope

- "Challenge won" and "challenges created" achievements (deferred, see Goal).
- Platform achievements (Game Center / Play Games) — that integration lives on
  the unmerged `game-services` branch; this feature targets the local
  progression engine on `main`.
- Any change to attempt submission, ranking, or the challenge record contract.

## 6. Tests

- `applyRun` (progression): the `challenge` flag increments
  `challengesPlayed`; tiers unlock at 1/10/30 with tier XP paid; legacy
  persisted stats (no `challengesPlayed`) load as 0; offline runs leave the
  counter untouched.
- `ChallengeScreen`: records exactly once per completed run; celebration card
  shows on results (fresh run) and on the waiting state; a submit retry does
  not re-record; reopening an already-played challenge shows no celebration
  and does not record.
- Play screens: existing challenge-mode tests updated for the extended
  `ChallengeResult` payload (each game passes its full `GameRunResult`).
- `RunCelebration`: offline behavior unchanged after the split (records once,
  renders the same card).
