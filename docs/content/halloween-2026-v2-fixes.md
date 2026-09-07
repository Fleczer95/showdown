# Halloween v2 — review fixes

Date: 2026-09-07. Current content: **`halloween-2026-v2`**, in [`ladder-v2.json`](../../assets/events/halloween-2026/ladder-v2.json). Production Halloween remains disabled.

## Decisions applied

Exactly **five questions** changed, and only their prompts/hints. All 300 IDs, options, answer indices, themes and difficulty levels are unchanged; the current pool still has 20 questions per rung and 75 keys in each position.

| ID      | Correction                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **019** | Replaced the unexplained museum reference with a summer-solstice clue in both languages. The independent recheck caught that English _midsummer_ should not be translated literally as Polish _w środku lata_; the final wording uses **summer solstice / przesilenie letnie**.                                                                                                                         |
| **049** | Removed the claim that garments transmit skills. The bilingual hint now describes a craft using needle and thread, with techniques passed down through generations. This provides useful needlework context without specifying silk or copying the answer. Needle/thread use is a reasonable inference from the documented traditional patchwork construction, not a claimed verbatim source statement. |
| **082** | Changed the Polish opening from “Jak wiele…” to **“W jaki sposób wiele…”**, clearly asking about method rather than quantity. The valid plural answer sentences and English text are unchanged.                                                                                                                                                                                                         |
| **162** | Rephrased the Polish condition so it clearly preserves similar other conditions while cloud droplets become smaller. The English text and inverse size/radius relationship are unchanged.                                                                                                                                                                                                               |
| **257** | Removed “the museum example” from both hints. The clue directly gives early nineteenth-century Britain, supported by the dated British mortsafe.                                                                                                                                                                                                                                                        |

## Decisions deliberately not applied

- **016 / 250:** retain the existing placements for now. The photograph/monument references are narrow, but the farm-material/early-farming hints provide an inference route. Rebanding without player data would be speculative and require compensating changes to the rung distribution.
- **060 / 120:** retain these expert-level items and record the recognition concerns. Their keys are source-supported. Rewriting the experiment item to restate the feedback mechanism risks reintroducing the answer-leading phrasing removed during the first review.
- **007 / 271:** do not apply the rejected guising or _pepo_ changes. Institutional sources support performing tricks; replacing the Polish botanical answer with “owoc dyniowaty” would introduce an answer-stem clue.
- **047 / 179 / 180:** no question changes: substantive primary-source rechecks resolved the reviewer evidence issues.

## Review and compatibility

A fresh Codex recheck examined the full final records in two batches (two and three items), with separate truth/key/distractor/hint and EN/PL localization passes. **All five final corrections passed.** Exact reviewed inputs were compared with the shipped v2 records before recording their hashes.

The remaining 295 records inherit the adjudicated v1 full-bank review. Current evidence: [`halloween-2026-v2-evidence.json`](halloween-2026-v2-evidence.json). Final disposition: **296 PASS, 4 PASS_WITH_NOTE**, with the four difficulty judgments above retained. See the [five-item review record](reviews/halloween-2026-v2-corrections.json) and the [full v1 dual-review report](halloween-2026-dual-review.md).

No existing revision was overwritten:

- `ladder.json` and `halloween-2026-evidence.json` retain **v1**, byte-for-byte.
- The original `local-halloween-preview` edition remains bound to v1.
- Fresh development entries use **`local-halloween-preview-v2`**, bound to v2.
- `local-event-fixture` / `local-ladder-v1` also remain supported.
- The Worker registers both ID manifests, but imports neither answer bank. Separate edition/revision identities prevent old and new random matches from mixing.

No dates, launch rewards, production activation or native configuration changed. A running in-memory preview backend must be restarted to load the new fixture definition; no native rebuild is required.

## Verification

- **105 Jest suites / 1,017 tests passed.** New guards check that exactly five text records differ, all answers/difficulties remain unchanged, the original v1 bank remains frozen, and all retained questions/rung IDs resolve correctly.
- Real local D1 tests passed, including v1/v2 admission isolation, v1 idempotent retry and rejection of a v2 revision under the old edition ID.
- App/Worker type checks, targeted lint/format, i18n synchronization and whitespace checks passed.
- `npm run content:halloween:check` validates **both** revision banks and their reviewed-content hashes.
- Strict text scan: zero errors/warnings. Generic audit: zero errors; the existing five fruit-related `Apple` warnings only.

Full multi-game native lifecycle coverage remains a separate outstanding task; these fixes do not constitute a new native-matrix pass.
