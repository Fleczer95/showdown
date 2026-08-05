# Google Play Level Up Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring ShowDown into compliance with the Google Play Games Level Up program — the "required at launch" items that are already overdue, plus the two single-use reward offers due 2026-09-30.

**Architecture:** Everything new hangs off the seams that already exist. `recordRun` stays the one impure progression seam; cloud save and Game Stats both hook there rather than growing new call sites. Conflict resolution for cloud save is a *pure element-wise merge* — legal because `ProgressionStats` is monotonic by design, so a union/max of two devices' states is always the correct answer and needs no timestamps or "last write wins" policy. Native work is confined to `modules/game-services`, which already owns the Play Games bridge.

**Tech Stack:** Expo SDK 54 / React Native 0.81.5, Kotlin (Expo module), `com.google.android.gms:play-services-games-v2:21.0.0`, MMKV, Jest.

## Execution status (2026-08-05, branch `feat/play-level-up`)

| Task | State | Commit |
|---|---|---|
| 1 — pure merge | **done**, 10 tests | `d1974a5` |
| 2 — Snapshots bridge | **written**, Kotlin unbuilt (no Android SDK) | `49c0994` |
| 3 — cloud save wiring | **done**, 7 tests | `06e0948` |
| 5 — Game Stats shaping + CSV | **done**, 8 tests | `d25492e` |
| 6 — Game Stats bridge + wiring | **written**, Kotlin unbuilt | `d93dc25` |
| 0, 4, 7–12 | blocked — need Play Console access or an Android build machine | — |

Full suite green at that point: 98 suites, 954 tests, `tsc --noEmit` clean, eslint clean.

**Deviation from the plan as written:** Task 3 originally had `cloudSave.ts` call
`loadStats`/`saveStats` directly, which would have made `recordRun → cloudSave →
recordRun` an import cycle. `restoreFromCloud` now takes local stats and returns the
merged result for the caller to persist, and `defaultStats` moved to its own
`src/game/progression/defaults.ts` (re-exported from `recordRun`, so no caller
changed). The plan's Task 3 code blocks are superseded by what is on the branch.

## Global Constraints

- **Target audience is 13+.** The under-13 exemption from PGS/achievements/Game Stats/Sidekick/rewards does **not** apply. Verified indirectly: the Play listing carries content rating "Everyone" with no Designed for Families designation.
- **Snapshot limits:** saved-game binary data ≤ 3 MB, cover image ≤ 800 KB. Our payload is a few KB of JSON — never near the limit, but the guard belongs in code.
- **Saved Games API is free.** No Google Cloud charges for saved game data.
- **targetSdk 36** (Expo 54 default). Consequence: Android 16 **ignores orientation restrictions on displays ≥ sw600dp**. Phones (< sw600dp) keep the portrait lock. This is why no manifest change is needed for large screens — only layout work.
- **This Mac has no Android SDK.** Every task below that needs a device build must be executed on a machine with the SDK, or via EAS. Jest-level tasks run anywhere.
- **Earned cosmetics stay out of `STORE_CATALOG`** — reward offers must not contaminate IAP SKUs or `is_paying_user` analytics.
- **Bilingual copy:** every new user-visible string lands in both `src/i18n/locales/en.json` and `pl.json`.

## Reference documentation

- Level Up guidelines: https://developer.android.com/games/guidelines
- Saved Games: https://developer.android.com/games/pgs/savedgames
- Game Stats (overview): https://developer.android.com/games/pgs/gamestats
- Game Stats (Android client): https://developer.android.com/games/pgs/android/gamestats
- Android 16 orientation changes: https://android-developers.googleblog.com/2025/01/orientation-and-resizability-changes-in-android-16.html

---

## Phase 0 — Console audit (no code, blocks Phases 1–2)

### Task 0: Confirm what is already configured in Play Console

Nothing here is code; it is the information the later tasks depend on. Two of these
may already be done — Sidekick in particular is believed to be enabled already.

**Files:** none. Record findings in this plan's checkboxes.

- [ ] **Step 1: Confirm Sidekick status**

Play Console → ShowDown → Grow → Play Games Services → Sidekick.
Record: enabled yes/no. If already enabled, Phase 4's Sidekick task is a no-op.

- [ ] **Step 2: Enable Saved Games**

Play Console → Play Games Services → Configuration → enable **Saved Games**.
This is a hard prerequisite: `SnapshotsClient` calls fail without it.

- [ ] **Step 3: Confirm the target-audience declaration**

Policy and programs → App content → Target audience and content.
Record which age brackets are ticked. If any bracket ≤ 12 is ticked, **stop** —
Phases 1, 2, 4 and 5 become exempt and this plan shrinks to Phase 3 only.

- [ ] **Step 4: Confirm PGS configuration is published**

Play Games Services → Configuration → publishing state. Achievements and
leaderboards already ship; this confirms the config itself is live, not draft.

---

## Phase 1 — Cloud save via Play Saved Games

**Why this shape:** `ProgressionStats` is monotonic in every field (`lifetimeXp` only
grows, `datesPlayed`/`feats` only gain entries, `bestScoreByGame` only rises). So
merging two devices is `max` on numbers and union on sets. No timestamps, no
conflict UI, no data loss. The merge is pure and fully testable in Jest without a
device — which is where the real risk lives, so that is where the tests go.

### Task 1: The pure merge function

**Files:**
- Create: `src/game/progression/merge.ts`
- Create: `src/game/progression/merge.test.ts`
- Modify: `src/game/progression/index.ts` (export the new function)

**Interfaces:**
- Consumes: `ProgressionStats` from `./types`
- Produces: `mergeStats(a: ProgressionStats, b: ProgressionStats): ProgressionStats`

- [ ] **Step 1: Write the failing test**

```typescript
// src/game/progression/merge.test.ts
import { mergeStats } from './merge';
import { defaultStats } from './recordRun';
import type { ProgressionStats } from './types';

const stats = (over: Partial<ProgressionStats>): ProgressionStats => ({ ...defaultStats(), ...over });

describe('mergeStats', () => {
    it('takes the higher lifetimeXp', () => {
        expect(mergeStats(stats({ lifetimeXp: 500 }), stats({ lifetimeXp: 1200 })).lifetimeXp).toBe(1200);
    });

    it('sums nothing — it maxes, so a re-merge is idempotent', () => {
        const a = stats({ lifetimeXp: 500, runsPlayed: 10 });
        const once = mergeStats(a, a);
        expect(mergeStats(once, a)).toEqual(once);
    });

    it('unions the date set without duplicates and keeps it sorted', () => {
        const a = stats({ datesPlayed: ['2026-08-01', '2026-08-03'] });
        const b = stats({ datesPlayed: ['2026-08-02', '2026-08-03'] });
        expect(mergeStats(a, b).datesPlayed).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    });

    it('unions feats', () => {
        const a = stats({ feats: ['spotless'] });
        const b = stats({ feats: ['survivor', 'spotless'] });
        expect(mergeStats(a, b).feats.sort()).toEqual(['spotless', 'survivor']);
    });

    it('maxes per-game maps key by key, keeping keys only one side has', () => {
        const a = stats({ bestScoreByGame: { 'the-ladder': 8000, 'the-drop': 100 } });
        const b = stats({ bestScoreByGame: { 'the-ladder': 5000, 'the-wheel': 900 } });
        expect(mergeStats(a, b).bestScoreByGame).toEqual({
            'the-ladder': 8000,
            'the-drop': 100,
            'the-wheel': 900,
        });
    });

    it('sums wins per game — wins on two devices are genuinely additive', () => {
        const a = stats({ winsByGame: { 'the-ladder': 3 } });
        const b = stats({ winsByGame: { 'the-ladder': 2, 'the-drop': 1 } });
        expect(mergeStats(a, b).winsByGame).toEqual({ 'the-ladder': 5, 'the-drop': 1 });
    });

    it('keeps the later day and only that day\'s gameIds', () => {
        const a = stats({ today: '2026-08-04', todayGameIds: ['the-ladder'] });
        const b = stats({ today: '2026-08-05', todayGameIds: ['the-drop'] });
        expect(mergeStats(a, b).today).toBe('2026-08-05');
        expect(mergeStats(a, b).todayGameIds).toEqual(['the-drop']);
    });

    it('unions todayGameIds when both sides are on the same day', () => {
        const a = stats({ today: '2026-08-05', todayGameIds: ['the-ladder'] });
        const b = stats({ today: '2026-08-05', todayGameIds: ['the-drop'] });
        expect(mergeStats(a, b).todayGameIds.sort()).toEqual(['the-drop', 'the-ladder']);
    });
});
```

Note on `winsByGame` and `runsPlayed`: these are **counters**, not high-water marks,
so they sum. `lifetimeXp` also sums in principle — but summing it would double-count
the XP already synced to both devices, inflating levels. Maxing is the conservative
choice and never grants a level the player did not earn on at least one device.
The tests above lock that decision in.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/game/progression/merge.test.ts`
Expected: FAIL — `Cannot find module './merge'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/game/progression/merge.ts
// Cross-device conflict resolution for cloud save. Legal because ProgressionStats
// is monotonic: nothing it holds ever decreases, so the union/max of two devices
// is always a state the player genuinely reached. That is what lets cloud save
// skip timestamps, "last write wins", and any conflict UI.
//
// Two fields are counters rather than high-water marks (runsPlayed, winsByGame)
// and therefore sum. lifetimeXp deliberately does NOT sum: both devices have
// already been credited the shared history, so summing would inflate levels.

import type { ProgressionStats } from './types';

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])].sort();

function maxByKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] ?? 0, value);
    return out;
}

function sumByKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 0) + value;
    return out;
}

/** Merge two devices' raw stats. Commutative, associative, idempotent per field. */
export function mergeStats(a: ProgressionStats, b: ProgressionStats): ProgressionStats {
    const today = a.today >= b.today ? a.today : b.today;
    const todayGameIds =
        a.today === b.today
            ? union(a.todayGameIds, b.todayGameIds)
            : [...(a.today === today ? a.todayGameIds : b.todayGameIds)];

    return {
        lifetimeXp: Math.max(a.lifetimeXp, b.lifetimeXp),
        runsPlayed: a.runsPlayed + b.runsPlayed,
        winsByGame: sumByKey(a.winsByGame, b.winsByGame),
        datesPlayed: union(a.datesPlayed, b.datesPlayed),
        today,
        todayGameIds,
        bestScoreByGame: maxByKey(a.bestScoreByGame, b.bestScoreByGame),
        feats: union(a.feats, b.feats),
        challengesPlayed: a.challengesPlayed + b.challengesPlayed,
    };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/game/progression/merge.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Export from the barrel**

In `src/game/progression/index.ts`, add alongside the existing exports:

```typescript
export { mergeStats } from './merge';
```

- [ ] **Step 6: Commit**

```bash
git add src/game/progression/merge.ts src/game/progression/merge.test.ts src/game/progression/index.ts
git commit -m "feat(progression): pure monotonic merge for cross-device stats"
```

### Task 2: Native Snapshots bridge

**Files:**
- Modify: `modules/game-services/android/src/main/java/expo/modules/gameservices/GameServicesModule.kt`
- Modify: `modules/game-services/index.ts`
- Modify: `modules/game-services/ios/GameServicesModule.swift` (stub so the JS surface is uniform)

**Interfaces:**
- Produces (JS): `readCloudSave(): Promise<string | null>` and `writeCloudSave(payload: string): Promise<boolean>`
- Consumes: nothing from Task 1 — deliberately dumb transport, it moves an opaque string

- [ ] **Step 1: Add the Kotlin functions**

Append inside `ModuleDefinition` in `GameServicesModule.kt`, after `submitScore`:

```kotlin
        // Single-slot cloud save. The payload is opaque here — merging is JS's job
        // (see src/game/progression/merge.ts), so this stays a dumb transport.
        // MOST_RECENTLY_MODIFIED is safe despite being lossy on its own: JS always
        // merges what it reads into local state and writes the union straight back.
        AsyncFunction("readCloudSave") { promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(null)
            PlayGames.getSnapshotsClient(activity)
                .open(SNAPSHOT_NAME, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnSuccessListener { result ->
                    val snapshot = result.data
                    if (snapshot == null) {
                        promise.resolve(null)
                    } else {
                        val bytes = snapshot.snapshotContents.readFully()
                        promise.resolve(if (bytes.isEmpty()) null else String(bytes, Charsets.UTF_8))
                    }
                }
                .addOnFailureListener { promise.resolve(null) }
        }

        AsyncFunction("writeCloudSave") { payload: String, promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            val bytes = payload.toByteArray(Charsets.UTF_8)
            // Guarded rather than assumed: the platform hard-limit is 3 MB and a
            // silent truncation would corrupt a player's save.
            if (bytes.size > MAX_SNAPSHOT_BYTES) return@AsyncFunction promise.resolve(false)
            PlayGames.getSnapshotsClient(activity)
                .open(SNAPSHOT_NAME, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnSuccessListener { result ->
                    val snapshot = result.data
                    if (snapshot == null) {
                        promise.resolve(false)
                        return@addOnSuccessListener
                    }
                    snapshot.snapshotContents.writeBytes(bytes)
                    val metadata = SnapshotMetadataChange.Builder().build()
                    PlayGames.getSnapshotsClient(activity)
                        .commitAndClose(snapshot, metadata)
                        .addOnSuccessListener { promise.resolve(true) }
                        .addOnFailureListener { promise.resolve(false) }
                }
                .addOnFailureListener { promise.resolve(false) }
        }
```

Add to the imports at the top of the file:

```kotlin
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
```

Add beside `RC_ACHIEVEMENT_UI` at the top of the file:

```kotlin
private const val SNAPSHOT_NAME = "showdown-progression-v1"
private const val MAX_SNAPSHOT_BYTES = 3 * 1024 * 1024
```

- [ ] **Step 2: Add the iOS stub**

In `GameServicesModule.swift`, inside the module definition alongside the existing
functions. iOS has no Play Saved Games; the stubs exist so the JS surface needs no
platform branches:

```swift
    AsyncFunction("readCloudSave") { (promise: Promise) in
      // Play Saved Games is Android-only; iOS progression syncs through Game Center.
      promise.resolve(nil)
    }

    AsyncFunction("writeCloudSave") { (payload: String, promise: Promise) in
      promise.resolve(false)
    }
```

- [ ] **Step 3: Extend the JS surface**

In `modules/game-services/index.ts`, add to the `GameServicesNativeModule` interface:

```typescript
    readCloudSave(): Promise<string | null>;
    writeCloudSave(payload: string): Promise<boolean>;
```

Then add the two wrappers. `readCloudSave` cannot use the existing `soft` helper
(that one is typed to `boolean`), so it gets its own:

```typescript
/** Reads the cloud save slot. Null when absent, unavailable, or the call failed. */
export async function readCloudSave(): Promise<string | null> {
    if (!native) return null;
    try {
        return await native.readCloudSave();
    } catch {
        return null;
    }
}

/** Writes the cloud save slot. False when it didn't land, so the caller retries. */
export function writeCloudSave(payload: string): Promise<boolean> {
    return soft((m) => m.writeCloudSave(payload));
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. (Kotlin compilation needs an Android SDK — see Global Constraints.
Defer the device build to Task 4's verification step.)

- [ ] **Step 5: Commit**

```bash
git add modules/game-services
git commit -m "feat(game-services): Play Saved Games transport for cloud save"
```

### Task 3: Wire cloud save into the progression seam

**Files:**
- Create: `src/services/gameServices/cloudSave.ts`
- Create: `src/services/gameServices/cloudSave.test.ts`
- Modify: `src/game/progression/recordRun.ts` (save after a run)
- Modify: `App.tsx` (restore at startup)

**Interfaces:**
- Consumes: `mergeStats` (Task 1), `readCloudSave`/`writeCloudSave` (Task 2), `loadStats`/`saveStats` from `recordRun.ts`
- Produces: `restoreFromCloud(): Promise<boolean>`, `pushToCloud(stats: ProgressionStats): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/gameServices/cloudSave.test.ts
import { restoreFromCloud, pushToCloud } from './cloudSave';
import { defaultStats } from '../../game/progression/recordRun';

jest.mock('../../../modules/game-services', () => ({
    gameServicesAvailable: true,
    readCloudSave: jest.fn(),
    writeCloudSave: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../game/progression/recordRun', () => {
    const actual = jest.requireActual('../../game/progression/recordRun');
    return { ...actual, loadStats: jest.fn(), saveStats: jest.fn() };
});

const native = jest.requireMock('../../../modules/game-services');
const store = jest.requireMock('../../game/progression/recordRun');

describe('restoreFromCloud', () => {
    beforeEach(() => jest.clearAllMocks());

    it('merges the remote save into local state and writes the union back', async () => {
        store.loadStats.mockReturnValue({ ...defaultStats(), lifetimeXp: 400 });
        native.readCloudSave.mockResolvedValue(JSON.stringify({ ...defaultStats(), lifetimeXp: 900 }));

        expect(await restoreFromCloud()).toBe(true);
        expect(store.saveStats).toHaveBeenCalledWith(expect.objectContaining({ lifetimeXp: 900 }));
    });

    it('is a no-op when the slot is empty', async () => {
        store.loadStats.mockReturnValue(defaultStats());
        native.readCloudSave.mockResolvedValue(null);

        expect(await restoreFromCloud()).toBe(false);
        expect(store.saveStats).not.toHaveBeenCalled();
    });

    it('survives a corrupt payload without touching local state', async () => {
        store.loadStats.mockReturnValue({ ...defaultStats(), lifetimeXp: 400 });
        native.readCloudSave.mockResolvedValue('{not json');

        expect(await restoreFromCloud()).toBe(false);
        expect(store.saveStats).not.toHaveBeenCalled();
    });
});

describe('pushToCloud', () => {
    it('serializes the stats it is handed', async () => {
        await pushToCloud({ ...defaultStats(), lifetimeXp: 123 });
        expect(native.writeCloudSave).toHaveBeenCalledWith(expect.stringContaining('"lifetimeXp":123'));
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/services/gameServices/cloudSave.test.ts`
Expected: FAIL — `Cannot find module './cloudSave'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/gameServices/cloudSave.ts
// Cloud save on top of Play Saved Games. Restore is deliberately a MERGE, never a
// replace: a player who played offline on a second device must not lose that run
// just because the cloud slot is older. mergeStats makes that safe (see its doc).
//
// A corrupt or absent payload is a no-op, never a reset — local state is the one
// thing we are certain about.

import { readCloudSave, writeCloudSave } from '../../../modules/game-services';
import { loadStats, saveStats } from '../../game/progression/recordRun';
import { mergeStats } from '../../game/progression/merge';
import type { ProgressionStats } from '../../game/progression/types';
import { SafeSentry } from '../../utils/sentry/init';

/** Serialize and store the given stats. False when the write didn't land. */
export function pushToCloud(stats: ProgressionStats): Promise<boolean> {
    return writeCloudSave(JSON.stringify(stats));
}

/**
 * Pull the cloud slot, merge it into local stats, persist, and push the union back
 * so both sides converge. Returns whether local state actually changed hands.
 */
export async function restoreFromCloud(): Promise<boolean> {
    const payload = await readCloudSave();
    if (!payload) return false;

    let remote: ProgressionStats;
    try {
        remote = JSON.parse(payload) as ProgressionStats;
    } catch {
        SafeSentry.captureMessage('Cloud save payload was not valid JSON', {
            level: 'warning',
            tags: { area: 'game-services' },
        });
        return false;
    }

    const merged = mergeStats(loadStats(), remote);
    saveStats(merged);
    await pushToCloud(merged);
    return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/gameServices/cloudSave.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Check that `saveStats` is exported**

`recordRun.ts` persists internally. Confirm `loadStats` and `saveStats` are both
exported from that module; if `saveStats` is private, export it (one-line change)
and note it in the commit.

Run: `grep -n "export function loadStats\|export function saveStats" src/game/progression/recordRun.ts`

- [ ] **Step 6: Push after every run**

In `recordRun.ts`, add the import beside the existing `syncGameServices` one —
the concrete module, not the barrel, for the same import-cycle reason documented
there:

```typescript
import { pushToCloud } from '../../services/gameServices/cloudSave';
```

Then, next to the existing `syncGameServices(stats)` call in `recordRun`:

```typescript
    // Fire-and-forget: a failed push replays on the next run, and the cloud slot
    // is never the source of truth — local MMKV is.
    void pushToCloud(stats);
```

- [ ] **Step 7: Restore at startup**

In `App.tsx`, after game services authentication settles:

```typescript
useEffect(() => {
    // A failed restore must never block boot — local state already works offline.
    restoreFromCloud().catch(() => {});
}, []);
```

- [ ] **Step 8: Run the full suite and commit**

```bash
npx jest src/game/progression src/services/gameServices
git add src/services/gameServices/cloudSave.ts src/services/gameServices/cloudSave.test.ts src/game/progression/recordRun.ts App.tsx
git commit -m "feat(game-services): restore and push progression through cloud save"
```

### Task 4: Verify cloud save on device

**Files:** none — this is the verification gate for Phase 1.

- [ ] **Step 1: Build on a machine with the Android SDK**

Run: `npx expo run:android`
(Per CLAUDE.md, never `expo start` — this project needs a dev build.)

- [ ] **Step 2: Play one run, then check the slot round-trips**

Play a run on device A. Install on device B with the same Play Games account.
Expected: device B's Progress screen shows device A's level after launch.

- [ ] **Step 3: Verify the offline-merge case**

Turn off networking on device B, play two runs, re-enable networking, relaunch.
Expected: no progress lost on either device; `lifetimeXp` is the higher of the two,
`runsPlayed` is the sum.

---

## Phase 2 — Game Stats

**Requirement:** ≥ 5 stats representing regularly occurring actions, ≥ 1 usable for
competitive features, ≥ 1 progression stat. Stats are *defined in Console via CSV*
as aggregations (SUM/MAX/MIN/COUNT) over event properties — so a small number of
rich events yields many stats. Two events are enough.

**Note on API freshness:** Game Stats reached GA in August 2026. Verify the client
class against https://developer.android.com/games/pgs/android/gamestats before
writing Kotlin — if `Games.getGameStatsClient` has been renamed, adjust Task 6 and
keep everything else.

### Task 5: Define the events and stats

**Files:**
- Create: `src/services/gameServices/stats.ts`
- Create: `src/services/gameServices/stats.test.ts`
- Create: `.agents/game-services/game_stats.csv` (the Console upload)

**Interfaces:**
- Consumes: `GameRunResult`, `ProgressionStats` from progression
- Produces: `runCompletedEvent(result: GameRunResult): StatsEvent`, `progressUpdateEvent(stats: ProgressionStats): StatsEvent`, `interface StatsEvent { name: string; properties: Record<string, string | number | boolean> }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/gameServices/stats.test.ts
import { runCompletedEvent, progressUpdateEvent } from './stats';
import { defaultStats } from '../../game/progression/recordRun';

describe('runCompletedEvent', () => {
    it('carries the properties every console stat aggregates over', () => {
        const event = runCompletedEvent({
            gameId: 'the-ladder',
            score: 12000,
            won: true,
            rungReached: 15,
            lifelinesUsed: 0,
            challenge: false,
        });

        expect(event.name).toBe('runCompleted');
        expect(event.properties).toEqual({
            gameId: 'the-ladder',
            score: 12000,
            isWinner: true,
            rungReached: 15,
            lifelinesUsed: 0,
            isChallenge: false,
        });
    });

    it('defaults the optional per-game facts so the console schema always matches', () => {
        const event = runCompletedEvent({ gameId: 'the-drop', score: 900, won: false });
        expect(event.properties.rungReached).toBe(0);
        expect(event.properties.lifelinesUsed).toBe(0);
        expect(event.properties.isChallenge).toBe(false);
    });
});

describe('progressUpdateEvent', () => {
    it('reports the current level as currentProgress', () => {
        const event = progressUpdateEvent({ ...defaultStats(), lifetimeXp: 3600 });
        expect(event.name).toBe('progressUpdate');
        expect(event.properties.currentProgress).toBe(8);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/services/gameServices/stats.test.ts`
Expected: FAIL — `Cannot find module './stats'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/gameServices/stats.ts
// Game Stats event shaping. Two events carry everything; the individual STATS are
// defined console-side as aggregations over these properties (see
// .agents/game-services/game_stats.csv), which is why this file stays this small.
//
// Every property is always present, never conditionally omitted: PGS validates
// each event against the console schema and silently rejects mismatches.

import { level } from '../../game/progression/map';
import type { GameRunResult, ProgressionStats } from '../../game/progression/types';

export interface StatsEvent {
    name: string;
    properties: Record<string, string | number | boolean>;
}

/** Repetitive event — one per finished run, whatever the game. */
export function runCompletedEvent(result: GameRunResult): StatsEvent {
    return {
        name: 'runCompleted',
        properties: {
            gameId: result.gameId,
            score: result.score,
            isWinner: result.won,
            rungReached: result.rungReached ?? 0,
            lifelinesUsed: result.lifelinesUsed ?? 0,
            isChallenge: result.challenge ?? false,
        },
    };
}

/** Progression event — the player's current level on the Level Map. */
export function progressUpdateEvent(stats: ProgressionStats): StatsEvent {
    return {
        name: 'progressUpdate',
        properties: { currentProgress: level(stats.lifetimeXp) },
    };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/gameServices/stats.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Write the Console CSV**

Create `.agents/game-services/game_stats.csv` defining seven stats over those two
events — comfortably over the five-stat minimum, with the competitive and
progression requirements covered:

| Stat | Event | Property | Aggregation | Filter | Role |
|---|---|---|---|---|---|
| Runs played | runCompleted | — | COUNT | — | repetitive |
| Wins | runCompleted | — | COUNT | isWinner = true | repetitive |
| Best score | runCompleted | score | MAX | — | **competitive** |
| Highest rung | runCompleted | rungReached | MAX | gameId = the-ladder | repetitive |
| Lifelines used | runCompleted | lifelinesUsed | SUM | — | repetitive |
| Challenges played | runCompleted | — | COUNT | isChallenge = true | repetitive |
| Level | progressUpdate | currentProgress | MAX | — | **progression** |

Match the exact column headers Console's CSV template expects (stat ID, event
label, property label, aggregation, filter, display name, description, icon).
Add EN and PL display names — the same bilingual rule as the rest of the app.

- [ ] **Step 6: Commit**

```bash
git add src/services/gameServices/stats.ts src/services/gameServices/stats.test.ts .agents/game-services/game_stats.csv
git commit -m "feat(game-services): shape Game Stats events and console stat definitions"
```

### Task 6: Native Game Stats bridge and wiring

**Files:**
- Modify: `modules/game-services/android/src/main/java/expo/modules/gameservices/GameServicesModule.kt`
- Modify: `modules/game-services/index.ts`
- Modify: `modules/game-services/ios/GameServicesModule.swift` (stub)
- Modify: `src/game/progression/recordRun.ts`

**Interfaces:**
- Consumes: `StatsEvent` (Task 5)
- Produces (JS): `recordStatsEvent(name: string, properties: Record<string, string | number | boolean>): Promise<boolean>`

- [ ] **Step 1: Add the Kotlin function**

```kotlin
        // Game Stats. Properties arrive as a JS object; PGS validates each event
        // against the console schema and drops mismatches, so the shaping lives in
        // JS (src/services/gameServices/stats.ts) where it is unit-tested.
        AsyncFunction("recordStatsEvent") { name: String, properties: Map<String, Any>, promise: Promise ->
            val activity = activityOrNull ?: return@AsyncFunction promise.resolve(false)
            try {
                val builder = PlayerGameEvent.Builder(name)
                for ((key, value) in properties) {
                    when (value) {
                        is Boolean -> builder.addProperty(key, value)
                        is Number -> builder.addProperty(key, value.toLong())
                        else -> builder.addProperty(key, value.toString())
                    }
                }
                val client = PlayGames.getGameStatsClient(activity)
                client.recordEvent(builder.build())
                client.requestEventsUpload()
                promise.resolve(true)
            } catch (_: Throwable) {
                promise.resolve(false)
            }
        }
```

Add the matching import for `PlayerGameEvent` from the games package.

- [ ] **Step 2: Add the iOS stub and the JS wrapper**

Same pattern as Task 2: a Swift function resolving `false`, plus in
`modules/game-services/index.ts`:

```typescript
export function recordStatsEvent(
    name: string,
    properties: Record<string, string | number | boolean>,
): Promise<boolean> {
    return soft((m) => m.recordStatsEvent(name, properties));
}
```

…with the matching entry added to the `GameServicesNativeModule` interface.

- [ ] **Step 3: Emit both events from the progression seam**

In `recordRun.ts`, beside the existing `syncGameServices` and `pushToCloud` calls,
emit `runCompletedEvent(result)` and `progressUpdateEvent(stats)` through
`recordStatsEvent`. Import the concrete modules, not the barrel (import cycle).

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npx jest src/game/progression src/services/gameServices
git add modules/game-services src/game/progression/recordRun.ts
git commit -m "feat(game-services): report Game Stats events at the progression seam"
```

- [ ] **Step 5: Upload the CSV and verify in Console**

Play Games Services → Game Stats → upload `.agents/game-services/game_stats.csv`.
Then play a run on a device build and confirm events arrive (Console reports
rejected events with reasons — an empty rejection list is the pass condition).

---

## Phase 3 — Large screens

**Key fact that shrinks this phase:** with targetSdk 36, Android 16 already ignores
the portrait lock on displays ≥ sw600dp, and leaves it in force below that. So
**phones keep portrait with no change**, and tablets/foldables already rotate today
whether or not we act. The work is therefore purely making the layouts survive
landscape at tablet width — not touching `app.json` or the manifest at all.

### Task 7: Audit and fix the screens at sw600dp landscape

**Files:**
- Modify: whichever of `src/screens/*.tsx` and `src/game/*/…PlayScreen.tsx` fail the audit
- Reference: `src/responsive/useResponsive.ts:43` (already has the tablet-landscape branch)

- [ ] **Step 1: Launch a large-screen emulator**

Create an AVD with a tablet profile (≥ sw600dp, e.g. 1280×800) and run:
`npx expo run:android`

- [ ] **Step 2: Walk every screen in landscape and record what breaks**

Home, Progress, Ranking, Theme, Challenge, and the three play screens (Ladder,
Drop, Wheel). For each: does content overflow, letterbox, or clip? The dense ones
(Wheel's puzzle board, Ladder's rung column) are the expected failures.

- [ ] **Step 3: Fix each failure using the existing responsive seam**

`useResponsive` already exposes `isTablet` and a landscape content width. Prefer
widening/reflowing through that hook over per-screen hacks, so the fix matches the
established pattern rather than introducing a second layout system.

- [ ] **Step 4: Verify rotation mid-run loses no state**

Rotate during an active Ladder run. The manifest already declares
`configChanges="…|orientation|screenSize|screenLayout|…"`, so the activity should
not recreate — confirm the run survives.

- [ ] **Step 5: Commit**

```bash
git add src/screens src/game
git commit -m "fix(responsive): support landscape layouts on large screens"
```

---

## Phase 4 — Sidekick and Play Games on PC

### Task 8: Confirm or enable Sidekick

- [ ] **Step 1: Act on Task 0's finding**

If Task 0 recorded Sidekick as already enabled, tick this task and move on — no
code, no build. If not, enable it in Play Console for the App Bundle (the Console
path, not the SDK-compile path; we ship an AAB, so no code change is needed).

### Task 9: Google Play Games on PC and keyboard/mouse

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml` (input feature declarations)
- Possibly: `src/game/wheel/WheelPlayScreen.tsx` (keyboard letter entry)

**Requirement nuance:** ShowDown is point-and-click, so **controller support is
exempt**; keyboard and mouse are **not**. Mouse already works — every control is a
`Pressable`. Keyboard is the real gap.

- [ ] **Step 1: Opt in to Google Play Games on PC in Console**

Play Console → Google Play Games on PC. Confirm the emulator playability check
passes and that no unsupported feature is marked as required.

- [ ] **Step 2: Declare that touchscreen is not required**

In `AndroidManifest.xml`, ensure the app does not require a touchscreen — otherwise
PC distribution filters it out:

```xml
  <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
```

- [ ] **Step 3: Add keyboard letter entry to the Wheel**

The Wheel is the one screen where a keyboard genuinely changes playability
(guessing letters). A hidden, always-focused `TextInput` routes hardware keys into
the *existing* letter-guess handler, so on-screen keys and hardware keys share one
code path rather than diverging:

```tsx
{/* Off-screen keyboard sink: on PC and with a hardware keyboard, typing a letter
    must do exactly what tapping that letter does. Never focused on touch devices,
    where it would raise the soft keyboard over the board. */}
<TextInput
    style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
    autoFocus={hasHardwareKeyboard}
    showSoftInputOnFocus={false}
    value=""
    onKeyPress={({ nativeEvent }) => {
        const letter = nativeEvent.key.toUpperCase();
        if (/^[A-Z]$/.test(letter)) onGuessLetter(letter);
    }}
/>
```

Derive `hasHardwareKeyboard` from `Platform.OS === 'android' && !isTouchPrimary`;
if the codebase has no such signal yet, gate on the tablet/PC branch already in
`useResponsive` rather than adding a new capability system.

- [ ] **Step 4: Verify on the PC client**

Play one run of each game with keyboard and mouse only, no touch. Every action must
be reachable. That is the literal requirement: "no fallback to touch".

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml src/game/wheel
git commit -m "feat(input): keyboard playability and PC distribution support"
```

---

## Phase 5 — Reward offers (deadline 2026-09-30)

**Requirement:** ≥ 2 single-use offers, awarded on Quest completion, available to
every player at least once, and *meaningful*. A second milestone (≥ 1 repeatable
offer, awarded after social challenges, max one per player per week) lands
2027-03-01 and is deliberately out of scope here.

**Design note:** ShowDown already has three earn-only currencies that cost nothing
to grant and do not touch `STORE_CATALOG`: banked bonus runs (`src/game/offline/limit.ts`),
signatures, and earned themes. Offers should draw from these — never from IAP SKUs,
or `is_paying_user` analytics get contaminated.

### Task 10: Doc spike — how offers are redeemed

- [ ] **Step 1: Read the reward offers documentation**

Start from https://developer.android.com/games/guidelines and follow to the Play
Games reward offers pages. Establish concretely: are offers granted purely
Console-side against a Quest, or must the client redeem and honor them? This
determines whether Task 11 is Console configuration or Console plus client work.

- [ ] **Step 2: Record the answer in this plan**

Write the finding directly under this step, then size Task 11 accordingly. Do not
start Task 11 before this is answered — the two possible shapes differ by roughly
a day of work.

### Task 11: Configure two single-use offers

- [ ] **Step 1: Pick the two rewards**

Proposal, both meaningful and both already implemented as grantable state:
1. **5 banked bonus runs** — the existing level-up bonus, granted via `grantLevelBonus`.
2. **An earned signature** — an existing `SIGNATURES` entry, granted early rather than at its level gate.

- [ ] **Step 2: Configure the Quest and the two offers in Console**

Bind each offer to a Quest whose completion is achievable by every player at least
once. Add EN and PL copy for both.

- [ ] **Step 3: Implement the grant path if the spike says the client must honor offers**

Route the grant through the existing progression seams rather than adding a parallel
entitlement system.

- [ ] **Step 4: Verify end to end on a device build, then commit**

---

## Phase 6 — Ship

### Task 12: Release to Play

- [ ] **Step 1: Note the current gap**

Play production is on versionCode 35 (1.4.0); the repo is at 1.4.1 (versionCode 36),
which never shipped to Android. Everything above compounds on top of that gap.

- [ ] **Step 2: Build on a machine with the Android SDK, or via EAS**

This Mac cannot produce an Android build.

- [ ] **Step 3: Run the release skill**

Use the `release-notes` skill for the version bump and bilingual notes, matching
how 1.4.0 and 1.4.1 were prepared.

- [ ] **Step 4: Verify Level Up status in Console after the release propagates**

Play Console → Grow → Play Games Services → Level Up. Each requirement should read
as met. Anything still failing goes back into this plan as a new task.

---

## Out of scope (deliberately)

- **Repeatable reward offer** (due 2027-03-01) and **Googlebook distribution** (same date).
- **Android XR / TV / Auto** distribution (2027-09).
- **Vulkan and frame-rate requirements** — React Native renders through HWUI/SKIA, which both requirements explicitly exempt.
- **Stability thresholds** (<1% crash, <2% ANR) — not actionable: the Play Developer Reporting API returns no rows for `com.showdown.app`, meaning the install base is under the ≥1,500-sessions-per-28-days measurement floor. Revisit when the app has that traffic.
- **Android 17 memory limits** — announced as "required later in 2026" with detailed compliance criteria not yet published. Nothing to build against until Google publishes them.
- **iOS** — Level Up is a Play program. The Game Center work is tracked separately.
