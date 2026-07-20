import React from 'react';
import {
    Pressable as MockPressable,
    ScrollView,
    StyleSheet,
    Text as MockNativeText,
    TextInput as MockTextInput,
    View as MockView,
} from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { ChallengeScreen } from './ChallengeScreen';
import {
    getChallenge,
    getAttempt,
    getAttempts,
    submitAttempt,
    getRematch,
    createRematch,
} from '../game/challenge/store';
import { countCreatedToday, recordChallenge } from '../game/challenge/log';
import { buildChallenge } from '../game/challenge/build';
import { recordRun } from '../game/progression';
import type { GameRunResult, RecordRunDiff } from '../game/progression';
import type { ChallengeRecord } from '../game/challenge/types';

const mockNavigate = jest.fn();
const mockPush = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        push: mockPush,
        addListener: jest.fn(() => jest.fn()),
        setParams: jest.fn(),
    }),
    useRoute: () => ({ params: { challengeId: 'c1' } }),
    useFocusEffect: () => undefined,
    usePreventRemove: () => undefined,
}));

jest.mock('lucide-react-native', () => ({
    Swords: () => null,
    Crown: () => null,
    Trophy: () => null,
}));

jest.mock('../game/transitions', () => ({
    springEnter: () => undefined,
}));

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../responsive/useResponsive', () => ({
    useResponsive: () => ({ tabletColumn: {}, iconSize: (n: number) => n, scale: (n: number) => n }),
}));

jest.mock('../components/atoms/Text', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockNativeText>{children}</MockNativeText>,
}));

jest.mock('../components/atoms/Stack', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/Card', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/Button', () => ({
    __esModule: true,
    default: ({ children, onPress, disabled, accessibilityLabel }: any) => (
        <MockPressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
        >
            <MockNativeText>{children}</MockNativeText>
        </MockPressable>
    ),
}));

jest.mock('../components/molecules/BottomSheet', () => ({
    __esModule: true,
    default: ({ visible, children }: any) => (visible ? <MockView>{children}</MockView> : null),
}));

jest.mock('../components/molecules/Input', () => ({
    __esModule: true,
    default: ({ value, onChangeText, placeholder }: any) => (
        <MockTextInput value={value} onChangeText={onChangeText} placeholder={placeholder} />
    ),
}));

jest.mock('../theme', () => ({
    useTheme: () => ({
        colors: {
            primary: '#ff00ff',
            secondary: '#00ff00',
            success: '#00ffaa',
            border: '#333333',
            text: '#ffffff',
            textMuted: '#888888',
            textSecondary: '#aaaaaa',
        },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        radii: { sm: 8, md: 12, lg: 16 },
        typography: { sm: 14, lineHeight: { sm: 20 }, fontFamily: {} },
        components: { button: { secondary: { text: '#ffffff' } } },
    }),
}));

jest.mock('../theme/colorUtils', () => ({
    hexToRgba: (color: string) => color,
    readableOn: () => '#ffffff',
    resolveAccent: () => '#ff00ff',
}));

jest.mock('../i18n/TranslationContext', () => ({
    useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../hooks/store/useStore', () => ({
    useStore: () => ({ purchasedItemIds: [], isPremium: false }),
}));

jest.mock('../hooks/useSound', () => ({
    useSound: () => ({ play: jest.fn() }),
}));

jest.mock('../hooks/useHaptics', () => ({
    useHaptics: () => ({ notification: jest.fn(), heavy: jest.fn() }),
}));

jest.mock('../utils/firebase/init', () => ({
    SafeAnalytics: { logEvent: jest.fn() },
}));

jest.mock('../utils/sentry/init', () => ({
    SafeSentry: { captureException: jest.fn(), captureMessage: jest.fn() },
}));

jest.mock('../game/mascot/Mascot', () => ({
    Mascot: () => null,
}));

jest.mock('../game/mascot/reactions/useMascotDirector', () => ({
    useMascotEmit: () => jest.fn(),
}));

jest.mock('../game/challenge/deviceId', () => ({
    getDeviceId: () => 'my-device',
}));

jest.mock('../game/challenge/nickname', () => ({
    getChallengeNickname: () => 'Ada',
    setChallengeNickname: () => true,
}));

jest.mock('../game/challenge/store', () => ({
    getChallenge: jest.fn(),
    getAttempt: jest.fn(),
    getAttempts: jest.fn(),
    submitAttempt: jest.fn(),
    getRematch: jest.fn(),
    createRematch: jest.fn(),
    newChallengeId: jest.fn(() => 'r1'),
    prewarmChallengeAuth: jest.fn(),
    BlockedError: class BlockedError extends Error {},
}));

jest.mock('../game/challenge/log', () => ({
    recordChallenge: jest.fn(),
    markChallengePlayed: jest.fn(),
    markChallengeOpponentPlayed: jest.fn(),
    countCreatedToday: jest.fn(() => 0),
}));

jest.mock('../game/challenge/share', () => ({
    shareChallenge: jest.fn(),
}));

jest.mock('../game/challenge/autoShare', () => ({
    registerAutoShareAfterTransition: jest.fn(() => undefined),
}));

jest.mock('../game/ranking/push', () => ({
    pushRanking: jest.fn(() => Promise.resolve()),
}));

jest.mock('../game/challenge/build', () => ({ buildChallenge: jest.fn() }));
jest.mock('../game/history', () => ({ getHistory: jest.fn(() => ({})) }));
jest.mock('../game/challenge/limit', () => ({ dailyCap: jest.fn(() => 3), canUpsell: jest.fn(() => false) }));
jest.mock('../game/mascot/equippedLook', () => ({ getEquippedLook: jest.fn(() => ({})) }));

jest.mock('../game/challenge/resolve', () => ({
    gateChallenge: jest.fn(() => 'live'),
    missingContentIds: jest.fn(() => []),
    ladderRunFromRecord: jest.fn(() => ({})),
    dropStateFromRecord: jest.fn(() => ({})),
    wheelGameFromRecord: jest.fn(() => ({})),
    ownedQuestionIds: jest.fn(() => new Set<string>()),
}));

const RUN: GameRunResult = { gameId: 'the-ladder', score: 1200, won: false, rungReached: 6 };

// The play screen stand-in exposes a FINISH button that reports the run,
// standing in for ChallengeHandoff at the end of a real run.
jest.mock('../game/ladder/LadderPlayScreen', () => ({
    __esModule: true,
    default: ({ challenge }: any) => (
        <MockPressable onPress={() => challenge.onComplete({ progress: 6, run: RUN })}>
            <MockNativeText>FINISH</MockNativeText>
        </MockPressable>
    ),
}));
jest.mock('../game/drop/DropPlayScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../game/wheel/WheelPlayScreen', () => ({ __esModule: true, default: () => null }));

const DIFF: RecordRunDiff = {
    xpGained: 150,
    lifetimeXp: 500,
    leveledUp: false,
    previousLevel: 3,
    level: 3,
    newRewards: [],
    newAchievements: [],
    bonusRunsGranted: 0,
};

jest.mock('../game/progression', () => ({
    ...jest.requireActual('../game/progression'),
    recordRun: jest.fn(),
}));

jest.mock('../components/molecules/RunCelebration', () => ({
    __esModule: true,
    default: () => null,
    CelebrationCard: () => (
        <MockView>
            <MockNativeText>CELEBRATION</MockNativeText>
            {Array.from({ length: 12 }, (_, index) => (
                <MockNativeText key={index}>{`ACHIEVEMENT ${index + 1}`}</MockNativeText>
            ))}
        </MockView>
    ),
}));

const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-ladder',
    questions: [],
    createdBy: { uuid: 'creator-device', nickname: 'Bob' },
    expiresAt: Date.now() + 86_400_000,
    mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
} as unknown as ChallengeRecord;

const myAttempt = { nickname: 'Ada', progress: 6, score: 1200, timestamp: 111 };
const opponentAttempt = { nickname: 'Bob', progress: 5, score: 900, timestamp: 222 };

async function playThrough(screen: ReturnType<typeof render>) {
    await waitFor(() => screen.getByText('challenge.start'));
    fireEvent.press(screen.getByText('challenge.start'));
    fireEvent.press(await screen.findByText('FINISH'));
}

describe('ChallengeScreen progression', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getChallenge as jest.Mock).mockResolvedValue(record);
        (getAttempts as jest.Mock).mockResolvedValue([myAttempt]);
        (countCreatedToday as jest.Mock).mockReturnValue(0);
        (recordRun as jest.Mock).mockReturnValue(DIFF);
    });

    it('records the run once with the challenge flag and celebrates on the results board', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(null);
        (submitAttempt as jest.Mock).mockResolvedValue(undefined);

        const screen = render(<ChallengeScreen />);
        await playThrough(screen);

        await waitFor(() => screen.getByText('CELEBRATION'));
        expect(recordRun).toHaveBeenCalledTimes(1);
        expect(recordRun).toHaveBeenCalledWith({ ...RUN, challenge: true });
        expect(submitAttempt).toHaveBeenCalledTimes(1);
        const resultsScroll = screen.UNSAFE_getByType(ScrollView);
        expect(StyleSheet.flatten(resultsScroll.props.contentContainerStyle).flexGrow).toBe(1);
        expect(within(resultsScroll).getByText('ACHIEVEMENT 12')).toBeTruthy();
        fireEvent.press(within(resultsScroll).getByLabelText('challenge.viewGlobalRankings'));
        expect(mockNavigate).toHaveBeenCalledWith('Ranking', { gameId: 'the-ladder' });
        expect(within(resultsScroll).getByText('common.home')).toBeTruthy();
    });

    it('keeps the XP on a failed submit and does not re-record on retry', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(null);
        (submitAttempt as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

        const screen = render(<ChallengeScreen />);
        await playThrough(screen);

        // Submit failed offline → retry screen; XP was already recorded.
        await waitFor(() => screen.getByText('challenge.retry'));
        expect(recordRun).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByText('challenge.retry'));
        await waitFor(() => screen.getByText('CELEBRATION'));
        expect(recordRun).toHaveBeenCalledTimes(1);
        expect(submitAttempt).toHaveBeenCalledTimes(2);
    });

    it('does not record or celebrate when reopening an already-played challenge', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(myAttempt);

        const screen = render(<ChallengeScreen />);
        await waitFor(() => screen.getByText('challenge.waiting'));

        expect(recordRun).not.toHaveBeenCalled();
        expect(screen.queryByText('CELEBRATION')).toBeNull();
    });

    it('creates and locally indexes a fresh directed rematch without sharing', async () => {
        const nextRecord = {
            ...record,
            createdBy: { uuid: 'my-device', nickname: 'Ada' },
            expiresAt: Date.now() + 86_400_000,
        };
        (getAttempt as jest.Mock).mockResolvedValue(myAttempt);
        (getAttempts as jest.Mock).mockResolvedValue([myAttempt, opponentAttempt]);
        (getRematch as jest.Mock).mockResolvedValue(null);
        (buildChallenge as jest.Mock).mockReturnValue(nextRecord);
        (createRematch as jest.Mock).mockResolvedValue({
            id: 'r1',
            created: true,
            recipientNickname: 'Bob',
        });

        const screen = render(<ChallengeScreen />);
        fireEvent.press(await screen.findByLabelText('challenge.rematch.actionA11y'));
        fireEvent.press(await screen.findByText('challenge.rematch.confirmAction'));

        await waitFor(() => expect(createRematch).toHaveBeenCalledWith('c1', 'my-device', nextRecord, 'r1'));
        expect(recordChallenge).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'r1',
                role: 'created',
                opponent: 'Bob',
                isRematch: true,
                sourceChallengeId: 'c1',
            }),
        );
        expect(mockPush).toHaveBeenCalledWith('Challenge', { challengeId: 'r1' });
    });

    it('opens the sole existing rematch instead of creating another round', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(myAttempt);
        (getAttempts as jest.Mock).mockResolvedValue([myAttempt, opponentAttempt]);
        (getRematch as jest.Mock).mockResolvedValue({ id: 'r1' });

        const screen = render(<ChallengeScreen />);
        fireEvent.press(await screen.findByLabelText('challenge.rematch.openA11y'));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('Challenge', { challengeId: 'r1' }));
    });

    it('shows a tappable locked CTA only after confirming no rematch exists and the daily cap is reached', async () => {
        (getAttempt as jest.Mock).mockResolvedValue(myAttempt);
        (getAttempts as jest.Mock).mockResolvedValue([myAttempt, opponentAttempt]);
        (getRematch as jest.Mock).mockResolvedValue(null);
        (countCreatedToday as jest.Mock).mockReturnValue(3);

        const screen = render(<ChallengeScreen />);

        expect(await screen.findByLabelText('challenge.rematch.limitA11y')).toBeTruthy();
    });
});
