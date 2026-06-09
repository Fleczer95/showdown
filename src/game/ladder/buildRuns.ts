// Pure content adapter for "The Ladder": turns the bilingual question bank into
// the per-rung pools that `buildRun` (logic.ts) consumes. No React / RN imports
// so it can be unit-tested in isolation.

import { ALL_PACK } from './content';
import type { LadderQuestion } from './logic';

export type Language = 'en' | 'pl';

/** Turn the bilingual content pack into a per-rung pool for the chosen locale. */
export function buildLocalizedRungs(lang: Language): LadderQuestion[][] {
    const rawRungs = ALL_PACK.rungs.map((rung) =>
        rung.map((q) => ({
            id: q.id,
            prompt: q.question[lang],
            options: q.options.map((o) => o[lang]),
            // Carry the bank's real correct-answer position; the loader must NOT
            // assume option 0 is correct (the bank places it at any of 0–3).
            correctIndex: q.correctIndex,
            hint: q.hint[lang],
        })),
    );

    // We group the 15 rungs into 5 broader difficulty pools (3 rungs each).
    // This increases variety at each step (e.g. any question from levels 1-3
    // can appear in any of the first three rungs of a run).
    const pooled: LadderQuestion[][] = [];
    for (let i = 0; i < 5; i++) {
        const startIndex = i * 3;
        const combinedPool = [...rawRungs[startIndex], ...rawRungs[startIndex + 1], ...rawRungs[startIndex + 2]];
        // We push the same large pool for all 3 rungs in the group.
        // buildRun() will then pick distinct least-shown questions for each.
        pooled.push(combinedPool, combinedPool, combinedPool);
    }
    return pooled;
}
