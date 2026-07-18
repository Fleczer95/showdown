import React from 'react';
import {
    Alert,
    Pressable as MockPressable,
    Text as MockNativeText,
    TextInput as MockTextInput,
    View as MockView,
} from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GameSetupScreen } from './GameSetupScreen';
import { buildChallenge } from '../game/challenge/build';
import { ensureChallengeCreated, getChallenge, newChallengeId, prewarmChallengeAuth } from '../game/challenge/store';
import type { ChallengeRecord } from '../game/challenge/types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockLeaderboard = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => ({ params: { gameId: 'the-drop' } }),
    useFocusEffect: () => undefined,
    usePreventRemove: () => undefined,
}));

jest.mock('@xstate/react', () => ({
    useMachine: () => [{ matches: () => false }, jest.fn()],
}));

jest.mock('lucide-react-native', () => ({
    ChevronLeft: () => null,
    Play: () => null,
    Trophy: () => null,
    Swords: () => null,
    Sparkles: () => null,
    Lock: () => null,
}));

jest.mock('react-native-svg', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    const Node = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
    return {
        __esModule: true,
        default: Node,
        Defs: Node,
        LinearGradient: Node,
        Stop: Node,
        Rect: Node,
    };
});

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/atoms/Text', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockNativeText>{children}</MockNativeText>,
}));

jest.mock('../components/atoms/Stack', () => ({
    __esModule: true,
    default: ({ children, style }: { children?: React.ReactNode; style?: object }) => (
        <MockView style={style}>{children}</MockView>
    ),
}));

jest.mock('../components/atoms/Icon', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../components/atoms/Glyph', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../components/molecules/IconButton', () => ({
    __esModule: true,
    default: ({ onPress, disabled, accessibilityLabel }: any) => (
        <MockPressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
        />
    ),
}));

jest.mock('../components/molecules/Button', () => ({
    __esModule: true,
    default: ({ children, onPress, disabled, loading, accessibilityLabel }: any) => (
        <MockPressable
            onPress={disabled || loading ? undefined : onPress}
            disabled={disabled || loading}
            accessibilityLabel={accessibilityLabel}
        >
            <MockNativeText>{children}</MockNativeText>
        </MockPressable>
    ),
}));

jest.mock('../components/molecules/Card', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/ProgressBar', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../components/molecules/Input', () => ({
    __esModule: true,
    default: ({ value, onChangeText, placeholder, onSubmitEditing, editable }: any) => (
        <MockTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            onSubmitEditing={onSubmitEditing}
            editable={editable}
        />
    ),
}));

jest.mock('../components/molecules/Leaderboard', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockLeaderboard(props);
        return null;
    },
}));

// This test double models the iOS contract that matters to GameSetupScreen:
// children disappear first, then Modal.onDismiss confirms the native presenter
// has gone away. BottomSheet's own tests cover that native callback wiring.
jest.mock('../components/molecules/BottomSheet', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

    function MockBottomSheet({ visible, title, children, onDismissComplete }: any) {
        const previouslyVisible = React.useRef(visible);
        React.useEffect(() => {
            if (previouslyVisible.current && !visible) onDismissComplete?.();
            previouslyVisible.current = visible;
        }, [visible, onDismissComplete]);

        return visible ? (
            <View>
                <Text>{title}</Text>
                {children}
            </View>
        ) : null;
    }

    return {
        __esModule: true,
        default: MockBottomSheet,
    };
});

jest.mock('../theme', () => ({
    useTheme: () => ({
        colors: {
            background: '#000000',
            text: '#ffffff',
            textMuted: '#888888',
            textSecondary: '#aaaaaa',
        },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        radii: { xl: 24 },
        zIndex: { sheet: 100 },
    }),
}));

jest.mock('../theme/colorUtils', () => ({
    hexToRgba: (color: string) => color,
    blend: (color: string) => color,
    darken: (color: string) => color,
    readableOn: () => '#ffffff',
    resolveAccent: () => '#ff00ff',
}));

jest.mock('../i18n/TranslationContext', () => ({
    useTranslation: () => ({
        locale: 'en',
        t: (key: string, options?: { count?: number; cap?: number }) => {
            if (key === 'challenge.createWithCount') return `Create challenge ${options?.count}/${options?.cap}`;
            if (key === 'challenge.nicknamePrompt') return 'Your nickname';
            if (key === 'challenge.create') return 'Create';
            if (key === 'challenge.creating') return 'Creating…';
            if (key === 'leaderboard.nicknamePlaceholder') return 'Nickname';
            return key;
        },
    }),
}));

jest.mock('../data/games', () => ({
    games: [
        {
            id: 'the-drop',
            accent: '#ff00ff',
            iconName: 'drop',
            emoji: '💧',
        },
    ],
    GAME_ICONS: {},
}));

jest.mock('../game/playScreens', () => ({ playScreens: {} }));
jest.mock('../hooks/store/useStore', () => ({ useStore: () => ({ purchasedItemIds: [], isPremium: false }) }));
jest.mock('../game/challenge/build', () => ({ buildChallenge: jest.fn() }));
jest.mock('../game/challenge/store', () => {
    class BlockedError extends Error {}
    class ChallengeIdCollisionError extends BlockedError {}
    return {
        ensureChallengeCreated: jest.fn(),
        getChallenge: jest.fn(),
        newChallengeId: jest.fn(),
        prewarmChallengeAuth: jest.fn(),
        sameChallengeRecord: jest.fn(() => true),
        BlockedError,
        ChallengeIdCollisionError,
    };
});
jest.mock('../game/challenge/log', () => ({ countCreatedToday: () => 0 }));
jest.mock('../game/challenge/limit', () => ({ dailyCap: () => 5, canUpsell: () => false }));
jest.mock('../game/offline/limit', () => ({
    canStartOfflineRun: () => true,
    remainingOfflineRuns: () => 3,
    consumeOfflineRun: jest.fn(),
    dailyAllowance: () => 3,
    BONUS_RUNS_PER_LEVEL: 1,
}));
jest.mock('../game/challenge/deviceId', () => ({ getDeviceId: () => 'device-id' }));
jest.mock('../utils/firebase/init', () => ({ SafeAnalytics: { logEvent: jest.fn() } }));
jest.mock('../utils/sentry/init', () => ({ SafeSentry: { captureMessage: jest.fn() } }));
jest.mock('../game/history', () => ({ getHistory: () => [] }));
jest.mock('../game/poolCoverage', () => ({ poolCoverage: () => ({ seen: 0, total: 0, floor: 0, reseen: 0 }) }));
jest.mock('../data/store/catalog', () => ({ hasBuyablePacks: () => false }));
jest.mock('../game/challenge/nickname', () => ({
    getChallengeNickname: () => 'Saved player',
    setChallengeNickname: () => true,
}));
jest.mock('../game/mascot/equippedLook', () => ({ getEquippedLook: () => ({}) }));
jest.mock('../responsive/useResponsive', () => ({
    useResponsive: () => ({
        tabletColumn: undefined,
        scale: (value: number) => value,
        iconSize: (value: number) => value,
    }),
}));

const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-drop',
    questions: [{ id: 'question-1' }],
    createdBy: { uuid: 'device-id', nickname: 'Alice' },
    expiresAt: 1,
    mascot: { fur: 'fur', suit: 'suit', accent: 'accent', mic: 'mic' },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(buildChallenge).mockReturnValue(record);
    jest.mocked(newChallengeId).mockReturnValue('challenge-id');
    jest.mocked(getChallenge).mockResolvedValue(null);
});

afterEach(() => {
    jest.restoreAllMocks();
});

it('creates while the iOS nickname sheet dismisses, then navigates with auto-share', async () => {
    let finishCreation: () => void = () => undefined;
    jest.mocked(ensureChallengeCreated).mockImplementation(
        () =>
            new Promise<string>((resolve) => {
                finishCreation = () => resolve('challenge-id');
            }),
    );

    const { getByPlaceholderText, getByText } = render(<GameSetupScreen />);

    fireEvent.press(getByText('Create challenge 0/5'));
    expect(prewarmChallengeAuth).toHaveBeenCalledTimes(1);

    fireEvent.changeText(getByPlaceholderText('Nickname'), 'Alice');
    fireEvent.press(getByText('Create'));

    await waitFor(() => {
        expect(ensureChallengeCreated).toHaveBeenCalledWith(record, 'challenge-id');
    });
    expect(getByText('Creating…')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('Challenge', expect.anything());

    await act(async () => {
        finishCreation();
    });

    await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('Challenge', {
            challengeId: 'challenge-id',
            autoShare: true,
        });
    });
    expect(buildChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
            gameId: 'the-drop',
            createdBy: { uuid: 'device-id', nickname: 'Alice' },
        }),
    );
});

it('unlocks after a failed create and retries the frozen draft with the same id', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(ensureChallengeCreated)
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValueOnce('challenge-id');

    const { getByPlaceholderText, getByText } = render(<GameSetupScreen />);

    fireEvent.press(getByText('Create challenge 0/5'));
    fireEvent.press(getByText('Create'));

    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByText('Create challenge 0/5')).toBeTruthy());

    fireEvent.press(getByText('Create challenge 0/5'));
    expect(getByPlaceholderText('Nickname').props.editable).toBe(false);
    fireEvent.press(getByText('Create'));

    await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('Challenge', {
            challengeId: 'challenge-id',
            autoShare: true,
        });
    });

    expect(newChallengeId).toHaveBeenCalledTimes(1);
    expect(buildChallenge).toHaveBeenCalledTimes(1);
    expect(getChallenge).toHaveBeenCalledTimes(1);
    expect(getChallenge).toHaveBeenCalledWith('challenge-id');
    expect(ensureChallengeCreated).toHaveBeenNthCalledWith(1, record, 'challenge-id');
    expect(ensureChallengeCreated).toHaveBeenNthCalledWith(2, record, 'challenge-id');
});

it('uses the sheet title without duplicating the Solo Leaderboard heading', () => {
    const screen = render(<GameSetupScreen />);

    fireEvent.press(screen.getByLabelText('leaderboard.view'));

    expect(screen.getByText('leaderboard.title')).toBeTruthy();
    expect(mockLeaderboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ gameId: 'the-drop', showTitle: false }),
    );
});
