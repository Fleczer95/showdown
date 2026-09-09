import { drawPrizes, seededIndex } from './draw';

const POOL = ['a-fur', 'b-suit', 'c-accent', 'd-mic'];
const base = {
    editionId: 'halloween-2026',
    pool: POOL,
    winsPerPrize: 13,
    grantedDraws: [] as string[],
    alreadyEarned: [] as string[],
};

test('no draw below the threshold', () => {
    expect(drawPrizes({ ...base, wins: 12 })).toEqual([]);
});

test('one draw at the threshold, identified by draw number', () => {
    const out = drawPrizes({ ...base, wins: 13 });
    expect(out).toHaveLength(1);
    expect(out[0].grantId).toBe('halloween-2026/draw-1');
    expect(POOL).toContain(out[0].rewardId);
});

test('the same player and edition always draw the same sequence', () => {
    const a = drawPrizes({ ...base, wins: 39 });
    const b = drawPrizes({ ...base, wins: 39 });
    expect(a).toEqual(b);
});

// The draw is deliberately NOT keyed on the player: two devices sharing one cloud
// save must compute the same prize for the same draw, or the union merge would
// hand the player two rewards for one milestone.
test('the sequence is fixed per edition but varies between editions', () => {
    const sequence = (editionId: string) =>
        drawPrizes({ ...base, editionId, wins: 52 })
            .map((d) => d.rewardId)
            .join(',');
    expect(sequence('halloween-2026')).toBe(sequence('halloween-2026'));
    const distinct = new Set(Array.from({ length: 20 }, (_, i) => sequence(`edition-${i}`)));
    expect(distinct.size).toBeGreaterThan(1);
});

test('a prize is never drawn twice', () => {
    const out = drawPrizes({ ...base, wins: 52 });
    const ids = out.map((d) => d.rewardId);
    expect(new Set(ids).size).toBe(ids.length);
});

test('an exhausted pool grants nothing and does not throw', () => {
    expect(drawPrizes({ ...base, wins: 130, alreadyEarned: POOL })).toEqual([]);
    expect(drawPrizes({ ...base, wins: 130 })).toHaveLength(POOL.length);
});

test('already-granted draws are skipped, not re-rolled', () => {
    const first = drawPrizes({ ...base, wins: 13 })[0];
    const next = drawPrizes({
        ...base,
        wins: 26,
        grantedDraws: [first.grantId],
        alreadyEarned: [first.rewardId],
    });
    expect(next).toHaveLength(1);
    expect(next[0].grantId).toBe('halloween-2026/draw-2');
    expect(next[0].rewardId).not.toBe(first.rewardId);
});

test('pool declaration order does not change the result', () => {
    const forward = drawPrizes({ ...base, wins: 13 })[0].rewardId;
    const reversed = drawPrizes({ ...base, pool: [...POOL].reverse(), wins: 13 })[0].rewardId;
    expect(reversed).toBe(forward);
});

test('seededIndex stays in range and returns -1 for an empty pool', () => {
    for (let i = 0; i < 50; i++) {
        const n = seededIndex(`seed-${i}`, 4);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(4);
    }
    expect(seededIndex('seed', 0)).toBe(-1);
});
