# The Review Loop

Two full passes. Authoring your own content makes you blind to it — pass 2 exists because pass 1's fixes are themselves new, unreviewed content.

```
author → [self-review → codex review → fix] → [FRESH-CONTEXT self-review → codex review → fix] → done
              pass 1                                        pass 2
```

Pass 2 is not optional and not a formality. Two independent reasons, both from the first real run:

1. **Pass 1's fixes are new, unreviewed content.** Pass 1 rewrote 36 questions; nobody had checked any of them.
2. **The cold reader sees what the author and the fact-checker both miss.** The single worst defect of the run — 120 of 135 ladder questions keyed to option B, index 3 never used, so "always tap B" beat the entire hard and expert bands — was invisible to the audit (structurally valid), invisible to Codex (every question was individually *true*), and invisible to the author. It is a property of the **set**, not of any question. Only the fresh-context reviewer, reading all 300 at once with no memory of writing them, caught it.

Corollary: the fresh-context reviewer must be given the **whole set at once** and told to look for set-level patterns, not just per-item errors.

---

## Self-review (both passes)

Mechanical gate — must be green before Codex is worth spending:

```bash
node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs src/game/ladder/content.ts src/game/drop/content.ts src/game/wheel/content.ts
npx tsx scripts/validate-content.mjs     # tsx, NOT node
npx tsc --noEmit
```

Then re-read your new items against `authoring-rules.md` yourself, hunting specifically for the one-defensible-answer failure and false hints.

### Pass 2 self-review MUST run in a fresh context

Use a subagent so it reads the content cold, with no memory of having written it:

```
Agent(subagent_type: "general-purpose", run_in_background: false, prompt:
  "Read <scratchpad>/new-content.txt — N new bilingual EN/PL quiz questions already
   merged into the Showdown free pools. You did NOT write these; review them cold.
   Read .claude/skills/showdown-free-pool/references/authoring-rules.md first and
   apply its rules, especially the one-defensible-answer rule and the wheel IP rules.
   For EVERY item report only defects: wrong keyed answer, a second defensible option,
   a false or outdated hint, an IP-risky phrase, an unnatural Polish translation, or a
   ladder item mis-banded for its rung. Output: ID | category | problem | fix.
   No praise, no restating correct items.")
```

Feed its findings back through the same fix cycle.

---

## Codex review (both passes)

```bash
cd <scratchpad>
codex exec --skip-git-repo-check -s read-only "<prompt>" < <game>-only.txt > review-<game>.txt 2>&1
```

**Split per game and run the three in parallel** (background Bash). One combined 300-item run is much slower and dilutes the prompt.

Prompt must state: `correctIndex is 0-BASED`, the ladder difficulty bands by id range, and "flag ONLY problems — no praise, no restating correct items", plus a demand for sourced reasoning. Ask for `ID | category | problem | fix`.

### Traps (each of these cost real time)

- **Never pipe Codex through `tail`/`head`.** The pipe buffers and you see an empty file for 15 minutes while it looks hung. Redirect straight to a file (`> review-x.txt 2>&1`) and read the file.
- **It is slow.** Codex runs at high reasoning effort and does live web searches to verify facts — 10–25 min per game is normal. Launch in background, do other work, wait for the notification. Do not kill it early.
- Codex echoes stdin back into the output file; the verdict is after the final `codex` marker. `awk '/^codex$/{f=1} f' review-x.txt | grep -v '^web search'` extracts it.
- It reads the repo's own skills and may narrate about them — harmless noise.

---

## Triage: what blocks, what does not

| Finding | Action |
|---|---|
| Factual error (wrong key, second defensible option, false hint) | **BLOCKER — fix** |
| IP risk (trademark, song/book/film title, slogan, lyric) | **BLOCKER — fix**, use the suggested neutral replacement |
| Polish: mistranslation, calque instead of a real proverb, missing diacritic | **Fix** — these are genuine errors |
| Ladder difficulty mis-banding | **Judgment call** — surface to the user, do not silently reshuffle 15 rungs |
| Style / phrasing preference | Surface, do not auto-apply |

**Codex over-triggers on IP — do not apply its flags mechanically.** On a real run it flagged ~30 ordinary public-domain idioms because a song happened to share the title, which would have gutted the bank (and would equally condemn the already-shipped content). Apply the "did the phrase exist before the work?" test in `authoring-rules.md §3`: keep pre-existing idioms, block trademarks, quotes, slogans, and *invented* phrases that collide with a real title.

This is the one place where you must push back on the reviewer rather than defer to it. Say clearly in your report which flags you rejected and why.

Pre-existing warnings in the untouched bank (e.g. the `Apple` IP hit on the fruit) are **not yours**. Confirm with `git stash` that they exist on the clean tree, then leave them and say so.

## Done

Both passes complete, every factual/IP finding resolved, audit 0 errors with exact EN/PL parity, `tsc` clean, validator clean. Report before/after counts and list the judgment calls you did *not* apply.
