# Mascot "Alive" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fox mascot feel alive by having it react — with facial expression and occasional spoken lines — to game outcomes, navigation, and economy/challenge events, driven by one central, offline, bilingual reaction engine.

**Architecture:** A framework-agnostic **reaction director** (plain TypeScript, unit-tested) owns all pacing: it receives fire-and-forget `MascotEvent`s carrying scope (`screenScope`/`roundId`/`questionId`/`timestamp`), maps each to a **bucket**, applies priority + global cooldown + recent-repeat avoidance + escalation, and exposes the current **utterance** (line + expression) and **idle drip** to a thin React host mounted at app root. Screens/games only `emit()`. Line text is authored in i18n (EN+PL); the director returns i18n **keys**, never English strings.

**Tech Stack:** React Native, TypeScript, react-native-mmkv (persisted memory), react-native-reanimated (poses), react-native-svg (mascot art), i18next (copy), Jest + ts-jest (tests).

## Global Constraints

- **Offline only** — no network, no LLM. All content authored and bundled.
- **Bilingual EN + PL** — every player-facing line has a key in BOTH `src/i18n/locales/en.json` and `src/i18n/locales/pl.json`. A missing PL key MUST throw in dev (see Task 12), never silently render EN.
- **Director returns i18n keys + interpolation params, never literal display text.**
- **Reduced-motion** (`useReducedMotion()` from reanimated) damps all motion: no full peek-in entrance, minimal bounce, expression swaps still allowed (instant, no animation).
- **No spoken reactions during active/timed gameplay.** Spoken bubbles occur at run-end and on non-game screens only. Mid-run is EXPRESSION-ONLY and rare.
- **"Do NOT react" guards** (director drops the event): a round timer is running, a screen transition is in flight, a modal is open, a purchase is pending, or within `NAV_QUIET_MS` of a navigation.
- **v1 is deliberately small:** ~8–12 buckets, 3–6 lines per high-frequency bucket, 1–2 for rare ones. Bias toward silence.
- Match existing code style: functional modules, MMKV `createMMKV({ id })` per feature, pure selection modules with colocated `*.test.ts` (see `src/game/mascot/homeMessages.ts` as the reference pattern).
- Run tests with `npx jest <path>`. TypeScript check: `npx tsc --noEmit`.

---

## File Structure

Directory: `src/game/mascot/reactions/` (new) — the whole engine lives here, colocated with the existing mascot art.

- `events.ts` — `MascotEvent` union, `EventName`, `EventContext`, `MascotScope`. Pure types + a couple of type guards.
- `buckets.ts` — the trigger table: maps each `EventName` → `BucketId`, priority, allowed surfaces, spoken?, expression. Pure data + lookup.
- `lines.ts` — per-bucket line pools (arrays of i18n keys) + escalation config. Pure data.
- `reactionSelection.ts` — pure functions: `pickLine(bucket, recent)` (pool + recent-repeat avoidance + escalation), `resolveBucket(event)`. No state, no timers. Fully unit-tested.
- `reactionDirector.ts` — the stateful core: `createReactionDirector()` returns `{ emit, getState, subscribe, tick, setActive, reset }`. Owns priority resolution, global cooldown, idle-drip scheduling, stale-scope filtering, background drop. Pure TS (injectable clock), fully unit-tested.
- `useMascotDirector.tsx` — React context + provider wrapping a single director instance; wires navigation route → `screenScope`, AppState background → drop, reduced-motion, and the settings toggle. Exposes `useMascot()` (for emitters) and `useMascotState()` (for the host).
- `emit.ts` — typed thin helpers so callers read well: `emitMascot(name, ctx)`.
- `MascotHost.tsx` — the single app-root overlay: subscribes to director state, renders `MascotOverlay` with the current pose/expression/message, drives the idle drip timer via `tick`.
- `expressions.ts` — `MascotExpression` type + the face-layer data (added to the Mascot render).

Modified:
- `src/game/mascot/Mascot.tsx` — add `expression` prop, swap the facial-feature group by expression.
- `src/game/mascot/MascotOverlay.tsx` — accept + forward `expression`; add auto-hide-after-timeout for spoken bubbles.
- `src/game/mascot/look.ts` — extend `MascotPose`/add `MascotExpression` export if colocated there.
- `src/hooks/useSettings.tsx` — add `mascotChatter: boolean` setting.
- `src/navigation/RootNavigator.tsx` — mount `MascotDirectorProvider` + `MascotHost`.
- `src/screens/SettingsScreen.tsx` — add the "Mascot chatter" toggle row.
- `src/screens/HomeScreen.tsx` — replace bespoke `selectHomeMascotMessage` wiring with `emit` calls; remove now-dead local mascot state.
- `src/game/GameOverHeader.tsx` / the 4 play screens — `emit('run-won'|'run-lost', ctx)` at run end; emit expression-only mid-run events.
- `src/i18n/locales/en.json` + `pl.json` — the new `mascot.*` line keys.

---

## Task 1: Event model + scope types

**Files:**
- Create: `src/game/mascot/reactions/events.ts`
- Test: `src/game/mascot/reactions/events.test.ts`

**Interfaces:**
- Produces:
  - `type Surface = 'home' | 'game' | 'store' | 'progress' | 'challenge' | 'mascot' | 'other'`
  - `type EventName = 'app-open' | 'home-focus' | 'idle' | 'run-won' | 'run-lost' | 'streak-milestone' | 'clutch' | 'all-in-survived' | 'level-up' | 'unlock' | 'look-equipped' | 'challenge-received' | 'challenge-beaten' | 'challenge-sent' | 'offline-limit'`
  - `interface MascotScope { surface: Surface; roundId?: string; questionId?: string; navSeq: number }`
  - `interface EventContext { gameId?: string; streak?: number; count?: number; [k: string]: string | number | boolean | undefined }`
  - `interface MascotEvent { name: EventName; scope: MascotScope; ctx: EventContext; at: number }`
  - `function isGameplayEvent(name: EventName): boolean` — true for `run-won|run-lost|streak-milestone|clutch|all-in-survived`.

- [ ] **Step 1: Write the failing test**

```ts
import { isGameplayEvent, type MascotEvent } from './events';

describe('events', () => {
    it('classifies gameplay events', () => {
        expect(isGameplayEvent('run-won')).toBe(true);
        expect(isGameplayEvent('clutch')).toBe(true);
        expect(isGameplayEvent('home-focus')).toBe(false);
        expect(isGameplayEvent('level-up')).toBe(false);
    });

    it('MascotEvent shape carries scope + timestamp', () => {
        const e: MascotEvent = {
            name: 'run-won',
            scope: { surface: 'game', roundId: 'r1', navSeq: 3 },
            ctx: { gameId: 'ladder', streak: 5 },
            at: 1000,
        };
        expect(e.scope.roundId).toBe('r1');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/events.test.ts`
Expected: FAIL — cannot find module `./events`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Surface = 'home' | 'game' | 'store' | 'progress' | 'challenge' | 'mascot' | 'other';

export type EventName =
    | 'app-open' | 'home-focus' | 'idle'
    | 'run-won' | 'run-lost' | 'streak-milestone' | 'clutch' | 'all-in-survived'
    | 'level-up' | 'unlock' | 'look-equipped'
    | 'challenge-received' | 'challenge-beaten' | 'challenge-sent'
    | 'offline-limit';

export interface MascotScope {
    surface: Surface;
    roundId?: string;
    questionId?: string;
    navSeq: number; // monotonically bumped on every navigation
}

export interface EventContext {
    gameId?: string;
    streak?: number;
    count?: number;
    [k: string]: string | number | boolean | undefined;
}

export interface MascotEvent {
    name: EventName;
    scope: MascotScope;
    ctx: EventContext;
    at: number; // ms epoch, injected by the director's clock
}

const GAMEPLAY = new Set<EventName>(['run-won', 'run-lost', 'streak-milestone', 'clutch', 'all-in-survived']);
export function isGameplayEvent(name: EventName): boolean {
    return GAMEPLAY.has(name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/events.ts src/game/mascot/reactions/events.test.ts
git commit -m "feat(mascot): reaction event model + scope types"
```

---

## Task 2: Bucket table (trigger → bucket, priority, surface, spoken?, expression)

**Files:**
- Create: `src/game/mascot/reactions/expressions.ts`
- Create: `src/game/mascot/reactions/buckets.ts`
- Test: `src/game/mascot/reactions/buckets.test.ts`

**Interfaces:**
- Consumes: `EventName`, `Surface` from `./events`.
- Produces:
  - `expressions.ts`: `type MascotExpression = 'happy' | 'worried' | 'smug' | 'surprised' | 'neutral'`
  - `buckets.ts`:
    - `type BucketId` (string union, one per reaction family)
    - `interface BucketDef { id: BucketId; priority: number; spoken: boolean; expression: MascotExpression; surfaces: Surface[] | 'all'; escalates?: boolean }`
    - `function resolveBucket(name: EventName): BucketDef` — the single mapping. Higher `priority` wins ties.

The v1 trigger table (author exactly this):

| EventName | BucketId | priority | spoken | expression | surfaces | escalates |
|---|---|---|---|---|---|---|
| level-up | `level-up` | 90 | yes | happy | all | no |
| challenge-beaten | `challenge-win` | 85 | yes | smug | challenge, home | no |
| run-won | `run-won` | 80 | yes | happy | game | no |
| run-lost | `run-lost` | 78 | yes | worried | game | no |
| challenge-received | `challenge-in` | 70 | yes | surprised | challenge, home | no |
| offline-limit | `offline-limit` | 68 | yes | worried | home | no |
| unlock | `unlock` | 60 | yes | happy | store, home | no |
| look-equipped | `look-equipped` | 58 | yes | smug | mascot, store | no |
| challenge-sent | `challenge-out` | 50 | yes | happy | challenge | no |
| streak-milestone | `streak` | 40 | no | happy | home, game | yes |
| clutch | `clutch` | 38 | no | surprised | game | no |
| all-in-survived | `all-in` | 36 | no | surprised | game | no |
| home-focus | `greeting` | 20 | yes | happy | home | no |
| app-open | `greeting` | 20 | yes | happy | home | no |
| idle | `idle` | 5 | yes | neutral | home | no |

Note: `spoken: false` buckets (streak/clutch/all-in) are the rare EXPRESSION-ONLY mid-run reactions — they change the face, never open a bubble.

- [ ] **Step 1: Write the failing test**

```ts
import { resolveBucket } from './buckets';

describe('buckets', () => {
    it('maps run-won to a spoken happy game bucket', () => {
        const b = resolveBucket('run-won');
        expect(b.id).toBe('run-won');
        expect(b.spoken).toBe(true);
        expect(b.expression).toBe('happy');
        expect(b.surfaces).toContain('game');
    });

    it('mid-run streak is expression-only and escalates', () => {
        const b = resolveBucket('streak-milestone');
        expect(b.spoken).toBe(false);
        expect(b.escalates).toBe(true);
    });

    it('level-up outranks a greeting', () => {
        expect(resolveBucket('level-up').priority).toBeGreaterThan(resolveBucket('home-focus').priority);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/buckets.test.ts`
Expected: FAIL — cannot find module `./buckets`.

- [ ] **Step 3: Write minimal implementation**

Create `expressions.ts`:

```ts
export type MascotExpression = 'happy' | 'worried' | 'smug' | 'surprised' | 'neutral';
```

Create `buckets.ts`:

```ts
import type { EventName, Surface } from './events';
import type { MascotExpression } from './expressions';

export type BucketId =
    | 'level-up' | 'challenge-win' | 'run-won' | 'run-lost' | 'challenge-in'
    | 'offline-limit' | 'unlock' | 'look-equipped' | 'challenge-out'
    | 'streak' | 'clutch' | 'all-in' | 'greeting' | 'idle';

export interface BucketDef {
    id: BucketId;
    priority: number;
    spoken: boolean;
    expression: MascotExpression;
    surfaces: Surface[] | 'all';
    escalates?: boolean;
}

const TABLE: Record<EventName, BucketDef> = {
    'level-up': { id: 'level-up', priority: 90, spoken: true, expression: 'happy', surfaces: 'all' },
    'challenge-beaten': { id: 'challenge-win', priority: 85, spoken: true, expression: 'smug', surfaces: ['challenge', 'home'] },
    'run-won': { id: 'run-won', priority: 80, spoken: true, expression: 'happy', surfaces: ['game'] },
    'run-lost': { id: 'run-lost', priority: 78, spoken: true, expression: 'worried', surfaces: ['game'] },
    'challenge-received': { id: 'challenge-in', priority: 70, spoken: true, expression: 'surprised', surfaces: ['challenge', 'home'] },
    'offline-limit': { id: 'offline-limit', priority: 68, spoken: true, expression: 'worried', surfaces: ['home'] },
    'unlock': { id: 'unlock', priority: 60, spoken: true, expression: 'happy', surfaces: ['store', 'home'] },
    'look-equipped': { id: 'look-equipped', priority: 58, spoken: true, expression: 'smug', surfaces: ['mascot', 'store'] },
    'challenge-sent': { id: 'challenge-out', priority: 50, spoken: true, expression: 'happy', surfaces: ['challenge'] },
    'streak-milestone': { id: 'streak', priority: 40, spoken: false, expression: 'happy', surfaces: ['home', 'game'], escalates: true },
    'clutch': { id: 'clutch', priority: 38, spoken: false, expression: 'surprised', surfaces: ['game'] },
    'all-in-survived': { id: 'all-in', priority: 36, spoken: false, expression: 'surprised', surfaces: ['game'] },
    'home-focus': { id: 'greeting', priority: 20, spoken: true, expression: 'happy', surfaces: ['home'] },
    'app-open': { id: 'greeting', priority: 20, spoken: true, expression: 'happy', surfaces: ['home'] },
    'idle': { id: 'idle', priority: 5, spoken: true, expression: 'neutral', surfaces: ['home'] },
};

export function resolveBucket(name: EventName): BucketDef {
    return TABLE[name];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/buckets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/expressions.ts src/game/mascot/reactions/buckets.ts src/game/mascot/reactions/buckets.test.ts
git commit -m "feat(mascot): bucket/trigger table with priority + expression mapping"
```

---

## Task 3: Line pools + escalation config

**Files:**
- Create: `src/game/mascot/reactions/lines.ts`
- Test: `src/game/mascot/reactions/lines.test.ts`

**Interfaces:**
- Consumes: `BucketId` from `./buckets`.
- Produces:
  - `interface LinePool { keys: string[]; escalation?: { thresholds: number[]; keys: string[] } }`
  - `const LINES: Record<BucketId, LinePool>`
  - `function poolFor(id: BucketId): LinePool`

Each `keys` entry is an i18n key under `mascot.*`. Escalation keys are chosen by how many `ctx.count` thresholds are crossed (see Task 4). Author 3–6 keys for high-frequency buckets, 1–2 for rare ones.

- [ ] **Step 1: Write the failing test**

```ts
import { poolFor, LINES } from './lines';

describe('lines', () => {
    it('every bucket has at least one key', () => {
        for (const id of Object.keys(LINES) as (keyof typeof LINES)[]) {
            expect(LINES[id].keys.length).toBeGreaterThan(0);
        }
    });

    it('streak bucket carries an escalation ladder', () => {
        const pool = poolFor('streak');
        expect(pool.escalation).toBeDefined();
        expect(pool.escalation!.thresholds.length).toBe(pool.escalation!.keys.length);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/lines.test.ts`
Expected: FAIL — cannot find module `./lines`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { BucketId } from './buckets';

export interface LinePool {
    keys: string[];
    escalation?: { thresholds: number[]; keys: string[] };
}

export const LINES: Record<BucketId, LinePool> = {
    'level-up': { keys: ['mascot.levelUp.1', 'mascot.levelUp.2', 'mascot.levelUp.3'] },
    'challenge-win': { keys: ['mascot.challengeWin.1', 'mascot.challengeWin.2', 'mascot.challengeWin.3'] },
    'run-won': { keys: ['mascot.runWon.1', 'mascot.runWon.2', 'mascot.runWon.3', 'mascot.runWon.4'] },
    'run-lost': { keys: ['mascot.runLost.1', 'mascot.runLost.2', 'mascot.runLost.3', 'mascot.runLost.4'] },
    'challenge-in': { keys: ['mascot.challengeIn.1', 'mascot.challengeIn.2'] },
    'offline-limit': { keys: ['mascot.offlineLimit.1', 'mascot.offlineLimit.2'] },
    'unlock': { keys: ['mascot.unlock.1', 'mascot.unlock.2'] },
    'look-equipped': { keys: ['mascot.lookEquipped.1', 'mascot.lookEquipped.2', 'mascot.lookEquipped.3'] },
    'challenge-out': { keys: ['mascot.challengeOut.1', 'mascot.challengeOut.2'] },
    // expression-only buckets still carry keys so a future spoken experiment has copy ready
    'streak': {
        keys: ['mascot.streak.1'],
        escalation: {
            thresholds: [3, 5, 10],
            keys: ['mascot.streak.tier1', 'mascot.streak.tier2', 'mascot.streak.tier3'],
        },
    },
    'clutch': { keys: ['mascot.clutch.1'] },
    'all-in': { keys: ['mascot.allIn.1'] },
    'greeting': { keys: ['mascot.greeting.1', 'mascot.greeting.2', 'mascot.greeting.3', 'mascot.greeting.4'] },
    'idle': { keys: ['mascot.idle.1', 'mascot.idle.2', 'mascot.idle.3', 'mascot.idle.4', 'mascot.idle.5'] },
};

export function poolFor(id: BucketId): LinePool {
    return LINES[id];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/lines.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/lines.ts src/game/mascot/reactions/lines.test.ts
git commit -m "feat(mascot): line pools + streak escalation config"
```

---

## Task 4: Pure line selection (pool avoidance + escalation)

**Files:**
- Create: `src/game/mascot/reactions/reactionSelection.ts`
- Test: `src/game/mascot/reactions/reactionSelection.test.ts`

**Interfaces:**
- Consumes: `poolFor`, `LinePool` from `./lines`; `BucketId` from `./buckets`.
- Produces:
  - `function pickLine(bucketId: BucketId, opts: { recent: string[]; count?: number; rand?: () => number }): string`
    - If the pool escalates and `count` is given: choose the highest escalation key whose threshold `count` meets; ignore recent-avoidance for escalation (the arc is the point).
    - Otherwise: filter out `recent` keys; if all filtered out, use the full pool; pick via `rand()` (default `Math.random`).

- [ ] **Step 1: Write the failing test**

```ts
import { pickLine } from './reactionSelection';

describe('pickLine', () => {
    it('never repeats a recent key when alternatives exist', () => {
        const recent = ['mascot.runWon.1', 'mascot.runWon.2', 'mascot.runWon.3'];
        // rand=0 would pick index 0 of the filtered pool
        const key = pickLine('run-won', { recent, rand: () => 0 });
        expect(recent).not.toContain(key);
        expect(key).toBe('mascot.runWon.4');
    });

    it('falls back to full pool when everything is recent', () => {
        const recent = ['mascot.clutch.1'];
        const key = pickLine('clutch', { recent, rand: () => 0 });
        expect(key).toBe('mascot.clutch.1');
    });

    it('escalates by count threshold', () => {
        expect(pickLine('streak', { recent: [], count: 3 })).toBe('mascot.streak.tier1');
        expect(pickLine('streak', { recent: [], count: 6 })).toBe('mascot.streak.tier2');
        expect(pickLine('streak', { recent: [], count: 25 })).toBe('mascot.streak.tier3');
    });

    it('escalation below the first threshold uses the base pool', () => {
        expect(pickLine('streak', { recent: [], count: 2, rand: () => 0 })).toBe('mascot.streak.1');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/reactionSelection.test.ts`
Expected: FAIL — cannot find module `./reactionSelection`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { poolFor } from './lines';
import type { BucketId } from './buckets';

export function pickLine(
    bucketId: BucketId,
    opts: { recent: string[]; count?: number; rand?: () => number },
): string {
    const pool = poolFor(bucketId);
    const rand = opts.rand ?? Math.random;

    if (pool.escalation && typeof opts.count === 'number') {
        const { thresholds, keys } = pool.escalation;
        let idx = -1;
        for (let i = 0; i < thresholds.length; i++) {
            if (opts.count >= thresholds[i]) idx = i;
        }
        if (idx >= 0) return keys[idx];
        // below the first threshold: fall through to the base pool
    }

    const filtered = pool.keys.filter((k) => !opts.recent.includes(k));
    const choices = filtered.length > 0 ? filtered : pool.keys;
    return choices[Math.floor(rand() * choices.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/reactionSelection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/reactionSelection.ts src/game/mascot/reactions/reactionSelection.test.ts
git commit -m "feat(mascot): pure line selection with repeat-avoidance + escalation"
```

---

## Task 5: Reaction director — emit, priority, cooldown, stale-scope, guards

**Files:**
- Create: `src/game/mascot/reactions/reactionDirector.ts`
- Test: `src/game/mascot/reactions/reactionDirector.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `interface DirectorConfig { cooldownMs: number; navQuietMs: number; recentSize: number; now: () => number }`
  - `interface Utterance { bucketId: BucketId; expression: MascotExpression; textKey?: string; ctx: EventContext }` (`textKey` omitted for expression-only buckets)
  - `interface DirectorState { utterance: Utterance | null; expression: MascotExpression }`
  - `interface Blockers { timerRunning: boolean; transitioning: boolean; modalOpen: boolean; purchasePending: boolean }`
  - `function createReactionDirector(cfg: Partial<DirectorConfig>): ReactionDirector`
  - `ReactionDirector = { emit, getState, subscribe, setScope, setBlockers, onNavigate, onBackground, reset, rand }` where:
    - `emit(name: EventName, ctx: EventContext): void` — resolves bucket; drops if a blocker is active, if the event surface isn't allowed for the current scope, if the event's `scope.navSeq` is stale, or if within cooldown (unless the incoming priority strictly exceeds the current utterance's and cooldown, in which case it preempts). On accept: expression always updates; spoken buckets set `utterance.textKey` and start the cooldown; the chosen key is pushed to that bucket's recent list (bounded by `recentSize`).
    - `setScope(scope: MascotScope)`, `setBlockers(b: Partial<Blockers>)`, `onNavigate()` (bumps navSeq, records nav time, clears any visible utterance), `onBackground()` (clears utterance + expression to neutral).
    - `subscribe(fn) => unsubscribe`, `getState()`.

Key rule detail for tests: an event is accepted only when `resolveBucket(name).surfaces === 'all'` OR includes `scope.surface`.

- [ ] **Step 1: Write the failing test**

```ts
import { createReactionDirector } from './reactionDirector';

function makeDirector(now = { t: 0 }) {
    return createReactionDirector({ cooldownMs: 5000, navQuietMs: 500, recentSize: 3, now: () => now.t });
}

describe('reactionDirector', () => {
    it('emits a spoken utterance on the right surface', () => {
        const now = { t: 1000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        now.t = 2000; // past navQuiet
        d.emit('home-focus', {});
        expect(d.getState().utterance?.textKey).toMatch(/^mascot\.greeting\./);
        expect(d.getState().expression).toBe('happy');
    });

    it('drops events whose surface is not allowed', () => {
        const d = makeDirector();
        d.setScope({ surface: 'store', navSeq: 1 });
        d.emit('run-won', {}); // run-won only allowed on game
        expect(d.getState().utterance).toBeNull();
    });

    it('respects cooldown but lets higher priority preempt', () => {
        const now = { t: 10000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.emit('home-focus', {});           // greeting, prio 20
        const first = d.getState().utterance?.bucketId;
        expect(first).toBe('greeting');
        now.t = 10100;                       // still within cooldown
        d.emit('idle', {});                  // prio 5 — dropped
        expect(d.getState().utterance?.bucketId).toBe('greeting');
        d.emit('level-up', {});              // prio 90 — preempts
        expect(d.getState().utterance?.bucketId).toBe('level-up');
    });

    it('drops when a blocker is active', () => {
        const d = makeDirector();
        d.setScope({ surface: 'game', roundId: 'r1', navSeq: 1 });
        d.setBlockers({ timerRunning: true });
        d.emit('run-won', {});
        expect(d.getState().utterance).toBeNull();
    });

    it('expression-only bucket sets face but no text', () => {
        const d = makeDirector();
        d.setScope({ surface: 'game', roundId: 'r1', navSeq: 1 });
        d.emit('streak-milestone', { count: 5 });
        expect(d.getState().expression).toBe('happy');
        expect(d.getState().utterance?.textKey).toBeUndefined();
    });

    it('onBackground clears everything to neutral', () => {
        const now = { t: 5000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.emit('home-focus', {});
        d.onBackground();
        expect(d.getState().utterance).toBeNull();
        expect(d.getState().expression).toBe('neutral');
    });

    it('onNavigate within navQuiet suppresses the next emit', () => {
        const now = { t: 0 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.onNavigate();          // records nav at t=0
        now.t = 200;             // < navQuietMs (500)
        d.emit('home-focus', {});
        expect(d.getState().utterance).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/reactionDirector.test.ts`
Expected: FAIL — cannot find module `./reactionDirector`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { resolveBucket, type BucketId } from './buckets';
import { pickLine } from './reactionSelection';
import type { EventContext, EventName, MascotScope } from './events';
import type { MascotExpression } from './expressions';

export interface DirectorConfig {
    cooldownMs: number;
    navQuietMs: number;
    recentSize: number;
    now: () => number;
    rand: () => number;
}

export interface Utterance {
    bucketId: BucketId;
    expression: MascotExpression;
    textKey?: string;
    ctx: EventContext;
}

export interface DirectorState {
    utterance: Utterance | null;
    expression: MascotExpression;
}

export interface Blockers {
    timerRunning: boolean;
    transitioning: boolean;
    modalOpen: boolean;
    purchasePending: boolean;
}

const DEFAULTS: DirectorConfig = {
    cooldownMs: 6000,
    navQuietMs: 600,
    recentSize: 3,
    now: () => Date.now(),
    rand: Math.random,
};

export function createReactionDirector(cfg: Partial<DirectorConfig> = {}) {
    const config: DirectorConfig = { ...DEFAULTS, ...cfg };
    let scope: MascotScope = { surface: 'other', navSeq: 0 };
    let blockers: Blockers = { timerRunning: false, transitioning: false, modalOpen: false, purchasePending: false };
    let state: DirectorState = { utterance: null, expression: 'neutral' };
    let lastSpokenAt = -Infinity;
    let lastNavAt = -Infinity;
    let lastPriority = -Infinity;
    const recent: Record<string, string[]> = {};
    const subs = new Set<(s: DirectorState) => void>();

    const emitState = () => subs.forEach((f) => f(state));

    function anyBlocker(): boolean {
        return blockers.timerRunning || blockers.transitioning || blockers.modalOpen || blockers.purchasePending;
    }

    function surfaceAllowed(name: EventName): boolean {
        const b = resolveBucket(name);
        return b.surfaces === 'all' || b.surfaces.includes(scope.surface);
    }

    function emit(name: EventName, ctx: EventContext = {}) {
        const now = config.now();
        if (anyBlocker()) return;
        if (now - lastNavAt < config.navQuietMs) return;
        if (!surfaceAllowed(name)) return;

        const bucket = resolveBucket(name);
        const withinCooldown = now - lastSpokenAt < config.cooldownMs;
        const isSpoken = bucket.spoken;

        // Cooldown gates SPOKEN utterances; expression-only changes are always allowed.
        if (isSpoken && withinCooldown && bucket.priority <= lastPriority) return;

        if (isSpoken) {
            const key = pickLine(bucket.id, {
                recent: recent[bucket.id] ?? [],
                count: typeof ctx.count === 'number' ? ctx.count : undefined,
                rand: config.rand,
            });
            recent[bucket.id] = [...(recent[bucket.id] ?? []), key].slice(-config.recentSize);
            state = { utterance: { bucketId: bucket.id, expression: bucket.expression, textKey: key, ctx }, expression: bucket.expression };
            lastSpokenAt = now;
            lastPriority = bucket.priority;
        } else {
            state = { ...state, utterance: { bucketId: bucket.id, expression: bucket.expression, ctx }, expression: bucket.expression };
        }
        emitState();
    }

    return {
        emit,
        rand: config.rand,
        getState: () => state,
        subscribe(fn: (s: DirectorState) => void) { subs.add(fn); return () => subs.delete(fn); },
        setScope(next: MascotScope) { scope = next; },
        setBlockers(patch: Partial<Blockers>) { blockers = { ...blockers, ...patch }; },
        onNavigate() {
            lastNavAt = config.now();
            scope = { ...scope, navSeq: scope.navSeq + 1 };
            if (state.utterance) { state = { ...state, utterance: null }; emitState(); }
        },
        onBackground() {
            state = { utterance: null, expression: 'neutral' };
            lastPriority = -Infinity;
            emitState();
        },
        reset() {
            state = { utterance: null, expression: 'neutral' };
            lastSpokenAt = -Infinity; lastNavAt = -Infinity; lastPriority = -Infinity;
            for (const k of Object.keys(recent)) delete recent[k];
            emitState();
        },
    };
}

export type ReactionDirector = ReturnType<typeof createReactionDirector>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/reactionDirector.test.ts`
Expected: PASS (7 tests). Note: the preempt test relies on `home-focus` being emitted after navQuiet — the test sets `now.t` high and never calls `onNavigate`, so `lastNavAt` stays `-Infinity`.

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/reactionDirector.ts src/game/mascot/reactions/reactionDirector.test.ts
git commit -m "feat(mascot): reaction director core (priority, cooldown, guards, scope)"
```

---

## Task 6: Idle drip scheduling

**Files:**
- Modify: `src/game/mascot/reactions/reactionDirector.ts`
- Modify: `src/game/mascot/reactions/reactionDirector.test.ts`

**Interfaces:**
- Produces (added to `ReactionDirector`):
  - `startIdle(): void` — begins a drip: on each `tick`, if the current surface is `home`, no blockers, and idle enabled, emit an `idle` line, then hide it after `idleShowMs`, wait `idleGapMs`, emit the next. Any `emit` of higher priority or any `onNavigate`/`onBackground` cancels the drip.
  - `tick(): void` — advances the idle scheduler using `config.now()` (host calls it on an interval).
  - `stopIdle(): void`.
  - Config additions: `idleShowMs: number; idleGapMs: number`.

- [ ] **Step 1: Write the failing test** (append)

```ts
describe('idle drip', () => {
    it('drips idle lines one at a time and hides between', () => {
        const now = { t: 0 };
        const d = createReactionDirector({ now: () => now.t, idleShowMs: 3000, idleGapMs: 2000, cooldownMs: 0, navQuietMs: 0 });
        d.setScope({ surface: 'home', navSeq: 1 });
        d.startIdle();
        d.tick(); // first line shows
        expect(d.getState().utterance?.bucketId).toBe('idle');
        now.t = 3001; d.tick(); // past show window -> hidden
        expect(d.getState().utterance).toBeNull();
        now.t = 5002; d.tick(); // past gap -> next line
        expect(d.getState().utterance?.bucketId).toBe('idle');
    });

    it('navigation cancels the drip', () => {
        const now = { t: 0 };
        const d = createReactionDirector({ now: () => now.t, cooldownMs: 0, navQuietMs: 0 });
        d.setScope({ surface: 'home', navSeq: 1 });
        d.startIdle(); d.tick();
        d.onNavigate();
        now.t = 10000; d.tick();
        expect(d.getState().utterance).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/reactionDirector.test.ts -t "idle drip"`
Expected: FAIL — `d.startIdle is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `DEFAULTS`: `idleShowMs: 4000, idleGapMs: 4000` and to `DirectorConfig`. Inside `createReactionDirector`, add drip state and methods:

```ts
    let idleOn = false;
    let idlePhase: 'show' | 'gap' = 'gap';
    let idlePhaseUntil = 0;

    function stopIdle() { idleOn = false; if (state.utterance?.bucketId === 'idle') { state = { ...state, utterance: null }; emitState(); } }
    function startIdle() { idleOn = true; idlePhase = 'gap'; idlePhaseUntil = config.now(); }

    function tick() {
        if (!idleOn) return;
        if (scope.surface !== 'home' || anyBlocker()) return;
        const now = config.now();
        if (now < idlePhaseUntil) return;
        if (idlePhase === 'gap') {
            emit('idle', {});
            idlePhase = 'show';
            idlePhaseUntil = now + config.idleShowMs;
        } else {
            if (state.utterance?.bucketId === 'idle') { state = { ...state, utterance: null }; emitState(); }
            idlePhase = 'gap';
            idlePhaseUntil = now + config.idleGapMs;
        }
    }
```

Wire `stopIdle()` into `onNavigate` and `onBackground` (call it before their existing body). Add `startIdle`, `stopIdle`, `tick` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/reactionDirector.test.ts`
Expected: PASS (all, incl. 2 new idle tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/reactionDirector.ts src/game/mascot/reactions/reactionDirector.test.ts
git commit -m "feat(mascot): interruptible idle drip scheduler"
```

---

## Task 7: Facial expressions in the Mascot render

**Files:**
- Modify: `src/game/mascot/Mascot.tsx`
- Test: `src/game/mascot/Mascot.expression.test.tsx`

**Interfaces:**
- Consumes: `MascotExpression` from `./reactions/expressions`.
- Produces: `Mascot` and `renderMascot` accept an optional `expression?: MascotExpression` (default `'neutral'` = today's face). The four fixed facial-feature paths (brows, eyes, nose, mouth) become a function of `expression`; the recolorable body/fur/suit/mic paths and the SHADE/HILITE seam are UNCHANGED.

Implementation guidance (the art): keep one `renderFace(expression)` block that returns the eyes/brows/mouth SVG for the given expression. `neutral` = the current paths verbatim. The other four vary only brows + mouth + eye shape (cheap, few nodes, palette-independent since features are the fixed dark `#1F2937`):
- `happy`: raised arch brows (current), mouth = bigger upward curve.
- `worried`: brows angled up-inward, mouth = small flat/downward curve.
- `smug`: one brow raised, mouth = asymmetric smirk (curve up on one side).
- `surprised`: brows high + straight, eyes rounder (larger `ry`), mouth = small open circle.

Keep total added nodes within `MASCOT_NODE_CEILING` (52). This task ships the `neutral` + `happy` + `worried` faces; Task 8 adds `smug` + `surprised` (split so art can be reviewed in two passes, and each face is independently testable via snapshot).

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import renderer from 'react-test-renderer';
import { Mascot } from './Mascot';
import { NEUTRAL_LOOK } from './look'; // if absent, build an inline look map of the 4 slots

describe('Mascot expression', () => {
    it('renders happy without throwing and differs from neutral', () => {
        const neutral = renderer.create(<Mascot look={NEUTRAL_LOOK} pose='idle' expression='neutral' />).toJSON();
        const happy = renderer.create(<Mascot look={NEUTRAL_LOOK} pose='idle' expression='happy' />).toJSON();
        expect(neutral).toBeTruthy();
        expect(JSON.stringify(happy)).not.toEqual(JSON.stringify(neutral));
    });
});
```

(If `NEUTRAL_LOOK` doesn't exist, inline `const NEUTRAL_LOOK = { fur: 'default', suit: 'default', accent: 'default', mic: 'default' } as any;` — the render is ownership-agnostic and falls back to slot defaults.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/Mascot.expression.test.tsx`
Expected: FAIL — `expression` prop has no effect (outputs identical), or type error on the prop.

- [ ] **Step 3: Write minimal implementation**

Add `expression?: MascotExpression` to `MascotProps` and `renderMascot`. Extract the facial-feature JSX (the brows `<Path>`s, eyes `<Ellipse>`/`<Circle>`, nose `<Path>`, mouth `<Path>` — lines ~211–233 today) into `function renderFace(expression: MascotExpression)`. Return the current paths for `neutral`; return variant brows/mouth/eyes for `happy` and `worried` per the guidance above. Render `{renderFace(expression)}` in place of the inlined block.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/Mascot.expression.test.tsx`
Expected: PASS. Also run `npx tsc --noEmit` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/Mascot.tsx src/game/mascot/Mascot.expression.test.tsx
git commit -m "feat(mascot): expression-driven face (neutral/happy/worried)"
```

---

## Task 8: Remaining expressions (smug, surprised)

**Files:**
- Modify: `src/game/mascot/Mascot.tsx`
- Modify: `src/game/mascot/Mascot.expression.test.tsx`

- [ ] **Step 1: Write the failing test** (append)

```tsx
it.each(['smug', 'surprised'] as const)('renders %s distinctly', (expr) => {
    const neutral = renderer.create(<Mascot look={NEUTRAL_LOOK} pose='idle' expression='neutral' />).toJSON();
    const variant = renderer.create(<Mascot look={NEUTRAL_LOOK} pose='idle' expression={expr} />).toJSON();
    expect(JSON.stringify(variant)).not.toEqual(JSON.stringify(neutral));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/Mascot.expression.test.tsx -t "renders"`
Expected: FAIL — smug/surprised currently fall through to neutral, so JSON matches.

- [ ] **Step 3: Write minimal implementation**

Add the `smug` and `surprised` branches to `renderFace` per the Task 7 guidance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/Mascot.expression.test.tsx`
Expected: PASS (all expression tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/Mascot.tsx src/game/mascot/Mascot.expression.test.tsx
git commit -m "feat(mascot): smug + surprised expressions"
```

---

## Task 9: MascotOverlay accepts expression + auto-hides spoken bubbles

**Files:**
- Modify: `src/game/mascot/MascotOverlay.tsx`
- Test: `src/game/mascot/MascotOverlay.test.tsx`

**Interfaces:**
- Consumes: `MascotExpression`.
- Produces: `MascotOverlayProps` gains `expression?: MascotExpression` (forwarded to `<Mascot>`) and `autoHideMs?: number` — when set and `message` is non-null, the overlay calls `onAutoHide?.()` after `autoHideMs`. Adds `onAutoHide?: () => void`.

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { MascotOverlay } from './MascotOverlay';

jest.useFakeTimers();

it('calls onAutoHide after autoHideMs when a message is shown', () => {
    const onAutoHide = jest.fn();
    render(<MascotOverlay pose='idle' message='hi' autoHideMs={3000} onAutoHide={onAutoHide} />);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onAutoHide).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/MascotOverlay.test.tsx`
Expected: FAIL — `onAutoHide`/`autoHideMs` not implemented.

- [ ] **Step 3: Write minimal implementation**

Add the two props. Forward `expression` into `<Mascot look={look} pose={pose} size={size} expression={expression} />`. Add an effect:

```tsx
useEffect(() => {
    if (!message || !autoHideMs) return;
    const id = setTimeout(() => onAutoHide?.(), autoHideMs);
    return () => clearTimeout(id);
}, [message, autoHideMs, onAutoHide]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/MascotOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/MascotOverlay.tsx src/game/mascot/MascotOverlay.test.tsx
git commit -m "feat(mascot): overlay forwards expression + auto-hides spoken bubbles"
```

---

## Task 10: Settings toggle `mascotChatter`

**Files:**
- Modify: `src/hooks/useSettings.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/pl.json`

**Interfaces:**
- Produces: `SettingsState.mascotChatter: boolean` (default `true`), `setMascotChatter(v: boolean)` in the context, following the exact pattern of `soundEffects`.

- [ ] **Step 1: Add the setting to `useSettings.tsx`**

In `SettingsState` add `mascotChatter: boolean;`. In `SettingsContextValue` add `setMascotChatter: (v: boolean) => void;`. In `defaults` add `mascotChatter: true,`. In `load()` add `mascotChatter: storage.getBoolean('mascotChatter') ?? defaults.mascotChatter,`. In the default context object add `setMascotChatter: () => {},`. In the provider add:

```tsx
const setMascotChatter = useCallback((v: boolean) => {
    setState((s) => ({ ...s, mascotChatter: v }));
    storage.set('mascotChatter', v);
}, []);
```

Add `setMascotChatter` to the `value` object.

- [ ] **Step 2: Add copy keys**

`en.json` under `screen.settings` (match existing structure): `"mascotChatter": "Mascot chatter"`, `"mascotChatterHint": "Let the fox comment out loud."`. `pl.json`: `"mascotChatter": "Gadatliwy lis"`, `"mascotChatterHint": "Pozwól lisowi komentować na głos."`.

- [ ] **Step 3: Add the toggle row to `SettingsScreen.tsx`**

Copy the existing `soundEffects` toggle row (find `settings.soundEffects` usage) and duplicate it for `mascotChatter`, reading `mascotChatter` and calling `setMascotChatter`.

- [ ] **Step 4: Verify types + a smoke test**

Run: `npx tsc --noEmit` — expect no errors. Run existing settings tests if any: `npx jest src/hooks` (expect pass or no tests found).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.tsx src/screens/SettingsScreen.tsx src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(settings): mascot chatter toggle (silent-but-present when off)"
```

---

## Task 11: React provider — wire director to navigation, AppState, reduced-motion, settings

**Files:**
- Create: `src/game/mascot/reactions/useMascotDirector.tsx`
- Create: `src/game/mascot/reactions/emit.ts`
- Test: `src/game/mascot/reactions/useMascotDirector.test.tsx`

**Interfaces:**
- Consumes: `createReactionDirector`, `EventName`, `EventContext`, `Surface`.
- Produces:
  - `MascotDirectorProvider` (React component) — creates ONE director via `useRef`, subscribes state into React state, and:
    - maps the current navigation route name → `Surface` and calls `director.setScope` + `director.onNavigate` on route change (bump navSeq, quiet window),
    - listens to `AppState` `change` → `background`/`inactive` calls `director.onBackground()`,
    - when `mascotChatter` setting is `false`, suppresses SPOKEN utterances at the HOST layer (director still tracks expression) — pass `chatter` down via context so the host hides the bubble but keeps the face,
    - runs a `setInterval(() => director.tick(), 1000)` while mounted (idle drip clock), cleared on unmount.
  - `useMascotEmit(): (name, ctx?) => void` — returns `director.emit` bound.
  - `useMascotState(): { utterance, expression, chatter }` — for the host.
  - `emit.ts`: `route-to-surface` map helper `surfaceForRoute(routeName: string): Surface`.

- [ ] **Step 1: Write the failing test** (logic-level: route→surface mapping is the testable pure part)

```ts
import { surfaceForRoute } from './emit';

it('maps routes to surfaces', () => {
    expect(surfaceForRoute('Home')).toBe('home');
    expect(surfaceForRoute('Store')).toBe('store');
    expect(surfaceForRoute('Challenge')).toBe('challenge');
    expect(surfaceForRoute('Mascot')).toBe('mascot');
    expect(surfaceForRoute('ladder-play')).toBe('game');
    expect(surfaceForRoute('SomethingElse')).toBe('other');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/useMascotDirector.test.tsx`
Expected: FAIL — cannot find `./emit`.

- [ ] **Step 3: Write minimal implementation**

`emit.ts`:

```ts
import type { Surface } from './events';

const EXACT: Record<string, Surface> = {
    Home: 'home', Store: 'store', Progress: 'progress',
    Challenge: 'challenge', ChallengeHistory: 'challenge', Mascot: 'mascot',
};

export function surfaceForRoute(routeName: string): Surface {
    if (EXACT[routeName]) return EXACT[routeName];
    if (/play|game/i.test(routeName)) return 'game';
    return 'other';
}
```

Then implement `useMascotDirector.tsx` with the provider/hooks per the Interfaces block. Use `useReducedMotion()` to pass a `reduced` flag through context (the host uses it to damp animation). Read `mascotChatter` from `useSettings()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/useMascotDirector.test.tsx`
Expected: PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/useMascotDirector.tsx src/game/mascot/reactions/emit.ts src/game/mascot/reactions/useMascotDirector.test.tsx
git commit -m "feat(mascot): director provider wired to nav/appstate/settings + route-surface map"
```

---

## Task 12: Dev-time i18n completeness guard

**Files:**
- Create: `src/game/mascot/reactions/lines.i18n.test.ts`

**Interfaces:**
- Consumes: `LINES`, `en.json`, `pl.json`.

This is the "fail loud if a PL key is missing" guarantee, enforced as a test (runs in CI/dev, never ships a silent EN fallback).

- [ ] **Step 1: Write the failing test**

```ts
import { LINES } from './lines';
import en from '../../../i18n/locales/en.json';
import pl from '../../../i18n/locales/pl.json';

function get(obj: any, path: string): unknown {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const allKeys = Array.from(
    new Set(
        Object.values(LINES).flatMap((p) => [...p.keys, ...(p.escalation?.keys ?? [])]),
    ),
);

describe('mascot line i18n completeness', () => {
    it.each(allKeys)('EN has %s', (key) => { expect(typeof get(en, key)).toBe('string'); });
    it.each(allKeys)('PL has %s', (key) => { expect(typeof get(pl, key)).toBe('string'); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/mascot/reactions/lines.i18n.test.ts`
Expected: FAIL — no `mascot.*` keys exist yet.

- [ ] **Step 3: Author the copy (EN + PL)**

Add a `"mascot"` object to BOTH locale files with every key referenced in `LINES` (Task 3). Write in the warm host voice with adaptive register; keep lines short (fit 3 lines in the bubble). Example EN entries:

```json
"mascot": {
  "runWon": { "1": "That's a win. Textbook.", "2": "You made that look easy.", "3": "Champion stuff.", "4": "Take a bow." },
  "runLost": { "1": "Ah — so close.", "2": "That one stung. Rematch?", "3": "We'll get it next time.", "4": "Brutal. Shake it off." },
  "greeting": { "1": "Welcome in. I'll keep score.", "2": "Back for more? Good.", "3": "Ready when you are.", "4": "Let's make it count." },
  "streak": { "1": "On a roll.", "tier1": "Three straight!", "tier2": "Five! You're on fire.", "tier3": "Ten in a row — unstoppable." },
  "idle": { "1": "Take your time.", "2": "I'm not going anywhere.", "3": "Pick a game, any game.", "4": "The Wheel's feeling lucky today.", "5": "Still here." },
  "levelUp": { "1": "Level up! Look at you.", "2": "New level. Earned it.", "3": "Onwards and upwards." },
  "challengeWin": { "1": "You beat their score. Savage.", "2": "Bragging rights: yours." },
  "challengeIn": { "1": "A challenge landed. Someone's brave.", "2": "New challenge for you." },
  "challengeOut": { "1": "Challenge sent. Now we wait.", "2": "Let's see if they can match that." },
  "offlineLimit": { "1": "That's today's free runs. The Store lifts the cap.", "2": "Out of solo runs for today." },
  "unlock": { "1": "Unlocked. Nice pickup.", "2": "New content — go try it." },
  "lookEquipped": { "1": "Sharp look.", "2": "Suits me, doesn't it?", "3": "Dressed to host." },
  "clutch": { "1": "Down to the wire!" },
  "allIn": { "1": "All in — and it paid off!" }
}
```

Author the matching PL block (same keys, natural Polish, not literal). Keep the fox's warm-host register.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/game/mascot/reactions/lines.i18n.test.ts`
Expected: PASS (every key present in both locales).

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/lines.i18n.test.ts src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(mascot): author EN+PL line copy + i18n completeness guard"
```

---

## Task 13: MascotHost — the single app-root overlay

**Files:**
- Create: `src/game/mascot/reactions/MascotHost.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `useMascotState`, `MascotOverlay`, `useTranslation`.
- Produces: `MascotHost` — renders nothing on surfaces where the fox shouldn't sit (its visibility is driven by the current utterance/expression + surface). It:
  - reads `{ utterance, expression, chatter }` from `useMascotState()`,
  - resolves `message = chatter && utterance?.textKey ? t(utterance.textKey, utterance.ctx) : null`,
  - renders `<MascotOverlay pose='idle' expression={expression} message={message} autoHideMs={BUBBLE_MS} onAutoHide={clearUtterance} anchor='bottom-right' size={120} />`,
  - maps `run-won` → pose `cheer`, `run-lost` → pose `dismay` for the moment of that utterance (optional polish; default `idle`).

- [ ] **Step 1: Mount the provider + host in `RootNavigator.tsx`**

Wrap `<NavigationContainer>`'s children so the host renders ABOVE all screens. Because scope tracking needs navigation state, put `MascotDirectorProvider` INSIDE `NavigationContainer` (it uses the navigation ref/state), and render `<MascotHost />` as the last child of the provider, as a sibling of `<Stack.Navigator>`:

```tsx
<NavigationContainer theme={navTheme} linking={linking}>
    <MascotDirectorProvider>
        <Stack.Navigator /* ...unchanged... */>
            {/* ...unchanged screens... */}
        </Stack.Navigator>
        <MascotHost />
    </MascotDirectorProvider>
</NavigationContainer>
```

- [ ] **Step 2: Implement `MascotHost.tsx`** per the Interfaces block.

- [ ] **Step 3: Verify build + types**

Run: `npx tsc --noEmit` — expect no errors. Run the full mascot test dir: `npx jest src/game/mascot`.
Expected: PASS.

- [ ] **Step 4: Manual smoke (device/simulator)**

Per CLAUDE.md, use a dev build: `npx expo run:ios`. Confirm: launch → greeting bubble appears then auto-hides; sit idle on Home → idle lines drip and stop on navigation.

- [ ] **Step 5: Commit**

```bash
git add src/game/mascot/reactions/MascotHost.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(mascot): app-root mascot host wired into the navigator"
```

---

## Task 14: Emit from Home + retire the bespoke home-message path

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify (delete usage): `src/game/mascot/homeMessages.ts` becomes unused for selection; KEEP the file only if other code imports it — otherwise remove it and its test.

**Interfaces:**
- Consumes: `useMascotEmit`.

- [ ] **Step 1: Emit `home-focus` on focus, `offline-limit` when applicable**

In `HomeScreen`, replace the `useFocusEffect` that set `mascotPose`/`mascotMessage` and the `selectHomeMascotMessage` wiring with:

```tsx
const emitMascot = useMascotEmit();
useFocusEffect(useCallback(() => {
    emitMascot('home-focus', { streak });
    if (remainingOfflineRuns(ownedIds, isPremium) === 0 && canUpsell(ownedIds, isPremium)) {
        emitMascot('offline-limit', {});
    }
}, [emitMascot, streak, ownedIds, isPremium]));
```

Remove the now-dead local mascot state (`mascotPose`, `mascotMessage`, `resolveMascotMessage`, `showMascotMessage*`, `handleMascotMessagePress`) and the local `<MascotOverlay>` at the bottom of `HomeScreen` (the host renders it globally now).

- [ ] **Step 2: Idle — start/stop the drip on Home**

The provider's `tick` runs globally; the drip only fires on the `home` surface, so no extra Home wiring is needed beyond `startIdle()` being called when the app settles on Home. Add to the provider: call `director.startIdle()` whenever surface becomes `home`, `director.stopIdle()` when it leaves. (If already covered in Task 11, skip.)

- [ ] **Step 3: Remove dead code**

If nothing else imports `homeMessages.ts`, delete `src/game/mascot/homeMessages.ts` and `src/game/mascot/homeMessages.test.ts`, and drop the `mascotCloud` keys from both locale files (superseded by `mascot.*`). Confirm with: `grep -rn "homeMessages\|mascotCloud\|selectHomeMascotMessage" src`.

- [ ] **Step 4: Verify**

Run: `npx jest src/screens 2>/dev/null; npx tsc --noEmit`.
Expected: no type errors; grep from Step 3 returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(mascot): Home emits events; retire bespoke home-message path"
```

---

## Task 15: Emit run-end + expression-only mid-run from the games

**Files:**
- Modify: `src/game/ladder/LadderPlayScreen.tsx`
- Modify: `src/game/drop/DropPlayScreen.tsx`
- Modify: `src/game/wheel/WheelPlayScreen.tsx`
- Modify: the Grid play screen (fourth game) if present
- Modify: `src/game/GameOverHeader.tsx` (optional: emit on mount)

**Interfaces:**
- Consumes: `useMascotEmit`.

Emit rules per game (fire-and-forget; the director's guards handle timing):
- On reaching the game-over/results state: `emit(won ? 'run-won' : 'run-lost', { gameId })`. (These pass the director's `game` surface + no active timer, so they speak.)
- Set `director.setBlockers({ timerRunning: true })` while a question timer is counting and `false` at lock/reveal — expose a `useMascotBlockers()` helper from the provider that games call, OR simpler: have each game emit `streak-milestone`/`clutch`/`all-in-survived` ONLY at the safe post-reveal beat, and never emit spoken events mid-round (the trigger table already marks those three as `spoken:false`, so they can't open a bubble regardless).
- Ladder: at a correct reveal that crosses a streak threshold, `emit('streak-milestone', { count: currentStreak })`; at a fast-correct high rung, `emit('clutch', {})`.
- Drop: when a survived allocation was the full stake, `emit('all-in-survived', {})`.
- Wheel: on a clean solve, `emit('clutch', {})` (optional).

Because the three mid-run events are `spoken:false`, they only change the fox's face; there is no bubble and no entrance during play (satisfies the "no spoken mid-run" constraint without needing precise timer-blocker wiring in v1).

- [ ] **Step 1: Wire Ladder run-end + streak**

In `LadderPlayScreen`, where `won`/game-over is determined (near the `GameOverHeader pose={won ? 'cheer' : 'dismay'}` at line ~699), add on the transition into that state:

```tsx
const emitMascot = useMascotEmit();
useEffect(() => {
    if (isGameOver) emitMascot(won ? 'run-won' : 'run-lost', { gameId: GAME_ID });
}, [isGameOver, won, emitMascot]);
```

And at the correct-answer reveal handler, when the streak count hits a threshold, `emitMascot('streak-milestone', { count: streakCount })`.

- [ ] **Step 2: Wire Drop + Wheel run-end** identically (map their own win/lose state), plus Drop `all-in-survived` and Wheel `clutch` at their safe beats.

- [ ] **Step 3: Wire the Grid game** run-end the same way (inspect its win/lose state first).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`. Manual: play a Ladder run to a win → at results the fox shows `happy` + a `run-won` line; lose → `worried` + `run-lost`. Mid-run streak → face brightens, no bubble.

- [ ] **Step 5: Commit**

```bash
git add src/game
git commit -m "feat(mascot): games emit run-end + expression-only mid-run reactions"
```

---

## Task 16: Emit economy + challenge events

**Files:**
- Modify: the purchase-completion path in `src/hooks/store/*` or `src/screens/store/StoreScreen.tsx`
- Modify: `src/screens/MascotScreen.tsx` (look-equipped)
- Modify: `src/game/progression/*` level-up path or wherever level-up is detected
- Modify: `src/screens/ChallengeScreen.tsx` (received/beaten) and the challenge-send path

**Interfaces:**
- Consumes: `useMascotEmit`.

Guards to honor (per Global Constraints): emit `unlock` only AFTER the purchase is confirmed (not on optimistic tap) to avoid the double-fire Codex flagged; set `purchasePending` blocker true during the transaction if the provider exposes it, or simply emit once in the single confirmed-success callback.

- [ ] **Step 1: `look-equipped`** — in `MascotScreen`, on the equip/save action success, `emitMascot('look-equipped', {})`.
- [ ] **Step 2: `level-up`** — where the app detects a level increase (progression), `emitMascot('level-up', { count: newLevel })`. Emit exactly once per level gain (guard against re-fire on re-render).
- [ ] **Step 3: `unlock`** — in the single confirmed purchase-success handler, `emitMascot('unlock', {})`.
- [ ] **Step 4: challenge events** — `challenge-received` when a challenge deep-link/record opens, `challenge-beaten` when the player's result beats the sender, `challenge-sent` on successful share.
- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit`. Manual smoke each path. Then:

```bash
git add -A
git commit -m "feat(mascot): emit economy + challenge reactions (dedup on confirmed success)"
```

---

## Task 17: Full regression + tuning pass

**Files:**
- Modify: `src/game/mascot/reactions/reactionDirector.ts` (constants only, if tuning)

- [ ] **Step 1: Run the whole suite**

Run: `npx jest` and `npx tsc --noEmit`.
Expected: all green.

- [ ] **Step 2: Device tuning pass** (dev build)

On device, tune the constants (no logic change): `cooldownMs` (start 6000), `navQuietMs` (600), `idleShowMs` (4000), `idleGapMs` (6000), `BUBBLE_MS` (4000), streak thresholds. Confirm the fox never speaks over an active question, never double-fires on purchase, and idle chatter cancels the instant you touch anything.

- [ ] **Step 3: Reduced-motion + chatter-off pass**

Enable OS reduce-motion → confirm no entrance/bounce, faces still swap instantly. Turn OFF the Settings toggle → confirm the fox still reacts with faces/poses but never opens a bubble.

- [ ] **Step 4: Commit any tuning**

```bash
git add -A
git commit -m "chore(mascot): tune pacing constants after device pass"
```

---

## Self-Review Notes (coverage map)

- Offline/authored, EN+PL, keys-not-strings → Tasks 3, 12; enforced by Task 12's test.
- Central director owns pacing (priority, cooldown, stale-scope, background) → Task 5; idle drip → Task 6.
- Event+context awareness → Task 1 (`EventContext`), used in escalation Task 4.
- Shared spine + per-game flavor → shared buckets Task 2; per-game emit points Task 15 (bespoke lines can be added as extra keys later without engine change).
- Pool avoidance + escalation → Task 4.
- In-game peek = run-end spoken + expression-only mid-run, never over a question → Tasks 2 (`spoken:false`), 15.
- Reaction surfaces (home/idle/economy/challenge) → Tasks 14, 16.
- 5 expressions on the recolor rig → Tasks 7–8; forwarded Task 9; rendered Task 13.
- Auto-hide bubbles, one-wins-drop-rest, hard cooldown → Tasks 9, 5.
- Warm adaptive voice + catchphrases → Task 12 copy.
- Settings toggle (silent-but-present) + reduced-motion damping → Tasks 10, 11, 13, 17.
- Codex hardening (scope stamps, background drop, do-not-react guards, purchase dedup, fail-loud i18n, small v1) → Tasks 1, 5, 12, 16, and the Global Constraints.
