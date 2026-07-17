import React from 'react';
import { Modal, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import en from '../../../i18n/locales/en.json';
import { recordRun, type GameRunResult, type RecordRunDiff } from '../../../game/progression';
import { ConfettiOverlayProvider } from '../../../animations/ConfettiOverlay';
import { acceptReview } from '../../../services/review/reviewPrompt';
import RunCelebration from '../RunCelebration';

// recordRun is the impure persistence seam; stub it so the card renders a known
// diff without touching storage.
jest.mock('../../../game/progression', () => ({
    ...jest.requireActual('../../../game/progression'),
    recordRun: jest.fn(),
}));

jest.mock('../../../services/review/reviewPrompt', () => ({
    ...jest.requireActual('../../../services/review/reviewPrompt'),
    acceptReview: jest.fn(),
}));

// Confetti draws via Skia (not fully mocked in jest); stub it to a no-op.
jest.mock('../../../animations/Confetti', () => () => null);

// Avoid pulling the real Firebase analytics chain.
jest.mock('../../../utils/firebase/init', () => ({
    SafeAnalytics: { logEvent: jest.fn() },
}));

const result = { gameId: 'the-ladder' } as unknown as GameRunResult;
const originalPlatform = Platform.OS;

function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function renderWith(diff: RecordRunDiff) {
    (recordRun as jest.Mock).mockReturnValue(diff);
    return render(
        <ThemeProvider>
            <ConfettiOverlayProvider>
                <TranslationProvider>
                    <RunCelebration result={result} accent='#34D399' />
                </TranslationProvider>
            </ConfettiOverlayProvider>
        </ThemeProvider>,
    );
}

describe('RunCelebration', () => {
    beforeEach(() => jest.clearAllMocks());

    afterEach(() => {
        setPlatform(originalPlatform as 'ios' | 'android');
        jest.useRealTimers();
    });

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

    it('keeps the level-five review prompt as the only native modal', () => {
        jest.useFakeTimers();
        const view = renderWith({
            xpGained: 600,
            lifetimeXp: 1000,
            leveledUp: true,
            previousLevel: 4,
            level: 5,
            newRewards: [],
            newAchievements: [
                'challenger-bronze',
                'contestant-bronze',
                'on-a-roll-bronze',
                'well-rounded',
                'quick-wit',
            ],
            bonusRunsGranted: 0,
        });

        expect(view.UNSAFE_getAllByType(Modal)).toHaveLength(1);
        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);

        act(() => jest.advanceTimersByTime(3000));

        expect(view.UNSAFE_getAllByType(Modal)).toHaveLength(1);
        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
    });

    it('waits for native prompt dismissal before handing off to StoreKit', () => {
        jest.useFakeTimers();
        setPlatform('ios');
        const view = renderWith({
            xpGained: 600,
            lifetimeXp: 1000,
            leveledUp: true,
            previousLevel: 4,
            level: 5,
            newRewards: [],
            newAchievements: [],
            bonusRunsGranted: 0,
        });

        act(() => jest.advanceTimersByTime(3000));
        fireEvent.press(view.getByLabelText('Rate 5 of 5 stars', { includeHiddenElements: true }));
        act(() => jest.advanceTimersByTime(280));

        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
        expect(acceptReview).not.toHaveBeenCalled();

        act(() => view.UNSAFE_getByType(Modal).props.onDismiss());
        expect(acceptReview).toHaveBeenCalledTimes(1);
    });
});
