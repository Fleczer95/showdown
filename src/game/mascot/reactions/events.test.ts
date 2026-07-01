import { isGameplayEvent, type MascotEvent } from './events';

describe('events', () => {
    it('classifies gameplay events', () => {
        expect(isGameplayEvent('run-won')).toBe(true);
        expect(isGameplayEvent('clutch')).toBe(true);
        expect(isGameplayEvent('home-focus')).toBe(false);
        expect(isGameplayEvent('level-up')).toBe(false);
    });

    it('MascotEvent shape carries scope + timestamp', () => {
        const e: MascotEvent = {
            name: 'run-won',
            scope: { surface: 'game', roundId: 'r1', navSeq: 3 },
            ctx: { gameId: 'ladder', streak: 5 },
            at: 1000,
        };
        expect(e.scope.roundId).toBe('r1');
    });
});
