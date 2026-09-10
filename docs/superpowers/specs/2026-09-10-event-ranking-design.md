# Event ranking: a per-edition global board

Date: 2026-09-10
Status: Approved for planning.
Amends: `docs/decisions/0004-global-ranking.md` (the period model) and
`docs/superpowers/specs/2026-09-08-halloween-event-prizes-design.md`
(which listed event leaderboards as out of scope).

## Outcome

Give each event edition its own global board, and stop event rounds from
writing into the normal per-game boards.

The second half is a defect fix, not a refinement. `ChallengeScreen.tsx:350`
and `src/game/challenge/session/recovery.ts:37` both call `pushRanking` with
no knowledge of event membership, so a Halloween round already writes into
`the-ladder`'s all-time and monthly boards. Event rounds play a different
question pack (`HALLOWEEN_CONTENT_REVISION`), so those scores were never
comparable with normal ones.

## Approved decisions

| Area          | Decision                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------- |
| Ranking key   | Best single event-round score, per device. Same best-only rule as the existing boards.   |
| Normal boards | An event round pushes to the event board **only** — never all-time, never monthly.       |
| Entry points  | A button in the Event Hub, and one extra tab in the Ranking screen per visible edition.  |
| After closure | The board stays readable while the edition is visible; writes are refused from `endsAt`. |
| Retention     | Event buckets are never pruned. Nothing prunes D1 rankings today.                        |

## Design

### 1. The period is the edition id

`rankings` is `(game, period, uuid)` where `period` is `'alltime'` or a UTC
`'YYYY-MM'`. An event board adds a third form: the edition id, e.g.
`halloween-2026`. No migration, no new table, no new endpoint — `GET
/rankings/:game/:period`, `/count` and `/lowest` already accept any period
string and are unchanged.

Collision is impossible by construction: an edition id is neither the literal
`alltime` nor seven characters of `YYYY-MM`, and the write validator resolves
the period against the real edition list rather than pattern-matching it.

### 2. Server: one validator (`server/src/validation.ts`)

`isWritablePeriod` today accepts `alltime` or the current UTC month. It gains a
third accepted form and, with it, the game it is being written under:

```ts
export function isWritablePeriod(period: string, game: string, now = Date.now()): boolean {
    if (period === 'alltime') return true;
    const edition = findEdition(period);
    if (edition) {
        return eventLifecycle(edition, now) === 'active' && edition.activities.some((a) => a.game === game);
    }
    if (period.length !== 7) return false;
    return period === currentMonthId(now); // unchanged
}
```

Two guarantees fall out of this rather than needing their own machinery:

- **Standings freeze at closure.** `eventLifecycle` returns `'closed'` from
  `endsAt`, so a late write is a 400. No scheduled job, no flag to flip.
- **A board belongs to its activity.** The `activities` check stops a Drop
  score being written into a Ladder-only edition's board.

`findEdition` is called without the test-fixture flag: fixture editions are a
device-side development affordance and must not be writable on production D1.

Reads stay unvalidated, as they are today. A closed edition's board is
readable; only writing is closed.

### 3. Client: `pushRanking` routes by membership

`pushRanking(game, score, nickname, editionId?)`. When `editionId` is present
the function pushes to that one bucket and returns; the all-time and monthly
paths are not reached. This single branch is both the feature and the fix.

The two call sites pass what they already hold: `record.event?.editionId` in
`ChallengeScreen`, `session.record.event?.editionId` in
`session/recovery.ts`. Neither needs new state.

The existing `RANKED_GAMES` guard stays first, so an edition whose activity is
not a ranked game silently has no board — no error, no empty tab.

### 4. Local state and cache

`RankingScope` becomes `'month' | 'alltime' | 'event'`.

```ts
export interface LocalRankingState {
    allTime?: LocalBest;
    month?: LocalBest & { monthId: string };
    /** Best per edition. Keyed by edition id; never reset (an edition never rolls over). */
    events?: Record<string, LocalBest>;
}
```

`recordBestIfHigher` and `markSynced` take the edition id where they take
`monthId` today; `listPending` yields event bests alongside the others, so the
existing retry queue carries an offline event best without structural change.
`retryPending`'s month-rollover skip does not apply to an event best: a write
to a closed edition is refused server-side, which `pushToBucket` already
treats as terminal — `httpError` maps 400 to `BlockedError`
(`src/game/challenge/store.ts:71`) — so a stale event best resolves rather
than retrying forever.

Cache keys extend from `game|scope` to `game|event|<editionId>`, and
`invalidateGameCache` drops the event keys for that game too — otherwise a
just-submitted event score would not appear for up to an hour.

### 5. Presentation

`RankingScreen` renders one extra tab per edition from `visibleEvents(now)`,
after the three game tabs, wearing the edition accent and its
`EventArtwork` rather than a game icon. With an event tab selected:

- the month / all-time `ToggleGroup` is hidden — an event board has exactly
  one period;
- the board is fetched as `getBoard(activityGame, edition.id)`, where
  `activityGame` is the edition's first activity;
- a caption states the board counts event rounds only.

`EventHubScreen` gains a button into it. The `Ranking` route parameter becomes
`{ gameId?: string; editionId?: string }`; an `editionId` that is not
currently visible falls back to the default game tab rather than rendering an
empty board.

New EN/PL keys: the hub button and the board caption. Tab labels reuse
`edition.name[locale]`, which already exists.

## Consequences to accept

**The board outlives the event by exactly the discovery window.**
`visibleEvents` filters on `eventDiscoveryPhase`, which returns null once
`now >= endsAt + afterDays` (7 days by default). So the final standings are
readable for a week after closure and then the tab disappears, while the rows
stay in D1. Giving the board its own, longer visibility rule would mean a
second concept of "visible edition"; one rule is worth more than seven extra
days of a board nobody is playing.

**Rehearsal gets a live board on production D1.** `halloween-2026-rehearsal`
is enabled with a wide window, so under this design it is writable today. That
is what the internal track needs, and it is one more reason the entry must be
deleted before a public release — the existing tripwire test in
`src/game/events/events.test.ts` remains the only automated guard.

**Already-polluted rows are not retracted.** Rehearsal rounds played before
this ships have written into `the-ladder`'s real all-time and monthly boards.
Nothing distinguishes them from honest rows after the fact — no marker was
ever written — so removing them means a manual D1 delete by device uuid, or
accepting them. Out of scope here; flagged because the all-time board never
resets.

## Testing

- **Server** — an active edition id is writable; a closed one is refused; a
  draft one is refused; a fixture edition id is refused; a game outside the
  edition's `activities` is refused; `alltime` and the current month still
  behave exactly as today.
- **Push routing** — an event round writes the event bucket and writes
  _neither_ all-time nor month (the regression test for the defect above); a
  non-event round is unchanged; an event round in a non-ranked game writes
  nothing.
- **Local state** — an event best is recorded per edition, best-only; two
  editions keep independent bests; a pending event best appears in
  `listPending` and is retried; a terminal rejection marks it synced.
- **Cache** — an event board caches under its own key, and pushing an event
  score invalidates it.
- **UI** — an event tab appears only for a visible edition; selecting it hides
  the period toggle; an unknown `editionId` route param falls back to a game
  tab.

Existing ranking, challenge, allowance and event suites stay green, including
`test:events:d1`.

## Out of scope

Pruning event ranking buckets, event-specific prizes for board placement,
cross-edition or all-events aggregate boards, retracting the already-written
rows, and any change to how normal boards rank or roll over.
