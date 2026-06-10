---
name: showdown-premium-pack
description: Author and ship one premium content pack for one Showdown game (The Ladder, The Drop, or The Wheel) end-to-end — generate original bilingual (EN/PL) questions, self-review and Gemini-review them, wire a premium PackDefinition into the TypeScript store catalog and i18n files, and provision the IAP product as a draft in App Store Connect and Google Play. Use when adding a new paid trivia/puzzle pack, expanding monetizable content, or when asked to "add a premium pack", "create a paid pack", or "make a new IAP pack" for Showdown.
---

# Showdown Premium Pack

Add ONE premium content pack for ONE Showdown game per run, from authoring through draft IAP provisioning. Never wire or provision anything until both review layers pass.

## Inputs

- **game** (required): `ladder` | `drop` | `wheel`. (Grid is deferred; Poll was cut — do not target them.)
- **topic** (required): the pack theme, e.g. "Space Exploration". Runs through the legal gate — refuse and explain if it cannot be made IP-safe (see `references/legal-and-quality.md`).
- **price** (optional): default **$2.99**, overridable. Resolved to the nearest store price point at provision time.

Auto-derive everything else: `slug` = kebab-case(topic); `id` = `pack-<game>-<slug>`; `sku` = `com.showdown.pack_<game>_<slug>`; i18n key = `<game>_<slug>`; icon (from `STORE_ICONS` in `src/data/store/index.ts`); accent color.

## Sizing rule (fixed)

Total = 20 × full-run size. The Ladder is **front-loaded**; Drop and Wheel are flat pools.

Always run the planner first to get exact per-slot targets and id ranges:

```bash
node .agents/skills/showdown-premium-pack/scripts/pack_plan.mjs --game <game> --slug <slug>
```

| Game | Total | Shape |
|---|---|---|
| ladder | 300 | front-loaded per rung: P1 30/rung, P2 24, P3 20, P4 15, P5 11 (pools of 3 rungs) |
| drop | 180 | flat |
| wheel | 60 | flat |

## Pipeline — strict order

Execute these stages in order. Stages 1–5 are local and reversible; stage 6 is outward-facing and gated by explicit confirmation.

1. **Generate** original bilingual content meeting every hard requirement. See `references/content-schemas.md` for exact TS shapes, id conventions, and difficulty rules; `references/legal-and-quality.md` for the 5 hard requirements and the legal gate.

2. **Self-review (BLOCKING, auto-fix loop)** — run the content audit and re-check the hard requirements yourself. Fix and re-run until clean:
   ```bash
   node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs <pack-file>
   ```
   Treat ladder "<20 per rung" warnings on rungs 10–15 as EXPECTED (front-loaded pools are intentionally lean). Everything else must pass.

3. **Gemini review (BLOCKING on facts/IP)** — independent second opinion via the `gemini` CLI on factual accuracy, Polish naturalness, IP risk, and difficulty calibration. Factual/IP errors block and must be fixed; style/judgment calls are surfaced to the user. See `references/review-and-provision.md`.

4. **Structural validation** — `node scripts/validate-content.mjs` and a TypeScript typecheck (`npx tsc --noEmit`). Both green before proceeding.

5. **Wire locally** — append the premium `PackDefinition` to the per-game packs array in `src/data/store/`, and add the bilingual store-copy strings to `src/i18n/locales/en.json` + `pl.json`. New entries start `status: 'hidden'`. See `references/content-schemas.md`.

6. **Provision IAP (draft + confirm + idempotent)** — do ALL local work first, then show the exact product (sku, name, resolved price point) and WAIT for explicit user confirmation before any remote call. Create as draft/unsubmitted in BOTH stores; skip if the sku already exists; never auto-submit. See `references/review-and-provision.md`.

## Definition of done

Local content validated, both review layers pass, `tsc` clean, content validators green, and the IAP products exist as **drafts** in both consoles pending manual submission. The catalog entry stays `status: 'hidden'` until the IAP is approved in both stores, then is flipped to `'live'`.

## References

- `references/content-schemas.md` — exact per-game TS shapes, file locations, id/sku/i18n conventions, front-load curve, catalog + i18n wiring.
- `references/legal-and-quality.md` — the legal hard gate and the 5 hard content requirements.
- `references/review-and-provision.md` — self-review, Gemini review (exact CLI usage), and the IAP draft/confirm/idempotent protocol.
