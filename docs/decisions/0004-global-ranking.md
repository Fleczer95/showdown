# 4. Global ranking fed by async challenges, with a delayed monthly switch

Date: 2026-06-15

## Status

Accepted

## Context

ADR-0003 shipped the [[Async Challenge]] — a head-to-head, link-shared round
backed by Firestore with device-UUID identity and no auth. We now want a
**global, all-users leaderboard** with **This Month** and **All Time** views.

Constraints inherited from ADR-0003 shape every choice: no application server,
no sign-in, identity is a device UUID in MMKV, the project runs on the Firestore
**free (Spark) plan** (so there is *no* native TTL — expiry is a manual
Admin-SDK script), and App Check attests the genuine app binary. A global board
is a bigger trust and moderation surface than an ephemeral 1:1 challenge: it is
public, persistent, and shared, with no server to validate a score.

Two product clarifications shaped the design:

1. **Only async-challenge play counts** — not solo game-overs. A run scored
   inside a challenge is what feeds the board.
2. **The monthly switch is deliberately delayed** — at the turn of a month the
   "This Month" board would be empty, so it keeps showing the previous month
   until the new one has enough entries, to avoid an empty dashboard.

## Decision

Build a **per-game, score-only, bounded global leaderboard** in a new Firestore
collection, written directly by the app (no server), with a client-side
delayed monthly rollover and an Admin-SDK script for rotation/retention.

- **Source & metric.** Fed **only** by async-challenge completions. **Per game**
  (`the-ladder` / `the-drop` / `the-wheel`), three independent boards. The
  ranking value is a device's **best single challenge score** for that game and
  scope, sorted by `score` descending (equal scores fall back to document-id
  order). No progress / wins / ELO — those need cross-attempt recompute the
  serverless model can't cheaply provide.
- **Scopes.** Two tabs: **This Month** (`months/{YYYY-MM}`) and **All Time**
  (`alltime`). The month bucket is **UTC `YYYY-MM`**, and the security rule pins
  a write to the *server's* current month, so a tampered device clock cannot
  write into another month.
- **Bounded board + rotation.** We store only **top `STORE_CAP` (60)** per
  bucket and display **top `DISPLAY_SIZE` (50)**; the 10-entry buffer keeps the
  visible 50 backed by data as entries churn. The client **self-gates** writes
  with `qualifies()` (reused from the local-leaderboard logic): write when the
  bucket has room, otherwise only when the score beats the lowest stored entry.
  **Clients never delete** (`allow delete: if false`) — eviction/rotation is done
  by the Admin-SDK cleanup script, so there is no "delete a rival" vector.
- **Delayed monthly switch.** Purely client-side: show the **previous** month's
  board until the current month has **≥ `ROLLOVER_THRESHOLD` (10)** entries
  (checked with a Firestore `count()` aggregation), then switch to the current
  month for the rest of the month. Cold start falls back **at most one month**;
  if both are below threshold, the (sparse) current month is shown. The board
  header shows the **actual month name** ("May 2026"), never a misleading "This
  Month", and a help note explains the rollover settles within the first days of
  a month so a just-set score that isn't visible yet is expected.
- **Identity & attestation.** Device UUID (`getDeviceId`), **no auth**. Integrity
  rests on **App Check enforced for Firestore** — binary attestation blocks
  `curl`/non-app writes. *Release prerequisite:* App Check must be flipped from
  monitor to **Enforce** (it is service-wide, so it also covers existing
  challenge writes — verify the verified-request metric first).
- **Security rules.** Public read; create/update only the caller's own
  `{uuid}` doc; **update only when the score increases** (best-only, monotonic);
  **current-month-only** writes (path `YYYY-MM` must equal `request.time`
  year/month); a **game-id allowlist**; field-shape + size validation; `score`
  bounded `0 .. MAX_SCORE`; **no client delete**.
- **`MAX_SCORE` is a loose sentinel** (`1_000_000_000`, far above any legitimate
  run across the three games). Its only job is to stop a single write of an
  astronomically large value from **permanently** pinning #1 on the
  never-resetting all-time board. It is not a tight anti-cheat measure.
- **Nickname & moderation.** Reuse the shared `lastNickname` (same identity as
  local boards and challenges), editable, UI-capped at 12 / rule-capped at 24,
  not unique. The board is public, so nicknames pass a **client-side PL+EN
  blocklist filter** at entry; anything that slips through (e.g. a modified
  client) is removed manually via the cleanup script's `--remove` mode.
- **Connectivity & local state.** The ranking push rides the same online moment
  as the challenge attempt write, but is **best-effort and non-blocking** — it
  never holds up the result reveal. Each device keeps, per game, its
  `allTimeBest` and `monthBest` (+ `monthId`) with `synced` flags in MMKV; a
  push that fails leaves the best **pending** and is retried on next online app
  open and when the rankings view opens. A local history view shows
  pending-vs-verified status.

### Record shape

```jsonc
// rankings/{game}/periods/{period}/entries/{uuid}
//   period = "YYYY-MM" (a month) | "alltime"   — sibling docs, symmetric paths
{ nickname, score }   // minimal: no progress, no timestamp, no expiresAt
```

### Retention / hygiene (manual, Admin SDK)

`scripts/cleanup-expired-challenges.mjs` (Admin SDK bypasses rules *and* App
Check) gains three jobs, run **monthly**: (1) **rotate** — trim each bucket to
`STORE_CAP`; (2) **retain** — delete month buckets older than the current +
previous 2; (3) **moderate** — `--remove <game> <uuid>` to pull a single entry.
Every destructive run first writes a timestamped local JSON **backup** so a
wrong sweep is reversible.

## Consequences

- **Residual cheat risk is accepted, honour-based**, matching ADR-0003: App
  Check blocks `curl`/scripts, but a *modified app binary* can still post a
  plausible fake or impersonated score under its own uuid. Impersonation is
  largely defanged — `no delete` + monotonic `update` mean an attacker can only
  *raise* another uuid's score, never lower or remove it. The all-time board is
  backstopped by the cleanup script. The real fix (federated sign-in + server
  validation) remains the post-MVP path ADR-0003 anticipated.
- Storage stays tiny: at most ~`STORE_CAP` × 3 games × (1 all-time + a couple of
  retained months), two fields each.
- The board can briefly exceed `STORE_CAP` between script runs (clients add but
  never evict); display always takes the top `DISPLAY_SIZE` by score, so
  correctness holds — the script only bounds storage.
- New native surface: a per-game ranking screen with This Month / All Time tabs,
  the delayed-rollover logic, the rollover help note, the connectivity note, and
  a local history view with sync status.
- App Check moving to **Enforce** is service-wide and affects the live Async
  Challenge writes too; it is gated on healthy verified-request metrics.
