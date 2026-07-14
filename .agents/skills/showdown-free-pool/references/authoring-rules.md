# Authoring Rules

All of these are hard. They were learned the expensive way — each one has already caused a real defect.

## 1. Format constraints (break these and the audit lies to you)

- **Single quotes, NO apostrophes, anywhere in any string.** The audit engine parses TS by regex-counting `en: '...'` vs `pl: '...'` with `[^']*`. An escaped apostrophe (`\'`) truncates the capture and desyncs the counts, producing a bogus `[MISMATCH]` that looks like a missing translation. Rephrase: `of Rome` not `Rome's`, `cannot` not `can't`.
- **Diacritics are fine and required.** `ö`, `é`, `ń`, `ś` do not break the regex — only `'` does. Spell foreign names properly: **Gödel, Schrödinger, René Descartes, Poincaré**. Stripping diacritics is a Polish-quality bug, not a safety measure.
- Typographic `’` (U+2019) is safe if you truly need an apostrophe-looking glyph, but prefer rephrasing.
- Exactly 4 options for ladder/drop; all 4 distinct within a question; `correctIndex` is **0-based**.

## 1a. Answer-position spread (a real exploit — check it mechanically)

When you write questions one at a time you will unconsciously put the correct answer in the same slot almost every time. In this pipeline's first run, **120 of 135 new ladder questions were keyed to index 1, and index 3 was never used once** — every question in the hard and expert bands was option B. A player who always taps B cleared both bands. Neither the audit nor the Codex review caught it; only a fresh-context reader looking at the *whole set* did.

`pool_stats.mjs` prints the distribution. It must be roughly even across 0–3 for the ladder.

To fix, **rotate the options** (permute the array and re-point `correctIndex`) — never just renumber `correctIndex`, which silently keys the wrong answer. Leave questions whose option order is meaningful (years, ascending magnitudes) alone.

**Drop is different:** its options are an ascending magnitude bracket, so the true value naturally sits in the middle — the existing bank runs ≈6/97/91/6. Match that shape; do not rotate drop options (it would break the ascending ladder). Vary the *bracket window* instead, so the answer is sometimes the 1st or 4th value.
- Free ladder questions carry **no `difficulty` field** (position in `RUNGS` = the rung). Only premium packs carry `difficulty`.

## 2. The one-defensible-answer rule (the biggest source of defects)

For every question ask: *can a knowledgeable player argue for a different option?* If yes, it is broken. Real examples caught in review:

| Wrote | Problem |
|---|---|
| "Which planet is hot enough to melt lead?" → Venus | Mercury peaks ~430 °C, above lead's 327 °C. **Both** qualify. → ask for the *highest average* surface temperature. |
| "Loudest sound of any animal?" → Blue whale | Sperm whale clicks are louder. The keyed answer was simply **wrong**. |
| "Which animal has human-like fingerprints?" → Koala | Chimps and gorillas do too — and they were distractors. |
| "Driest place on Earth?" → Atacama | Only the driest **non-polar** desert. |
| "Deepest point in the ocean?" → Mariana Trench | The deepest *point* is Challenger Deep; the trench contains it. |
| "Hardest natural substance after diamond?" → Corundum | Moissanite is harder. → ask which mineral **defines Mohs 9**. |
| "Which organ can regrow?" → Liver | Lung tissue regrows too. → ask which **rapidly restores its original mass**. |

**Fix pattern:** narrow the question with a qualifier (`non-polar`, `average`, `peripheral`, `defines hardness nine`, `published in 1543`) or remove the defensible distractor. Superlatives (*most*, *greatest*, *strongest*, *first*) are where ambiguity hides.

**Check the hints too.** A hint can be independently false: "O positive — the universal donor" is wrong (that is O **negative**), and "spoken in the most populous country" for Mandarin is now outdated (India passed China).

## 3. Wheel = the IP minefield

Public-domain proverbs and idioms are safe. **Invented "generic descriptive phrases" are NOT automatically safe** — a plain-sounding English phrase is very often an exact book, song, or film title. Real hits found in review:

- `SAVED BY THE BELL` — a live NBCUniversal **trademark**, despite being an old idiom.
- `THE CUSTOMER IS ALWAYS RIGHT` — originated as a retail **advertising slogan**.
- `TOMORROW IS ANOTHER DAY` — the closing line of *Gone with the Wind*.
- `WHAT DOES NOT KILL YOU MAKES YOU STRONGER` — Nietzschean, but this exact wording is a **song hook**.
- `FOOTPRINTS IN THE SNOW`, `THE LAST TRAIN HOME`, `A CANDLE IN THE WINDOW`, `THE FIRST SNOW OF THE YEAR`, `THE OLD STONE BRIDGE` — all exact book/song titles.

**Rule:** the more it sounds like a nice title, the more likely it *is* one. Make descriptive phrases longer and more specific than any plausible title (`A MOSSY FOOTBRIDGE ABOVE A STREAM`, not `THE OLD STONE BRIDGE`). Assume any 3–5 word evocative phrase is taken until the review clears it.

**Rewording an IP hit is not enough.** `A CANDLE IN THE WINDOW` (a song title) became `A SMALL CANDLE BESIDE THE WINDOW` — still title-shaped, and flagged again on the second pass. The replacement must change the *shape*, not just the words: `A WORN LEATHER ARMCHAIR BY THE BOOKSHELF`.

**But do NOT accept every IP flag — reviewers over-trigger here.** On the second pass Codex flagged ~30 ordinary idioms (`PLAY WITH FIRE`, `HIT THE ROAD`, `TURN A BLIND EYE`, `MAKE ENDS MEET`, `READ BETWEEN THE LINES`…) as IP risks purely because a song or book shares the title. That is wrong: **titles are not copyrightable**, and these idioms predate the works by centuries. Accepting it would also condemn the existing shipped bank (`BREAK THE ICE`, `SPILL THE BEANS`, `BITE THE BULLET`).

Use this test:

| Situation | Verdict |
|---|---|
| A phrase that already existed in the language as an idiom/proverb, which a song/book later used as a title | **SAFE — keep.** The idiom is the source, not the work. |
| A registered **trademark** used as a commercial identifier (`SAVED BY THE BELL`) | **BLOCK** |
| A famous line *from* a work (`TOMORROW IS ANOTHER DAY`), a lyric hook, or an ad slogan | **BLOCK** |
| An **invented** evocative phrase that turns out to match a real title (`THE LAST TRAIN HOME`, `A LONG WALK ON THE BEACH`) | **BLOCK** — you invented it, so the work is the only plausible source of the coincidence. Reshape it. |

The dividing question is *did the phrase exist before the work?* If yes, keep it and say so in the report.

**Do not invent "proverbs".** `GOOD SERVICE BUILDS TRUST` and `HARD TIMES CAN BUILD RESILIENCE` were flagged as corporate/self-help copy — an invented aphorism reads as an ad slogan, which is the very thing the gate forbids. Use a *real* proverb (`A LIE HAS SHORT LEGS` / `KŁAMSTWO MA KRÓTKIE NOGI`) or a plainly descriptive phrase. And never truncate a proverb into an ungrammatical fragment (`BETTER AN OUNCE OF PREVENTION` is not English; the proverb is `AN OUNCE OF PREVENTION IS WORTH A POUND OF CURE`).

**Both locales must be independently solvable.** A puzzle whose Polish answer labels itself (`a pride` → `STADO LWÓW`) or a hint that refers to English spelling (`the English name starts with A` for `Tętnica`) is broken for half the players. If a concept has no distinct Polish word, cut the question.

Polish must be a **real Polish proverb** where one exists, not a calque: `PRÓŻNA BECZKA DZWONI`, not the literal `PUSTE NACZYNIE NAJWIĘCEJ DZWONI`.

## 4. Drop = one true, checkable figure

Four numeric options, one true, distractors plausibly close. **Never ship a contested or poorly-sourced statistic** — the whole game is "which number is right", so a disputed figure has no right answer.

Three failure modes, all of which shipped defects on the first run:

1. **Disputed / refuted.** Sneeze speed (16 vs 160 km/h), human–banana DNA overlap, total nerve length ("72 km", widely repeated, poorly sourced), "1 trillion distinguishable odours" (the study was publicly refuted). Cut these.
2. **The true value is not even among the options.** The first commercial mobile phone weighs 790 g; the options were 0.3 / 1.1 / 3 / 6 kg. Always confirm the keyed figure is the *actual* one, not the one you half-remember.
3. **The figure drifts.** Ocean floor mapped, objects tracked in orbit, people who have been to space, words spoken per day, dairy yields — all move year to year, and some were already obsolete when written (500,000 earthquakes → USGS locates ~20,000; 36,000 debris objects → ~54,000). Either **anchor to a fixed source/year** in the prompt ("In the 2007 study published in Science…", "By 2025…") or pick a stable fact instead (how many people have *walked on the Moon* = 12, forever).

Watch definition traps: "oldest tree" depends on whether clonal root systems count (Methuselah ~4,900 y vs Old Tjikko ~9,550 y), and "a day on Venus" differs sidereal (243 d) vs solar (117 d). And check what a famous number actually measures — the Eiffel Tower's celebrated "15 cm" is *lateral summit movement*, not summer height gain (that is a few mm).

## 5. Interesting, not more of the same

The existing banks are already saturated with:
- **Ladder:** "What is the capital of X?", "Which element has the symbol X?", "How many strings on X?" — the tail of the bank is almost entirely obscure capitals. **Do not add more of these.**
- **Drop:** "How many X are in a Y?" counting questions.
- **Wheel:** the common English idioms are largely used up — check the dump.

Aim for the *wait, really?* reaction: the only mammal that truly flies; the Sargasso Sea has no coastline; turnips were carved into lanterns before pumpkins; energy takes tens of thousands of years to escape the Sun's core; the number of ways to shuffle 52 cards.

Dedup case-insensitively against the dumps from `pool_stats.mjs`, across **both** locales, and against near-duplicates (a question with the same *answer* and *fact* is a duplicate even if worded differently).

## 6. Ladder difficulty bands

Position in `RUNGS` is the difficulty. Be honest about the top band — school-syllabus science is **not** expert.

| Rungs | Band | Calibration |
|---|---|---|
| 1–3 | Very easy | General audience; still surprising, never toddler-level |
| 4–6 | Easy / medium | A curious adult gets it |
| 7–9 | Medium | Needs some real knowledge |
| 10–12 | Hard | Specialist-leaning |
| 13–15 | Expert | Genuinely hard. **Not** "helicase unwinds DNA", "the corona is visible during an eclipse", or "the Great Barrier Reef" — those are school/pop-science and belong lower. |
