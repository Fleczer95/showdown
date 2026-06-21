import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import en from '../../../i18n/locales/en.json';
import { recordRun, type GameRunResult, type RecordRunDiff } from '../../../game/progression';
import RunCelebration from '../RunCelebration';

// recordRun is the impure persistence seam; stub it so the card renders a known
// diff without touching storage.
jest.mock('../../../game/progression', () => ({
    ...jest.requireActual('../../../game/progression'),
    recordRun: jest.fn(),
}));

// Confetti draws via Skia (not fully mocked in jest); stub it to a no-op.
jest.mock('../../../animations/Confetti', () => () => null);

// Avoid pulling the real Firebase analytics chain.
jest.mock('../../../utils/firebase/init', () => ({
    SafeAnalytics: { logEvent: jest.fn() },
}));

const result = { gameId: 'the-ladder' } as unknown as GameRunResult;

function renderWith(diff: RecordRunDiff) {
    (recordRun as jest.Mock).mockReturnValue(diff);
    return render(
        <ThemeProvider>
            <TranslationProvider>
                <RunCelebration result={result} accent='#34D399' />
            </TranslationProvider>
        </ThemeProvider>,
    );
}

describe('RunCelebration', () => {
    beforeEach(() => jest.clearAllMocks());

    it('records the finished run exactly once', () => {
        renderWith({
            xpGained: 200,
            lifetimeXp: 500,
            leveledUp: false,
            previousLevel: 3,
            level: 3,
            newRewards: [],
            newAchievements: [],
            bonusRunsGranted: 0,
        });
        expect(recordRun).toHaveBeenCalledTimes(1);
        expect(recordRun).toHaveBeenCalledWith(result);
    });

    it('reveals an earned gift on a level-up run', () => {
        const { getByText } = renderWith({
            xpGained: 600,
            lifetimeXp: 22000, // Champion theme threshold (level 15)
            leveledUp: true,
            previousLevel: 14,
            level: 15,
            newRewards: ['theme-champion'],
            newAchievements: [],
            bonusRunsGranted: 9,
        });
        // Stack wraps content with importantForAccessibility="no-hide-descendants",
        // so opt into hidden elements when matching by text. (The level-up label
        // styling appears only after the bar's animated rollover, which is not
        // deterministic under jest, so it isn't asserted here.)
        const opts = { includeHiddenElements: true };
        expect(getByText(en.progression.themes.champion, opts)).toBeTruthy();
        expect(getByText(en.progression.newReward, opts)).toBeTruthy();
    });

    it('renders no gift reveal when nothing was earned', () => {
        const { queryByText } = renderWith({
            xpGained: 120,
            lifetimeXp: 800,
            leveledUp: false,
            previousLevel: 4,
            level: 4,
            newRewards: [],
            newAchievements: [],
            bonusRunsGranted: 0,
        });
        const opts = { includeHiddenElements: true };
        expect(queryByText(en.progression.newReward, opts)).toBeNull();
        expect(queryByText(en.progression.newSignature, opts)).toBeNull();
    });
});
