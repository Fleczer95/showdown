---
name: showdown-free-pool
description: Extend the FREE question pools of the Showdown games (The Ladder, The Drop, The Wheel) with new original bilingual (EN/PL) content — plan the per-rung gaps, author interesting non-repetitive questions, splice them into the existing content.ts banks, then self-review and Codex-review for factual errors and IP risk. Use when asked to "add more free questions", "extend the free pool", "add questions to the ladder/drop/wheel", or to make the base game bigger. NOT for paid packs — use showdown-premium-pack for anything with an IAP.
---

# Showdown Free Pool

Extend the **free** question banks that ship with the base game. No store catalog, no i18n store copy, no IAP — those belong to `showdown-premium-pack`. This skill only grows three files:

| Game | File | Shape |
|---|---|---|
| ladder | `src/game/ladder/content.ts` | `RUNGS: QuestionContent[][]` — 15 rung arrays, **position = difficulty** |
| drop | `src/game/drop/content.ts` | `dropQuestions: DropQuestion[]` — flat |
| wheel | `src/game/wheel/content.ts` | `PACKS.all.puzzles: PuzzleContent[]` — flat |

**Free pools differ from premium packs:** free ladder questions carry **no `difficulty` field** — the rung is the array they live in. Never add `difficulty` here.

## Inputs

- **games** (optional): which of `ladder` / `drop` / `wheel`. Default: all three.
- **volume** (optional): how many new questions. If the user has not said, ask — the answer changes the whole run. Sensible bands: light ~75 total, balanced ~150, big ~300.
- **theme** (optional): free pools are general-knowledge; only narrow if asked.

## Pipeline

Run in order. Stages 1–4 are local and reversible; nothing here is outward-facing.

### 1. Survey before authoring (never skip)

```bash
node .agents/skills/showdown-free-pool/scripts/pool_stats.mjs
```

It prints per-rung counts, flags lean rungs, reports the max id per game (new ids continue past it), and dumps every existing EN prompt to `<scratchpad>/pool-existing-{ladder,drop,wheel}.txt`.

**Read those dumps.** They are the dedup baseline *and* the quality baseline: the existing banks lean hard on repetitive patterns (ladder = "capital of X", "element symbol X", "how many strings on X"; drop = "how many X" counting). New content must not add more of the same. See `references/authoring-rules.md`.

### 2. Author

Write the new content as a data module, then splice — do **not** hand-edit 300 lines into the content files. Follow `references/authoring-rules.md` for the hard constraints (they are not optional; the apostrophe rule will silently corrupt the audit if broken).

Distribute ladder questions across **all 15 rungs**, weighted to fill lean rungs, with difficulty genuinely matching the rung band.

### 3. Splice

```bash
node .agents/skills/showdown-free-pool/scripts/splice_pool.mjs <your-content-module.mjs>
```

The splicer inserts into the right array (each rung's closing bracket for ladder; end-of-array for drop/wheel), matches existing indentation, and hard-fails on an apostrophe rather than writing corrupt content.

### 4. Review — TWO FULL PASSES (BLOCKING)

```
author → [self-review → codex review → fix] → [FRESH-CONTEXT self-review → codex review → fix] → done
              pass 1                                        pass 2
```

**Pass 2 is mandatory, not a formality.** Pass 1 routinely rewrites 30+ questions, and every one of those rewrites is *new content that nobody has reviewed*. Skipping pass 2 ships unreviewed questions.

Each pass is:

1. **Self-review (mechanical gate):**
   ```bash
   node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs src/game/ladder/content.ts src/game/drop/content.ts src/game/wheel/content.ts
   npx tsx scripts/validate-content.mjs    # tsx, NOT node — the validator imports TS
   npx tsc --noEmit
   ```
   Audit must show `"errors": []` and **exactly equal EN/PL counts** per file. A count mismatch means an apostrophe broke a string literal — it does **not** mean a translation is missing, so do not "fix" it by adding strings.

   Then re-read the new items against `references/authoring-rules.md`, hunting the one-defensible-answer failure and false hints.

   **In pass 2 the self-review runs in a fresh-context subagent** so it reads the content cold, without the blind spot of having authored it. Exact prompt in `references/review-loop.md`.

2. **Codex review** — independent model, checks facts + IP with live sources. Split per game, run the three in parallel, redirect straight to a file (never pipe through `tail` — it buffers and looks hung). Expect 10–25 min per game. Exact invocation and traps: `references/review-loop.md`.

3. **Fix**, then re-run the mechanical gate.

Triage: factual errors and IP hits are **blockers**. Polish mistranslations/calques/missing diacritics are real errors — fix them. Ladder difficulty mis-banding is a **judgment call** — surface it, do not silently reshuffle rungs.

Pre-existing warnings (e.g. the `Apple` IP hit on the fruit in the ladder bank) are **not yours to fix** — confirm with `git stash` that they exist on the clean tree, then leave them and say so.

## Definition of done

**Both** review passes complete, every factual/IP finding resolved, audit 0 errors with exact EN/PL parity, `tsc` clean, validator 0 errors. Report before/after counts per game and per rung, and list the judgment calls you deliberately did **not** apply. Nothing is committed unless the user asks.

## References

- `references/authoring-rules.md` — hard constraints, difficulty bands, what makes a question *interesting*, and the real defects this pipeline has already caught.
- `references/review-loop.md` — the two-pass loop, the fresh-context subagent prompt, the Codex CLI invocation, and the traps (buffering, latency).
