import { findActiveRematch, resolveRematchRecipient } from './rematch';

const ada = { uuid: 'ada', nickname: 'Ada' };
const bob = { uuid: 'bob', nickname: 'Bob' };

it('finds an active successor through the canonical rematch query', async () => {
    const first = jest.fn().mockResolvedValue({ id: 'r1' });
    const bind = jest.fn(() => ({ first }));
    const prepare = jest.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;

    await expect(findActiveRematch(db, 'source-1', 1234)).resolves.toEqual({ id: 'r1' });
    expect(prepare).toHaveBeenCalledWith('SELECT id FROM challenges WHERE rematchOf = ? AND expiresAt > ?');
    expect(bind).toHaveBeenCalledWith('source-1', 1234);
});

it('returns the sole other participant in a completed 1:1 round', () => {
    expect(resolveRematchRecipient([ada, bob], 'ada')).toEqual(bob);
    expect(resolveRematchRecipient([ada, bob], 'bob')).toEqual(ada);
});

it.each([
    ['a waiting round', [ada], 'ada'],
    ['a group round', [ada, bob, { uuid: 'cara', nickname: 'Cara' }], 'ada'],
    ['a sender who did not complete the source', [ada, bob], 'cara'],
] as const)('rejects %s', (_label, participants, sender) => {
    expect(resolveRematchRecipient(participants, sender)).toBeNull();
});
