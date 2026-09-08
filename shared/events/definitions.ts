import type { ChallengeGameId } from '../challenge/contract';
import { testEventEdition, halloweenPreviewEdition, halloweenV1PreviewEdition } from './fixtures';
import { HALLOWEEN_CONTENT_REVISION } from './halloween';

export const EVENT_UPLOAD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export interface EventActivity {
    game: ChallengeGameId;
    contentRevision: string;
}
export interface EventEdition {
    id: string;
    enabled: boolean;
    name: { en: string; pl: string };
    startsAt?: number;
    endsAt?: number;
    accent?: string;
    artwork?: 'pumpkin';
    /** Home promotion only; does not extend admissions, play or upload deadlines. */
    discoveryWindow?: { beforeDays: number; afterDays: number };
    activities: readonly EventActivity[];
    allowance: { base: number; perPaidItem: number; premium: number };
    /** Wins required per prize draw. The ladder repeats: 13, 26, 39, … */
    winsPerPrize: number;
    /** Reward ids this edition can award, drawn without replacement. */
    prizePool: readonly string[];
}
export interface EventMembership {
    editionId: string;
    contentRevision: string;
    mode: 'friend' | 'random';
    endsAt: number;
}

const HALLOWEEN_PRIZE_POOL = [
    'mascot-fur-pumpkin',
    'mascot-fur-blackcat',
    'mascot-suit-witch',
    'mascot-accent-slime',
    'mascot-accent-blood',
    'mascot-mic-bone',
    'theme-haunt',
] as const;

export const eventEditions: readonly EventEdition[] = [
    {
        id: 'halloween-2026',
        enabled: false,
        name: { en: 'Halloween', pl: 'Halloween' },
        accent: '#F97316',
        artwork: 'pumpkin',
        activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
        allowance: { base: 3, perPaidItem: 1, premium: 10 },
        winsPerPrize: 13,
        prizePool: HALLOWEEN_PRIZE_POOL,
    },
    // INTERNAL TRACK ONLY. Delete before the public release that enables
    // halloween-2026 — the tripwire test in events.test.ts enforces it.
    // Containment is by binary: the Worker validates whatever definitions file
    // it was deployed with, and it is shared by the internal and public apps,
    // so no server-side flag could separate them.
    {
        id: 'halloween-2026-rehearsal',
        enabled: true,
        name: { en: 'Halloween', pl: 'Halloween' },
        startsAt: Date.UTC(2026, 8, 1),
        endsAt: Date.UTC(2026, 11, 31),
        accent: '#F97316',
        artwork: 'pumpkin',
        activities: [{ game: 'the-ladder', contentRevision: HALLOWEEN_CONTENT_REVISION }],
        allowance: { base: 3, perPaidItem: 1, premium: 10 },
        winsPerPrize: 13,
        prizePool: HALLOWEEN_PRIZE_POOL,
    },
];

export function eventLifecycle(edition: EventEdition, now: number): 'draft' | 'upcoming' | 'active' | 'closed' {
    if (!edition.enabled || !Number.isFinite(edition.startsAt) || !Number.isFinite(edition.endsAt)) return 'draft';
    if (now < edition.startsAt!) return 'upcoming';
    return now < edition.endsAt! ? 'active' : 'closed';
}

/** Drafts may omit launch data. Enabled editions must be complete and resolvable. */
export function validateEdition(
    edition: EventEdition,
    hasContent: (activity: EventActivity) => boolean,
    hasReward: (id: string) => boolean,
): string[] {
    const errors: string[] = [];
    if (!/^[a-z0-9-]+$/.test(edition.id)) errors.push('id');
    if (!edition.name.en || !edition.name.pl) errors.push('name');
    if (
        edition.discoveryWindow &&
        Object.values(edition.discoveryWindow).some(
            (days) => !Number.isSafeInteger(days) || days < 0 || !Number.isSafeInteger(days * 86400000),
        )
    )
        errors.push('discovery window');
    if (Object.values(edition.allowance).some((n) => !Number.isSafeInteger(n) || n < 0)) errors.push('allowance');
    if (
        !Number.isSafeInteger(edition.winsPerPrize) ||
        edition.winsPerPrize < 1 ||
        new Set(edition.prizePool).size !== edition.prizePool.length ||
        edition.prizePool.some((id) => !hasReward(id)) ||
        (edition.enabled && edition.prizePool.length === 0)
    )
        errors.push('prizes');
    if (edition.enabled) {
        if (
            !Number.isSafeInteger(edition.startsAt) ||
            !Number.isSafeInteger(edition.endsAt) ||
            edition.startsAt! >= edition.endsAt!
        )
            errors.push('schedule');
        if (!edition.activities.length || edition.activities.some((a) => !hasContent(a))) errors.push('content');
    }
    if (new Set(edition.activities.map((a) => `${a.game}:${a.contentRevision}`)).size !== edition.activities.length)
        errors.push('activities');
    return errors;
}

export function eventDailyCap(edition: EventEdition, paidItems: number, premium: boolean): number {
    return (
        edition.allowance.base + paidItems * edition.allowance.perPaidItem + (premium ? edition.allowance.premium : 0)
    );
}
export function findEdition(id: string, includeTestFixture = false): EventEdition | undefined {
    return (
        eventEditions.find((e) => e.id === id) ??
        (includeTestFixture
            ? [testEventEdition, halloweenV1PreviewEdition, halloweenPreviewEdition].find((e) => e.id === id)
            : undefined)
    );
}
export function playDeadline(record: { expiresAt: number; event?: EventMembership }): number {
    return record.event?.endsAt ?? record.expiresAt;
}
