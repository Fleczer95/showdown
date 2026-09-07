import { RUNGS } from '../ladder/content';
import type { LadderQuestion } from '../ladder/logic';
import type { ChallengeLocale, ChallengeRecord } from '../challenge/types';
import { testEventQuestions } from '../../../shared/events/fixtures';
import { eventContent } from '../../../shared/events/content';
import { HALLOWEEN_CONTENT_REVISION, HALLOWEEN_V1_CONTENT_REVISION } from '../../../shared/events/halloween';
import halloweenV1 from '../../../assets/events/halloween-2026/ladder.json';
import halloween from '../../../assets/events/halloween-2026/ladder-v2.json';

/** Resolve retained revisions explicitly; never fall back to a different pool. */
export function eventLadderIndex(revision: string, locale: ChallengeLocale): Map<string, LadderQuestion> {
    const index = new Map<string, LadderQuestion>();
    if (revision === HALLOWEEN_CONTENT_REVISION || revision === HALLOWEEN_V1_CONTENT_REVISION) {
        const bank = revision === HALLOWEEN_CONTENT_REVISION ? halloween : halloweenV1;
        for (const q of bank.questions) {
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
    return index;
}

export function eventQuestions(revision: string): ChallengeRecord['questions'] {
    const pool = eventContent[revision];
    if (!pool) throw new Error('Unsupported event content');
    return pool.map((q) => {
        const ids = [q.id, ...(q.alternates ?? [])];
        // Sample from the entire rung, not just its first six entries. Freeze the
        // sampled order in the pending intent; the contract allows five alternates.
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        return { id: ids[0], alternates: ids.slice(1, 6) };
    });
}
