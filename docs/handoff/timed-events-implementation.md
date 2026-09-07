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

## Local fixture demonstration (not a production event)

1. Use a **local** D1 database. For a fresh database, run `npm run schema:local` inside `server/`. An existing pre-event local database instead needs `migrations/20260906-add-timed-events.sql` applied once before using the new schema/Worker.
2. Inside `server/`, start `npx wrangler dev --local --ip 0.0.0.0 --var ENABLE_EVENT_FIXTURE:true`.
3. Start the app development server with `EXPO_PUBLIC_EVENT_FIXTURE=true` and `EXPO_PUBLIC_CHALLENGE_API_URL` pointing at that local Worker. Use a reachable development HTTPS endpoint where platform transport policy requires it; **do not weaken native transport/permission settings**.
4. The Home event entry exposes **Halloween · preview / Halloween · podgląd**, an isolated test edition, not the production Halloween draft. The `local-halloween-preview-v2` edition uses 300 dedicated EN/PL Halloween questions, sampling a primary and up to five Skip alternates from all 20 candidates per rung. The original `local-halloween-preview` remains bound to `halloween-2026-v1`; its bank and saved runs are not reinterpreted. The earlier `local-event-fixture` / `local-ladder-v1` also remain resolvable and still use their original base questions. Its one-run fixture prize is the existing Champion theme, making permanent earned access observable without inventing launch assets.
5. On two installations, exercise friend/random entry, pause and reopen via history, finish offline, then reconnect and inspect both results. A first-question loss earns the fixture milestone.

The fixture is excluded from the production catalogue. The app override is development-only, and the Worker rejects fixture admissions unless its explicit fixture variable is set. Never enable that variable on the production Worker.

### Simulator-only preview without hardware attestation

For the iOS simulator, `scripts/run-event-preview.mjs` creates an in-memory Worker bundle with ephemeral-token verification, binds only to `127.0.0.1:8787`, and uses isolated D1 data in `/tmp/showdown-halloween-preview-db`. No remote resources are changed. Run both processes with the same environment:

```bash
export EXPO_PUBLIC_EVENT_FIXTURE=true
export EXPO_PUBLIC_CHALLENGE_API_URL=http://127.0.0.1:8787
export EXPO_PUBLIC_LOCAL_PREVIEW_TOKEN=$(openssl rand -hex 32)
node scripts/run-event-preview.mjs &
npx expo start --localhost --port 8082 --clear
# In another terminal, with the Debug app installed:
xcrun simctl launch booted com.showdown.app -RCT_jsLocation localhost:8082
```

The app token override rejects release builds, disabled fixtures, remote/LAN endpoints and missing tokens. Stop these processes and unset the three `EXPO_PUBLIC_*` variables to disable preview; do not save them in release environment files. Metro should run without `CI=1` so edits remain watched.

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
