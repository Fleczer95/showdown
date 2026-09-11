import { MAX_SYNC_IDS, RANKED_GAMES, isWritablePeriod, parseBoundedSyncIds } from './validation';
import { eventEditions } from '../../shared/events/definitions';
import { halloweenPreviewEdition } from '../../shared/events/fixtures';

it.each([
    ['sourceChallengeIds', { uuid: 'mine', sourceChallengeIds: ['c1', 'c2'] }, ['c1', 'c2']],
    ['challengeIds', { uuid: 'mine', challengeIds: ['c1'] }, ['c1']],
] as const)('parses a bounded %s sync payload', (field, body, ids) => {
    expect(parseBoundedSyncIds(body, field)).toEqual({ uuid: 'mine', ids });
});

it.each([
    ['missing body', null],
    ['invalid uuid', { uuid: '', challengeIds: ['c1'] }],
    ['missing id array', { uuid: 'mine' }],
    ['invalid id', { uuid: 'mine', challengeIds: [''] }],
    ['too many ids', { uuid: 'mine', challengeIds: Array.from({ length: MAX_SYNC_IDS + 1 }, (_, i) => `c${i}`) }],
] as const)('rejects %s', (_label, body) => {
    expect(parseBoundedSyncIds(body, 'challengeIds')).toBeNull();
});

// --- Ranking periods -------------------------------------------------------

const RANKED_GAME = 'the-ladder';

it('accepts alltime and the current UTC month, and nothing else that looks like a month', () => {
    const now = Date.UTC(2026, 9, 15);
    expect(isWritablePeriod('alltime', RANKED_GAME, now)).toBe(true);
    expect(isWritablePeriod('2026-10', RANKED_GAME, now)).toBe(true);
    expect(isWritablePeriod('2026-09', RANKED_GAME, now)).toBe(false);
    expect(isWritablePeriod('2026-11', RANKED_GAME, now)).toBe(false);
    expect(isWritablePeriod('not-a-period', RANKED_GAME, now)).toBe(false);
});

// Asserted over whatever editions ship rather than a named one, so changing the
// shipped window before a public release cannot quietly hollow this out.
it.each(eventEditions.map((edition) => [edition.id, edition] as const))(
    'gates writes to the %s board on its own lifecycle',
    (_id, edition) => {
        const dated = Number.isFinite(edition.startsAt) && Number.isFinite(edition.endsAt);
        const game = edition.activities[0].game;
        if (!edition.enabled || !dated) {
            // A draft edition has no board at all, at any instant.
            expect(isWritablePeriod(edition.id, game, Date.now())).toBe(false);
            return;
        }
        const mid = (edition.startsAt! + edition.endsAt!) / 2;
        expect(isWritablePeriod(edition.id, game, mid)).toBe(true);
        // Standings freeze the moment the edition closes — no job, no flag.
        expect(isWritablePeriod(edition.id, game, edition.endsAt!)).toBe(false);
        expect(isWritablePeriod(edition.id, game, edition.startsAt! - 1)).toBe(false);
        // A board belongs to its activity: another game may not write into it.
        const other = RANKED_GAMES.find((g) => !edition.activities.some((a) => a.game === g));
        if (other) expect(isWritablePeriod(edition.id, other, mid)).toBe(false);
    },
);

it('refuses a development fixture edition on the real backend', () => {
    expect(isWritablePeriod(halloweenPreviewEdition.id, RANKED_GAME, Date.now())).toBe(false);
});
