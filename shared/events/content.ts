import type { ChallengeQuestion, ChallengeRecord } from '../challenge/contract';
import { testEventQuestions } from './fixtures';
import { halloweenQuestions, HALLOWEEN_CONTENT_REVISION, HALLOWEEN_V1_CONTENT_REVISION } from './halloween';

/** Immutable frozen-id manifests. Add production pools only after content review. */
export const eventContent: Readonly<Record<string, readonly ChallengeQuestion[]>> = {
    'local-ladder-v1': testEventQuestions,
    [HALLOWEEN_V1_CONTENT_REVISION]: halloweenQuestions,
    [HALLOWEEN_CONTENT_REVISION]: halloweenQuestions,
};
export function validEventQuestions(record: ChallengeRecord): boolean {
    if (!record.event) return false;
    const pool = eventContent[record.event.contentRevision];
    if (!pool || pool.length !== 15 || record.game !== 'the-ladder' || record.questions.length !== 15) return false;
    return record.questions.every((question, index) => {
        const ids = new Set([pool[index].id, ...(pool[index].alternates ?? [])]);
        const selected = [question.id, ...(question.alternates ?? [])];
        return (
            selected.length >= 2 && new Set(selected).size === selected.length && selected.every((id) => ids.has(id))
        );
    });
}
