# Timed events implementation handoff

Source: `docs/plans/2026-09-06-timed-events.md`.

## Implemented

- [x] Device-local versioned sessions for Ladder, Drop and Wheel challenges/rematches; solo remains non-resumable.
- [x] Logical decisions persist before presentation: Ladder answers/lifelines/Skip, Drop allocations and committed outcomes, Wheel landings/letters/solve outcomes.
- [x] Separate active timing and wall-clock deadlines; pause/background checkpoints, offline history resume, explicit terminal abandonment.
- [x] Terminal session journal with frozen completion time/upload payload; progression receipts and retry-safe level bonuses.
- [x] Bundled event definitions and content manifests; disabled Halloween draft with production dates, thresholds and prize assets still deferred.
- [x] Dedicated, source-reviewed Halloween Ladder bank: 300 EN/PL questions, 20 per rung, immutable ID manifest, balanced keys and a hash-bound evidence ledger. Current content is v2; v1 is retained unchanged. See `docs/content/halloween-2026-v2-fixes.md`.
- [x] Installation-wide persisted pending event start; per-edition calendar-day charges, independent purchased-item/Premium allowance.
- [x] Atomic D1 match-or-create and friend admission; immutable two-seat membership, oldest compatible matching, self-match exclusion.
- [x] Event-aware result admission and retention through end + 30 days; no event rematches.
- [x] Completed-run milestones, permanent grants, max/union cloud restore, separate earned content/cosmetic access.
- [x] Event discovery/hub, permanent-asset prize previews, scoped game accents, offline prize celebrations, overlapping history upload/membership facts, EN/PL copy.
- [x] Temporary named Home buttons with original pumpkin artwork for Halloween, matching the game-card side margins. Default promotion: 7 days before, throughout play, and 7 days after; configurable via `discoveryWindow`. Upcoming/results hub states do not offer new admissions. History keeps pending-start recovery reachable after promotion disappears.
- [x] Automated app/Worker checks and local workerd/D1 integration tests.
- [x] iPhone 17 Pro simulator Debug build and Ladder fixture smoke: random admission, correct answer, pause, process restart, history resume at question 2, and exactly one daily charge.
- [x] Dedicated Halloween simulator smoke: new-bank admission, Skip to another Halloween question, correct answer, pause/relaunch/resume with the consumed lifeline retained and no extra daily charge; original base-content save also still resumes.
- [ ] Full iOS/Android background/kill/relaunch, offline completion, and app-update matrix on devices remains outstanding.

## Running Halloween on the internal track

There is one shipped edition, `halloween-2026`, and it is **enabled** with a
deliberately wide temporary window (`2026-09-01` → `2026-12-31`) so the real
flow can be played against production before October. There is no rehearsal
edition, no env flag and no fixture involved: whatever window ships is the
window every user of that build sees.

1. **Just build it.**

    ```bash
    npx expo run:ios --configuration Release
    npx expo run:android --variant release
    ```

2. **Redeploy the Worker.** `admitEvent` resolves the edition from the Worker's
   own bundled copy of `shared/events/definitions.ts`
   (`server/src/events/admission.ts`), and `isWritablePeriod`
   (`server/src/validation.ts`) decides whether the edition's ranking board
   accepts writes. A Worker deployed with different dates fails silently in both
   places: admissions return `410 Event closed or unavailable` and ranking
   writes return `400`, while the app looks perfectly normal.

    ```bash
    cd server && npx wrangler deploy
    ```

Both devices must run the same build: matchmaking pairs on edition id and
content revision. Test runs write real production D1 rows — challenges,
attempts, and entries on the `halloween-2026` ranking board.

**Before any public release**, replace the temporary window with the real
Halloween dates and redeploy the Worker in the same change. The dates are the
only containment; nothing automated can tell an intentional window from a
leftover test one.

## Important paths

- `shared/events/`: edition policy, immutable pool manifests, isolated test edition.
- `src/game/challenge/session/`: device-local journal, per-game checkpoints, timing, completion recovery.
- `src/game/events/`: participation/allowance, content resolution, earned access and presentation.
- `server/src/events/admission.ts`: transactional D1 allocation.
- `server/migrations/20260906-add-timed-events.sql`: additive upgrade for existing databases.
- `src/screens/EventHubScreen.tsx`: entry, goals and previews.

## Verification

Commands used:

```bash
npm run type-check
npm --prefix server run typecheck
npx jest --runInBand --coverage=false
npm run test:events:d1
npm run content:halloween:check
npm run i18n:check
# Targeted ESLint/Prettier checks on changed files; git diff --check.
```

Final automated result: **110 Jest suites / 1,060 tests passed**. App and Worker type checks, targeted ESLint/Prettier, locale synchronization, and `git diff --check` passed.

The D1 harness uses the installed Miniflare/workerd runtime, not SQL mocks. It upgrades an existing schema without losing its ordinary record, tests simultaneous seat claims, request retries, self/full/friend isolation, deadline boundaries, late immutable uploads, 100-ID sync requests within D1's total bound-parameter limit, and actual Worker cleanup. It also verifies dedicated Halloween admission, production gating, cross-rung/oversized-alternate rejection and exclusion of the answer bank from the Worker bundle. App Check is stubbed **only in temporary test/preview bundles**; the production Worker verifier is unchanged. Normal app requests still require hardware attestation; the explicit development-only loopback preview described below uses an ephemeral token instead.

Jest reports non-fatal React `act`/open-handle warnings in the existing suite. Translation analysis reports existing potentially-unused English plural forms; locale synchronization and static-key checks pass.

## Fixture editions are test data only

Fixture editions (`local-event-fixture`, `local-halloween-preview`,
`local-halloween-preview-v2`) exist only as data for unit tests and for the D1
regression suite. There is no app-side switch that shows them: `visibleEvents`
returns the shipped editions and nothing else, so no environment variable can
put a fixture event on Home.

The Worker keeps a test-only seam — `ENABLE_EVENT_FIXTURE`, read by
`admitEvent` and the attempt route — used by `npm run test:events:d1`, which
drives admission, seats, idempotency, closure and retention entirely through
fixture editions. It is never set in `wrangler.jsonc`, so a deployed Worker
always refuses a fixture admission. Never set it on the production Worker.

To exercise the real event, build the app and play `halloween-2026` against the
deployed Worker; see "Running Halloween on the internal track" above.

Verified with the original base-content fixture on iPhone 17 Pro / iOS 26.3 (2026-09-07): event hub and reward goal display; random admission; orange-accent Ladder gameplay; first correct answer; save/pause; process stop/relaunch; history resume at question 2; allowance remains 2 of 3. Screenshots: `/tmp/showdown-halloween-hub.png`, `/tmp/showdown-halloween-playing.png`, `/tmp/showdown-halloween-resumed.png`. Local preview/transport tests: **2 suites / 32 tests passed**, plus app type check, targeted lint/format, i18n and whitespace checks. This is not a full native matrix pass.

The dedicated **v1** bank was also verified on the same simulator: 002 (Halloween/All Saints’ Day) was replaced via Skip with 183 (the ghost in _Hamlet_), the correct answer advanced to question 2, and a process restart/history resume retained two lifelines and two of three daily plays. The original fixture separately resumed its saved question 2 with all three lifelines, confirming it was not reinterpreted as the new edition. Screenshots: `/tmp/showdown-dedicated-{hub,question1,skipped,question2,resumed,history}.png` and `/tmp/showdown-legacy-preserved.png`. These are limited Ladder smoke checks, not the full native matrix.

Pause-modal regression fixed (2026-09-07): Ladder, Drop and Wheel explicitly hide the leave dialog before the pause exit. Challenge exit uses `popTo('Home')`, rather than pushing Home above a still-mounted game/modal/clock. Regression tests cover all three game dialogs and the navigation action. A standalone iOS Maestro flow passed two pause exits, confirmed the dialog/abandon action were absent on Home, and reopened the same saved question with unchanged lifelines. Flow: `/tmp/showdown-pause-modal-regression.yaml`; screenshots: `/tmp/showdown-pause-modal-fixed-{home,resumed}.png`. This extends the Ladder smoke only; the broader native matrix remains outstanding.

Seasonal Home entry verified on the same iOS simulator (2026-09-07): named pumpkin button inside the game-card inset column, no generic “Wydarzenia czasowe” Home button, a tap directly on the pumpkin opens the selected Halloween hub, and returning Home restores the entry. Flow: `/tmp/showdown-seasonal-card-smoke.yaml`; screenshots: `/tmp/showdown-seasonal-card-{home,hub}.png`. Unit tests cover inclusive start-minus-seven-days / exclusive end-plus-seven-days boundaries, disabled editions, configurable windows, upcoming/closed admission controls, overlapping editions, focus/foreground clock refresh, tablet margins and pending-start recovery through history. Promotion visibility does not extend gameplay or the existing 30-day upload window, and does not change permanent reward ownership.

Friend-invite intro parity fixed (2026-09-07): new event friend creators retain an optional durable `awaitingStart` marker and see the normal Start / Play later intro instead of being treated as a resumed game. Starting later clears the marker locally without a new admission, deck or charge. Older saves without the marker still resume directly; random admission and recipients who already chose Start remain immediate. History labels an unstarted reservation as Your turn. On the simulator, a single new invite showed the intro behind the share sheet, Play later returned Home, process restart/history reopen restored the intro, and explicit Start reached question 1. Remaining plays went from 2 to 1 at invitation creation and stayed 1 after starting/pausing later. Flows: `/tmp/showdown-event-invite-{create,later,reopen}.yaml`; screenshots: `/tmp/showdown-event-invite-{intro,reopened,playing,single-charge}.png`. An initial swipe did not dismiss the iOS share popover; tapping outside did. A cold automation retry hit `kAXErrorInvalidUIElement`; the subsequent warm continuation passed. The Home speech bubble/debug warning overlay can obstruct center taps, so this smoke entered via the pumpkin and used the hub's history button.

Current session logs/PIDs: `/tmp/showdown-preview-{backend,metro}.{log,pid}`. The unsigned Debug simulator build is at `/tmp/showdown-ios-sim/Build/Products/Debug-iphonesimulator/ShowDown.app`; build log: `/tmp/showdown-sim-build.log`. Port 8081 belongs to another project and was left untouched.

## Required native smoke-test matrix

For **each** game, background then force-kill at an open question, immediately after a decision, during reveal, and while a completed result upload is offline. Relaunch into history and verify no restart/reroll, duplicated progression, or extra charge. Include Ladder lifelines/Skip, Drop split allocations, Wheel Bankrupt/consonant/vowel/solve/Continue transitions, and multiple retained sessions beyond 100 history rows.

Also exercise a normal app update retaining the same application data; local midnight/DST/date revisits; event closure while a leave modal is open; a terminal decision just before closure; pending admission during a network timeout; reward ownership after closure and cloud restore. Unsupported saves must not be silently replaced with a fresh attempt.

## Release boundaries

No remote migration, Worker deployment, native prebuild, version bump or store submission was performed. Apply the additive migration before deploying the new Worker through the normal release process. Do not apply the ALTER migration to a fresh database already initialized from the updated `schema.sql`.

Dedicated Halloween question content is now complete and reviewed. Production schedule, launch reward thresholds/assets and activation remain deferred; the local preview’s Champion reward is still a placeholder. Referenced content revisions must stay bundled through their upload window; permanent reward definitions/assets must remain available afterward. No native permission/removal files or existing `CONTEXT.md` edits were changed by this implementation.
