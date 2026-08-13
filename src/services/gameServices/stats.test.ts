import { runCompletedEvent, progressUpdateEvent, reportRunStats } from './stats';
import { defaultStats } from '../../game/progression/defaults';

jest.mock('../../../modules/game-services', () => ({
    recordStatsEvent: jest.fn().mockResolvedValue(true),
}));

const native = jest.requireMock('../../../modules/game-services');

describe('runCompletedEvent', () => {
    it('carries the properties every console stat aggregates over', () => {
        const event = runCompletedEvent({
            gameId: 'the-ladder',
            score: 12000,
            won: true,
            rungReached: 15,
            lifelinesUsed: 0,
            challenge: false,
        });

        expect(event.name).toBe('runCompleted');
        expect(event.properties).toEqual({
            gameId: 'the-ladder',
            score: 12000,
            isWinner: true,
            rungReached: 15,
            lifelinesUsed: 0,
            isChallenge: false,
        });
    });

    it('defaults the optional per-game facts so the console schema always matches', () => {
        const event = runCompletedEvent({ gameId: 'the-drop', score: 900, won: false });

        expect(event.properties.rungReached).toBe(0);
        expect(event.properties.lifelinesUsed).toBe(0);
        expect(event.properties.isChallenge).toBe(false);
    });

    it('marks challenge runs so the Challenges stat can filter on them', () => {
        const event = runCompletedEvent({ gameId: 'the-wheel', score: 5000, won: true, challenge: true });
        expect(event.properties.isChallenge).toBe(true);
    });
});

describe('progressUpdateEvent', () => {
    it('reports the current level as currentProgress', () => {
        const event = progressUpdateEvent({ ...defaultStats(), lifetimeXp: 3600 });

        expect(event.name).toBe('progressUpdate');
        expect(event.properties.currentProgress).toBe(8);
    });

    it('reports level 1 for a fresh player', () => {
        expect(progressUpdateEvent(defaultStats()).properties.currentProgress).toBe(1);
    });
});

describe('reportRunStats', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends both events for one finished run', async () => {
        await reportRunStats({ gameId: 'the-ladder', score: 8000, won: true }, { ...defaultStats(), lifetimeXp: 400 });

        expect(native.recordStatsEvent).toHaveBeenCalledTimes(2);
        expect(native.recordStatsEvent).toHaveBeenCalledWith('runCompleted', expect.objectContaining({ score: 8000 }));
        expect(native.recordStatsEvent).toHaveBeenCalledWith('progressUpdate', { currentProgress: 3 });
    });
});
