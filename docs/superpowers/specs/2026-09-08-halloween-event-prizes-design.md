# Halloween event: win-gated, randomised repeating prizes

Date: 2026-09-08
Status: Approved for planning.
Amends: `docs/plans/2026-09-06-timed-events.md` (rows **Prizes**, **Goal credit**, **Offline completion**).

## Outcome

Make the `halloween-2026` edition shippable, and change its prize model from
"complete N runs, receive a specified prize" to "win N head-to-head rounds,
receive a prize drawn from a pool, repeatable until the pool is empty".

Add a rehearsal edition so two devices on the internal track can exercise the
whole flow against production before October.

## Approved decisions

| Area              | Decision                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Win               | The player's score beats their opponent's. A genuine tie is a draw, not a win.                                                             |
| Who decides       | The device. `GET /challenges/:id/attempts` already returns both attempts to either player. **No Worker changes.**                          |
| Absent opponent   | A run whose opponent never uploaded counts as a **win at event closure** (`now >= edition.endsAt`), including never-matched rounds.        |
| Ladder            | One prize per **13 wins**, repeating, with no upper bound other than pool size.                                                            |
| Draw selection    | Rolled on-device from a seed fixed to the player, then recorded. Never re-rolled.                                                          |
| Uniqueness        | A pool item can be won at most once per player per edition.                                                                                |
| Pool exhausted    | Further wins earn nothing. No error, no placeholder grant.                                                                                 |
| Name              | "Halloween" in EN and PL, unchanged.                                                                                                       |
| Testing           | A separate `halloween-2026-rehearsal` edition, enabled with a wide date window, removed before public release.                             |

### What this changes in the original plan

- **Prizes** — was "complete N runs … a specified, previewable prize". Now
  win-gated, repeating, and drawn from a pool. The pool is previewable; the
  individual draw is not.
- **Goal credit** — was "Normal losses, even on question one, count". Losses no
  longer advance prize progress. Completed-run counting is retained separately
  for the "Completed runs: N" display, which is unchanged.
- **Offline completion** — was "grant prizes locally immediately". A run still
  completes and records progression offline, but its prize progress cannot
  resolve until the opponent's attempt is readable. Prizes are granted at
  resolution, not at completion.

Everything else in the original plan stands: allowance, charging, matchmaking,
seats, resume, retention, rankings.

## Consequence to accept

During the event the visible win count reflects only *resolved* rounds. A player
matched with slow opponents sees progress lag, then jump at closure when
walkovers resolve. This is inherent to head-to-head scoring plus
walkover-at-closure and is not a defect.

## Design

### 1. Edition model (`shared/events/definitions.ts`)

Replace the fixed milestone list with a repeating pool. Both the app and the
Worker import this file, so the shape must stay serialisable and pure.

```ts
export interface EventEdition {
    // … unchanged fields …
    /** Wins required per prize draw. Repeats: 13, 26, 39, … */
    winsPerPrize: number;
    /** Reward ids this edition can award. Drawn without replacement. */
    prizePool: readonly string[];
}
```

`milestones` is removed. `validateEdition` gains:

- `winsPerPrize` must be a safe integer `>= 1`.
- `prizePool` must be non-empty and every id must satisfy the injected
  `hasReward` predicate.
- The existing `prizes` error is raised when an **enabled** edition has an empty
  pool, preserving today's behaviour that an incomplete draft cannot go live.

`grantIdentity(editionId, milestoneId)` becomes `grantIdentity(editionId, drawIndex)`
producing `"<editionId>/draw-<n>"`. Old identities in existing saves remain in
`eventRewardGrants` and are ignored, which the "old-save upgrade preserves
unknown permanent grants" test already covers.

### 2. Outcome resolution (`src/game/challenge/log.ts`)

`ChallengeStub` gains `outcome?: 'won' | 'lost' | 'draw'`. Absent means
unresolved. The field is the idempotency receipt for the *display*; the
authoritative win tally lives in progression (§3).

A new `resolveEventOutcomes()`:

1. Selects stubs where `eventId` is set and `outcome` is absent.
2. For each, if the opponent's attempt is readable, compares scores and writes
   the outcome. If not, and `now >= edition.endsAt`, writes `won` (walkover).
   Otherwise leaves it unresolved.
3. Batches its network reads: it fetches attempts only for challenges the
   statuses sync has already reported as `opponentPlayed`, plus, once past
   closure, resolves the remainder locally with no request at all.

It runs from `syncIncomingRematches` (where `recoverCompletions` already runs)
and after the results screen resolves a challenge it is displaying.

**The comparison must not be a second implementation.** `ChallengeScreen`
already derives `winner` / `isTopTie` / `draw` / `youWon` from the attempts
array. Extract that into one pure exported function taking the attempts and the
player's own timestamp, and have both the results view and
`resolveEventOutcomes` call it. A divergent copy of "did I win" is the specific
failure this design must avoid.

### 3. Win tally and draws (`src/game/progression/`)

`ProgressionStats` gains:

```ts
/** Challenge ids won per edition. Length is the win count; union-merges cleanly. */
eventWinIds?: Record<string, string[]>;
```

A set of ids rather than a counter, for three reasons: it is idempotent under
retry (re-resolving the same challenge is a no-op), it survives a crash between
the log write and the stats write without double-counting, and cloud merge is a
plain deduplicating union — which is the correct semantics for wins earned on
two devices. It mirrors the existing `completionReceipts` pattern.

`mergeStats` unions the arrays per edition and deduplicates.
`preservesProgress` treats it like the other monotonic fields.

Granting, invoked whenever `eventWinIds` grows:

```
wins        = eventWinIds[editionId].length
drawsEarned = floor(wins / winsPerPrize)
for d in 1..drawsEarned:
    grantId = `${editionId}/draw-${d}`
    if eventRewardGrants includes grantId: continue
    remaining = prizePool
                  minus rewards awarded by draws 1..d-1
                  minus anything already in earnedRewardIds
    if remaining is empty: break
    reward = remaining[ seededIndex(deviceId, editionId, d, remaining.length) ]
    record grantId in eventRewardGrants, reward in earnedRewardIds,
    push reward onto diff.newRewards
```

`seededIndex` is a small pure hash (FNV-1a over `${deviceId}:${editionId}:${d}`,
reduced modulo the remaining count) indexing into the **sorted** remaining pool,
so the result is independent of pool declaration order.

The sequence is therefore a pure function of the player, the edition and the
pool — recomputable rather than stored. Excluding anything already in
`earnedRewardIds` guards the case where a later app version changes the pool: a
player keeps what they were granted, and only future draws shift.

Wins are counted outside `recordRun`, because at completion the opponent's score
is not yet known. `recordRun` keeps counting `eventCompletedRuns` exactly as it
does today for the "Completed runs" display.

### 4. Prizes

New swatches in `src/game/mascot/look.ts`, bound as event-only rewards in
`PROGRESSION_MASCOT_COLORS` with **no `LEVEL_MAP` node**, so they are grantable
only by this event. They stay outside `STORE_CATALOG`, so no SKU and no
`is_paying_user` contamination — the constraint both reward modules document.

| Slot  | Reward id               | colorId          | Hex       |
| ----- | ----------------------- | ---------------- | --------- |
| fur   | `mascot-fur-pumpkin`    | `fur.pumpkin`    | `#EA580C` |
| fur   | `mascot-fur-blackcat`   | `fur.blackcat`   | `#1C1917` |
| suit  | `mascot-suit-witch`     | `suit.witch`     | `#4C1D95` |
| accent| `mascot-accent-slime`   | `accent.slime`   | `#84CC16` |
| accent| `mascot-accent-blood`   | `accent.blood`   | `#7F1D1D` |
| mic   | `mascot-mic-bone`       | `mic.bone`       | `#E7E5E4` |

Plus one theme, `theme-haunt`, added to `PROGRESSION_THEMES` as
`{ id: 'theme-haunt', value: 'haunt', titleKey: 'progression.themes.haunt',
iconName: 'moon', accentColor: '#EA580C', tokens: magmaTheme }`. `magmaTheme` is
already exported from `src/theme/themes/index.ts` and bound to nothing — near-black
`#1a0a0a`, blood-red surfaces, pumpkin-orange `#ea580c` primary, already the
edition accent. `moon` is an existing `ICON_MAP` key. No `LEVEL_MAP` node, so
levelling never grants it, and `themeRegistry` picks it up automatically because
it maps all of `PROGRESSION_THEMES`.

Note for the implementer: `EARNED_MASCOT_COLOR_IDS` is exported from
`mascotColors.ts` and its comment claims it excludes earned colours from the
purchasable bundle, but nothing currently imports it. Adding the six colours
there will not by itself keep them out of any bundle — confirm where the store
actually filters before relying on it. This is pre-existing; do not remove it as
part of this work.

Seven items covers the ceiling: a Premium player at 13 plays/day over 7 days has
91 runs, so at most 7 draws even winning every round.

### 5. Editions

```ts
{
    id: 'halloween-2026',
    enabled: false,              // flipped on with real dates for the public release
    name: { en: 'Halloween', pl: 'Halloween' },
    accent: '#F97316',
    artwork: 'pumpkin',
    activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
    allowance: { base: 3, perPaidItem: 1, premium: 10 },
    winsPerPrize: 13,
    prizePool: [
        'mascot-fur-pumpkin',
        'mascot-fur-blackcat',
        'mascot-suit-witch',
        'mascot-accent-slime',
        'mascot-accent-blood',
        'mascot-mic-bone',
        'theme-haunt',
    ],
}
```

And a rehearsal edition with a distinct id, `enabled: true`, the same content
revision and pool, and a window wide enough to stay testable
(`2026-09-01` → `2026-12-31`).

Containment is by binary, not by flag: the Worker validates whatever
`shared/events/definitions.ts` it was deployed with, and it is shared by the
internal and public apps, so any server-side gate would be global. The internal
build carries the rehearsal edition; the public build must not. A unit test
asserts that no `-rehearsal` edition is enabled at the same time as
`halloween-2026`, which fails the build if it is left in when the real event
goes live.

Do not remove the rehearsal edition from a build until the `recoverCompletions`
fix from 2026-09-08 has shipped: before it, a tester holding an unsettled
completed run for a removed edition would have every pending upload blocked.

### 6. Presentation

`EventHubScreen` replaces its milestone rows with:

- a goal line — wins toward the next draw, `N / 13`;
- the pool, each item marked earned or not, each opening the existing
  `EventRewardPreview`;
- copy stating the prize is drawn at random and never repeats.

`EventRewardPreview` is unchanged; it already resolves any reward id through
`PROGRESSION_THEMES`, `PROGRESSION_MASCOT_COLORS` and the store catalog.

New EN/PL keys: seven prize titles, plus `events.winsGoal`, `events.nextPrize`,
`events.randomPrize` and `events.poolComplete`.

## Testing

- **Draw** — the same player and edition always produce the same sequence; a
  prize never repeats; an exhausted pool grants nothing and does not throw;
  declaration order of the pool does not change the outcome.
- **Win accounting** — resolving the same challenge twice adds one win; a draw
  adds none; a loss adds none; a walkover only resolves at or after `endsAt`.
- **Merge** — win id sets from two devices union without double-counting, grants
  do not duplicate, and `preservesProgress` holds in both directions.
- **Validation** — an enabled edition with an empty pool, a zero
  `winsPerPrize`, or a pool id no reward resolves, is rejected.
- **Editions** — the rehearsal edition is active in its window; a rehearsal
  edition enabled alongside a live `halloween-2026` fails.
- **Shared outcome logic** — the extracted comparison returns the same verdict
  the results screen renders, over won / lost / drawn / unplayed fixtures.

Regression suites for allowance, charging, matchmaking, seats, resume and
retention are unchanged and must stay green, including `test:events:d1`.

## Out of scope

Event leaderboards, event rematches, push notifications, remote configuration,
prize trading, and any change to the Worker.
