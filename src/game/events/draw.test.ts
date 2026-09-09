import { drawPrizes } from './draw';

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

test('the same edition always draws the same sequence', () => {
    const a = drawPrizes({ ...base, wins: 39 });
    const b = drawPrizes({ ...base, wins: 39 });
    expect(a).toEqual(b);
});

// The draw is deliberately NOT keyed on the player: two devices sharing one cloud
// save must pick the same prize for the same draw, or the union merge would hand
// the player two rewards for one milestone.
test("prizes are awarded in the pool's declared order", () => {
    const out = drawPrizes({ ...base, wins: 52 }).map((d) => d.rewardId);
    expect(out).toEqual(POOL);
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

test('reordering the pool reorders the ladder', () => {
    expect(drawPrizes({ ...base, wins: 13 })[0].rewardId).toBe(POOL[0]);
    const reversed = [...POOL].reverse();
    expect(drawPrizes({ ...base, pool: reversed, wins: 13 })[0].rewardId).toBe(reversed[0]);
});
