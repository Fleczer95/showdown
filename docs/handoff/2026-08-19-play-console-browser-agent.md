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

**Input file:** `.agents/game-services/game_stats.zip` in the repository. If it is
missing, regenerate it — the archive is deliberately untracked:

```bash
/usr/bin/python3 .agents/game-services/pack_game_stats.py
```

It contains three CSVs and nine PNG icons, flat at the archive root: `repetitive_stats.csv`
(8 stats, one flagged competitive), `progression_stat.csv` (the Level stat), and
`localizations.csv` (pl-PL for all nine).

### Steps

1. Navigate to **Grow users → Play Games Services → Setup and management**
   (PL: *Rozwój użytkowników → Play Games Services → Konfiguracja i zarządzanie*).
2. Find the **Game Stats** section. Its exact position is not documented publicly, so
   locate it within that area rather than following a fixed path.
3. **Before uploading, download the template the console offers.** Compare its column
   headers against the three CSVs.
   - Headers match → upload the ZIP.
   - **Headers differ → stop and report the exact expected columns.** They were inferred
     from prose documentation, and a mismatched upload is rejected with an unhelpful
     error. Do not rename columns on a guess.
4. Upload the archive and record every validation message verbatim, including warnings.
5. **Publish the Play Games Services configuration.** Stats stay a draft until this
   separate action runs. Achievements already have a published version, so the config
   itself is published — the new stats still need their own publish.

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

1. Find the **Google Play Games on PC** area in the console.
2. Read what the enrolment asks for and **report it before accepting anything.** This is
   the one place where accepting a program agreement may be required; it needs explicit
   human approval first.
3. If the console runs a playability or emulator check, record its result in full.

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
