# In-app update + what's-new sheets — design

Date: 2026-07-31
Status: Approved

## Goal

Two bottom sheets that make the app feel alive and actively maintained, each
shown at most once per version and never in the middle of anything:

1. **Update available** — a newer build exists in the store. Tapping the CTA
   opens the store listing.
2. **What's new** — the player just updated. Shows this version's highlights.

Both dismiss by tapping outside, dragging down, the Android back button, or the
primary button. Neither ever blocks.

## Scope decisions made during brainstorming

- **Store credentials cannot ship in the app.** The App Store Connect and Google
  Play Developer APIs both require a signed JWT from a private key
  (`AuthKey_TYBAQ9XDGV.p8`, `google-play-key.json`). Bundling either would hand
  out publishing credentials. The check therefore uses a public path only:
  Apple's iTunes Search API.
- **One HTTP lookup serves both platforms.** iOS and Android always ship
  together, so the App Store version is the release marker for the pair. Google
  publishes no equivalent endpoint, and the Play listing no longer reliably
  exposes a version.
- **No native module.** `expo-in-app-updates` was implemented and then removed.
  Its Android half (Play Core) is genuinely native — a bound-service call into
  the Play Store app, not an HTTP request, so it cannot be replicated in JS. Its
  iOS half is only a `URLSession` GET to the iTunes Search API, and its podspec
  demands iOS 16.4 against this app's 15.1 floor, so CocoaPods silently skipped
  the pod and every iOS check would have failed closed — a working build with a
  dead feature. Keeping a native path on one platform and an HTTP path on the
  other means two mechanisms to keep in sync for one boolean, only one of which
  is verifiable on this machine. Rejected in favour of a single lookup.
- **Release notes are bundled in the app, not fetched.** The remote check
  answers exactly one question — "is there a newer version?" — and returns a
  version string. All human-readable copy lives in the bundle.
- **The CTA opens the store listing** for the current platform. One code path,
  works in dev builds, and avoids Play Core's flexible-update
  download/`completeUpdate` state machine.
- **Cold start on Home only.** No foreground re-check, no post-run slot. At most
  one interruption per version, and never during a run, a purchase, a challenge
  deep link, or the review prompt.
- **One entry of notes at a time.** `whatsNew.ts` describes only the current
  version. No accumulating changelog to maintain.

## 1. Units

| Unit                                             | Responsibility                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `src/services/appUpdate/updateCheck.ts`          | The iTunes lookup. `checkStoreVersion()` → `{ available, storeVersion } \| null`. Never throws. |
| `src/services/appUpdate/seenVersions.ts`         | The once-per-version ledger in `deviceStore` + the pure gating decision.                        |
| `src/data/whatsNew.ts`                           | Current version's highlights: `{ version, highlights: [{ emoji, key }] }`.                      |
| `src/components/molecules/AnnouncementSheet.tsx` | One presentational sheet over the existing `BottomSheet`. Both flows render it.                 |
| `src/hooks/useAppAnnouncement.ts`                | Orchestrator. Decides which sheet (if any) Home shows, and mounts it.                           |

The gating logic is a pure function of stored state and inputs, so the entire
behaviour matrix is unit-testable without a native module or a renderer.

**Storage: `deviceStore`, not `profileStore`.** These are per-install facts. A
restore onto a new phone must not carry "already told them about 1.4.0".

Two independent keys, both strings:

- `updatePromptSeenVersion` — the `storeVersion` last prompted about.
- `whatsNewSeenVersion` — the `APP_VERSION` last caught up on.

## 2. Decision flow

Runs once per launch, when Home first gains focus and no other sheet is open.

```
Home focused, first time this launch
│
├─ whatsNewSeenVersion absent?          → FRESH INSTALL: seed = APP_VERSION, show nothing
├─ whatsNewSeenVersion !== APP_VERSION?
│    ├─ WHATS_NEW.version === APP_VERSION → show WHAT'S NEW
│    └─ no matching entry (silent patch)  → bump key, show nothing
└─ else → checkStoreVersion()  (async, fire & forget)
     └─ available && updatePromptSeenVersion !== storeVersion → show UPDATE
```

The two sheets are mutually exclusive and what's-new wins. Right after an update
there is no newer version anyway; the ordering makes that explicit rather than
accidental.

Cases this must get right:

- **Fresh install shows nothing.** A brand-new player has nothing to catch up
  on. Seeding `whatsNewSeenVersion` on first launch is what prevents it.
- **Skipped versions.** 1.3.1 → 1.5.0 shows 1.5.0's notes only.
- **Silent patches** still advance `whatsNewSeenVersion`, so a later real
  release is not suppressed.
- **Check failure** (offline, throttled, no Play Services, dev build) shows
  nothing and marks nothing.

**"Seen" is marked when the sheet is shown, not when it is dismissed.** There
are five ways out — button, backdrop, drag, Android back, app kill — and marking
on show is the only way "exactly once" is actually true.

## 3. Platform details

- `checkStoreVersion()` has **no platform branch** — one `fetch` of
  `itunes.apple.com/lookup?bundleId=com.showdown.app`, both platforms. A test
  asserts the two behave identically. The US storefront resolves the bundle ID,
  so no `country` parameter is needed (verified 2026-07-31).
- The store version is a **semver string**, compared with `isNewerVersion()` —
  a segment-wise numeric compare, so `1.10.0` correctly beats `1.9.0`. The
  _ledger_ still only ever compares stored versions for equality.
- The lookup is CDN-cached, so the request carries a timestamp and
  `cache: 'no-store'`, and aborts after 5s — a hung request must not surface a
  sheet minutes later, over whatever the player is doing by then.
- CTA → `Linking.openURL` with `itms-apps://apps.apple.com/app/id6774886649`
  (iOS) and `market://details?id=com.showdown.app` (Android), falling back to
  the `https://` form when the scheme will not open. This is the only
  platform-specific code in the feature, and it is a URL constant, not logic.
- **No new dependency and no native code**, so no prebuild and no rebuild —
  the feature runs in the existing dev client.

## 4. Error handling

Every remote path fails silent — no network, App Store throttling, Play Services
missing, dev build all resolve to "no sheet". A version nudge is never worth an
error state in front of a player. Failures are not reported to Sentry; a failed
check is an expected state, not an incident.

## 5. Testing

- **Pure** (`seenVersions.test.ts`): the full decision table — fresh install,
  unchanged version, newer version, skipped version, missing notes entry,
  already-seen, check failure.
- **Component** (`AnnouncementSheet.test.tsx`): highlights render, CTA fires,
  each dismiss path calls back.
- The lookup is tested against a mocked `global.fetch` — no network, no native
  module, no platform-specific harness.
- New i18n keys verified with `npm run i18n:check`. The `whatsNew.<version>.*`
  keys are referenced dynamically through `WHATS_NEW`, so the checker lists them
  as possibly-unused, exactly like the existing `progression.family.*` and
  `offline.limit.bullets.*` families. That is expected; do not delete them.

## 6. Visual pass

A dev-only trigger forces either sheet on demand. 2–3 real variants (mascot
pose, highlight density, CTA treatment) are built and chosen from the running
app on device, not from a written description.

Baseline layout, shared by both sheets: drag handle, mascot, title, body
(generic copy for update; emoji-per-highlight list for what's-new), one primary
CTA.

## 7. Known costs, accepted

- **iTunes lookup is CDN-cached** and can lag a few hours behind a release, so
  players may hear about a new version slightly late. Accepted as the price of a
  store-driven check over a self-hosted manifest that would need publishing on
  every release.
- **Staged Play rollouts can prompt Android users early.** If a release rolls
  out to a percentage, a device that is not yet eligible may still be told an
  update exists; tapping through shows "Open" rather than "Update" in Play.
  Mild, and the once-per-version cap means no repeat nagging. Release timing
  works in our favour here: Apple review is the slow step, so the App Store
  usually learns of a release _after_ Play, making skew late rather than early.
- **Divergent store versions would mislead Android.** An iOS-only hotfix (say a
  rejection forcing 1.4.1 on iOS alone) would prompt Android toward a version
  Play will never have. This rests on the existing practice of releasing both
  platforms in lockstep; if that ever stops being true, this check needs a
  second source.
- **`whatsNew.ts` must be updated every release** or the sheet silently stops
  appearing. This is deliberate: no notes means no sheet, never an error, so a
  release with nothing worth announcing can ship an empty `highlights` list. The
  cost is that forgetting looks identical to choosing, so the `/release-notes`
  skill gains a step that writes the new version's highlights into `whatsNew.ts`
  and the matching `en.json` / `pl.json` keys, and `whatsNew.test.ts` logs a
  warning naming the mismatch rather than failing the build.
