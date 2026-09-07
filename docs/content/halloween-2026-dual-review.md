# Halloween questions: independent Codex + agy review

**Follow-up:** the five wording/hint improvements below have since been applied and independently rechecked in **v2**. Four difficulty judgments remain unchanged. This report and its snapshots describe v1; see [the fix decisions](halloween-2026-v2-fixes.md).

Date: **2026-09-07**. Scope: **all 300 English/Polish Ladder questions**, including every option, zero-based answer key and hint, in `assets/events/halloween-2026/ladder.json` (`halloween-2026-v1`).

**Result: no confirmed wrong answer, materially false premise or second correct option. Nine non-blocking improvements remain. No gameplay content or existing evidence records were changed.**

Input SHA-256: `8281c6fb0869cf4d03cc70ebe796d54e3b93f3471b78e36e4a4b543eae8b3d92`.

## Method and coverage

Used `question-quality-audit`, its truth/localization rubric, the ShowDown content-audit standards, and the fresh-context/whole-set review principles from the content-authoring review loop.

Both tools received frozen content, source leads without prior verdicts, explicit two-pass instructions, difficulty bands, and a report-only restriction. Reviewers were told not to read earlier reviews or delegate. The original question bank was kept outside their working directories.

| Reviewer                                 | Scope                                                                        | Raw PASS | Raw PASS_WITH_NOTE | Raw FAIL | Raw UNVERIFIED |
| ---------------------------------------- | ---------------------------------------------------------------------------- | -------: | -----------------: | -------: | -------------: |
| Codex CLI, `gpt-6-astra`, high reasoning | 300/300, separate truth and localization passes                              |      291 |                  8 |        0 |              1 |
| agy CLI, `gemini-3.1-pro-high`           | Whole-set semantic review plus five independent 60-item source-audit batches |      297 |                  1 |        2 |              0 |

These are **reviewer reports, not the final adjudication**. After checking the disputed claims and sources, final triage is **291 PASS / 9 PASS_WITH_NOTE / 0 FAIL / 0 UNVERIFIED**. This is not production launch approval or empirical difficulty calibration.

### Coverage and provenance qualifications

- Codex recorded 167 substantively inspected URLs touching 271 items, identified 28 common/stable items accepted using supplied references and general knowledge, and left one exact institutional attribution unverified. That gap was subsequently resolved against the actual primary page, below.
- agy initially returned an ungrounded 300-item pass without opening sources. That was rejected as a factual audit. A planning-only follow-up also was not counted. The final review used smaller source-audit batches; customs was finalized from its retained conversation after reaching the CLI time limit.
- Every final agy batch ID has exactly one verdict. Its raw truth/localization coverage arrays omit 007 and/or 082, but explicit findings assess those exact items. The finding records reconcile actual assessment coverage to 300/300; the raw arrays are preserved rather than silently rewritten.
- **agy’s source provenance is not consistently auditable:** its “supplied evidence only” IDs overlap claimed opened-source IDs for 218 items, and one substitute DOI could not be resolved. Its blanket source-pass claims were not accepted as independent certification. Important disputes were adjudicated against substantive primary sources.
- Both tools reviewed the whole set for patterns. Topic concentration, narrow source-specific trivia and easily eliminated distractors remain editorial considerations, not confirmed answer errors.

## Recommended improvements — not applied

| IDs          | Category              | Recommendation                                                                                                                                                                                               |
| ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **019, 257** | Hint self-containment | Remove “the museum” / “the museum example” when no museum is identified in the displayed question. Refer directly to the midsummer celebration or early nineteenth-century Britain.                          |
| **049**      | Polish hint           | Garments do not themselves transmit tailoring skills. Prefer: “Umiejętności potrzebne do wykonania tych strojów przekazuje się z pokolenia na pokolenie”. Align the English hint if revised.                 |
| **082**      | Polish wording        | Change the opening “Jak wiele…” to “W jaki sposób wiele…”, avoiding an initial “how many?” reading. The plural standalone answers are grammatical; an answer-key or wholesale option rewrite is unnecessary. |
| **162**      | Polish phrasing       | Replace the cumbersome “w podobnych poza tym chmurach” with a clearer statement that the other conditions remain similar. Preserve the correct inverse droplet-size/corona-radius relationship.              |
| **016, 250** | Difficulty placement  | The unseen South Uist photograph at rung 4 and the specific Stoney Littleton monument at rung 3 are narrow references. Consider a better identifying clue or later placement after playtesting.              |
| **060, 120** | Expert answerability  | Prefer meaningful identifying evidence over recall of a particular municipal page or a named 1996 experiment. Any rewrite must preserve unique answers and avoid reinstating answer-leaking hints.           |

The full current EN/PL prompts, options, keys, hints and per-item verdicts are in the [coverage ledger](reviews/halloween-2026-dual/coverage.json). Exact reviewer proposals and evidence links are in the raw results linked below. Difficulty changes are judgment calls, not automatic fixes.

### Set-level observations

- Ten of the sixteen story questions at rungs 12–15 come from M. R. James or Hearn. The facts differ, but broader author representation would improve variety.
- Several questions reuse South Uist/Canna, Nishimonai or Perneb settings. A few facts also reappear as hints in other items.
- Some creature/science distractors are physiologically implausible or conspicuously absolute, making specialist-looking questions easier by elimination.
- The 75/75/75/75 key distribution has no detected deterministic answer cycle; the longest identical-key run is three.

## Disputed findings and source rechecks

### 007 — guisers performing tricks: rejected as an error

agy called “Performed a song or a trick” / “Śpiewali lub pokazywali sztuczkę” a major historical/localization defect. A separate Codex adjudicator checked both sides:

- [National Trust for Scotland](https://www.nts.org.uk/stories/6-scottish-halloween-traditions) explicitly says **“After performing tricks or songs”**.
- [National Records of Scotland](https://blog.nrscotland.gov.uk/2020/10/31/out-guising/) independently documents performances for treats.
- An [Ulster-Scots institutional publication, page 16](https://discoverulsterscots.com/sites/default/files/documents/2021-03/Oct%202019.pdf.pdf) explicitly describes a party trick.

The existing answer is supported. A poem would be another valid example, not a required correction.

### 047 — Hokkien attribution: evidence gap resolved

Codex correctly marked the precise National Heritage Board attribution **UNVERIFIED**, rather than claiming success after encountering access challenges.

A subsequent direct read-only request retrieved the actual [Roots / Getai article](https://www.roots.gov.sg/ich-landing/ich/getai), HTTP 200. It explicitly states:

> A distinguishing feature of the getai performance is the predominant use of the Hokkien dialect.

This supports the existing narrowed question and key. agy’s alternative Hungry Ghost article only describes dialects “such as Hokkien”; that weaker passage alone was not used to establish predominance. No question edit is required.

### 082 — downgrade the claimed grammar failure to wording cleanup

“Wiele pająków odzyskuje” has correct singular agreement. A separate answer sentence such as “Zjadają ją” can refer to the spiders in the plural; it is not inherently ungrammatical. The actionable issue is the initially ambiguous “Jak wiele…”, not a false web-eating answer. This remains a non-blocking phrasing recommendation.

### 271 — keep the technical term rather than add an answer clue

agy proposed replacing Polish “Pepo” with “Peponidium” or “Owoc dyniowaty”. Independent terminology checks found documented Polish botanical use of _pepo_; no necessary correction was established. Historical evidence does not prove modern frequency, but neither did the reviewer establish its alternative as more conventional.

Most importantly, **dynia → dyniowaty** would reveal the Polish answer through its word stem, unlike English _pepo_. Do not automatically apply that suggestion. See the adjudication record for the Polish botanical text, glossary and FAO terminology references.

### 179–180 — reviewer citation problems, not wrong answers

agy used Wikipedia alone for the precise oxygen-quenching claim in 179 and claimed to inspect RSC DOI `10.1039/d0tc05786g` for 180. Both the DOI resolver and Crossref returned 404 for that DOI, while a known-DOI control succeeded; the publisher URL returned 403. The claimed independent access was not substantiated.

The coordinator instead directly retrieved and read:

- **179:** [University of Southampton thesis](https://eprints.soton.ac.uk/465803/1/994907.pdf), printed page 17 / PDF page 38: the long-lived oxygen state is collisionally quenched at lower altitudes before red emission.
- **180:** [Persistent Luminescence in Eu2+-Doped Compounds: A Review, full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5445854/fullTextXML): charge-carrier trapping, gradual release and recombination explain delayed luminescence, distinct from quasi-stable-state phosphorescence.

These substantive sources support the existing answers and hints. The weak substitute citations were not added to the game’s evidence ledger.

## Artifacts and unchanged-content checks

- [Raw Codex review](reviews/halloween-2026-dual/codex.json)
- [Raw agy batch reviews, with provenance caveats](reviews/halloween-2026-dual/agy.json)
- [Independent adjudication and coordinator source checks](reviews/halloween-2026-dual/adjudication.json)
- [Complete bilingual coverage ledger](reviews/halloween-2026-dual/coverage.json)

Preflight checks passed: `npm run content:halloween:check`, the generic content audit (zero errors; five fruit-related `Apple` warnings), and the strict Unicode/ID scanner (zero errors/warnings). These checks are mechanical, not factual certification.

The question bank, existing evidence ledger, both locale files and `CONTEXT.md` were hash-checked and left unchanged. Only these review reports were added. No deployment, production activation, native changes or content fixes were performed. Production Halloween remains disabled; any approved content changes must respect retained, already-admitted revisions.
