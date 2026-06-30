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

(The `ask-agy` skill, if available, is an acceptable alternative transport.)

Handling the verdict:
- **BLOCK on factual or IP findings** — fix them (re-author the offending items), then re-run stages 2–3.
- **Style/judgment calls** (Polish phrasing nuance, difficulty borderline) — surface a short summary to the user and apply reasonable fixes; do not block on subjective polish alone.

Note: sending the pack to Gemini transmits content to an external service. That is fine for original pre-release pack content, but do not send credentials or anything from the key files.

## Stage 4 — Structural validation

```bash
node scripts/validate-content.mjs      # validates the bilingual content banks
npx tsc --noEmit                        # typecheck the catalog + content wiring
```

`npx tsc --noEmit` is the binding gate — it must exit 0, and it typechecks the new pack + `packs.ts` + catalog wiring end to end. The project's real checks are `npm run type-check`, `lint`, `format:check`, and `jest` (see `package.json`); `validate-content.mjs` is NOT among them.

**`validate-content.mjs` caveat (known-broken, do not block on it):** it only validates the static free banks (`RUNGS`, `dropQuestions`, …) — a premium pack lives in the catalog, not those banks, so it is out of scope regardless. As of this writing the script also fails to run: plain `node` cannot import its `.ts` targets, and it imports `CATEGORIES` from `grid/content`, which no longer exports it (Grid was deferred). So the **audit engine is the effective content validator for a premium pack**, paired with `tsc`. Don't try to "fix" the script as part of a pack run — note it and move on.

**Style/formatting:** the per-game `content.ts` files (and your new pack `.ts`) are committed in a one-line-per-question style that Prettier does NOT enforce (they fail `prettier --check` by design) — match that style, do not reformat. But `catalog.ts`/`packs.ts` ARE Prettier-clean; run `prettier --write` on those two. The locale JSONs may already be Prettier-dirty before you touch them — only match the surrounding indentation, never reformat the whole file.

## Stage 6 — IAP provisioning (draft + confirm + idempotent, BOTH stores)

Do ALL local work (stages 1–5) first. Then provision. The credential files are in the repo root: `AuthKey_*.p8` (ASC), `google-play-key.json` (Play).

### Confirmation gate (required)

Before any remote call, print the exact product and WAIT for explicit user confirmation:
- sku: `com.showdown.pack_<game>_<slug>`
- reference name + localized title/desc
- resolved price point (default $2.99 → nearest store price point)
- target: App Store Connect AND Google Play, DRAFT state

### Runtime prerequisites (both scripts)

The scripts need Python deps not always installed: ASC needs `PyJWT cryptography requests`; Play needs `google-auth google-api-python-client`. If the default `python3`/Homebrew Python is broken (e.g. a `pyexpat`/libexpat dlopen error makes even pip fail), fall back to Apple's `/usr/bin/python3` (3.9), which has a working pip, install to a target dir, and run with PYTHONPATH:

```bash
/usr/bin/python3 -m pip install --target=/tmp/iap-libs PyJWT cryptography requests google-auth google-api-python-client
PYTHONPATH=/tmp/iap-libs /usr/bin/python3 .agents/app-store-connect-api/create_iap.py
```

### App Store Connect

Edit the `PRODUCTS` list in `.agents/app-store-connect-api/create_iap.py`, then run it. **The sku must be snake_case (no hyphens) — see the sku rule in content-schemas.md; a hyphen yields a 409 `ENTITY_ERROR.ATTRIBUTE.INVALID` on productId.**

```bash
python3 .agents/app-store-connect-api/create_iap.py
```

CRITICAL safety rules:
- **Deletion model (verified against the committed script):** `main()` calls `delete_obsolete()`, which deletes ONLY the SKUs explicitly listed in the module-level `OBSOLETE_SKUS` (currently `[]`). It does NOT prune SKUs that are merely absent from `PRODUCTS`. So appending your one product and running will NOT remove live IAPs (e.g. the theme SKUs), even though `PRODUCTS` does not enumerate them. Still: APPEND, never delete existing `PRODUCTS` entries, and leave `OBSOLETE_SKUS` untouched unless you intend a deletion. (The committed `PRODUCTS` is empty and is out of sync with what is actually live in the store — do not treat it as the source of truth for live products.)
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
- Its `delete_obsolete()` is also `OBSOLETE_SKUS`-driven (currently `[]`), so it only deletes SKUs you explicitly list — appending your product is safe. Still, APPEND rather than replace `PRODUCTS` entries.
- Idempotent via `patch`; an existing productId is updated, not duplicated.
- **Billing permission gotcha:** if the API returns `400 ... Can't create product. To fix, request billing permission.`, the `google-play-key.json` service account lacks the financial/billing permission. This is an account grant the human must make in Play Console (Users & permissions → grant the service account access to financial data / manage orders), then re-run. It is NOT a code/sku problem — surface it to the user and stop.

### After provisioning

The IAP exists as a DRAFT in both consoles. The user submits/activates manually. Only after approval in BOTH stores, flip the catalog entry `status` from `'hidden'` to `'live'`.
