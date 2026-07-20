import { MAX_SYNC_IDS, parseBoundedSyncIds } from './validation';

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
