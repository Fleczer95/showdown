# Handoff: Play Console work for a browser-driving agent

**Date:** 2026-08-19
**Audience:** an agent that controls a browser, working inside Google Play Console
**Plan this serves:** `docs/superpowers/plans/2026-08-05-play-level-up.md`
**Goal:** finish the Level Up items that cannot be done through any API. Everything
here is console-only — verified: the Play Developer API exposes no endpoint for any
of it.

## Hard boundaries — read before touching anything

This console controls a live app with real players and real money. Inside it:

- **Never publish, promote, halt, or change the rollout of any release.** The current
  production release (1.5.0, versionCode 37) is fully rolled out and must stay that way.
- **Never delete a release, a track, or an uploaded artifact.**
- **Never change pricing, countries, the store listing, screenshots, or the app name.**
- **Never submit anything for app review.** Publishing a *Play Games Services
  configuration* is a different action and is explicitly in scope; publishing an *app
  release* is not.
- **Never accept new terms, agreements, or program enrolments** beyond the one named in
  Task B, and stop and ask if any appear.

If the console asks for confirmation on anything not spelled out below, **stop and
report** rather than guessing. When a page does not match this document, that is a
signal the console changed — report it; do not improvise a path.

## Access

Start from the app dashboard:

```
https://play.google.com/console/u/0/developers/8291209362117111057/app/4974544417577616151/app-dashboard
```

The console is in Polish for this account, so both label sets are given below where it
matters. The Chrome profile on the primary development Mac is **blocked** from Play
Console at the Workspace admin level — this work needs a browser session signed in as
the account that owns the developer account.

---

## Task A — upload the Game Stats configuration and publish it

**Why:** the app already sends Game Stats events after every run. Google discards them
until the stats are declared, because incoming events are validated against the console
schema and silently dropped when they do not match.

**Input files:**

- `.agents/game-services/game_stats/PlayerGameEvent.csv` — the event schema uploaded
  separately before any stats can be configured.
- `.agents/game-services/game_stats.zip` — the stats configuration archive. If it is
  missing, regenerate it; the archive is deliberately untracked:

```bash
/usr/bin/python3 .agents/game-services/pack_game_stats.py
```

It contains three CSVs and nine PNG icons, flat at the archive root:
`RepetitiveStatsConfig.csv` (8 stats, one flagged competitive),
`ProgressionStatConfig.csv` (the Level stat), and `StatLocalizations.csv` (pl-PL for
all nine). These names and their title-cased column headers must match exactly.

### Steps

1. Navigate to **Grow users → Play Games Services → Setup and management**
   (PL: *Rozwój użytkowników → Play Games Services → Konfiguracja i zarządzanie*).
2. Open **Game Stats** under **Setup and management**, then select **Get started** if
   the five-step setup checklist is shown.
3. Configure events first. Open **Configure events**, download the sample, and verify
   its headers are exactly `Event Name,Property Name,Property Type`. Upload
   `PlayerGameEvent.csv` and save it as a draft. This prerequisite unlocks stats setup.
4. Open **Configure stats**. **Before uploading, download the templates the console
   offers** and compare their column headers against the three CSVs in the ZIP.
   - Headers match → upload the ZIP.
   - **Headers differ → update the files to the exact documented/template schema; do
     not invent field names.** The old inferred schema predates the event-first flow.
5. Upload the archive and record every validation message verbatim, including warnings.
6. **Publish the Play Games Services configuration.** Stats stay a draft until this
   separate action runs. Achievements already have a published version, so the config
   itself is published — the new stats still need their own publish.

### Console state observed on 2026-08-19

- The live console uses a five-step Game Stats workflow and requires the event schema
  before the stats ZIP. The stats upload is locked until events are saved as a draft.
- The downloaded event sample is `game_stats_schema_config.csv` with headers
  `Event Name,Property Name,Property Type`.
- The downloaded stats sample is `game_stats_config.zip`. Its exact required files are
  `RepetitiveStatsConfig.csv` and `ProgressionStatConfig.csv`; the optional localization
  file is named `StatLocalizations.csv`.
- **Task A is complete.** The console accepted 2 events and all 9 stats without
  validation warnings. Both events and all stats show **Published / Available to
  everyone**. The Play Games Services publication page confirmed **Game published**
  and then **No changes to publish**.
- Saving the stats draft briefly displayed generic error `7D7B078E`, but a reload
  authoritatively showed all 9 stats saved as a draft and ready to publish. Publication
  then completed normally; do not re-upload because of that stale error.
- Google Play Games on PC is already **Active**. The console reports 2 of 4 tasks
  complete: program enrolment and a test-track artifact are complete; screenshots and
  video are optional. PC uses the same release track and artifacts as mobile.

### Verification

Report the list of stats the console shows after publishing, with their names and
aggregations. Expected: 8 repetitive stats plus one progression stat named Level.

### Known constraint

Google's documentation says test accounts can exercise a draft Game Stats configuration
only from **September 2026**, and players see stats on the Gamer profile in the same
month. Uploading and publishing now is still correct; do not expect to see data flowing.

---

## Task B — enrol in Google Play Games on PC

**Why:** Level Up requires the game to be available on Google Play Games for PC.

### Steps

1. Find the **Google Play Games on PC** area in the console. As of 2026-08-19 it is at
   **Test and release → format selector → Manage formats**.
2. Confirm the format remains **Active** and uses the same release track and artifacts
   as mobile. Do not change that setting.
3. No further enrolment action is currently required. If a future console state asks
   for a new agreement, report it before accepting anything.
4. If the console runs a playability or emulator check, record its result in full.

### What is not your job

The app currently declares no `uses-feature` entry for touchscreen. Adding
`android.hardware.touchscreen` as not required, and adding keyboard input to the Letter
Wheel screen, are **code changes** handled in the repository — not console work. If the
enrolment blocks on either, report that and stop.

---

## Task C — reward offers (do not start before 1 September 2026)

**Why:** Level Up requires at least two single-use reward offers granted on Quest
completion, by **30 September 2026**.

**Blocked until:** creating, managing, and testing Play Games Rewards opens 1 September.
Attempting it earlier wastes a session.

**Also blocked on code:** rewards are delivered through the Play Billing out-of-app
purchase flow — the client must call `queryPurchasesAsync`, grant the entitlement, and
call `acknowledgePurchase`. Until that ships, a configured offer cannot reach a player.
Confirm with the repository owner that the client side is live before configuring offers.

### Steps, once unblocked

1. **Monetize with Play → Products → One-time products.** Create two products. These are
   reward SKUs and are never sold; they exist only because Google requires rewards to be
   one-time products.
   - Proposed content: 5 banked bonus runs, and one earned signature granted ahead of its
     level gate. Confirm the exact naming with the repository owner — both need EN and
     pl-PL copy.
2. Attach an offer to each product, representing the Play Games Reward.
3. Bind the offers to a Quest completable by every player at least once.
4. Report the resulting product IDs — the client needs them.

---

## Settled facts, so you do not re-derive them

- **Saved Games is enabled** (confirmed 2026-08-11). Do not change it.
- **The Play Games Services configuration is published**, with 34 achievements and 3
  leaderboards live. Do not re-provision them; they were created through the API.
- **Sidekick is enabled** and rides along with each App Bundle.
- **Target audience is 13+**, so no Level Up requirement is exempt under the under-13
  carve-out.
- **Release notes are managed through the API** from the repository and are already
  filled for the live release. Do not edit release notes by hand — a console edit would
  be overwritten by the next scripted run.

## What to report back

For each task: what you clicked, what the console said, what is now true, and anything
that did not match this document. Report partial success plainly — these steps are not
transactional, and a half-finished Game Stats upload is worth knowing about precisely.
