import { appleAchievementId, appleLeaderboardId } from './ids';
import { PLAY_GAMES_ACHIEVEMENT_IDS, PLAY_GAMES_LEADERBOARD_IDS } from './playIds.generated';
import { ACHIEVEMENTS } from '../../game/progression/achievements';
import { RANKED_GAMES } from '../../game/ranking/config';

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

// Google's ids are opaque and provisioned by hand, so nothing but a test connects
// them to the local ones. Adding an achievement family without re-running the
// provisioning script would otherwise fail silently at runtime: `sync` skips any
// id it can't map, so the new achievement simply never unlocks on Android.
describe('play games id parity', () => {
    it('maps every local achievement, and nothing more', () => {
        const local = ACHIEVEMENTS.map((a) => a.id).sort();
        expect(Object.keys(PLAY_GAMES_ACHIEVEMENT_IDS).sort()).toEqual(local);
    });

    it('maps every ranked game to a leaderboard', () => {
        expect(Object.keys(PLAY_GAMES_LEADERBOARD_IDS).sort()).toEqual([...RANKED_GAMES].sort());
    });
});
