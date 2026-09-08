import { restoredReveals, type DropCheckpoint } from './checkpoints';

const checkpoint = (allocation: number[]): DropCheckpoint =>
    ({
        state: { round: 0, questions: [{ id: 'q', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 2 }] },
        allocation,
        speed: 0,
    }) as unknown as DropCheckpoint;

test('a resumed reveal drops only the options the player staked', () => {
    // Covered one wrong option (index 1); 0 and 3 were never staked.
    expect(restoredReveals(checkpoint([0, 50, 100, 0]))).toEqual(['none', 'drop', 'win', 'none']);
});

test('a resumed reveal drops every wrong option the player did cover', () => {
    expect(restoredReveals(checkpoint([25, 25, 25, 25]))).toEqual(['drop', 'drop', 'win', 'drop']);
});
