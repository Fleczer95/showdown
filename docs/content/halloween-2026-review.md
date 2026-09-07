# Halloween 2026 Ladder content review

This is the retained **v1** review. Current development content is **v2**: see [applied fixes and compatibility notes](halloween-2026-v2-fixes.md).

Reviewed: **2026-09-07**. Content audit complete; production `halloween-2026` remains **disabled**. This is not launch approval or a deployment.

## Delivered bank

- `assets/events/halloween-2026/ladder.json`: **300 original questions**, complete English/Polish prompts, four options, zero-based keys and hints.
- **20 questions at each of 15 rungs**; four questions from each theme at every rung.
- Five themes, **60 questions each**: customs/remembrance, nocturnal creatures, eerie science, public-domain stories/scoped folklore, and burial places/autumn harvest.
- Final answer distribution: **75 per position**, including **five per position per rung**. Actual options were shuffled together with their keys; answers were not assigned by a repeating cycle.
- `shared/events/halloween.ts`: revision `halloween-2026-v1`, ID-only rung manifest. The Worker does not bundle the answer bank.
- `docs/content/halloween-2026-evidence.json`: 300 matching source/evidence records, final answers, review-stage results and content hashes.

Connections include direct Halloween customs and intrinsically related subjects: darkness, nocturnal animals, spooky optical/acoustic phenomena, Gothic fiction, underworld folklore, funerary architecture, pumpkins and autumn fungi. Other remembrance festivals are identified as distinct traditions, not described as Halloween equivalents. No questions were added to the ordinary free pools or paid-pack catalogue.

## Review actually performed

1. Five separate authors produced 60 items each, with institutional/primary or scholarly sources, original bilingual wording and reported separate truth/localization self-review passes.
2. Five fresh, read-only reviewers inspected all **300 initial draft items**. Initial results were 269 PASS, 24 PASS_WITH_NOTE and 7 FAIL. Those are historical draft results, not unresolved final failures.
3. Four story items were replaced with source-backed folklore: Baba Yaga’s hut (184), the Warsaw basilisk (192), Mickiewicz’s _Pani Twardowska_ (201), and the scoped Coe collection’s Koshchei tale (217). These replacements were independently checked against the opened primary/municipal sources during the cold review; their superseded story reviews are not represented as reviews of the replacements.
4. A fresh-context reviewer made **two separate semantic passes over all 300 IDs together**: truth/key/distractors/hints, then ambiguity/Polish/parity/fairness. It also compared all 700 existing base Ladder prompts and assessed whole-set repetition and answer patterns. The cold draft ledger contained 291 PASS, 8 PASS_WITH_NOTE, 1 FAIL and no UNVERIFIED items.
5. All **26 questions changed after that cold snapshot** received independent final-order rechecks: one batch of 21 and one of five, all PASS. Exact reviewed inputs were compared with the shipped JSON; every semantic change from the cold snapshot was required to have a correction recheck.

**Final disposition: 299 PASS, 1 PASS_WITH_NOTE, 0 FAIL, 0 UNVERIFIED.** The retained note is difficulty-only: 016 uses a specialized South Uist photographic detail at rung 4, with a farm-material hint that makes it inferable. Difficulty is editorially estimated, not empirically calibrated with players.

### Important corrections

- **041:** replaced the broad hats-or-hoods description with the specific black _hikosa zukin_ hoods, avoiding an alternative defensible Bon-dance answer.
- **047:** asks which Chinese variety the National Heritage Board describes as **predominant** in getai. It no longer implies that only Hokkien has an important role; Teochew also appears in performances.
- **166:** specifies identical, equal-level clicks **3 ms apart**. The earlier vague delay admitted summing localization below roughly 1 ms. The primary precedence-effect review and independently opened UCSD material support the corrected scope.
- **131:** identifies the fluorescence process rather than repeating 077’s ultraviolet-excitation answer.
- **132 / 279:** removed answer-leading Polish sleep terminology and the giant/_maxima_ wording from the prompts. Optional hints can still help.
- Removed answer-supplying or redundant hints and repaired Polish cases, literal calques, morphology wording and unequal gender/clue information.
- The possible glowing-coal alternative in 005 was investigated, not automatically called a defect: the inspected account places coal in Jack’s legend, rather than establishing a competing ordinary lantern-lighting custom.

## Evidence and limitations

Sources include national museums/trusts, municipal tourism accounts, public-domain primary texts, university extension services, botanical institutions, NASA/physics teaching material and scholarly papers. Each item has specific URLs and support notes in the evidence ledger; independent-review URLs are recorded separately.

The cold reviewer opened selected high-risk sources independently and used supplied source-backed evidence elsewhere. **A listed URL does not mean every page was independently fetched twice.** Some material was accessed through browser/search retrieval or abstracts rather than a direct full-text HTTP fetch. This is a model-assisted, source-backed editorial review, not a guarantee against every factual error, professional legal clearance, or player-tested difficulty study.

Whole-set review found no exact prompt matches or confirmed same-keyed-fact duplicates against the base Ladder pool. The internal UV-answer repetition was corrected. Several customs concern marriage divination, and upper story rungs lean toward Hearn/M. R. James; these remain distinct scoped facts, but future editions should broaden those concentrations.

The generic IP scanner’s five `Apple` warnings refer to the fruit/apple bobbing, not Apple products. No modern-franchise dependency or copied literary quotation was identified. Public-domain characters/titles and factual references to institutions do not imply endorsement.

## Verification and integration

```bash
npm run content:halloween:check
node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs assets/events/halloween-2026/ladder.json
npm run type-check
npm --prefix server run typecheck
npx jest --runInBand --coverage=false
npm run test:events:d1
npm run i18n:check
```

Final checks passed: **105 Jest suites / 1,015 tests**, app/Worker type checks, targeted lint/format, i18n synchronization and real local D1 integration. The strict text scanner reported zero errors/warnings; the generic content audit reported zero errors and the five fruit-related warnings described above. Four negative-input checks confirmed that the release gate rejects an unfinished review, a changed answer, a changed hint and an unresolved verdict.

The content gate checks all 300 bilingual records, lengths, normalized/control-free text, unique prompts/options, rung/theme/key balance, evidence coverage and the exact reviewed answer/content hash. **It does not mechanically prove the truth of sources.** A changed prompt, option, key or hint invalidates the recorded review hash and requires re-review.

The dev-only `local-halloween-preview` edition resolves this dedicated bank. The previous `local-event-fixture` and `local-ladder-v1` remain resolvable for saved games; they are not reinterpreted as Halloween content. Admission samples all 20 rung candidates but transports only one primary plus at most five Skip alternates, within the challenge contract. The selected intent is persisted for retries.

Production dates, launch thresholds and prize assets remain deferred. The local preview still uses the existing Champion reward as a placeholder. Do not enable production or change a publicly admitted immutable revision merely because this content audit passed. See `docs/handoff/timed-events-implementation.md` for runtime verification and remaining native coverage.
