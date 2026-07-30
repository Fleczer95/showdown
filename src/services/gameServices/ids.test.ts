import { appleAchievementId, appleLeaderboardId } from './ids';

describe('apple vendor ids', () => {
    it('derives achievement ids from local ids (hyphens → underscores)', () => {
        expect(appleAchievementId('contestant-bronze')).toBe('com.showdown.app.ach.contestant_bronze');
        expect(appleAchievementId('well-rounded')).toBe('com.showdown.app.ach.well_rounded');
    });

    it('derives leaderboard ids from game ids', () => {
        expect(appleLeaderboardId('the-ladder')).toBe('com.showdown.app.lb.the_ladder');
        expect(appleLeaderboardId('the-wheel')).toBe('com.showdown.app.lb.the_wheel');
    });
});
