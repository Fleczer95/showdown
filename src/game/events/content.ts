import { RUNGS } from '../ladder/content';
import { shuffle } from '../deck';
import type { LadderQuestion } from '../ladder/logic';
import type { ChallengeLocale, ChallengeRecord } from '../challenge/types';
import { testEventQuestions } from '../../../shared/events/fixtures';
import { eventContent } from '../../../shared/events/content';
import { HALLOWEEN_CONTENT_REVISION, HALLOWEEN_V1_CONTENT_REVISION } from '../../../shared/events/halloween';

interface BilingualCard {
    id: string;
    prompt: Record<string, string>;
    options: Record<string, string>[];
    correctIndex: number;
    hint: Record<string, string>;
}

// The two banks are ~370 KB each. Requiring them inside the branch keeps them out
// of the eager startup graph, so players who never open an event never parse them.
function halloweenBank(revision: string): { questions: BilingualCard[] } {
    return revision === HALLOWEEN_CONTENT_REVISION
        ? require('../../../assets/events/halloween-2026/ladder-v2.json')
        : require('../../../assets/events/halloween-2026/ladder.json');
}

// Banks are immutable and callers only read from the index, so build each
// revision+locale once instead of on every lookup.
const indexCache = new Map<string, Map<string, LadderQuestion>>();

/** Resolve retained revisions explicitly; never fall back to a different pool. */
export function eventLadderIndex(revision: string, locale: ChallengeLocale): Map<string, LadderQuestion> {
    const cacheKey = `${revision}:${locale}`;
    const cached = indexCache.get(cacheKey);
    if (cached) return cached;
    const index = new Map<string, LadderQuestion>();
    if (revision === HALLOWEEN_CONTENT_REVISION || revision === HALLOWEEN_V1_CONTENT_REVISION) {
        for (const q of halloweenBank(revision).questions) {
            index.set(q.id, {
                id: q.id,
                prompt: q.prompt[locale],
                options: q.options.map((o) => o[locale]),
                correctIndex: q.correctIndex,
                hint: q.hint[locale],
            });
        }
    } else if (revision === 'local-ladder-v1') {
        // Preserve the original isolated fixture and its already-saved challenges.
        testEventQuestions.forEach((row, rung) => {
            [row.id, ...row.alternates].forEach((id, alternate) => {
                const q = RUNGS[rung][alternate];
                index.set(id, {
                    id,
                    prompt: q.question[locale],
                    options: q.options.map((o) => o[locale]),
                    correctIndex: q.correctIndex,
                    hint: q.hint[locale],
                });
            });
        });
    }
    indexCache.set(cacheKey, index);
    return index;
}

export function eventQuestions(revision: string): ChallengeRecord['questions'] {
    const pool = eventContent[revision];
    if (!pool) throw new Error('Unsupported event content');
    return pool.map((q) => {
        // Sample from the entire rung, not just its first six entries. Freeze the
        // sampled order in the pending intent; the contract allows five alternates.
        const ids = shuffle([q.id, ...(q.alternates ?? [])]);
        return { id: ids[0], alternates: ids.slice(1, 6) };
    });
}
