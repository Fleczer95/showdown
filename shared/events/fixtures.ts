import type { EventEdition } from './definitions';
import { HALLOWEEN_CONTENT_REVISION, HALLOWEEN_V1_CONTENT_REVISION } from './halloween';

/** Original local fixture stays resolvable so its existing saved runs are not reinterpreted. */
export const testEventEdition: EventEdition = {
    id: 'local-event-fixture',
    enabled: true,
    name: { en: 'Local test event', pl: 'Lokalne wydarzenie testowe' },
    startsAt: Date.UTC(2026, 0, 1),
    endsAt: Date.UTC(2036, 0, 1),
    accent: '#F97316',
    activities: [{ game: 'the-ladder', contentRevision: 'local-ladder-v1' }],
    allowance: { base: 3, perPaidItem: 1, premium: 10 },
    milestones: [{ id: 'first-run', completedRuns: 1, rewardId: 'theme-champion' }],
};
/** Dedicated questions, but test-only dates and Champion prize. NEVER a production edition. */
export const halloweenV1PreviewEdition: EventEdition = {
    ...testEventEdition,
    id: 'local-halloween-preview',
    name: { en: 'Halloween · preview', pl: 'Halloween · podgląd' },
    activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_V1_CONTENT_REVISION }],
};
/** New identity prevents revised activity content from changing old admissions. */
export const halloweenPreviewEdition: EventEdition = {
    ...halloweenV1PreviewEdition,
    id: 'local-halloween-preview-v2',
    artwork: 'pumpkin',
    activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
};

export const testEventQuestions = Array.from({ length: 15 }, (_, i) => ({
    id: `local-event-rung-${i + 1}-a`,
    alternates: [`local-event-rung-${i + 1}-b`],
}));
