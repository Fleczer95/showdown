import { surfaceForRoute } from './emit';

describe('surfaceForRoute', () => {
    it('maps known routes to surfaces', () => {
        expect(surfaceForRoute('Home')).toBe('home');
        expect(surfaceForRoute('Store')).toBe('store');
        expect(surfaceForRoute('Challenge')).toBe('challenge');
        expect(surfaceForRoute('ChallengeHistory')).toBe('challenge');
        expect(surfaceForRoute('Mascot')).toBe('mascot');
    });

    it('maps play/game routes to the game surface', () => {
        expect(surfaceForRoute('ladder-play')).toBe('game');
        expect(surfaceForRoute('WheelPlay')).toBe('game');
    });

    it('falls back to other', () => {
        expect(surfaceForRoute('Settings')).toBe('other');
        expect(surfaceForRoute('SomethingElse')).toBe('other');
    });
});
