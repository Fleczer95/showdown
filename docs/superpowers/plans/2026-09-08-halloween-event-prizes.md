# Halloween Event Prizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the Halloween event's prizes from "complete N runs, get a fixed prize" to "win N head-to-head rounds, get a prize drawn at random from a pool without repeats", and add a rehearsal edition so two internal-track devices can test it before October.

**Architecture:** Everything is on-device. `GET /challenges/:id/attempts` already returns both players' attempts to either player, so the win comparison is a pure function over data the results screen already fetches. Wins are stored as a set of challenge ids (idempotent, crash-safe, union-mergeable), and the prize draw is a pure function of the player id, edition and pool, so two devices that diverge and later merge compute the same prize. **No Cloudflare Worker changes.**

**Tech Stack:** React Native (Expo), TypeScript strict, MMKV via `deviceStore`, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-08-halloween-event-prizes-design.md`

## Global Constraints

- **No Worker changes.** `server/` is out of scope. `npm --prefix server run typecheck` and `npm run test:events:d1` must stay green but must not need edits.
- **Progression merge doctrine** (`src/game/progression/merge.ts` header): *"EVERY field merges with max or union — nothing sums."* A summed counter doubles on every cloud restore. Any new stats field must merge by `union` or `maxByKey`.
- **Earned cosmetics stay out of `STORE_CATALOG`** (`themes.ts` / `mascotColors.ts` headers): no SKU, no IAP flow, no `is_paying_user` contamination.
- **New reward ids must have no `LEVEL_MAP` node**, or levelling would grant them.
- **Bilingual:** every new user-facing string needs an `en.json` and a `pl.json` entry. `npm run i18n:check` must pass.
- **A draw is not a win.** A genuine tie on `progress` AND `score` crowns nobody.
- `winsPerPrize` for Halloween is **13**. Free players get 3 plays/day (21 over 7 days); Premium gets 13/day (91), so at most 7 draws.
- Verification for every task: `npm run type-check`, then the task's Jest command. Full suite (`npx jest --runInBand --coverage=false`) before the final commit. Baseline is **111 suites / 1064 tests**.

---

### Task 1: Deterministic prize draw

Pure module, no dependencies on anything else in this plan. Build it first so later tasks can call it.

**Files:**
- Create: `src/game/events/draw.ts`
- Test: `src/game/events/draw.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `seededIndex(seed: string, count: number): number`
  - `drawPrizes(input: DrawInput): { grantId: string; rewardId: string }[]`
  - `interface DrawInput { deviceId: string; editionId: string; pool: readonly string[]; winsPerPrize: number; wins: number; grantedDraws: readonly string[]; alreadyEarned: readonly string[] }`

**Note on the algorithm:** the spec described recomputing draws 1..d-1 to build the exclusion set. That is unnecessary — a reward from an earlier draw is already in `earnedRewardIds`, which arrives as `alreadyEarned`. Filtering the pool by `alreadyEarned` covers it, and also correctly excludes a pool item the player somehow obtained another way.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/events/draw.test.ts
import { drawPrizes, seededIndex } from './draw';

const POOL = ['a-fur', 'b-suit', 'c-accent', 'd-mic'];
const base = {
    deviceId: 'device-1',
    editionId: 'halloween-2026',
    pool: POOL,
    winsPerPrize: 13,
    grantedDraws: [] as string[],
    alreadyEarned: [] as string[],
};

test('no draw below the threshold', () => {
    expect(drawPrizes({ ...base, wins: 12 })).toEqual([]);
});

test('one draw at the threshold, identified by draw number', () => {
    const out = drawPrizes({ ...base, wins: 13 });
    expect(out).toHaveLength(1);
    expect(out[0].grantId).toBe('halloween-2026/draw-1');
    expect(POOL).toContain(out[0].rewardId);
});

test('the same player and edition always draw the same sequence', () => {
    const a = drawPrizes({ ...base, wins: 39 });
    const b = drawPrizes({ ...base, wins: 39 });
    expect(a).toEqual(b);
});

test('different players can draw different prizes', () => {
    const mine = drawPrizes({ ...base, wins: 13 })[0].rewardId;
    const theirs = drawPrizes({ ...base, deviceId: 'device-2', wins: 13 })[0].rewardId;
    // Not a guarantee for any single pair, but these two seeds must differ.
    expect(mine === theirs && base.pool.length > 1).toBe(false);
});

test('a prize is never drawn twice', () => {
    const out = drawPrizes({ ...base, wins: 52 });
    const ids = out.map((d) => d.rewardId);
    expect(new Set(ids).size).toBe(ids.length);
});

test('an exhausted pool grants nothing and does not throw', () => {
    expect(drawPrizes({ ...base, wins: 130, alreadyEarned: POOL })).toEqual([]);
    expect(drawPrizes({ ...base, wins: 130 })).toHaveLength(POOL.length);
});

test('already-granted draws are skipped, not re-rolled', () => {
    const first = drawPrizes({ ...base, wins: 13 })[0];
    const next = drawPrizes({
        ...base,
        wins: 26,
        grantedDraws: [first.grantId],
        alreadyEarned: [first.rewardId],
    });
    expect(next).toHaveLength(1);
    expect(next[0].grantId).toBe('halloween-2026/draw-2');
    expect(next[0].rewardId).not.toBe(first.rewardId);
});

test('pool declaration order does not change the result', () => {
    const forward = drawPrizes({ ...base, wins: 13 })[0].rewardId;
    const reversed = drawPrizes({ ...base, pool: [...POOL].reverse(), wins: 13 })[0].rewardId;
    expect(reversed).toBe(forward);
});

test('seededIndex stays in range and returns -1 for an empty pool', () => {
    for (let i = 0; i < 50; i++) {
        const n = seededIndex(`seed-${i}`, 4);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(4);
    }
    expect(seededIndex('seed', 0)).toBe(-1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/events/draw.test.ts --runInBand --coverage=false`
Expected: FAIL — `Cannot find module './draw'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/game/events/draw.ts

/**
 * Prize selection is a pure function of the player, the edition and the pool —
 * never a call to Math.random. Two devices that diverge offline and merge later
 * must compute the SAME prize for the same draw, or the union merge in
 * mergeStats would hand the player two prizes for one goal.
 */

export interface DrawInput {
    deviceId: string;
    editionId: string;
    pool: readonly string[];
    winsPerPrize: number;
    wins: number;
    /** Grant identities already recorded in `eventRewardGrants`. */
    grantedDraws: readonly string[];
    /** `earnedRewardIds` — a pool item in here is never drawn again. */
    alreadyEarned: readonly string[];
}

/** FNV-1a, reduced to an index. Stable across devices and app versions. */
export function seededIndex(seed: string, count: number): number {
    if (count <= 0) return -1;
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % count;
}

/** Grant identity for the nth prize of an edition. */
export function drawIdentity(editionId: string, draw: number): string {
    return `${editionId}/draw-${draw}`;
}

/** The prizes owed for `wins` that have not been granted yet. */
export function drawPrizes(input: DrawInput): { grantId: string; rewardId: string }[] {
    const { deviceId, editionId, pool, winsPerPrize, wins } = input;
    if (winsPerPrize < 1) return [];
    const granted = new Set(input.grantedDraws);
    const taken = new Set(input.alreadyEarned);
    const out: { grantId: string; rewardId: string }[] = [];
    for (let draw = 1; draw <= Math.floor(wins / winsPerPrize); draw++) {
        const grantId = drawIdentity(editionId, draw);
        // An already-granted draw's reward is in `taken`, so it stays excluded.
        if (granted.has(grantId)) continue;
        // Sorted so the outcome cannot depend on how the pool was declared.
        const remaining = [...pool].filter((id) => !taken.has(id)).sort();
        if (remaining.length === 0) break;
        const rewardId = remaining[seededIndex(`${deviceId}:${editionId}:${draw}`, remaining.length)];
        taken.add(rewardId);
        out.push({ grantId, rewardId });
    }
    return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/events/draw.test.ts --runInBand --coverage=false`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
npm run type-check
git add src/game/events/draw.ts src/game/events/draw.test.ts
git commit -m "feat(events): deterministic prize draw without replacement"
```

---

### Task 2: One shared "did I win" comparison

`ChallengeScreen`'s `ResultsCard` derives the verdict inline. Prize accounting needs the same verdict, and a second copy would drift — the earlier review already found `ResultsCard` recomputing the rematch rule independently. Extract it once.

**Files:**
- Create: `src/game/challenge/outcome.ts`
- Test: `src/game/challenge/outcome.test.ts`
- Modify: `src/screens/ChallengeScreen.tsx:976-983` (the `waiting` / `winner` / `isTopTie` / `draw` / `youWon` block inside `ResultsCard`)

**Interfaces:**
- Consumes: `LeaderboardEntry` from `src/game/leaderboard.ts` (`{ nickname: string; progress: number; score: number; timestamp: number }`).
- Produces:
  - `type ChallengeOutcome = 'won' | 'lost' | 'draw' | 'pending'`
  - `challengeOutcome(attempts: readonly LeaderboardEntry[], myTimestamp: number | null): ChallengeOutcome`

`attempts` must already be ranked best-first, which is how `ResultsCard` receives them today.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/challenge/outcome.test.ts
import { challengeOutcome } from './outcome';
import type { LeaderboardEntry } from '../leaderboard';

const entry = (progress: number, score: number, timestamp: number): LeaderboardEntry => ({
    nickname: 'P',
    progress,
    score,
    timestamp,
});

test('one attempt is still pending — nobody to beat yet', () => {
    expect(challengeOutcome([entry(5, 500, 100)], 100)).toBe('pending');
});

test('no attempts at all is pending', () => {
    expect(challengeOutcome([], 100)).toBe('pending');
});

test('an unplayed device is pending even with two attempts', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], null)).toBe('pending');
});

test('the top attempt wins when it is mine', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], 200)).toBe('won');
});

test('the top attempt wins when it is theirs', () => {
    expect(challengeOutcome([entry(9, 900, 200), entry(5, 500, 100)], 100)).toBe('lost');
});

test('equal progress and equal score is a draw, not a win', () => {
    expect(challengeOutcome([entry(5, 500, 100), entry(5, 500, 200)], 100)).toBe('draw');
    expect(challengeOutcome([entry(5, 500, 100), entry(5, 500, 200)], 200)).toBe('draw');
});

test('a zero-zero round is a draw for both players', () => {
    expect(challengeOutcome([entry(0, 0, 100), entry(0, 0, 200)], 100)).toBe('draw');
});

test('equal progress but a higher score is a win', () => {
    expect(challengeOutcome([entry(5, 700, 200), entry(5, 500, 100)], 200)).toBe('won');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/challenge/outcome.test.ts --runInBand --coverage=false`
Expected: FAIL — `Cannot find module './outcome'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/game/challenge/outcome.ts
import type { LeaderboardEntry } from '../leaderboard';

export type ChallengeOutcome = 'won' | 'lost' | 'draw' | 'pending';

/**
 * The verdict for one async round. `attempts` must be ranked best-first.
 *
 * A genuine tie on the ranking key (same progress AND same score) is a draw,
 * not a win — the timestamp tiebreak in rankEntries only fixes row order, it
 * shouldn't crown anyone (e.g. both players score 0). Applies to every game.
 */
export function challengeOutcome(
    attempts: readonly LeaderboardEntry[],
    myTimestamp: number | null,
): ChallengeOutcome {
    // One attempt means this device is the only one that has played — there is
    // no opponent to beat yet.
    if (myTimestamp === null || attempts.length <= 1) return 'pending';
    const winner = attempts[0];
    const runnerUp = attempts[1];
    if (runnerUp.progress === winner.progress && runnerUp.score === winner.score) return 'draw';
    return winner.timestamp === myTimestamp ? 'won' : 'lost';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/challenge/outcome.test.ts --runInBand --coverage=false`
Expected: PASS — 8 tests.

- [ ] **Step 5: Rewire ResultsCard to the shared function**

In `src/screens/ChallengeScreen.tsx`, replace the block that currently reads:

```tsx
    const waiting = attempts.length <= 1;
    const winner = attempts[0];
    // A genuine tie on the ranking key (same progress AND same score) is a draw,
    // not a win — the timestamp tiebreak in rankEntries only fixes row order, it
    // shouldn't crown anyone (e.g. both players score 0). Applies to every game.
    const isTopTie = (e: LeaderboardEntry) => !!winner && e.progress === winner.progress && e.score === winner.score;
    const draw = !waiting && !!attempts[1] && isTopTie(attempts[1]);
    const youWon = !waiting && !draw && winner && myTimestamp !== null && winner.timestamp === myTimestamp;
```

with:

```tsx
    const waiting = attempts.length <= 1;
    const winner = attempts[0];
    const outcome = challengeOutcome(attempts, myTimestamp);
    const draw = outcome === 'draw';
    const youWon = outcome === 'won';
```

Add the import beside the other `src/game/challenge` imports:

```tsx
import { challengeOutcome } from '../game/challenge/outcome';
```

If `LeaderboardEntry` is now unused in `ChallengeScreen.tsx`, drop it from its import; if other code in the file still uses it, leave it.

- [ ] **Step 6: Run the screen's tests to verify no behaviour change**

Run: `npx jest src/screens/ChallengeScreen.test.tsx --runInBand --coverage=false`
Expected: PASS, unchanged count.

- [ ] **Step 7: Commit**

```bash
npm run type-check
npx eslint src/screens/ChallengeScreen.tsx src/game/challenge/outcome.ts
git add src/game/challenge/outcome.ts src/game/challenge/outcome.test.ts src/screens/ChallengeScreen.tsx
git commit -m "refactor(challenge): extract one shared round outcome function"
```

---

### Task 3: Record the outcome on the challenge stub

**Files:**
- Modify: `src/game/challenge/log.ts` — add `outcome?: ChallengeOutcome` to `ChallengeStub` (after `opponentJoined`, line 43), and add a writer beside `markChallengeOpponentPlayed` (line 140)
- Test: `src/game/challenge/log.test.ts` (append; create with the imports below if absent)

**Interfaces:**
- Consumes: `ChallengeOutcome` from Task 2.
- Produces: `markChallengeOutcome(id: string, outcome: ChallengeOutcome): void` — writes once and never overwrites a settled verdict.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/challenge/log.test.ts
import { markChallengeOutcome, recordChallenge, listChallenges } from './log';

test('an outcome is written once and never overwritten', () => {
    recordChallenge({
        id: 'round-1',
        game: 'the-ladder',
        role: 'created',
        opponent: '',
        played: true,
        expiresAt: Date.now() + 100000,
        eventId: 'halloween-2026',
    });
    markChallengeOutcome('round-1', 'won');
    expect(listChallenges().find((s) => s.id === 'round-1')?.outcome).toBe('won');

    // A settled verdict is immutable — a later sync must not flip it.
    markChallengeOutcome('round-1', 'lost');
    expect(listChallenges().find((s) => s.id === 'round-1')?.outcome).toBe('won');
});

test('pending is not stored as a verdict', () => {
    recordChallenge({
        id: 'round-2',
        game: 'the-ladder',
        role: 'created',
        opponent: '',
        played: true,
        expiresAt: Date.now() + 100000,
        eventId: 'halloween-2026',
    });
    markChallengeOutcome('round-2', 'pending');
    expect(listChallenges().find((s) => s.id === 'round-2')?.outcome).toBeUndefined();
});

test('an unknown challenge id is ignored', () => {
    expect(() => markChallengeOutcome('nope', 'won')).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/challenge/log.test.ts --runInBand --coverage=false`
Expected: FAIL — `markChallengeOutcome is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to the `ChallengeStub` interface after `opponentJoined?: boolean;`:

```ts
    /** Settled head-to-head verdict. Absent until the opponent's score is readable. */
    outcome?: ChallengeOutcome;
```

Add the import at the top of `log.ts`:

```ts
import type { ChallengeOutcome } from './outcome';
```

Add after `markChallengeOpponentPlayed`:

```ts
/**
 * Settle the head-to-head verdict. Write-once: prize progress counts wins from
 * these stubs, so a later sync must never flip a verdict and re-open a grant.
 */
export function markChallengeOutcome(id: string, outcome: ChallengeOutcome): void {
    if (outcome === 'pending') return;
    const map = readAll();
    const stub = map[id];
    if (!stub || stub.outcome) return;
    map[id] = { ...stub, outcome, updatedAt: Date.now() };
    writeAll(map);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/challenge/log.test.ts --runInBand --coverage=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run type-check
git add src/game/challenge/log.ts src/game/challenge/log.test.ts
git commit -m "feat(challenge): store the settled head-to-head verdict on the stub"
```

---

### Task 4: Win tally in progression stats

**Files:**
- Modify: `src/game/progression/types.ts:71` (beside `earnedRewardIds`)
- Modify: `src/game/progression/defaults.ts:19-22`
- Modify: `src/game/progression/merge.ts` — `preservesProgress` (near line 56) and `mergeStats` (near line 85)
- Test: `src/game/progression/merge.test.ts` (append)

**Interfaces:**
- Produces: `ProgressionStats.eventWinIds?: Record<string, string[]>` — edition id → challenge ids won. The count is the array length.

**Why a set of ids, not a counter:** re-resolving the same challenge is then a no-op, a crash between the log write and the stats write cannot double-count, and cloud restore merges by union — which is the correct semantics for wins earned on two devices. A counter would violate the module's own doctrine that nothing sums.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/progression/merge.test.ts
test('event wins union across devices without double counting', () => {
    const a = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c1', 'c2'] } };
    const b = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c2', 'c3'] } };
    const merged = mergeStats(a, b);
    expect(merged.eventWinIds?.['halloween-2026']).toEqual(['c1', 'c2', 'c3']);
    expect(preservesProgress(a, merged)).toBe(true);
    expect(preservesProgress(b, merged)).toBe(true);
});

test('merging is idempotent for event wins', () => {
    const a = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c1'] } };
    expect(mergeStats(a, mergeStats(a, a))).toEqual(mergeStats(a, a));
});

test('dropping an event win fails the progress tripwire', () => {
    const prev = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c1', 'c2'] } };
    const next = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c1'] } };
    expect(preservesProgress(prev, next)).toBe(false);
});

test('an old save with no event wins merges cleanly', () => {
    const old = defaultStats();
    const withWins = { ...defaultStats(), eventWinIds: { 'halloween-2026': ['c1'] } };
    expect(mergeStats(old, withWins).eventWinIds?.['halloween-2026']).toEqual(['c1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/progression/merge.test.ts --runInBand --coverage=false`
Expected: FAIL — `eventWinIds` is not a known property / merged value is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `types.ts`, after `earnedRewardIds?: string[];`:

```ts
    /** Challenge ids won per edition. The count is the length; unions cleanly. */
    eventWinIds?: Record<string, string[]>;
```

In `defaults.ts`, after `earnedRewardIds: [],`:

```ts
        eventWinIds: {},
```

In `merge.ts`, add a helper beside `maxByKey`:

```ts
function unionByKey(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
    const out: Record<string, string[]> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = union(out[key] ?? [], value);
    return out;
}
```

In `preservesProgress`, beside the `eventCompletedRuns` loop:

```ts
    for (const [id, won] of Object.entries(prev.eventWinIds ?? {})) {
        const kept = new Set(next.eventWinIds?.[id] ?? []);
        if (won.some((challengeId) => !kept.has(challengeId))) return false;
    }
```

In the object `mergeStats` returns, after `earnedRewardIds`:

```ts
        eventWinIds: unionByKey(a.eventWinIds ?? {}, b.eventWinIds ?? {}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/progression/merge.test.ts --runInBand --coverage=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run type-check
git add src/game/progression/types.ts src/game/progression/defaults.ts src/game/progression/merge.ts src/game/progression/merge.test.ts
git commit -m "feat(progression): track event wins as a union-mergeable id set"
```

---

### Task 5: The Halloween prize pool

Six mascot colours plus one theme, all event-only.

**Files:**
- Modify: `src/game/mascot/look.ts:41-60` (the per-slot swatch lists)
- Modify: `src/game/progression/mascotColors.ts:20-27`
- Modify: `src/game/progression/themes.ts:20-35`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/pl.json`
- Test: `src/game/events/prizePool.test.ts` (create)

**Interfaces:**
- Produces the seven reward ids: `mascot-fur-pumpkin`, `mascot-fur-blackcat`, `mascot-suit-witch`, `mascot-accent-slime`, `mascot-accent-blood`, `mascot-mic-bone`, `theme-haunt`.

**Caveat carried from the spec:** `EARNED_MASCOT_COLOR_IDS` is exported from `mascotColors.ts` and its comment claims it excludes earned colours from the purchasable bundle, but nothing currently imports it. Adding colours there will not by itself keep them out of any bundle. Do not remove it; it is pre-existing.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/events/prizePool.test.ts
import { PROGRESSION_MASCOT_COLORS } from '../progression/mascotColors';
import { PROGRESSION_THEMES } from '../progression/themes';
import { MASCOT_PALETTE } from '../mascot/look';
import { eventRewardTitleKey } from './access';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';

const POOL = [
    'mascot-fur-pumpkin',
    'mascot-fur-blackcat',
    'mascot-suit-witch',
    'mascot-accent-slime',
    'mascot-accent-blood',
    'mascot-mic-bone',
    'theme-haunt',
];

const lookup = (source: object, key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);

test('every pool reward resolves to a title key present in both locales', () => {
    for (const id of POOL) {
        const key = eventRewardTitleKey(id);
        expect(key).toBeDefined();
        expect(lookup(en, key!)).toEqual(expect.any(String));
        expect(lookup(pl, key!)).toEqual(expect.any(String));
    }
});

test('each new mascot colour has a swatch in its slot', () => {
    for (const reward of PROGRESSION_MASCOT_COLORS.filter((c) => POOL.includes(c.id))) {
        const swatches = MASCOT_PALETTE[reward.slot].map((c) => c.id);
        expect(swatches).toContain(reward.colorId);
    }
});

test('the haunt theme is bound and event-only', () => {
    const haunt = PROGRESSION_THEMES.find((t) => t.id === 'theme-haunt');
    expect(haunt).toBeDefined();
    expect(haunt!.value).toBe('haunt');
    expect(haunt!.tokens).toBeDefined();
});

test('no pool reward is sold in the store', async () => {
    const { STORE_CATALOG } = await import('../../data/store/catalog');
    const sold = new Set(STORE_CATALOG.map((entry: { id: string }) => entry.id));
    for (const id of POOL) expect(sold.has(id)).toBe(false);
});
```

`MASCOT_PALETTE` (`src/game/mascot/look.ts:39`) is `Record<MascotSlot, MascotSwatch[]>`, so each new swatch goes into `MASCOT_PALETTE[slot]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/events/prizePool.test.ts --runInBand --coverage=false`
Expected: FAIL — title keys undefined, swatches missing, `theme-haunt` not found.

- [ ] **Step 3: Add the swatches**

In `src/game/mascot/look.ts`, append to the matching slot lists:

```ts
        { id: 'fur.pumpkin', hex: '#EA580C' },
        { id: 'fur.blackcat', hex: '#1C1917' },
        { id: 'suit.witch', hex: '#4C1D95' },
        { id: 'accent.slime', hex: '#84CC16' },
        { id: 'accent.blood', hex: '#7F1D1D' },
        { id: 'mic.bone', hex: '#E7E5E4' },
```

Each goes in its own slot's array, matching the surrounding formatting.

- [ ] **Step 4: Bind the mascot colour rewards**

In `src/game/progression/mascotColors.ts`, extend `PROGRESSION_MASCOT_COLORS`:

```ts
    { id: 'mascot-fur-pumpkin', slot: 'fur', colorId: 'fur.pumpkin', titleKey: 'events.prizes.pumpkinFur' },
    { id: 'mascot-fur-blackcat', slot: 'fur', colorId: 'fur.blackcat', titleKey: 'events.prizes.blackCatFur' },
    { id: 'mascot-suit-witch', slot: 'suit', colorId: 'suit.witch', titleKey: 'events.prizes.witchSuit' },
    { id: 'mascot-accent-slime', slot: 'accent', colorId: 'accent.slime', titleKey: 'events.prizes.slimeAccent' },
    { id: 'mascot-accent-blood', slot: 'accent', colorId: 'accent.blood', titleKey: 'events.prizes.bloodAccent' },
    { id: 'mascot-mic-bone', slot: 'mic', colorId: 'mic.bone', titleKey: 'events.prizes.boneMic' },
```

Do not add `LEVEL_MAP` nodes for these ids.

- [ ] **Step 5: Bind the theme**

In `src/game/progression/themes.ts`, import `magmaTheme` alongside the existing theme imports and append:

```ts
    {
        id: 'theme-haunt',
        value: 'haunt',
        titleKey: 'events.prizes.hauntTheme',
        iconName: 'moon',
        accentColor: '#EA580C',
        tokens: magmaTheme,
    },
```

`magmaTheme` is already exported from `src/theme/themes/index.ts` and bound to nothing. `moon` is an existing `ICON_MAP` key in `src/theme/registry.ts`. `themeRegistry` maps all of `PROGRESSION_THEMES`, so the picker entry appears automatically.

- [ ] **Step 6: Add the copy**

`src/i18n/locales/en.json`, under `events`:

```json
      "prizes": {
        "pumpkinFur": "Pumpkin fur",
        "blackCatFur": "Black cat fur",
        "witchSuit": "Witch's cloak",
        "slimeAccent": "Slime green",
        "bloodAccent": "Blood red",
        "boneMic": "Bone microphone",
        "hauntTheme": "Haunt"
      },
```

`src/i18n/locales/pl.json`, under `events`:

```json
      "prizes": {
        "pumpkinFur": "Dyniowe futro",
        "blackCatFur": "Futro czarnego kota",
        "witchSuit": "Peleryna wiedźmy",
        "slimeAccent": "Zielony śluz",
        "bloodAccent": "Krwista czerwień",
        "boneMic": "Kościany mikrofon",
        "hauntTheme": "Nawiedzenie"
      },
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/game/events/prizePool.test.ts --runInBand --coverage=false && npm run i18n:check`
Expected: PASS, and the locale check reports keys in sync.

- [ ] **Step 8: Commit**

```bash
npm run type-check
git add src/game/mascot/look.ts src/game/progression/mascotColors.ts src/game/progression/themes.ts src/i18n/locales/en.json src/i18n/locales/pl.json src/game/events/prizePool.test.ts
git commit -m "feat(events): add the Halloween prize pool cosmetics"
```

---

### Task 6: Swap the edition model to a prize pool

Removes `milestones`. Every consumer is updated in this task, so the tree compiles at the commit.

**Files:**
- Modify: `shared/events/definitions.ts:10-42` (`EventEdition`, `eventEditions`), `:70-91` (`validateEdition`), `grantIdentity`
- Modify: `shared/events/fixtures.ts:5-15` (`testEventEdition`)
- Modify: `src/game/progression/recordRun.ts:174-189` (the milestone grant loop)
- Modify: `src/screens/EventHubScreen.tsx:141-158` (the milestone rows)
- Test: `src/game/events/events.test.ts` (append), `src/game/challenge/session/session.test.ts` (update the fixture assertion)

**Interfaces:**
- Consumes: `drawPrizes`, `drawIdentity` (Task 1); `eventWinIds` (Task 4).
- Produces:
  - `EventEdition.winsPerPrize: number`, `EventEdition.prizePool: readonly string[]`
  - `grantIdentity` is deleted; `drawIdentity` from Task 1 replaces it.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/events/events.test.ts
// (this suite already imports from '../../../shared/events/definitions')

const enabled = {
    id: 'x',
    enabled: true,
    name: { en: 'X', pl: 'X' },
    startsAt: 1000,
    endsAt: 2000,
    activities: [{ game: 'the-ladder' as const, contentRevision: 'r1' }],
    allowance: { base: 3, perPaidItem: 1, premium: 10 },
    winsPerPrize: 13,
    prizePool: ['reward-a'],
};
const ok = () => true;

test('an enabled edition needs a non-empty prize pool', () => {
    expect(validateEdition({ ...enabled, prizePool: [] }, ok, ok)).toContain('prizes');
    expect(validateEdition(enabled, ok, ok)).toEqual([]);
});

test('winsPerPrize must be a positive integer', () => {
    expect(validateEdition({ ...enabled, winsPerPrize: 0 }, ok, ok)).toContain('prizes');
    expect(validateEdition({ ...enabled, winsPerPrize: 1.5 }, ok, ok)).toContain('prizes');
});

test('every pool reward must resolve', () => {
    expect(validateEdition(enabled, ok, () => false)).toContain('prizes');
});

test('a draft edition may still have an empty pool', () => {
    expect(validateEdition({ ...enabled, enabled: false, prizePool: [] }, ok, ok)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/events/events.test.ts --runInBand --coverage=false`
Expected: FAIL — `winsPerPrize`/`prizePool` are not known properties.

- [ ] **Step 3: Change the edition type and validator**

In `shared/events/definitions.ts`, in `EventEdition` replace the `milestones` line with:

```ts
    /** Wins required per prize draw. The ladder repeats: 13, 26, 39, … */
    winsPerPrize: number;
    /** Reward ids this edition can award, drawn without replacement. */
    prizePool: readonly string[];
```

In `validateEdition`, replace the milestone validation and the enabled-only `prizes` check with:

```ts
    if (
        !Number.isSafeInteger(edition.winsPerPrize) ||
        edition.winsPerPrize < 1 ||
        new Set(edition.prizePool).size !== edition.prizePool.length ||
        edition.prizePool.some((id) => !hasReward(id)) ||
        (edition.enabled && edition.prizePool.length === 0)
    )
        errors.push('prizes');
```

Delete `grantIdentity` and its export; Task 1's `drawIdentity` replaces it.

- [ ] **Step 4: Update the fixtures**

In `shared/events/fixtures.ts`, in `testEventEdition` replace
`milestones: [{ id: 'first-run', completedRuns: 1, rewardId: 'theme-champion' }],` with:

```ts
    winsPerPrize: 1,
    prizePool: ['theme-champion'],
```

- [ ] **Step 5: Replace the grant loop in recordRun**

In `src/game/progression/recordRun.ts`, the block currently reading
`for (const milestone of edition.milestones) { … }` becomes a win-driven grant.
Replace the whole `if (edition) { … }` body with:

```ts
        if (edition) {
            const count = (prev.eventCompletedRuns?.[edition.id] ?? 0) + 1;
            stats.eventCompletedRuns = { ...prev.eventCompletedRuns, [edition.id]: count };
        }
```

Completed runs still drive the "Completed runs: N" display. Prizes move to
`grantEventPrizes` below, called when a win is recorded rather than when a run
completes — at completion the opponent's score is not yet known.

Add to the same file, exported:

```ts
/**
 * Award any prizes owed for this edition's current win count. Idempotent: a
 * draw already in `eventRewardGrants` is skipped, never re-rolled.
 */
export function grantEventPrizes(edition: EventEdition, deviceId: string): string[] {
    const prev = loadStats();
    const wins = prev.eventWinIds?.[edition.id]?.length ?? 0;
    const drawn = drawPrizes({
        deviceId,
        editionId: edition.id,
        pool: edition.prizePool,
        winsPerPrize: edition.winsPerPrize,
        wins,
        grantedDraws: prev.eventRewardGrants ?? [],
        alreadyEarned: prev.earnedRewardIds ?? [],
    });
    if (drawn.length === 0) return [];
    saveStats({
        ...prev,
        eventRewardGrants: [...(prev.eventRewardGrants ?? []), ...drawn.map((d) => d.grantId)],
        earnedRewardIds: [...(prev.earnedRewardIds ?? []), ...drawn.map((d) => d.rewardId)],
    });
    return drawn.map((d) => d.rewardId);
}

/** Record a won round and award anything it unlocks. Safe to call repeatedly. */
export function recordEventWin(edition: EventEdition, challengeId: string, deviceId: string): string[] {
    const prev = loadStats();
    const won = prev.eventWinIds?.[edition.id] ?? [];
    if (won.includes(challengeId)) return [];
    saveStats({
        ...prev,
        eventWinIds: { ...prev.eventWinIds, [edition.id]: [...won, challengeId] },
    });
    return grantEventPrizes(edition, deviceId);
}
```

Add the imports `drawPrizes` from `../events/draw` and the `EventEdition` type
from `../../../shared/events/definitions`.

- [ ] **Step 6: Keep EventHubScreen compiling**

In `src/screens/EventHubScreen.tsx`, replace the `edition.milestones.map(...)`
block with a minimal pool listing; Task 8 makes it final.

```tsx
                                {edition.prizePool.map((rewardId) => (
                                    <Stack key={rewardId} gap='xs'>
                                        <Text weight='bold'>
                                            {t(eventRewardTitleKey(rewardId) ?? 'progression.newReward')}
                                        </Text>
                                        <Button variant='ghost' onPress={() => setPreviewReward(rewardId)}>
                                            {t('events.preview')}
                                        </Button>
                                    </Stack>
                                ))}
```

Remove the now-unused `grantIdentity` import.

- [ ] **Step 7: Update the fixture assertion in the session suite**

In `src/game/challenge/session/session.test.ts`, the test asserting
`loadStats().earnedRewardIds` contains `'theme-champion'` now depends on a win,
not a completion. Change that assertion to check `eventCompletedRuns` only:

```ts
    expect(loadStats().eventCompletedRuns?.[edition.id]).toBe(1);
```

and delete the `earnedRewardIds` expectation from that test. Prize granting is
covered by Task 1 and by the new tests in this task.

- [ ] **Step 8: Run the suite to verify it passes**

Run: `npx jest src/game/events src/game/progression src/game/challenge/session src/screens/EventHubScreen.test.tsx --runInBand --coverage=false`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
npm run type-check
git add shared/events src/game/progression src/screens/EventHubScreen.tsx src/game/challenge/session/session.test.ts
git commit -m "feat(events): replace fixed milestones with a repeating prize pool"
```

---

### Task 7: Resolve outcomes and award wins

**Files:**
- Create: `src/game/events/resolveOutcomes.ts`
- Test: `src/game/events/resolveOutcomes.test.ts`
- Modify: `src/game/challenge/rematchSync.ts:44-48` (the status loop)

**Interfaces:**
- Consumes: `challengeOutcome` (Task 2), `markChallengeOutcome` (Task 3), `recordEventWin` (Task 6), `getAttempts` from `src/game/challenge/store.ts`, `findEdition` from `shared/events/definitions.ts`, `listChallenges` from `src/game/challenge/log.ts`, `getDeviceId` from `src/game/challenge/deviceId.ts`.
- Produces: `resolveEventOutcomes(now?: number): Promise<string[]>` — the reward ids newly granted.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/events/resolveOutcomes.test.ts
import { resolveEventOutcomes } from './resolveOutcomes';
import { recordChallenge, listChallenges, markChallengeOpponentPlayed } from '../challenge/log';
import { getAttempts } from '../challenge/store';
import { testEventEdition as edition } from '../../../shared/events/fixtures';
import { loadStats, saveStats, defaultStats } from '../progression/recordRun';

jest.mock('../challenge/store', () => ({ getAttempts: jest.fn() }));
jest.mock('../challenge/deviceId', () => ({ getDeviceId: () => 'device-1' }));

const mine = { nickname: 'Me', progress: 9, score: 900, timestamp: 100 };
const theirs = { nickname: 'You', progress: 5, score: 500, timestamp: 200 };

const stub = (id: string) =>
    recordChallenge({
        id,
        game: 'the-ladder',
        role: 'created',
        opponent: '',
        played: true,
        expiresAt: edition.endsAt! + 1000,
        eventId: edition.id,
    });

beforeEach(() => {
    saveStats(defaultStats());
    jest.mocked(getAttempts).mockReset();
});

test('beating the opponent records a win and grants a prize', async () => {
    stub('r1');
    markChallengeOpponentPlayed('r1');
    jest.mocked(getAttempts).mockResolvedValue([mine, theirs]);
    // Fixture edition: winsPerPrize 1, pool ['theme-champion'].
    const granted = await resolveEventOutcomes(edition.startsAt! + 1);
    expect(granted).toEqual(['theme-champion']);
    expect(listChallenges().find((s) => s.id === 'r1')?.outcome).toBe('won');
    expect(loadStats().eventWinIds?.[edition.id]).toEqual(['r1']);
});

test('losing records the verdict and grants nothing', async () => {
    stub('r2');
    markChallengeOpponentPlayed('r2');
    jest.mocked(getAttempts).mockResolvedValue([theirs, mine]);
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r2')?.outcome).toBe('lost');
});

test('a draw is not a win', async () => {
    stub('r3');
    markChallengeOpponentPlayed('r3');
    jest.mocked(getAttempts).mockResolvedValue([
        { ...mine, progress: 5, score: 500 },
        { ...theirs, progress: 5, score: 500 },
    ]);
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r3')?.outcome).toBe('draw');
    expect(loadStats().eventWinIds?.[edition.id] ?? []).toEqual([]);
});

test('an absent opponent stays unresolved during the event', async () => {
    stub('r4');
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r4')?.outcome).toBeUndefined();
    expect(getAttempts).not.toHaveBeenCalled();
});

test('an absent opponent becomes a walkover win at closure', async () => {
    stub('r5');
    const granted = await resolveEventOutcomes(edition.endsAt! + 1);
    expect(granted).toEqual(['theme-champion']);
    expect(listChallenges().find((s) => s.id === 'r5')?.outcome).toBe('won');
    expect(getAttempts).not.toHaveBeenCalled();
});

test('resolving twice does not double-count a win', async () => {
    stub('r6');
    markChallengeOpponentPlayed('r6');
    jest.mocked(getAttempts).mockResolvedValue([mine, theirs]);
    await resolveEventOutcomes(edition.startsAt! + 1);
    await resolveEventOutcomes(edition.startsAt! + 1);
    expect(loadStats().eventWinIds?.[edition.id]).toEqual(['r6']);
});

test('a network failure on one round leaves the others resolvable', async () => {
    stub('r7');
    stub('r8');
    markChallengeOpponentPlayed('r7');
    markChallengeOpponentPlayed('r8');
    jest.mocked(getAttempts)
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce([mine, theirs]);
    await resolveEventOutcomes(edition.startsAt! + 1);
    const settled = listChallenges().filter((s) => s.outcome === 'won');
    expect(settled).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/events/resolveOutcomes.test.ts --runInBand --coverage=false`
Expected: FAIL — `Cannot find module './resolveOutcomes'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/game/events/resolveOutcomes.ts
import { findEdition } from '../../../shared/events/definitions';
import { listChallenges, markChallengeOutcome } from '../challenge/log';
import { challengeOutcome } from '../challenge/outcome';
import { getAttempts } from '../challenge/store';
import { getDeviceId } from '../challenge/deviceId';
import { recordEventWin } from '../progression/recordRun';

/**
 * Settle event rounds whose verdict is still unknown, and award any prize the
 * new wins unlock.
 *
 * Two resolution paths, and only one of them costs a request:
 *  - the opponent has uploaded (the statuses sync already told us), so compare;
 *  - the event has closed and no opponent ever uploaded, so it is a walkover.
 * A round with no opponent yet, mid-event, is left alone.
 */
export async function resolveEventOutcomes(now: number = Date.now()): Promise<string[]> {
    const deviceId = getDeviceId();
    const granted: string[] = [];
    for (const stub of listChallenges()) {
        if (!stub.eventId || stub.outcome || !stub.played) continue;
        const edition = findEdition(stub.eventId, true);
        if (!edition) continue;
        let outcome: 'won' | 'lost' | 'draw' | 'pending' = 'pending';
        if (stub.opponentPlayed) {
            try {
                outcome = challengeOutcome(await getAttempts(stub.id), myTimestamp(stub.id));
            } catch {
                // Offline or a transient failure. Leave it unresolved; the next
                // sync retries it. One bad round must not stop the others.
                continue;
            }
        } else if (edition.endsAt !== undefined && now >= edition.endsAt) {
            // Closure walkover: nobody ever came, so the round is won.
            outcome = 'won';
        }
        if (outcome === 'pending') continue;
        markChallengeOutcome(stub.id, outcome);
        if (outcome === 'won') granted.push(...recordEventWin(edition, stub.id, deviceId));
    }
    return granted;
}
```

`myTimestamp(id)` reads this device's own attempt timestamp from the session
journal — implement it in the same file:

```ts
import { listSessions } from '../challenge/session/store';

function myTimestamp(challengeId: string): number | null {
    return listSessions().find((s) => s.challengeId === challengeId)?.attempt?.timestamp ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/events/resolveOutcomes.test.ts --runInBand --coverage=false`
Expected: PASS — 7 tests.

- [ ] **Step 5: Wire it into the sync**

In `src/game/challenge/rematchSync.ts`, after the `for (const status of statuses)` loop that calls `markChallengePlayed` / `markChallengeOpponentPlayed`, add:

```ts
    // Statuses have just told us who else has played; settle any event verdict
    // that became knowable. Failures are contained per round inside.
    await resolveEventOutcomes().catch((error) =>
        SafeSentry.captureException(error, { tags: { area: 'event-outcomes' } }),
    );
```

Import `resolveEventOutcomes` from `../events/resolveOutcomes`. `SafeSentry` is already imported in that file.

- [ ] **Step 6: Run the sync tests**

Run: `npx jest src/game/challenge --runInBand --coverage=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run type-check
npx eslint src/game/events/resolveOutcomes.ts src/game/challenge/rematchSync.ts
git add src/game/events/resolveOutcomes.ts src/game/events/resolveOutcomes.test.ts src/game/challenge/rematchSync.ts
git commit -m "feat(events): settle head-to-head verdicts and award prize draws"
```

---

### Task 8: Editions, hub copy, and the rehearsal guard

**Files:**
- Modify: `shared/events/definitions.ts:31-41` (`eventEditions`)
- Modify: `src/screens/EventHubScreen.tsx` (the pool block from Task 6)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/pl.json`
- Test: `src/game/events/events.test.ts` (append), `src/screens/EventHubScreen.test.tsx` (append)

**Interfaces:**
- Consumes: the seven reward ids (Task 5), `EventEdition` (Task 6), `eventWinIds` (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/game/events/events.test.ts
// `eventEditions` comes from '../../../shared/events/definitions'

test('halloween ships as a draft with the full pool', () => {
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(halloween.enabled).toBe(false);
    expect(halloween.winsPerPrize).toBe(13);
    expect(halloween.prizePool).toHaveLength(7);
});

test('the rehearsal edition is enabled and dated', () => {
    const rehearsal = eventEditions.find((e) => e.id === 'halloween-2026-rehearsal')!;
    expect(rehearsal.enabled).toBe(true);
    expect(Number.isSafeInteger(rehearsal.startsAt)).toBe(true);
    expect(Number.isSafeInteger(rehearsal.endsAt)).toBe(true);
});

test('a rehearsal edition must never be live alongside the real event', () => {
    // Release tripwire: delete the rehearsal edition before enabling Halloween.
    const rehearsals = eventEditions.filter((e) => e.id.endsWith('-rehearsal') && e.enabled);
    const live = eventEditions.filter((e) => !e.id.endsWith('-rehearsal') && e.enabled);
    expect(rehearsals.length === 0 || live.length === 0).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/events/events.test.ts --runInBand --coverage=false`
Expected: FAIL — no rehearsal edition, pool empty.

- [ ] **Step 3: Write the editions**

Replace `eventEditions` in `shared/events/definitions.ts`:

```ts
const HALLOWEEN_PRIZE_POOL = [
    'mascot-fur-pumpkin',
    'mascot-fur-blackcat',
    'mascot-suit-witch',
    'mascot-accent-slime',
    'mascot-accent-blood',
    'mascot-mic-bone',
    'theme-haunt',
] as const;

export const eventEditions: readonly EventEdition[] = [
    {
        id: 'halloween-2026',
        enabled: false,
        name: { en: 'Halloween', pl: 'Halloween' },
        accent: '#F97316',
        artwork: 'pumpkin',
        activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
        allowance: { base: 3, perPaidItem: 1, premium: 10 },
        winsPerPrize: 13,
        prizePool: HALLOWEEN_PRIZE_POOL,
    },
    // INTERNAL TRACK ONLY. Delete before the public release that enables
    // halloween-2026 — the tripwire test in definitions.test.ts enforces it.
    // Containment is by binary: the Worker validates whatever definitions file
    // it was deployed with, and it is shared by the internal and public apps,
    // so no server-side flag could separate them.
    {
        id: 'halloween-2026-rehearsal',
        enabled: true,
        name: { en: 'Halloween', pl: 'Halloween' },
        startsAt: Date.UTC(2026, 8, 1),
        endsAt: Date.UTC(2026, 11, 31),
        accent: '#F97316',
        artwork: 'pumpkin',
        activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
        allowance: { base: 3, perPaidItem: 1, premium: 10 },
        winsPerPrize: 13,
        prizePool: HALLOWEEN_PRIZE_POOL,
    },
];
```

- [ ] **Step 4: Finish the hub**

In `src/screens/EventHubScreen.tsx`, above the returned JSX for each edition add:

```tsx
                        const wins = stats.eventWinIds?.[edition.id]?.length ?? 0;
                        const toNextPrize = edition.winsPerPrize - (wins % edition.winsPerPrize);
                        const earned = new Set(stats.earnedRewardIds ?? []);
                        const poolComplete = edition.prizePool.every((id) => earned.has(id));
```

Replace the pool block from Task 6 with:

```tsx
                                <Text>{t('events.winsGoal', { count: wins })}</Text>
                                <Text variant='caption'>
                                    {poolComplete
                                        ? t('events.poolComplete')
                                        : t('events.nextPrize', { count: toNextPrize })}
                                </Text>
                                <Text variant='caption'>{t('events.randomPrize')}</Text>
                                {edition.prizePool.map((rewardId) => (
                                    <Stack key={rewardId} gap='xs'>
                                        <Text weight='bold'>
                                            {t(eventRewardTitleKey(rewardId) ?? 'progression.newReward')}
                                        </Text>
                                        <Text>{earned.has(rewardId) ? t('events.earned') : t('events.locked')}</Text>
                                        <Button variant='ghost' onPress={() => setPreviewReward(rewardId)}>
                                            {t('events.preview')}
                                        </Button>
                                    </Stack>
                                ))}
```

- [ ] **Step 5: Add the copy**

`en.json`, under `events`:

```json
      "winsGoal": "%{count} wins so far",
      "nextPrize": "%{count} more wins for your next prize",
      "randomPrize": "Each prize is drawn at random from the ones you haven't won yet.",
      "poolComplete": "You've won every prize in this event.",
      "locked": "Not won yet",
```

`pl.json`, under `events`:

```json
      "winsGoal": "Zwycięstwa: %{count}",
      "nextPrize": "Jeszcze %{count} zwycięstw do następnej nagrody",
      "randomPrize": "Każda nagroda jest losowana spośród tych, których jeszcze nie masz.",
      "poolComplete": "Zdobyto wszystkie nagrody w tym wydarzeniu.",
      "locked": "Jeszcze niezdobyte",
```

- [ ] **Step 6: Add the hub test**

```tsx
// append to src/screens/EventHubScreen.test.tsx
test('the hub lists the pool and the wins remaining to the next prize', async () => {
    const { findByText } = renderHub();
    expect(await findByText('events.winsGoal')).toBeTruthy();
    expect(await findByText('events.randomPrize')).toBeTruthy();
});
```

Use whatever render helper the existing tests in that file use; if they render
`<EventHubScreen />` inline, follow that pattern rather than introducing a helper.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/game/events src/screens/EventHubScreen.test.tsx --runInBand --coverage=false && npm run i18n:check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npm run type-check
git add shared/events src/screens/EventHubScreen.tsx src/screens/EventHubScreen.test.tsx src/i18n/locales
git commit -m "feat(events): ship the Halloween pool and an internal rehearsal edition"
```

---

### Task 9: Full verification and spec amendment

**Files:**
- Modify: `docs/plans/2026-09-06-timed-events.md` (the Prizes, Goal credit and Offline completion rows)

- [ ] **Step 1: Amend the approved behaviour table**

In the "Approved behavior" table, replace those three rows:

```
| Prizes              | Win-count milestones: every N head-to-head wins draws one prize at random from the edition's pool, never repeating an item the player already holds. The pool is previewable; the individual draw is not. Repeats until the pool is empty. |
| Goal credit         | Completed runs still count for the run tally, but prize progress counts only wins. A loss or a draw earns no prize progress. A round whose opponent never uploads counts as a win at event closure. |
| Offline completion  | A run still completes and records progression offline. Prize progress needs the opponent's score, so prizes are granted when the round resolves rather than at completion. |
```

Add below the table:

```
Amended 2026-09-08 by docs/superpowers/specs/2026-09-08-halloween-event-prizes-design.md.
```

- [ ] **Step 2: Run the whole verification set**

```bash
npm run type-check
npm --prefix server run typecheck
npx jest --runInBand --coverage=false
npm run i18n:check
npm run content:halloween:check
npm run test:events:d1
npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx' | grep -v '^server/')
npx prettier --check $(git diff --name-only main...HEAD -- '*.ts' '*.tsx')
git diff --check
```

Expected: all pass. Jest must exceed the 111 suites / 1064 tests baseline and
report **zero failures**. If the Worker typecheck or the D1 suite needs a source
edit, stop — this plan requires no Worker changes, and needing one means a
shared-model change leaked into `server/`.

- [ ] **Step 3: Commit**

```bash
git add docs/plans/2026-09-06-timed-events.md
git commit -m "docs(events): amend prize, goal credit and offline rows for win-gated prizes"
```

---

## Self-Review

**Spec coverage.** Edition model → Task 6. Outcome resolution → Tasks 2, 3, 7. Win tally and draws → Tasks 1, 4, 6. Prizes → Task 5. Editions and rehearsal → Task 8. Presentation and i18n → Tasks 5, 8. Testing section → distributed across every task, with the full set in Task 9. Spec amendment → Task 9.

**Deviation from the spec, deliberate:** the spec's draw algorithm recomputed draws 1..d-1 to build the exclusion set. Task 1 filters by `alreadyEarned` instead, which is equivalent (earlier rewards are already in `earnedRewardIds`), simpler, and additionally excludes a pool item obtained by any other route. Noted in Task 1.

**Two spec details the implementer must confirm rather than assume:**
1. `EARNED_MASCOT_COLOR_IDS` has no importers, so adding colours to it may not exclude them from any purchasable bundle (Task 5).
2. Task 8's hub test must follow whatever render pattern `EventHubScreen.test.tsx` already uses; the plan does not invent a helper.

**Type consistency.** `drawPrizes`/`drawIdentity`/`seededIndex` (Task 1) are used with those names in Tasks 6 and 7. `ChallengeOutcome` (Task 2) is the type of `ChallengeStub.outcome` (Task 3) and of `markChallengeOutcome`'s parameter. `eventWinIds` (Task 4) is read by `recordEventWin` and `grantEventPrizes` (Task 6) and the hub (Task 8). `grantIdentity` is deleted in Task 6 and every consumer moves to `drawIdentity`.
