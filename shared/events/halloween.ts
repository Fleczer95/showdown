import type { ChallengeQuestion } from '../challenge/contract';

/** Never reinterpret the already-admitted v1 preview challenges. */
export const HALLOWEEN_V1_CONTENT_REVISION = 'halloween-2026-v1';
/** Current reviewed revision; keep older revisions available for retained challenges. */
export const HALLOWEEN_CONTENT_REVISION = 'halloween-2026-v2';

/**
 * Five themed groups, each with four questions at every rung: 300 unique IDs.
 * Only this ID manifest goes to the Worker, never the bilingual answer bank.
 * The content tests enforce that every ID resolves at its declared difficulty.
 */
export const halloweenQuestions: readonly ChallengeQuestion[] = Array.from({ length: 15 }, (_, rung) => {
    const ids = Array.from({ length: 5 }, (_, group) =>
        Array.from(
            { length: 4 },
            (_, item) => `halloween-2026-${String(group * 60 + rung * 4 + item + 1).padStart(3, '0')}`,
        ),
    ).flat();
    return { id: ids[0], alternates: ids.slice(1) };
});
