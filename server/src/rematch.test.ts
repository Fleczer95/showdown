import { resolveRematchRecipient } from './rematch';

const ada = { uuid: 'ada', nickname: 'Ada' };
const bob = { uuid: 'bob', nickname: 'Bob' };

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
