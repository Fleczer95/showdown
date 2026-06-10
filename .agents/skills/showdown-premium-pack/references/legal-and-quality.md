# Legal Gate & Hard Content Requirements

All five requirements are hard. Stages 2–3 of the pipeline verify them; do not wire or provision a pack that fails any.

## 1. Legal gate (refuse-on-fail)

The pack content must not violate any legal rights. Enforce, and REFUSE with an explanation when a topic cannot be made safe:

- **Original phrasing.** Write every question/clue/prompt in original wording from general factual knowledge. Never copy question text verbatim from any quiz product, website, or book. Facts are not copyrightable; specific wording is.
- **Wheel phrases = public domain or original only.** Allowed: proverbs, idioms, common sayings, generic descriptive phrases. REFUSE copyrighted material as a puzzle: song lyrics, movie/TV quotes, ad slogans/taglines, poetry, book lines.
- **No trademarked franchise as the subject.** Refuse a pack whose theme IS a protected brand/franchise used as the product (e.g. a "Harry Potter pack", "Marvel pack", "Pokémon pack"). Facts phrased originally that merely mention a real entity are fine; genericize where possible ("the famous wizard boy" over the trademarked name). The audit engine flags a trademark blocklist — treat any hit as a blocker unless it is an incidental, genericized, fair-use mention.
- **Provenance/IP note.** Emit a short note in the run summary stating the content is original, the topic's IP-safety basis, and (for Wheel) that all phrases are public-domain/original.

When refusing: name exactly why the topic is unsafe and propose an IP-safe reframing if one exists.

## 2. No duplication

De-dup new cards against:
- the game's existing free `content.ts`, and
- any premium packs already in the catalog.

Compare case-insensitively on the question/phrase text across BOTH locales. The audit engine catches intra-pack duplicates; cross-file dedup against existing content is the author's responsibility — grep the existing banks before finalizing.

## 3. Factual accuracy / verifiable answers

- Every `correctIndex` must point to a real, checkable fact.
- Drop: the four options are plausible real statistics bracketing one true figure; distractors are believable near-values, not absurd. State the true figure's basis when uncertain rather than inventing.
- Flag anything you are not confident is correct for the Gemini review rather than shipping it.

## 4. Difficulty calibration

- **Ladder:** difficulty genuinely rises across pools 1→5. Pool 1 (rungs 1–3) is general-audience easy; pool 5 (rungs 13–15) is genuinely hard/specialist. `difficulty`/rung indices must be consistent. Avoid "toddler-level" items the audit flags (basic color/counting/arithmetic, ambiguous descriptors).
- **Drop:** spread of magnitudes so the answer isn't obvious; distractors plausibly close.
- **Wheel:** phrase lengths and letter spread stay playable (not single short words, not absurdly long); reasonable consonant/vowel balance.

## 5. Thematic coherence + store copy

- Every card clearly belongs to the one pack theme.
- Auto-write the bilingual store copy to match the theme: `screen.store.item.<key>.title`, `.desc`, and 2+ `screen.store.feature.<key>_N` strings, in EN and PL. Keep titles short and the description benefit-led, mirroring the existing `theme_cyberpunk` copy.
