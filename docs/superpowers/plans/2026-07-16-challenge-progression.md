# Async Challenge Progression Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A challenge run (ADR-0003) awards XP, achievements, and every other progression effect exactly like an offline run, plus a new "Challenger" tiered achievement family (1/10/30 challenges played).

**Architecture:** Play screens pass their full `GameRunResult` through `ChallengeHandoff`; `ChallengeScreen` records it via the existing `recordRun` seam (flagged `challenge: true`) the moment the run ends — before submit, so a failed submit never loses XP and retries can't double-record. `RunCelebration` is split so its presentational card (`CelebrationCard`) can render the precomputed diff on the challenge results board.

**Tech Stack:** React Native / Expo, TypeScript, jest (`jest-expo` preset, config `jest.config.cjs`, mocks in `jest.setup.js`), `@testing-library/react-native`, i18n-js (en/pl JSON locales).

**Spec:** `docs/superpowers/specs/2026-07-16-challenge-progression-design.md`

## Global Constraints

- Do NOT run the app (`expo start` crashes on native modules); verification is jest + `npx tsc --noEmit` only.
- Every new i18n key must be added to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/pl.json`.
- "Challenge won" and "challenges created" achievements are explicitly out of scope.
- Match existing style exactly (4-space indent, single quotes, semicolons, comment density of surrounding code).
- Test command form: `npx jest <path> --coverage=false`

---

### Task 1: Progression core — `challengesPlayed` stat, `challenge` flag, Challenger family

**Files:**
- Modify: `src/game/progression/types.ts`
- Modify: `src/game/progression/recordRun.ts`
- Modify: `src/game/progression/achievements.ts`
- Modify: `src/components/molecules/AchievementDetailSheet.tsx:129-131`
- Modify: `src/i18n/locales/en.json` (~line 971 `progression.family`, ~line 980 `progression.requirement`)
- Modify: `src/i18n/locales/pl.json` (same blocks)
- Test: `src/game/progression/recordRun.test.ts`

**Interfaces:**
- Consumes: existing `applyRun(prev, result, today)`, `defaultStats()`, `ACHIEVEMENT_FAMILIES`.
- Produces: `GameRunResult.challenge?: boolean`; `ProgressionStats.challengesPlayed: number`; achievement ids `challenger-bronze|silver|gold`. Task 4 relies on `recordRun({ ...run, challenge: true })` incrementing the counter.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/progression/recordRun.test.ts` (the file already defines the `stats()`/`result()` helpers and `TODAY` shown in its first 15 lines):

```ts
describe('applyRun — challenge runs', () => {
    it('increments challengesPlayed and unlocks Challenger Bronze on the first challenge', () => {
        const { stats: next, diff } = applyRun(
            stats(),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(next.challengesPlayed).toBe(1);
        expect(diff.newAchievements).toContain('challenger-bronze');
    });

    it('leaves challengesPlayed untouched on a solo run', () => {
        const { stats: next, diff } = applyRun(
            stats(),
            result({ gameId: 'the-ladder', rungReached: 6 }),
            TODAY,
        );
        expect(next.challengesPlayed).toBe(0);
        expect(diff.newAchievements).not.toContain('challenger-bronze');
    });

    it('unlocks Challenger Silver and Gold at 10 and 30 challenges', () => {
        const silver = applyRun(
            stats({ challengesPlayed: 9 }),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(silver.diff.newAchievements).toContain('challenger-silver');
        const gold = applyRun(
            stats({ challengesPlayed: 29 }),
            result({ gameId: 'the-ladder', rungReached: 6, challenge: true }),
            TODAY,
        );
        expect(gold.diff.newAchievements).toContain('challenger-gold');
    });

    it('seeds challengesPlayed to 0 for fresh (and legacy spread-merged) stats', () => {
        expect(defaultStats().challengesPlayed).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/game/progression/recordRun.test.ts --coverage=false`
Expected: FAIL — TypeScript/jest errors: `challenge` not in `GameRunResult`, `challengesPlayed` not in `ProgressionStats`.

- [ ] **Step 3: Extend the types**

In `src/game/progression/types.ts`, inside `GameRunResult` after the `bankruptRecovered` field:

```ts
    // Challenge
    /** True when this run was an async challenge (ADR-0003). Drives "Challenger". */
    challenge?: boolean;
```

Inside `ProgressionStats` after the `feats` field:

```ts
    /** Async challenge runs completed. Powers the Challenger family. */
    challengesPlayed: number;
```

- [ ] **Step 4: Seed and fold the counter in recordRun.ts**

In `defaultStats()` add after `feats: [],`:

```ts
        challengesPlayed: 0,
```

In `applyRun`, in the `const stats: ProgressionStats = { ... }` literal, add after `feats: [...feats],`:

```ts
        challengesPlayed: prev.challengesPlayed + (result.challenge ? 1 : 0),
```

(Legacy persisted records without the field are handled by `loadStats()`'s existing `{ ...defaultStats(), ...parsed }` merge — no migration.)

- [ ] **Step 5: Add the Challenger family**

In `src/game/progression/achievements.ts`, append to `ACHIEVEMENT_FAMILIES` after the `wheel-scorer` line:

```ts
    { family: 'challenger', axis: (s) => s.challengesPlayed, thresholds: [1, 10, 30] },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/game/progression --coverage=false`
Expected: PASS (all existing progression tests too — `defaultStats` now carries the new field, so no other test should break).

- [ ] **Step 7: Add the i18n copy (both locales)**

In `src/i18n/locales/en.json`, in `progression.family` add after `"wheel-scorer": "Letter Wheel Scorer"` (add a trailing comma to that line):

```json
            "challenger": "Challenger"
```

In `progression.requirement` add after `"wheel-scorer": "Score %{n} in a single Letter Wheel run"` (trailing comma likewise):

```json
            "challenger": {
                "one": "Play your first challenge",
                "other": "Play %{n} challenges"
            }
```

In `src/i18n/locales/pl.json`, in `progression.family` after `"wheel-scorer": "Wynik w Kole Liter"`:

```json
            "challenger": "Rywal"
```

In `progression.requirement` after `"wheel-scorer": …`:

```json
            "challenger": {
                "one": "Rozegraj pierwsze wyzwanie",
                "few": "Rozegraj %{n} wyzwania",
                "many": "Rozegraj %{n} wyzwań",
                "other": "Rozegraj %{n} wyzwań"
            }
```

(`TranslationContext` already registers the CLDR pl plural rule — one/few/many.)

- [ ] **Step 8: Pass `count` so plural requirement copy resolves**

The requirement string is rendered only in `src/components/molecules/AchievementDetailSheet.tsx:129-131`. i18n-js picks a plural form only when `count` is passed; existing families are plain strings and ignore it. Change:

```tsx
                                                        {t(`progression.requirement.${family.family}`, {
                                                            n: fmt(family.thresholds[i]),
                                                        })}
```

to:

```tsx
                                                        {t(`progression.requirement.${family.family}`, {
                                                            n: fmt(family.thresholds[i]),
                                                            count: family.thresholds[i],
                                                        })}
```

- [ ] **Step 9: Typecheck and full-suite sanity**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx jest src/game/progression src/components --coverage=false`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/game/progression/types.ts src/game/progression/recordRun.ts src/game/progression/achievements.ts src/game/progression/recordRun.test.ts src/components/molecules/AchievementDetailSheet.tsx src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(progression): challengesPlayed stat + Challenger achievement family"
```

---

### Task 2: Carry the full run result through ChallengeHandoff

**Files:**
- Modify: `src/game/challenge/ChallengeHandoff.tsx`
- Modify: `src/game/ladder/LadderPlayScreen.tsx:244-265`
- Modify: `src/game/drop/DropPlayScreen.tsx:275-292`
- Modify: `src/game/wheel/WheelPlayScreen.tsx:439-462`
- Test: `src/game/challenge/ChallengeHandoff.test.tsx` (new)

**Interfaces:**
- Consumes: `GameRunResult` from Task 1 (`../progression`).
- Produces: `ChallengeResult` now `{ progress: number; score: number; run: GameRunResult }`; `ChallengeHandoff` gains a required `run` prop. Task 4 reads `result.run`.

- [ ] **Step 1: Write the failing test**

Create `src/game/challenge/ChallengeHandoff.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ChallengeHandoff } from './ChallengeHandoff';
import type { GameRunResult } from '../progression';

const run: GameRunResult = { gameId: 'the-ladder', score: 1200, won: false, rungReached: 6 };

describe('ChallengeHandoff', () => {
    it('reports the full result exactly once, including the progression run', () => {
        const onComplete = jest.fn();
        const { rerender } = render(
            <ChallengeHandoff progress={6} score={1200} run={run} onComplete={onComplete} />,
        );
        rerender(<ChallengeHandoff progress={6} score={1200} run={run} onComplete={onComplete} />);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith({ progress: 6, score: 1200, run });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/challenge/ChallengeHandoff.test.tsx --coverage=false`
Expected: FAIL — TS error: `run` is not a known prop / not in `ChallengeResult`.

- [ ] **Step 3: Extend ChallengeHandoff**

In `src/game/challenge/ChallengeHandoff.tsx`, add the import at the top:

```ts
import type { GameRunResult } from '../progression';
```

Extend `ChallengeResult`:

```ts
export interface ChallengeResult {
    /** How far the run got — the leaderboard's primary ranking key. */
    progress: number;
    /** Unified points score — the tie-breaker. */
    score: number;
    /** The run's full progression facts — recorded by the Challenge orchestrator. */
    run: GameRunResult;
}
```

Extend the component (new `run` prop, forwarded in the report):

```tsx
export function ChallengeHandoff({
    progress,
    score,
    run,
    onComplete,
}: {
    progress: number;
    score: number;
    run: GameRunResult;
    onComplete: (result: ChallengeResult) => void;
}) {
    const reported = useRef(false);
    useEffect(() => {
        if (reported.current) return;
        reported.current = true;
        onComplete({ progress, score, run });
        // Report once; the score is fixed the moment the run ends.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}
```

(`ChallengePlay<TInitial>` is unchanged.)

- [ ] **Step 4: Hoist `runResult` above the challenge branch in each play screen**

`src/game/ladder/LadderPlayScreen.tsx` — the game-over block currently returns `ChallengeHandoff` before building `runResult`. Reorder so the same object serves both paths:

```tsx
        // Questions answered correctly drives the ranking: a Q1 miss is 0 (and so
        // never reaches the board), a win clears all RUN_LENGTH rungs.
        const correctAnswered = run.status === 'won' ? RUN_LENGTH : run.currentIndex;
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won: run.status === 'won',
            rungReached: reachedRung(run),
            lifelinesUsed: run.usedLifelines.length,
            quickWit: quickWit.current,
        };
        // Challenge mode hands the result to the Challenge orchestrator (submit +
        // reveal) instead of the normal game-over board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={correctAnswered}
                    score={breakdown.total}
                    run={runResult}
                    onComplete={challenge.onComplete}
                />
            );
        }
```

`src/game/drop/DropPlayScreen.tsx` — same reorder:

```tsx
        const breakdown = dropScore({ bank: state.bank, roundsSurvived, speed: survivalSpeed.current });
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won,
            finalBank: state.bank,
            roundsSurvived,
        };
        // Challenge mode reports the result to the orchestrator instead of the board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={roundsSurvived}
                    score={breakdown.total}
                    run={runResult}
                    onComplete={challenge.onComplete}
                />
            );
        }
```

`src/game/wheel/WheelPlayScreen.tsx` — same reorder:

```tsx
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won: game.status === 'over',
            puzzlesSolved: solvedCount.current,
            cleanPuzzles: cleanPuzzles.current,
            bankruptRecovered: bankruptRecovered.current,
        };
        // Challenge mode reports the result to the orchestrator instead of the board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={solvedCount.current}
                    score={breakdown.total}
                    run={runResult}
                    onComplete={challenge.onComplete}
                />
            );
        }
```

In each file the original `const runResult` declaration below the branch is removed (it moved up); everything else (GameOverView / game-over board usage of `runResult`) is untouched.

- [ ] **Step 5: Run test + typecheck**

Run: `npx jest src/game/challenge/ChallengeHandoff.test.tsx --coverage=false`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: one remaining class of errors is acceptable ONLY if it points at `ChallengeScreen.tsx` — it should NOT: `ChallengeScreen` only consumes `progress`/`score` from `ChallengeResult`, and widening the type doesn't break consumers. Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/challenge/ChallengeHandoff.tsx src/game/challenge/ChallengeHandoff.test.tsx src/game/ladder/LadderPlayScreen.tsx src/game/drop/DropPlayScreen.tsx src/game/wheel/WheelPlayScreen.tsx
git commit -m "feat(challenge): carry the full GameRunResult through the handoff"
```

---

### Task 3: Split RunCelebration into a reusable CelebrationCard

**Files:**
- Modify: `src/components/molecules/RunCelebration.tsx`
- Test: `src/components/molecules/__tests__/RunCelebration.test.tsx` (existing — must keep passing unchanged)

**Interfaces:**
- Consumes: nothing new.
- Produces: named export `CelebrationCard({ diff, accent }: { diff: RecordRunDiff; accent: string })` — the presentational celebration (XP bar, count-up, level flip + confetti, reward/achievement reveals, level-up analytics, review pre-prompt). Default export `RunCelebration({ result, accent })` unchanged in API and behavior. Task 4 imports `CelebrationCard`.

- [ ] **Step 1: Refactor**

In `src/components/molecules/RunCelebration.tsx`:

1. Rename the existing `function RunCelebration({ result, accent }: { result: GameRunResult; accent: string })` to:

```tsx
/** Presentational celebration for an already-recorded run diff. Rendered by
 * RunCelebration (offline, records itself) and by the Challenge results board
 * (which records via recordRun at run end and passes the diff in). */
export function CelebrationCard({ diff, accent }: { diff: RecordRunDiff; accent: string }) {
```

2. Inside it, delete the recording state and effect (diff now arrives as a prop):
   - `const [diff, setDiff] = useState<RecordRunDiff | null>(null);`
   - `const recorded = useRef(false);`
   - the entire `useLayoutEffect` block that calls `recordRun(result)` (with its comment)
   - the early return `if (!diff) return null;`

   Everything else (displayLevel seeding, level-up analytics effect, review prompt, rollover handler, JSX) stays byte-identical — it already only reads `diff`.

3. Add the recording wrapper above the styles, and keep the memoized default export:

```tsx
/**
 * Inline game-over celebration for offline runs: records the finished run
 * (exactly once) and renders the celebration card with the resulting diff.
 */
function RunCelebration({ result, accent }: { result: GameRunResult; accent: string }) {
    const [diff, setDiff] = useState<RecordRunDiff | null>(null);
    const recorded = useRef(false);

    // Persist the finished run as a real side effect (not in render) and exactly
    // once — the ref guards against a StrictMode setup/cleanup/setup double-call.
    // useLayoutEffect commits the diff before paint, so the card never flashes empty.
    useLayoutEffect(() => {
        if (recorded.current) return;
        recorded.current = true;
        setDiff(recordRun(result));
    }, [result]);

    if (!diff) return null;
    return <CelebrationCard diff={diff} accent={accent} />;
}

export default React.memo(RunCelebration);
```

4. Fix the top-of-file JSDoc position: the big comment currently above the component ("Inline game-over celebration: records the finished run…") describes the wrapper; move/merge as shown above. Keep all imports (`useState`, `useRef`, `useLayoutEffect`, `recordRun` are still used — by the wrapper).

- [ ] **Step 2: Run the existing tests to verify behavior is unchanged**

Run: `npx jest src/components/molecules/__tests__/RunCelebration.test.tsx --coverage=false`
Expected: PASS with zero test-file changes (the tests exercise the default export: records once, renders reveals).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/molecules/RunCelebration.tsx
git commit -m "refactor(celebration): split presentational CelebrationCard from the recording wrapper"
```

---

### Task 4: ChallengeScreen records the run and celebrates on the results board

**Files:**
- Modify: `src/screens/ChallengeScreen.tsx`
- Test: `src/screens/ChallengeScreen.test.tsx` (new)

**Interfaces:**
- Consumes: `ChallengeResult.run` (Task 2), `recordRun` + `challenge: true` flag (Task 1), `CelebrationCard` (Task 3).
- Produces: user-facing behavior only.

- [ ] **Step 1: Write the failing tests**

Create `src/screens/ChallengeScreen.test.tsx`. Mocks follow the house pattern of `src/screens/GameSetupScreen.challenge.test.tsx`:

```tsx
import React from 'react';
import {
    Pressable as MockPressable,
    Text as MockNativeText,
    TextInput as MockTextInput,
    View as MockView,
} from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChallengeScreen } from './ChallengeScreen';
import { getChallenge, getAttempt, getAttempts, submitAttempt } from '../game/challenge/store';
import { recordRun } from '../game/progression';
import type { GameRunResult, RecordRunDiff } from '../game/progression';
import type { ChallengeRecord } from '../game/challenge/types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        addListener: jest.fn(() => jest.fn()),
        setParams: jest.fn(),
    }),
    useRoute: () => ({ params: { challengeId: 'c1' } }),
    useFocusEffect: () => undefined,
}));

jest.mock('lucide-react-native', () => ({
    Swords: () => null,
    Crown: () => null,
}));

jest.mock('../game/transitions', () => ({
    springEnter: () => undefined,
}));

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../responsive/useResponsive', () => ({
    useResponsive: () => ({ tabletColumn: {}, iconSize: (n: number) => n, scale: (n: number) => n }),
}));

jest.mock('../components/atoms/Text', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockNativeText>{children}</MockNativeText>,
}));

jest.mock('../components/atoms/Stack', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/Card', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/Button', () => ({
    __esModule: true,
    default: ({ children, onPress, disabled }: any) => (
        <MockPressable onPress={disabled ? undefined : onPress} disabled={disabled}>
            <MockNativeText>{children}</MockNativeText>
        </MockPressable>
    ),
}));

jest.mock('../components/molecules/Input', () => ({
    __esModule: true,
    default: ({ value, onChangeText, placeholder }: any) => (
        <MockTextInput value={value} onChangeText={onChangeText} placeholder={placeholder} />
    ),
}));

jest.mock('../theme', () => ({
    useTheme: () => ({
        colors: {
            primary: '#ff00ff',
            secondary: '#00ff00',
            success: '#00ffaa',
            border: '#333333',
            text: '#ffffff',
            textMuted: '#888888',
            textSecondary: '#aaaaaa',
        },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        radii: { sm: 8, md: 12, lg: 16 },
        typography: { sm: 14, lineHeight: { sm: 20 }, fontFamily: {} },
    }),
}));

jest.mock('../theme/colorUtils', () => ({
    hexToRgba: (color: string) => color,
    readableOn: () => '#ffffff',
    resolveAccent: () => '#ff00ff',
}));

jest.mock('../i18n/TranslationContext', () => ({
    useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../hooks/store/useStore', () => ({
    useStore: () => ({ purchasedItemIds: [] }),
}));

jest.mock('../hooks/useSound', () => ({
    useSound: () => ({ play: jest.fn() }),
}));

jest.mock('../hooks/useHaptics', () => ({
    useHaptics: () => ({ notification: jest.fn(), heavy: jest.fn() }),
}));

jest.mock('../utils/firebase/init', () => ({
    SafeAnalytics: { logEvent: jest.fn() },
}));

jest.mock('../utils/sentry/init', () => ({
    SafeSentry: { captureException: jest.fn(), captureMessage: jest.fn() },
}));

jest.mock('../game/mascot/Mascot', () => ({
    Mascot: () => null,
}));

jest.mock('../game/mascot/reactions/useMascotDirector', () => ({
    useMascotEmit: () => jest.fn(),
}));

jest.mock('../game/challenge/deviceId', () => ({
    getDeviceId: () => 'my-device',
}));

jest.mock('../game/challenge/nickname', () => ({
    getChallengeNickname: () => 'Ada',
    setChallengeNickname: () => true,
}));

jest.mock('../game/challenge/store', () => ({
    getChallenge: jest.fn(),
    getAttempt: jest.fn(),
    getAttempts: jest.fn(),
    submitAttempt: jest.fn(),
    BlockedError: class BlockedError extends Error {},
}));

jest.mock('../game/challenge/log', () => ({
    recordChallenge: jest.fn(),
    markChallengePlayed: jest.fn(),
}));

jest.mock('../game/challenge/share', () => ({
    shareChallenge: jest.fn(),
}));

jest.mock('../game/challenge/autoShare', () => ({
    registerAutoShareAfterTransition: jest.fn(() => undefined),
}));

jest.mock('../game/ranking/push', () => ({
    pushRanking: jest.fn(() => Promise.resolve()),
}));

jest.mock('../game/challenge/resolve', () => ({
    gateChallenge: jest.fn(() => 'live'),
    missingContentIds: jest.fn(() => []),
    ladderRunFromRecord: jest.fn(() => ({})),
    dropStateFromRecord: jest.fn(() => ({})),
    wheelGameFromRecord: jest.fn(() => ({})),
    ownedQuestionIds: jest.fn(() => new Set<string>()),
}));

const RUN: GameRunResult = { gameId: 'the-ladder', score: 1200, won: false, rungReached: 6 };

// The play screen stand-in exposes a FINISH button that reports the run,
// standing in for ChallengeHandoff at the end of a real run.
jest.mock('../game/ladder/LadderPlayScreen', () => ({
    __esModule: true,
    default: ({ challenge }: any) => (
        <MockPressable onPress={() => challenge.onComplete({ progress: 6, score: 1200, run: RUN })}>
            <MockNativeText>FINISH</MockNativeText>
        </MockPressable>
    ),
}));
jest.mock('../game/drop/DropPlayScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../game/wheel/WheelPlayScreen', () => ({ __esModule: true, default: () => null }));

const DIFF: RecordRunDiff = {
    xpGained: 150,
    lifetimeXp: 500,
    leveledUp: false,
    previousLevel: 3,
    level: 3,
    newRewards: [],
    newAchievements: [],
    bonusRunsGranted: 0,
};

jest.mock('../game/progression', () => ({
    ...jest.requireActual('../game/progression'),
    recordRun: jest.fn(),
}));

jest.mock('../components/molecules/RunCelebration', () => ({
    __esModule: true,
    default: () => null,
    CelebrationCard: () => <MockNativeText>CELEBRATION</MockNativeText>,
}));

const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-ladder',
    questions: [],
    createdBy: { uuid: 'creator-device', nickname: 'Bob' },
    expiresAt: Date.now() + 86_400_000,
    mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
} as unknown as ChallengeRecord;

const myAttempt = { nickname: 'Ada', progress: 6, score: 1200, timestamp: 111 };

async function playThrough(screen: ReturnType<typeof render>) {
    await waitFor(() => screen.getByText('challenge.start'));
    fireEvent.press(screen.getByText('challenge.start'));
    fireEvent.press(await screen.findByText('FINISH'));
}

describe('ChallengeScreen progression', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getChallenge as jest.Mock).mockResolvedValue(record);
        (getAttempts as jest.Mock).mockResolvedValue([myAttempt]);
        (recordRun as jest.Mock).mockReturnValue(DIFF);
    });

    it('records the run once with the challenge flag and celebrates on the results board', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(null);
        (submitAttempt as jest.Mock).mockResolvedValue(undefined);

        const screen = render(<ChallengeScreen />);
        await playThrough(screen);

        await waitFor(() => screen.getByText('CELEBRATION'));
        expect(recordRun).toHaveBeenCalledTimes(1);
        expect(recordRun).toHaveBeenCalledWith({ ...RUN, challenge: true });
        expect(submitAttempt).toHaveBeenCalledTimes(1);
    });

    it('keeps the XP on a failed submit and does not re-record on retry', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(null);
        (submitAttempt as jest.Mock)
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(undefined);

        const screen = render(<ChallengeScreen />);
        await playThrough(screen);

        // Submit failed offline → retry screen; XP was already recorded.
        await waitFor(() => screen.getByText('challenge.retry'));
        expect(recordRun).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByText('challenge.retry'));
        await waitFor(() => screen.getByText('CELEBRATION'));
        expect(recordRun).toHaveBeenCalledTimes(1);
        expect(submitAttempt).toHaveBeenCalledTimes(2);
    });

    it('does not record or celebrate when reopening an already-played challenge', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(myAttempt);

        const screen = render(<ChallengeScreen />);
        await waitFor(() => screen.getByText('challenge.youWin'));

        expect(recordRun).not.toHaveBeenCalled();
        expect(screen.queryByText('CELEBRATION')).toBeNull();
    });
});
```

Note on the third test's assertion: with a single attempt the board shows the waiting state — the headline key is `challenge.waiting`, not `challenge.youWin`. Use `challenge.waiting`:

```tsx
        await waitFor(() => screen.getByText('challenge.waiting'));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/screens/ChallengeScreen.test.tsx --coverage=false`
Expected: FAIL — `recordRun` never called, no `CELEBRATION` text (CelebrationCard not rendered by ChallengeScreen yet).

- [ ] **Step 3: Wire recording + celebration into ChallengeScreen**

In `src/screens/ChallengeScreen.tsx`:

1. Add imports:

```ts
import { recordRun, type RecordRunDiff } from '../game/progression';
import { CelebrationCard } from '../components/molecules/RunCelebration';
```

2. Add state next to the other `useState` calls:

```ts
    const [celebrationDiff, setCelebrationDiff] = useState<RecordRunDiff | null>(null);
```

3. Replace `handleComplete`:

```ts
    const handleComplete = useCallback(
        (result: ChallengeResult) => {
            // Bank the run's XP/achievements the moment it ends, before the submit:
            // a failed or abandoned submit never loses them, and submit retries
            // (which re-enter submit, not this callback) can't double-record.
            setCelebrationDiff(recordRun({ ...result.run, challenge: true }));
            return submit(result);
        },
        [submit],
    );
```

4. Pass the diff to the results board — change the `ResultsCard` call site:

```tsx
                ) : phase === 'results' && record ? (
                    <ResultsCard
                        record={record}
                        attempts={attempts}
                        myTimestamp={myTimestamp}
                        celebrationDiff={celebrationDiff}
                        onExit={exit}
                        t={t}
                        locale={locale}
                    />
                ) : null}
```

5. Extend `ResultsCard` — add the prop and render the card between the ranked rows and the Home button:

```tsx
function ResultsCard({
    record,
    attempts,
    myTimestamp,
    celebrationDiff,
    onExit,
    t,
    locale,
}: {
    record: ChallengeRecord;
    attempts: LeaderboardEntry[];
    myTimestamp: number | null;
    /** Set only in the session where the run just finished — reopened links never celebrate. */
    celebrationDiff: RecordRunDiff | null;
    onExit: () => void;
    t: (key: string, options?: Record<string, unknown>) => string;
    locale: string;
}) {
```

and in its JSX, after the closing `</Stack>` of the attempts list and before the Home `<Button …>`:

```tsx
                {celebrationDiff ? <CelebrationCard diff={celebrationDiff} accent={accent} /> : null}
```

- [ ] **Step 4: Run the new tests**

Run: `npx jest src/screens/ChallengeScreen.test.tsx --coverage=false`
Expected: PASS (3 tests).

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx jest --coverage=false`
Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ChallengeScreen.tsx src/screens/ChallengeScreen.test.tsx
git commit -m "feat(challenge): award XP and achievements for challenge runs"
```

---

## Self-Review Notes

- **Spec coverage:** §1 data flow → Task 2; §2 recording seam → Task 4; §3 stat + family + i18n → Task 1; §4 celebration split/placement → Tasks 3+4; §5 out-of-scope respected (no won/created achievements, no game-services, no submission changes); §6 tests → Tasks 1, 2, 4 (RunCelebration regression covered by existing suite in Task 3).
- **Type consistency:** `ChallengeResult.run: GameRunResult` (Task 2) is what Task 4 spreads into `recordRun({ ...result.run, challenge: true })`; `challengesPlayed: number` (required, seeded by `defaultStats`) matches the family axis `(s) => s.challengesPlayed`.
- **Known judgment call:** `CelebrationCard`'s level-up analytics and review prompt now also fire for challenge runs — intended (parity), noted in the spec §4.
