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
  out publishing credentials. The store-facing check therefore uses the public
  paths only: Apple's iTunes Search API and Google's Play Core in-app-updates
  API, both via `expo-in-app-updates`.
- **Release notes are bundled in the app, not fetched.** The remote check
  answers exactly one question — "is there a newer version?" — and returns a
  version identifier. All human-readable copy lives in the bundle.
- **The CTA opens the store listing** rather than driving Play Core's
  `startUpdate()`. One code path on both platforms, works in dev builds, and
  avoids the flexible-update download/`completeUpdate` state machine. The cost
  is Android's update-without-leaving-the-app; detection still goes through Play
  Core, so it stays accurate about what Play will serve that specific device.
- **Cold start on Home only.** No foreground re-check, no post-run slot. At most
  one interruption per version, and never during a run, a purchase, a challenge
  deep link, or the review prompt.
- **One entry of notes at a time.** `whatsNew.ts` describes only the current
  version. No accumulating changelog to maintain.

## 1. Units

| Unit                                             | Responsibility                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `src/services/appUpdate/updateCheck.ts`          | Wraps `expo-in-app-updates`. `checkStoreVersion()` → `{ available, storeVersion } \| null`. Never throws. |
| `src/services/appUpdate/seenVersions.ts`         | The once-per-version ledger in `deviceStore` + the pure gating decision.                                  |
| `src/data/whatsNew.ts`                           | Current version's highlights: `{ version, highlights: [{ emoji, key }] }`.                                |
| `src/components/molecules/AnnouncementSheet.tsx` | One presentational sheet over the existing `BottomSheet`. Both flows render it.                           |
| `src/hooks/useAppAnnouncement.ts`                | Orchestrator. Decides which sheet (if any) Home shows, and mounts it.                                     |

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

- Android's `storeVersion` is a **versionCode number**; iOS's is a **semver
  string**. The ledger stores whatever came back, as a string, and compares for
  equality only. It never parses or orders version identifiers, so there is no
  cross-platform version-math bug class.
- CTA → `Linking.openURL` with `itms-apps://apps.apple.com/app/id6774886649`
  (iOS) and `market://details?id=com.showdown.app` (Android), falling back to
  the `https://` form when the scheme will not open.
- `app.json` gains `ios.infoPlist.AppStoreID: "6774886649"`. No
  `AppStoreCountry` — the US storefront resolves the bundle ID, verified
  2026-07-31.
- `expo-in-app-updates` is a native module: `expo run:ios` / `expo run:android`,
  never Expo Go (per CLAUDE.md).

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
- `expo-in-app-updates` gets a `jest.setup.js` mock alongside the existing
  native module mocks.
- New i18n keys verified with `npm run i18n:check`.

## 6. Visual pass

A dev-only trigger forces either sheet on demand. 2–3 real variants (mascot
pose, highlight density, CTA treatment) are built and chosen from the running
app on device, not from a written description.

Baseline layout, shared by both sheets: drag handle, mascot, title, body
(generic copy for update; emoji-per-highlight list for what's-new), one primary
CTA.

## 7. Known costs, accepted

- **iTunes lookup is CDN-cached** and can lag a few hours behind an iOS release,
  so an iOS player may occasionally hear about a new version slightly late.
  Accepted as the price of a store-driven check over a self-hosted manifest.
  Play Core has no such lag — it is authoritative per device.
- **Play Core only reports updates for Play-installed builds.** Real Android
  verification needs internal app sharing, and this Mac has no Android SDK, so
  the Android half must be verified on the machine that can build it.
- **`whatsNew.ts` must be updated every release** or the sheet silently stops
  appearing. It fails quiet, which is safe but easy to forget, so the
  `/release-notes` skill gains a step that writes the new version's highlights
  into `whatsNew.ts` and the matching `en.json` / `pl.json` keys as part of the
  existing release ritual.
