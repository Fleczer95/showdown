# Audit — Cloudflare D1 Migration Plan

**Date:** 2026-06-22
**Subject:** [`2026-06-21-migrate-challenges-cloudflare-d1.md`](./2026-06-21-migrate-challenges-cloudflare-d1.md)
**Goal of the plan:** Move challenge + ranking storage off Firebase Firestore onto
Cloudflare Workers + D1 to escape the Firestore Spark daily quotas, keeping Firebase
App Check for request attestation.

## Confirmed scope & constraints

- **Infra migration only.** No changes to rankings or domain logic — the new backend
  must behave identically to the current Firestore one.
- **App is not launched.** Fresh, empty database → **no data migration, no cutover**.
- **New API domain:** `play.showdown.lebene.pl` (separate from the existing
  `showdown.lebene.pl` link/AASA host).
- **In-place swap** (the plan's original Task 4): rewrite `challenge/store.ts` and
  `ranking/store.ts` to call the Worker directly, replacing Firestore. No dual-backend
  switch — the app is pre-launch, so `git revert` is the rollback if internal testing
  goes wrong, and the behavior-identical tests (B9) prove parity.
- **No dev-environment routing.** Single production API URL; validation happens on the
  store internal-testing track, not a local emulator.
- **Optimizations are deferred** to the post-migration section below.

## Verdict

The architecture is sound and the goal is real — D1's free-tier headroom is materially
larger than Firestore Spark (confirm exact current Workers/D1 quotas before relying on
specific numbers). The hard part — edge App Check JWT verification — is structurally
correct. **But the plan is not execution-ready.** It silently drops the entire
server-side validation layer that `firestore.rules` enforces today, loses the
`signature` feature's data, and still points at the wrong App Check key endpoint.
None of these are "domain changes" — keeping them is *fidelity* to current behavior.

## Authoritative facts (verified against Google docs)

Source: <https://firebase.google.com/docs/app-check/custom-resource-backend>

| Item | Correct value | Plan status |
| --- | --- | --- |
| JWKS endpoint | `https://firebaseappcheck.googleapis.com/v1/jwks` | ❌ **Wrong** — uses `…/v1/projects/{projectNumber}/keys`. Fails closed → every request 403s. |
| `iss` claim | `https://firebaseappcheck.googleapis.com/{project_number}` | ✅ Correct |
| `aud` claim | array containing `projects/{project_number}` | ✅ Correct (the recent `aud` fix was right) |

## Assessment of the six prior fixes

| # | Fix | Verdict |
| --- | --- | --- |
| 1 | `wrangler d1 create` | 🟡 Good but incomplete — missing the schema-apply step (`wrangler d1 execute … --file=./server/schema.sql`). |
| 2 | `aud` → projectNumber + enforce App Check on reads | 🟢 Both correct. **But** the real blocker (JWKS endpoint, same function) was missed. |
| 3 | Dev URL routing (`__DEV__`/localhost) | ⤬ **Revert** — out of scope; use a single prod URL. |
| 4 | `PRAGMA foreign_keys = ON` per request | 🔴 Risky — D1 enforces FKs by default; an unsupported runtime PRAGMA would 500 *every* request. Verify or drop. |
| 5 | `fetchWithAppCheck` (403 → refresh → retry once) | 🟢 Good pattern. Caveat: keep server *validation* failures on 400/422 so they don't trigger a pointless token refresh. |
| 6 | `global.fetch` + app-check Jest mocks | 🟡 Mock scaffolding only — the existing test *cases* (Firestore `Timestamp` assertions in `challenge/store.test.ts`) still need rewriting; `push.test.ts` mocks `./store` wholesale and needs no fetch mock. |

## Blockers — must resolve before executing

Each preserves existing behavior or fixes a correctness bug. None changes domain logic.

- **B1 — Fix the JWKS endpoint** to `https://firebaseappcheck.googleapis.com/v1/jwks`.
  Gates the entire migration. *(correctness)*
- **B2 — Port server-side validation from `firestore.rules` into the Worker.** This is
  the largest gap. App Check proves "a genuine app sent this," not that the payload is
  honest. Required checks (all enforced today):
  - **Challenge:** key allowlist `[lang, game, questions, createdBy, expiresAt]`;
    `lang ∈ {en, pl}`; `game` string ≤ 40; `questions` list, size 1–50;
    `createdBy.uuid` ≤ 64, `createdBy.nickname` ≤ 24; `expiresAt < now + 31d`
    (no near-immortal docs); reject duplicate id (immutable-after-create).
  - **Attempt:** key allowlist `[nickname, progress, score, timestamp]`; `nickname`
    ≤ 24; `progress` int; `score` number; `timestamp` int; parent challenge must
    exist; exactly one per device UUID.
  - **Ranking entry:** key allowlist `[nickname, score, signature?]`; `nickname`
    1–24; **`score` 0–1,000,000,000** (the MAX_SCORE cap that stops one write
    pinning #1 on the never-resetting all-time board); `signature ∈ {sprout, spark,
    fire, gem, star, crown}`; `game ∈ {the-ladder, the-drop, the-wheel}`; `period ==
    'alltime'` **or** `YYYY-MM` equal to the **server-clock** UTC year/month;
    best-only update (`new.score ≥ stored.score`). *(behavior fidelity)*
- **B3 — Restore `signature` end-to-end** — add the column to the `rankings` schema,
  the `INSERT`, and the `getBoard` `SELECT`. It is stored and rendered
  (`signatureEmoji`) today; dropping it is data loss + a broken feature. *(fidelity)*
- **B4 — Clean one-attempt-per-device rejection** — a duplicate attempt must surface
  as "already played," not a 500 → client "offline". *(fidelity)*
- **B5 — Verify or remove the per-request `PRAGMA foreign_keys`** (B-fix #4 risk). *(correctness)*
- **B6 — Revert dev URL routing** to a single prod constant pointing at
  `https://play.showdown.lebene.pl`. *(scope)*
- **B7 — Use `crypto.randomUUID()` for challenge IDs** instead of `Math.random()` —
  IDs are capability URLs; weak/guessable ones invite enumeration and collisions.
  *(robustness — included now per request)*
- **B8 — Add the schema-apply step** to provisioning (`wrangler d1 execute`). *(completeness)*
- **B9 — Write real test cases, TDD-style.** Port the existing `challenge/store.test.ts`
  and ranking store behavior to the `fetch` layer and assert it *first* — offline/timeout
  → `OfflineError`, 403 → `BlockedError`, 404 → `null`, and the new `fetchWithAppCheck`
  retry path. "Behaves identically" must be proven, not asserted. *(fidelity)*

> **Structure note:** keep `OfflineError` / `BlockedError` / `withTimeout` exported from
> `challenge/store.ts` exactly as today — `ranking/store.ts` and `push.ts` import them,
> so the in-place rewrite must preserve those exports even as the Firestore calls become
> `fetch` calls.

## To consider after migrating and confirming all works on internal testing

Deferred by decision — revisit only once the straight infra port is verified live on the
internal track. All are opt-in; none is required for parity.

- **Fewer ranking requests** — let the server enforce best-only + qualify-cutoff and drop
  `push.ts`'s `count()` + `lowest()` pre-reads: 3 requests per bucket → 1 POST.
- **One-shot challenge open** — a single endpoint returning record + your attempt + all
  attempts, so `ChallengeScreen` opens in 1 request instead of up to 3 sequential reads.
- **Atomic D1 writes** — wrap cleanup+insert and the ranking upsert in D1
  batches/transactions for consistency under concurrency.
- **Rankings retention cron** — a scheduled Worker to trim buckets (top-N) and drop stale
  months, replacing the Admin-SDK cleanup script. Not urgent: the
  `(game, period, score DESC)` index keeps `getBoard … LIMIT 50` cheap regardless of
  bucket size, so unbounded growth is storage-only.

## Readiness checklist

- [x] B1 JWKS endpoint corrected → `/v1/jwks` (`server/src/appcheck.ts`), alg pinned to RS256
- [x] B2 Worker validation module mirrors `firestore.rules` (`server/src/validation.ts`)
- [x] B3 `signature` restored end-to-end (schema column + INSERT/SELECT + client passthrough)
- [x] B4 duplicate-attempt → `409` → `BlockedError` (distinct from offline; same terminal outcome as the old permission-denied)
- [x] B5 PRAGMA removed — cleanup is an explicit two-statement `batch`, no CASCADE dependency
- [x] B6 single prod URL (deployed: `https://showdown-backend.arturjankowski95.workers.dev`), no dev routing
- [x] B7 challenge IDs use a v4 UUID (see note below) instead of the weak short string
- [x] B8 schema-apply step (`server/package.json` `schema:remote` / `schema:local`)
- [x] B9 behavior-identical tests passing (`challenge/store.test.ts`, `ranking/store.test.ts`, `push.test.ts`)

## Implementation status — 2026-06-22 (in-place swap, code complete)

**Server** `server/`: `wrangler.jsonc`, `schema.sql`, `package.json`, `tsconfig.json`,
`src/appcheck.ts`, `src/validation.ts`, `src/index.ts`. Worker `tsc --noEmit` clean.

**Client**: `challenge/store.ts` and `ranking/store.ts` rewritten to `fetch` (App Check
header + 403 refresh-and-retry); `OfflineError`/`BlockedError`/`withTimeout` exports
preserved, so `push.ts`, the screens, and the 24h→1h board cache are unchanged. App
`tsc` + `jest` green (the one `RunCelebration` failure is pre-existing and unrelated).

**B7 note:** there is no crypto polyfill in the app (it already mints device IDs with a
`Math.random` v4 UUID). The challenge ID now uses that same v4 scheme — 122 structured
bits, collision-safe — rather than pulling in a native crypto dependency mid-migration.
Guessability is moot because reads are App Check-gated. Revisit if a real RNG is added.

**Cache TTL:** reduced 24h → 1h (`BOARD_CACHE_TTL_MS`) now that the backend has request
headroom; the in-app note changed from "about once a day" to "periodically".

### Deployed — 2026-06-22

- D1 `showdown_db` created (region EEUR), `database_id` in `wrangler.jsonc`.
- Schema applied remotely (3 tables).
- Worker **live** at `https://showdown-backend.arturjankowski95.workers.dev`; bindings
  `DB` + `FIREBASE_PROJECT_NUMBER=381435458877` confirmed.
- Smoke test: tokenless / bogus-token / unknown-path requests all return
  `403 App Check verification failed` (App Check runs before routing). The success path
  needs a real device App Check token — exercised on the internal-testing build.
- Client `BASE_API_URL` points at the workers.dev URL. **No custom domain / DNS needed:**
  the API is background-only (users never see it), and the share/deep-link domain
  `showdown.lebene.pl` (AASA + assetlinks + index fallback) is unchanged.

**Remaining:** build the app and run the end-to-end flow (create / play / rank) on the
internal-testing track to confirm the real App Check token path.
