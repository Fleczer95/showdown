# Review Layers & IAP Provisioning

## Stage 2 — Self-review (BLOCKING, auto-fix loop)

Run the existing content audit against the authored bilingual module:

```bash
node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs <path-to-pack-or-content-file>
```

It checks: intra-pack duplicates, structural integrity (4 options, valid `correctIndex`), EN/PL parity, a trademark blocklist, and over-simple/ambiguous patterns. Also consult `.agents/skills/showdown-content-audit/references/quality_standards.md`.

Then re-check the five hard requirements yourself (see `legal-and-quality.md`), including the cross-file dedup the engine does not do. Fix issues and re-run until clean.

**Expected, non-blocking:** ladder "fewer than 20 per rung" warnings on rungs 10–15 — the front-load curve makes pools 4–5 lean by design. Everything else must be clean before proceeding.

## Stage 3 — Gemini review (BLOCKING on facts/IP)

Independent second opinion via the `gemini` CLI (installed; check `gemini --version`). Send the pack content plus this rubric and require a structured verdict.

Pattern (adjust flags to the installed version):

```bash
gemini -p "$(cat <<'EOF'
You are reviewing a bilingual (EN/PL) trivia/puzzle pack for a mobile game.
For EVERY item check and report:
1. FACTUAL: is the marked-correct answer actually true? List any wrong/dubious facts with the correct value.
2. IP: any copyrighted phrase (lyric, movie/TV quote, slogan, poem) or trademarked-franchise subject? List them.
3. POLISH: is the Polish natural and accurate (not machine-literal)? List awkward/incorrect translations.
4. DIFFICULTY: for Ladder, does difficulty rise across rungs as labeled? Flag mismatches.
End with a VERDICT line: "VERDICT: BLOCK" if any factual error or IP issue exists, else "VERDICT: PASS".
Pack follows:
EOF
)
$(cat <path-to-pack-file>)"
```

(The `ask-gemini` skill, if available, is an acceptable alternative transport.)

Handling the verdict:
- **BLOCK on factual or IP findings** — fix them (re-author the offending items), then re-run stages 2–3.
- **Style/judgment calls** (Polish phrasing nuance, difficulty borderline) — surface a short summary to the user and apply reasonable fixes; do not block on subjective polish alone.

Note: sending the pack to Gemini transmits content to an external service. That is fine for original pre-release pack content, but do not send credentials or anything from the key files.

## Stage 4 — Structural validation

```bash
node scripts/validate-content.mjs      # validates the bilingual content banks
npx tsc --noEmit                        # typecheck the catalog + content wiring
```

Both must be green. If the authored module is registered into the validated banks, `validate-content.mjs` covers it; otherwise validate the pack file via the audit engine.

## Stage 6 — IAP provisioning (draft + confirm + idempotent, BOTH stores)

Do ALL local work (stages 1–5) first. Then provision. The credential files are in the repo root: `AuthKey_*.p8` (ASC), `google-play-key.json` (Play).

### Confirmation gate (required)

Before any remote call, print the exact product and WAIT for explicit user confirmation:
- sku: `com.showdown.pack_<game>_<slug>`
- reference name + localized title/desc
- resolved price point (default $2.99 → nearest store price point)
- target: App Store Connect AND Google Play, DRAFT state

### App Store Connect

Edit the `PRODUCTS` list in `.agents/app-store-connect-api/create_iap.py`, then run it.

```bash
python3 .agents/app-store-connect-api/create_iap.py
```

CRITICAL safety rules:
- **`main()` calls `delete_obsolete()` — it DELETES any App Store IAP whose sku is not in `PRODUCTS`.** APPEND the new product to the COMPLETE existing list; never run with a truncated list, or you will remove live products.
- Set **`"enabled": False`** for draft/unsubmitted (FUTURE state). `True` makes it ACTIVE immediately — never do that here.
- Product dict shape: `{"sku": "...", "name": "...", "desc": "...", "price": "2.99", "enabled": False}` (price is a string; `set_price` matches it to a USA price point).
- Idempotent: re-running with an existing sku updates rather than duplicates. If the sku already exists as intended, skip.

### Google Play

Edit the products list in `.agents/google-play-iap/create_iap.py`, then run it. It uses the new Monetization API v3 `onetimeproducts().patch` (upsert with `allowMissing`).

```bash
python3 .agents/google-play-iap/create_iap.py
```

Rules:
- Create/patch the product in **draft/inactive** status — do not activate.
- It also has a delete-obsolete style sync; APPEND to the full list, never truncate.
- Idempotent via `patch`; an existing productId is updated, not duplicated.

### After provisioning

The IAP exists as a DRAFT in both consoles. The user submits/activates manually. Only after approval in BOTH stores, flip the catalog entry `status` from `'hidden'` to `'live'`.
