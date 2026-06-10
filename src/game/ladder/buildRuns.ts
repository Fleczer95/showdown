// Pure content adapter for "The Ladder": turns the bilingual question bank into
// the per-rung pools that `buildRun` (logic.ts) consumes. No React / RN imports
// so it can be unit-tested in isolation.

import { ALL_PACK } from './content';
import type { LadderQuestion } from './logic';

export type Language = 'en' | 'pl';

/**
 * A localized question from an owned premium pack, tagged with its target rung
 * (1–15). Unlike the free bank — where the rung is the array position — pack
 * cards are a flat list, so they carry `difficulty` to slot into the right rung.
 */
export type LadderPackCard = LadderQuestion & { difficulty: number };

/**
 * Turn the bilingual content pack into a per-rung pool for the chosen locale,
 * optionally merging in already-localized cards from owned premium packs. Each
 * owned card is slotted into the rung named by its `difficulty` (1–15).
 */
export function buildLocalizedRungs(lang: Language, ownedCards: LadderPackCard[] = []): LadderQuestion[][] {
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

    // Merge owned-pack cards into their target rung (difficulty 1 → rawRungs[0]).
    // Out-of-range difficulties are ignored rather than crashing a run.
    for (const card of ownedCards) {
        const rungIndex = card.difficulty - 1;
        if (rungIndex >= 0 && rungIndex < rawRungs.length) {
            rawRungs[rungIndex].push({
                id: card.id,
                prompt: card.prompt,
                options: card.options,
                correctIndex: card.correctIndex,
                hint: card.hint ?? '',
            });
        }
    }

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
