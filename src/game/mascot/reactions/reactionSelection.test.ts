import { pickLine } from './reactionSelection';

describe('pickLine', () => {
    it('never repeats a recent key when alternatives exist', () => {
        const recent = ['mascot.runWon.1', 'mascot.runWon.2', 'mascot.runWon.3'];
        const key = pickLine('run-won', { recent, rand: () => 0 });
        expect(recent).not.toContain(key);
        expect(key).toBe('mascot.runWon.4');
    });

    it('falls back to full pool when everything is recent', () => {
        const recent = ['mascot.clutch.1'];
        const key = pickLine('clutch', { recent, rand: () => 0 });
        expect(key).toBe('mascot.clutch.1');
    });

    it('escalates by count threshold', () => {
        expect(pickLine('streak', { recent: [], count: 3 })).toBe('mascot.streak.tier1');
        expect(pickLine('streak', { recent: [], count: 6 })).toBe('mascot.streak.tier2');
        expect(pickLine('streak', { recent: [], count: 25 })).toBe('mascot.streak.tier3');
    });

    it('escalation below the first threshold uses the base pool', () => {
        expect(pickLine('streak', { recent: [], count: 2, rand: () => 0 })).toBe('mascot.streak.1');
    });
});
