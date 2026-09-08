# Timed events and async challenge resume — implementation plan

Date: 2026-09-06
Status: Product decisions approved, including the simplified first-delivery scope. Implementation pending.

## Outcome and first delivery

Build a reusable temporary event mode with friend invitations, asynchronous random
opponents, an independent daily allowance, and permanent milestone prizes. Reuse
normal gameplay and scoring. Add persistent resume to async challenges through the
challenge history dashboard. Prove the complete flow with The Ladder first, then
extend ordinary challenge/rematch recovery to The Drop and The Wheel before handoff.

Halloween is the first edition: The Ladder only, with a dedicated Halloween pool
available equally to all event players. Ship its configuration as a disabled draft.
Exact dates, goals, questions, and prize assets are supplied later; the infrastructure
must be demonstrable with local/test fixtures without making an event live.

The decisions below are approved product behavior. The module and delivery proposals
are implementation guidance, grounded in the inspected codebase.

## Approved behavior

| Area                | Decision                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event configuration | Declarative definitions bundled inside the app; no remote editor or remotely managed catalogue.                                                                                                                                   |
| Reuse               | Event editions select their game/content/presentation. Halloween does not justify a new gameplay rules engine.                                                                                                                    |
| Halloween           | The Ladder only; dedicated questions, including Skip alternates; no pack-ownership gate for participants.                                                                                                                         |
| Entry               | Invite a friend or find a random opponent. Both event paths have exactly two player seats.                                                                                                                                        |
| Event rematches     | Not offered in the first delivery. Start another round through the event hub's friend/random actions.                                                                                                                             |
| Random matching     | Join the oldest compatible unmatched round, otherwise start one awaiting an opponent. The first player can already be playing or finished.                                                                                        |
| Waiting             | Unmatched rounds stay eligible until event closure. Never match a player against their own round.                                                                                                                                 |
| Assigned opponents  | Pairings stay fixed even if someone pauses or abandons play; no replacement opponent.                                                                                                                                             |
| Event allowance     | One per-player daily budget per edition, shared across its games and friend/random entry paths; independent of ordinary limits and other editions.                                                                                |
| Allowance defaults  | 3 plays +1 per owned qualifying paid item +10 for active Premium. Bonuses stack; all three values are configurable per edition.                                                                                                   |
| Reset               | Player's local midnight.                                                                                                                                                                                                          |
| Consumption         | Each player pays one event play when starting. Resume and submission retries are free. Abandoning a started run gives no refund.                                                                                                  |
| Starting            | One event start operation at a time per installation; resolve a pending start before allowing another. Charge once when the playable session is durably saved, before revealing its first question.                               |
| Goal credit         | Completed runs still count for the run tally, but prize progress counts only wins. A loss or a draw earns no prize progress. A round whose opponent never uploads counts as a win at event closure.                                                                    |
| Completion          | A run completes when the game decision that ends it, its final result, and `completedAt` are durably saved together. Animations and Continue do not determine completion.                                                         |
| Prizes              | Win-count milestones: every N head-to-head wins draws one prize at random from the edition's pool, never repeating an item the player already holds. The pool is previewable; the individual draw is not. Repeats until the pool is empty.                                     |
| Offline completion  | A run still completes and records progression offline. Prize progress needs the opponent's score, so prizes are granted when the round resolves rather than at completion.                                                                                                                                     |
| Prize lifetime      | Earned skins/content remain permanently available after event closure.                                                                                                                                                            |
| Prize recovery      | Follow normal progression backup/cloud restore within supported app versions, independently of unfinished-run recovery. Upgrading old saves is supported; passing event data through older app versions is outside the guarantee. |
| Normal progression  | Preserve normal async-challenge XP, achievements, run statistics, level rewards, and bonuses. Event goals/prizes are additional.                                                                                                  |
| Rankings            | Feed event scores into existing monthly and all-time rankings.                                                                                                                                                                    |
| Closure             | Stop new starts, matchmaking, and continued event play at the deadline. No finishing grace period.                                                                                                                                |
| Late uploads        | Accept runs completed before closure for 30 days afterward; retain matches/results for that window. Late upload does not permit late play.                                                                                        |
| Resume modes        | Ordinary async challenges/rematches and event friend/random challenges only. Solo play does not gain resume.                                                                                                                      |
| Resume entry        | Challenge history dashboard.                                                                                                                                                                                                      |
| Resume persistence  | Same-device app data, surviving process death and normal app updates. No new cross-device unfinished-session synchronization.                                                                                                     |
| Offline resume      | Already-started sessions can resume without network access while their play window remains open.                                                                                                                                  |
| Resume expiry       | Ordinary sessions stop at their challenge's existing expiry; event sessions stop at event closure.                                                                                                                                |
| Speed scoring       | Exclude time away and preserve elapsed active time on normal pause/background. An unexpected crash may lose elapsed time since the last checkpoint; exact crash-time recovery is not promised.                                    |

Amended 2026-09-08 by docs/superpowers/specs/2026-09-08-halloween-event-prizes-design.md.

Ordinary shared-link participation behavior is outside this delivery. Links do not
need to be blocked to enforce event seats: opening a full event link can show its
status while admission refuses a third player. Dedicated event leaderboards,
scheduled public tournaments, new account systems, remote administration, and push
notifications are not required by the approved first delivery.

## Existing code and gaps

- `shared/challenge/contract.ts` is the app/Worker contract for immutable frozen
  rounds. It has question ids, creator, mascot, and expiry, but no event membership
  or durable player participation identity.
- `src/game/challenge/build.ts` uses ordinary free/owned content; `resolve.ts`
  rebuilds initial game state from bundled ids. Events need explicit pool selection
  and resolution, rather than attaching an event label to an ordinary deck.
- The Ladder, Drop, and Wheel play screens keep current game state and scoring
  accumulators in React state/refs. There are no persistent gameplay checkpoints.
  History reopens a challenge from its initial round, despite comments saying resume.
- `challenge/log.ts` caps history at 100 entries without protecting unfinished
  sessions. Resumable sessions and pending uploads must remain reachable. Its ordinary
  creation counter also needs to exclude event rounds indexed in the same history.
- `ChallengeScreen.tsx` holds unsent results in a ref and creates a new attempt
  timestamp inside each submission call. Durable retries need one frozen payload
  because the Worker compares all attempt fields, including timestamp.
- `server/src/index.ts` uses Worker/D1 with App Check. Ordinary challenges accept
  one result per device, but only directed rematches enforce two participant seats.
  Event admission must add actual atomic seat enforcement.
- Challenge cleanup deletes results using ordinary record expiry. Reusing a
  creation-plus-30-days expiry would delete early event rounds before their
  approved post-event upload window ends. The separate cleanup script is legacy
  Firestore tooling; the active D1 path is in the Worker. The shared validator's
  31-day maximum lifetime must not reject event retention through `endsAt + 30 days`.
- `challenge/limit.ts` already supplies the 3/+1/+10 formula using live premium
  catalogue items. Its accounting is local and creation-based; event accounting
  must be independent and based on each player's run start.
- `progression/recordRun.ts` awards progression at run completion. It is not a
  durable exactly-once completion workflow across crashes. Event grants need
  persistent identities and cannot be derived solely from lifetime XP.
- `progression/merge.ts`, `services/gameServices/cloudSave.ts`, and
  `storage/appStores.ts` govern normal restore. Cloud merge uses max/union rather
  than adding counters; new reward fields must participate in defaults, merge,
  preservation checks, persistence, and the existing native backup coverage.

## Domain model and module boundaries

An **Event Edition** is one dated occurrence, such as Halloween 2026. It contains
presentation, available activities, an allowance policy, and goals. A later edition
gets a distinct identity and fresh event progress.

An **Event Activity** selects a supported game and content revision. Friend and
random entry reuse the same frozen-round and scoring behavior. Event policy varies
by configuration; individual games continue to own their gameplay implementation.

A **Random Match** is a two-player async challenge whose opponent is assigned from
the waiting pool. Match membership and personal run progress are independent:
"unmatched" does not mean "not started."

An **Event Goal** defines a completed-run threshold within an edition and its prize.
The first delivery has no other goal metrics or configurable predicates. An
**Event Reward Grant** represents permanent earned ownership, separate from temporary
presentation and purchases.

A **Challenge Session** is one player's saved attempt at a frozen challenge round,
including its progress and any completed result awaiting submission.

Proposed implementation placement:

| Module                 | Responsibility                                                                                                  | Primary locations                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Event definitions      | Validate editions, schedules, content references, compatibility, allowances, and goals; derive lifecycle.       | New `shared/events/`, app event catalogue/content registration              |
| Challenge sessions     | Start/resume/checkpoint/complete; stable identity, active timing, pending immutable result.                     | New `src/game/challenge/session/`, existing game play screens               |
| Event participation    | Match-or-create, friend seat admission, membership checks, late submission, event-aware retention.              | New `server/src/events/`, additive D1 migrations, shared challenge contract |
| Event allowance        | Per-edition local-day usage, purchase/subscription formula, idempotent start charge.                            | New `src/game/events/`, existing purchase state                             |
| Completion and rewards | Persist completion once; ordinary progression, event goal credit, permanent grants, retry-safe synchronization. | `src/game/progression/`, new event progression module                       |
| Event presentation     | Hub, temporary theme context, entry actions, goal/prize display; history resume and match status.               | Screens, navigation, theme and catalogue access                             |

Keep public interfaces centered on operations callers need. Hide queue queries,
checkpoint representation, and grant reconciliation inside these modules. Do not
add an arbitrary rules engine or remote configuration platform.

These are responsibility groupings, not a requirement for a separate framework or
registry per concept. Keep editions as plain typed data, with nested activities
such as `{ game, contentRevision }` and milestones such as
`{ id, completedRuns, rewardId }`. Use ordinary functions for validation and
lifecycle; add no activity registry, pluggable goal handlers, or revision-management
subsystem. Source-controlled immutable definitions are sufficient for this delivery.

## Implementation choices for the first delivery

These choices implement the approved behavior without introducing additional
product systems:

- Keep definitions and assets in source control. Pure policy metadata may live in
  a shared file compiled into both the app and Worker for consistent validation;
  the Worker owns dynamic matches/results, not a remote configuration UI. Retain
  referenced edition revisions through their upload window. Do not silently change
  published progress thresholds or frozen content under an existing revision.
  Keep earned prize definitions and assets available permanently.
- Preserve the existing device-UUID/App Check and local entitlement model. Use
  server enforcement for seat allocation, immutable submissions, known event
  membership, and server-observable time boundaries. Local rewards and offline
  completion times retain the existing honour-based trust level; they are not
  proof of an authenticated identity or server-verified gameplay.
- Compute allowance from current purchased ownership and subscription state.
  An earned prize must not increase the purchased-item bonus, even if that prize
  grants access to content also sold commercially. Use separate earned/purchased
  access sources in content and cosmetic resolution.
- Match compatibility uses edition, activity/game, and supported content revision.
  Players resolve the frozen bilingual ids in their own language. Mere app-version
  differences should not split compatible players into separate queues.
- Reserve the friend creator's seat and let the first admitted opponent claim the
  second. Viewing a link does not consume a play. Keep friend rounds out of the
  random queue. Requests from different players can arrive concurrently, so use
  an idempotency key and atomic match-or-create; read-then-insert alone is insufficient.
- Use the challenge id plus player device UUID as the stable participation identity
  for the saved session, allowance charge, result, and progression receipt. Keep a
  separate start-request id because random admission precedes knowing the challenge
  id, and persist its mapping to the admitted participation. Use edition id plus
  milestone id for reward-grant identity; avoid independently generated ids for
  each step of the same run.
- Allow only one event start operation at a time per installation. Persist its
  request identity before sending and resolve any uncertain admission before another
  start. Charge once when saving the playable session, before revealing its first
  question; persist its participation identity and charge date for retries. A failed
  start with no playable session costs nothing. Check allowance and event availability
  before starting, and recheck before committing a new session after admission;
  a response arriving after closure cannot start or charge a run. This uses one
  pending start, not a separate allowance-reservation or distributed transaction system.
- Track usage by edition and local calendar date, with stable charged session ids.
  Retain day buckets through the event to avoid resetting by revisiting an earlier
  day. Handle daylight-saving changes, travel, and midnight-spanning retries using
  calendar dates rather than adding 24 hours. Do not add backend IAP verification
  solely for the event allowance. Exclude event-created history entries from the
  ordinary challenge-creation counter so independence works in both directions.
- Preserve multiple unfinished challenges using their existing history identities;
  never overwrite a saved run when another challenge starts. Derive history labels
  and actions from local run status, upload status, opponent membership/results,
  and the current deadline. These facts can overlap: a resumable run may still be
  waiting for an opponent, and a closed event may still have a pending upload.
  Do not persist a second authoritative history state machine. Pausing
  saves; explicit abandonment is terminal and does not recycle an assigned seat.
  History pruning must keep resumable sessions and pending uploads reachable; batch
  sync requests if the retained list exceeds the existing 100-id request limit.
  Open saved sessions locally without requiring a server fetch. Ordinary sessions
  stop at their challenge's existing expiry; event sessions stop at event closure.
- Save committed game decisions before presenting outcomes. Reconstruct animations
  from saved logical state. Preserve lifeline effects, allocations, spin outcomes,
  revealed answers, score accumulators, and timing so restore cannot undo or reroll.
- Save elapsed active time when pausing/backgrounding and at logical checkpoints.
  Restore the latest saved elapsed time after an unexpected crash, accepting loss
  of the unsaved interval. Exact crash-time accounting is outside this delivery.
  Restore compatible checkpoints after upgrades; migrate changed formats and handle
  missing content explicitly without silently restarting a paid attempt. Active
  sessions stay in device-local storage and outside cross-device restore.
- When a decision ends a run, save the terminal game state, final result, and
  `completedAt` together before presenting its outcome. A win or loss committed before
  event closure counts even if its animation, Continue action, or recovery happens
  afterward. Saving a nonterminal decision does not complete the run.
- Use the terminal saved session as the durable completion journal, including its
  original immutable upload payload; never regenerate the timestamp on retry or
  copy the completion into a separate journal. Recovery reads this saved completion
  and retries unfinished work. Persist a progression receipt keyed by participation
  identity in the same write as the ordinary XP, event goal credit, and prizes it
  guards. Make separately stored level bonuses retry-safe too; a receipt must not
  cause recovery to skip an unapplied bonus. Retain the terminal session until local
  effects are settled and upload succeeds or is permanently closed. Network side
  effects run independently.
- Merge per-edition completed-run counters using max and permanent reward identities
  using union; update preservation checks. This follows normal progression's
  accepted limitation: independent offline runs on two devices may undercount when
  merged. Exact cross-device run aggregation is outside this delivery. Keep receipt
  handling consistent with restored progression so a retained local completion
  cannot be applied twice after restore.
  Updated clients preserve unknown earned ids and can upgrade older saves using
  defaults for missing fields. Recovery guarantees cover supported app versions;
  downgrades or cloud-save round trips through older clients may discard event fields
  and are outside this delivery. Reuse existing progression backup and cloud support.
- Stop event gameplay at closure even when the active question timer is paused.
  Event wall-clock availability and active decision timing are separate clocks.
  Preserve completions recorded before closure for later upload; never turn an
  unfinished checkpoint into a post-close completion.
- Retain event records until `endsAt + 30 days`. Check a late result against its
  persisted completion time, claimed seat, edition, and upload deadline. Reject new
  play/admission after closing. Recognize identical committed retries before applying
  new-write gates. Results can settle during the upload window; a missing result
  at closure is not proof that the opponent never finished offline. Separate event
  play deadlines from retention and adapt lifetime validation for event records;
  preserve ordinary challenge expiry validation.
- Continue using the existing monthly/all-time ranking flow and period policy;
  do not add historical-month writes just for late event results. Retain permanent
  grants after match cleanup. Hide event rematch actions and reject rematch creation
  from event rounds so they cannot fall into ordinary rematch creation. Another
  event round starts through the hub's existing friend/random entry paths.

## Delivery sequence

Build steps 1–5 as a Ladder end-to-end slice using local/test event fixtures.
Drop/Wheel recovery remains required in step 6, but does not block proving event
entry, resume, completion, and rewards together. This changes implementation order,
not the approved final resume scope.

### 1. Ladder async sessions and recovery

Implement the session contract, durable storage, immutable pending submissions,
and completion deduplication using the terminal session and progression receipt.
Integrate The Ladder for ordinary challenges/rematches and history-dashboard resume.
Preserve solo behavior. Keep the checkpoint payload game-specific; extend the shared
session lifecycle as the other games are integrated.

Acceptance: interrupted questions, committed choices, and unsent completed results
survive process death; updating the app preserves/migrates compatible saves; resuming
never charges again or repeats progression. Open sessions resume offline and remain
reachable beyond the history cap. Normal pauses preserve active timing; unexpected
crashes restore the latest saved timing, with unsaved elapsed time allowed to be lost.

### 2. Event definition and content contracts

Implement edition validation, lifecycle, declarative allowance and completed-run milestones,
and event-specific content selection/resolution. Register a disabled Halloween
Ladder draft without invented production dates, goals, or prizes. Provide local/test
fixtures for a complete event lifecycle and a future-edition configuration check.

Acceptance: no live event appears from incomplete draft data; configured content
is accessible to all participants; normal content selection is unchanged; adding
another edition does not require changes to the event lifecycle implementation.

### 3. Event matchmaking, admission, and retention

Add event metadata and participation persistence through additive migrations.
Implement friend admission, oldest-compatible random matching, immutable seats,
event-aware submissions, and cleanup. Keep ordinary request shapes and behavior
compatible. Integrate client admission with one pending event start per installation
and once-per-start event charging, without a separate allowance-reservation system.

Acceptance: two simultaneous entrants cannot steal the same seat or create a third
participant; retries converge on the same admission; own rounds cannot match; older
unmatched rounds remain eligible through closure; no post-close starts; eligible
late uploads work throughout the 30-day window. Pending starts survive relaunch and
prevent overlapping starts; event and ordinary allowances do not consume each other.

### 4. Goals, grants, and progression restore

Add per-edition completed-run counters and edition/milestone grant identities to
the session completion workflow. Merge counters by max and earned ids by union.
Grant configured prizes immediately, including offline. Integrate earned-access
resolution, reward previews, celebration, and normal progression/cloud merge paths.

Acceptance: a first-question loss counts, an unfinished run does not, and an absent
opponent never delays credit. Crashes/retries/restore never duplicate or revoke
prizes within the supported recovery scope. Old saves upgrade into the new app;
round trips through older clients are not part of acceptance. Earned content does
not masquerade as a purchase for allowance or IAP logic. Cross-device counter merge
retains normal progression's accepted undercounting behavior.

### 5. Event hub and history integration

Expose active event discovery, friend/random entry, remaining daily plays, goal
progress, and prize previews. Apply event visuals through scoped presentation that
preserves normal theme preferences. Extend existing history for resume, pending
uploads, late opponents, and closed matches; keep network failure states actionable.

Acceptance: the complete journey works from start through resume, offline finish,
local prize grant, late upload, and later opponent result. Full links refuse only
extra participation. Expired event visuals do not remove earned cosmetics.
Event result screens offer no rematch action; another round starts through the hub.

### 6. Drop and Wheel async recovery

Extend the proven session lifecycle to The Drop and The Wheel for ordinary
challenges/rematches. Save each game's own logical checkpoint, including bank
allocations and spin/solve outcomes, through the same session operations. Reuse
history resume, completion receipts, and immutable upload handling. Halloween
remains Ladder-only; solo behavior remains unchanged.

Acceptance: all three games meet step 1's recovery guarantees. Drop allocations
and Wheel outcomes survive interruption without undoing decisions or rerolling.
All approved ordinary challenge/rematch resume modes are covered before handoff.

### 7. Verification and handoff

| Test surface              | Required scenarios                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session recovery          | Each game's key phases; lifelines, bank allocation, spin/solve transitions; background/kill/relaunch; offline resume; update migration; pending results and resumable sessions beyond the history cap. Normal pauses preserve timing; crashes restore the last saved elapsed time.                                                  |
| Exactly-once effects      | Crash before/after completion commit, uncertain upload, repeated history open, cloud merge while local completion lands.                                                                                                                                                                                                            |
| Allowance                 | Free/paid/Premium stacking, independent editions and ordinary limits, friend/random sharing, one pending start across relaunch, failed starts, midnight and DST, travel/date revisits, resume after a reset.                                                                                                                        |
| Matching                  | Empty queue, oldest compatible selection, self-match exclusion, concurrent claims, request retry, fixed abandoned seats, no third entrant.                                                                                                                                                                                          |
| Deadlines                 | Exact start/end boundaries, admission response after closure, paused run at closure, terminal decision saved before closure with reveal/recovery afterward, nonterminal save cannot finish after closure, ordinary resume expiry, late uploads, event retention beyond the ordinary 31-day maximum, cleanup at the 30-day boundary. |
| Rewards and restore       | Completed-run thresholds, offline grants, duplicate prevention, old saves upgraded by the new client, permanent ownership and assets after cleanup, earned/purchased access separation.                                                                                                                                             |
| Compatibility             | Ordinary challenges/rematches unaffected, event rematches unavailable, unsupported event content handled, schema upgrade without destructive reset, solo has no resume.                                                                                                                                                             |
| Presentation/localization | Event scope and normal-theme restoration, readable full/closed states, EN/PL parity, atomic touch handling.                                                                                                                                                                                                                         |

Run app and Worker type checks, relevant Jest suites, targeted lint/format checks,
and `npm run i18n:check` for translations. Exercise D1 atomic allocation and retention
with a local database integration harness rather than relying only on query mocks.
Validate recovery on iOS and Android. Do not run native prebuild for this work;
retain documented permission removals and other repository native requirements.

## Deferred launch work

Supply Halloween dates, milestone thresholds, reviewed bilingual Ladder content,
reward definitions/assets, and event visuals. Confirm content coverage at all 15
rungs and for Skip alternates, enable the finished edition, and perform launch
verification through the normal release workflow. This plan does not publish or
deploy an event, create paid products, or generate the final Halloween content.
