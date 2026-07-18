import React from 'react';
import { Pressable as MockPressable, Text as MockNativeText, View as MockView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RankingScreen } from './RankingScreen';
import { countEntries, getBoard } from '../game/ranking/store';
import { getLocalState } from '../game/ranking/local';
import { retryPending } from '../game/ranking/push';
import { BlockedError } from '../game/challenge/store';

let mockFocusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: jest.fn() }),
    useRoute: () => ({ params: { gameId: 'the-ladder' } }),
    useFocusEffect: (callback: () => void | (() => void)) => {
        mockFocusEffect = callback;
    },
}));

jest.mock('lucide-react-native', () => ({
    ChevronLeft: () => null,
    RefreshCw: () => null,
    WifiOff: () => null,
}));

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../responsive/useResponsive', () => ({
    useResponsive: () => ({
        tabletColumn: undefined,
        scale: (value: number) => value,
        iconSize: (value: number) => value,
    }),
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

jest.mock('../components/atoms/Icon', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/atoms/Glyph', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/atoms/RankBadge', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/atoms/ActivityIndicator', () => ({ __esModule: true, default: () => null }));

jest.mock('../components/atoms/HapticPressable', () => ({
    __esModule: true,
    default: ({ children, onPress, accessibilityLabel }: any) => (
        <MockPressable onPress={onPress} accessibilityLabel={accessibilityLabel}>
            {children}
        </MockPressable>
    ),
}));

jest.mock('../components/molecules/IconButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/molecules/Button', () => ({
    __esModule: true,
    default: ({ children, onPress }: any) => (
        <MockPressable onPress={onPress}>
            <MockNativeText>{children}</MockNativeText>
        </MockPressable>
    ),
}));
jest.mock('../components/molecules/ToggleGroup', () => ({
    __esModule: true,
    default: ({ options, onChange }: any) => (
        <MockView>
            {options.map((option: { value: string; label: string }) => (
                <MockPressable key={option.value} onPress={() => onChange(option.value)}>
                    <MockNativeText>{option.label}</MockNativeText>
                </MockPressable>
            ))}
        </MockView>
    ),
}));

jest.mock('../theme', () => ({
    useTheme: () => ({
        colors: {
            primary: '#ff00ff',
            surface: '#111111',
            border: '#333333',
            text: '#ffffff',
            textMuted: '#888888',
            textSecondary: '#aaaaaa',
        },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        radii: { lg: 16, full: 9999 },
        shadows: {
            sm: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
            },
        },
    }),
}));

jest.mock('../theme/colorUtils', () => ({
    hexToRgba: (color: string) => color,
    readableOn: () => '#ffffff',
    resolveAccent: () => '#ff00ff',
}));

jest.mock('../i18n', () => ({
    useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../data/games', () => ({
    games: [
        { id: 'the-ladder', accent: 'accent1', iconName: 'ladder' },
        { id: 'the-drop', accent: 'accent2', iconName: 'drop' },
        { id: 'the-wheel', accent: 'accent3', iconName: 'wheel' },
    ],
    GAME_ICONS: {},
}));

jest.mock('../game/ranking/config', () => ({
    ALLTIME_PERIOD: 'alltime',
    RANKED_GAMES: ['the-ladder', 'the-drop', 'the-wheel'],
    ROLLOVER_THRESHOLD: 10,
    monthBucketId: () => '2026-07',
    previousMonthBucketId: () => '2026-06',
}));

jest.mock('../game/ranking/rank', () => ({ resolveDisplayedMonth: () => 'current' }));
jest.mock('../game/ranking/store', () => ({ getBoard: jest.fn(), countEntries: jest.fn() }));
jest.mock('../game/ranking/cache', () => ({
    readCachedBoard: () => null,
    writeCachedBoard: jest.fn(),
}));
jest.mock('../game/ranking/local', () => ({ getLocalState: jest.fn() }));
jest.mock('../game/ranking/push', () => ({ retryPending: jest.fn(() => Promise.resolve()) }));
jest.mock('../game/progression', () => ({ signatureEmoji: () => null }));
jest.mock('../game/challenge/store', () => ({
    OfflineError: class OfflineError extends Error {},
    BlockedError: class BlockedError extends Error {},
}));

const localState = {
    month: { monthId: '2026-07', score: 1234, synced: true },
    allTime: { score: 4321, synced: true },
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffect = undefined;
    jest.mocked(retryPending).mockResolvedValue(undefined);
    jest.mocked(getLocalState).mockReturnValue(localState);
    jest.mocked(countEntries).mockResolvedValue(12);
    jest.mocked(getBoard).mockResolvedValue([{ nickname: 'Ada', score: 900 }]);
});

it('shows the current-month personal best before the global board resolves', () => {
    jest.mocked(countEntries).mockReturnValue(new Promise<number>(() => undefined));

    const screen = render(<RankingScreen />);

    expect(screen.getByText('ranking.yourBestMonth')).toBeTruthy();
    expect(screen.getByText('1,234 leaderboard.points')).toBeTruthy();
    expect(screen.getByText('ranking.globalBoard')).toBeTruthy();
});

it('renders the personal best before the first global row', async () => {
    const screen = render(<RankingScreen />);
    await screen.findByText('Ada');

    const textOrder = screen
        .UNSAFE_getAllByType(MockNativeText)
        .map((node) => React.Children.toArray(node.props.children).join(''));

    const bestIndex = textOrder.indexOf('ranking.yourBestMonth');
    const firstRowIndex = textOrder.indexOf('Ada');

    expect(bestIndex).toBeGreaterThanOrEqual(0);
    expect(firstRowIndex).toBeGreaterThanOrEqual(0);
    expect(bestIndex).toBeLessThan(firstRowIndex);
});

it('uses the all-time best label when that scope is selected', async () => {
    const screen = render(<RankingScreen />);

    fireEvent.press(screen.getByText('ranking.allTime'));

    await waitFor(() => expect(screen.getByText('ranking.yourBestAllTime')).toBeTruthy());
    expect(screen.getByText('4,321 leaderboard.points')).toBeTruthy();
});

it('ignores an older board request after the scope changes', async () => {
    const initialMonthCount = deferred<number>();
    jest.mocked(countEntries).mockReturnValue(initialMonthCount.promise);
    jest.mocked(getBoard).mockImplementation(async (_game, period) => [
        {
            nickname: period === 'alltime' ? 'All-time Ada' : 'Monthly Ada',
            score: 900,
        },
    ]);

    const screen = render(<RankingScreen />);

    await waitFor(() => expect(countEntries).toHaveBeenCalledWith('the-ladder', '2026-07'));
    fireEvent.press(screen.getByText('ranking.allTime'));
    await screen.findByText('All-time Ada');

    await act(async () => {
        initialMonthCount.resolve(12);
        await Promise.resolve();
    });

    await waitFor(() => expect(getBoard).toHaveBeenCalledWith('the-ladder', '2026-07'));
    await waitFor(() => {
        expect(screen.getByText('All-time Ada')).toBeTruthy();
        expect(screen.queryByText('Monthly Ada')).toBeNull();
    });
});

it('ignores an older request error after the scope changes', async () => {
    const initialMonthCount = deferred<number>();
    jest.mocked(countEntries).mockReturnValue(initialMonthCount.promise);
    jest.mocked(getBoard).mockResolvedValue([{ nickname: 'All-time Ada', score: 900 }]);

    const screen = render(<RankingScreen />);

    await waitFor(() => expect(countEntries).toHaveBeenCalledWith('the-ladder', '2026-07'));
    fireEvent.press(screen.getByText('ranking.allTime'));
    await screen.findByText('All-time Ada');

    await act(async () => {
        initialMonthCount.reject(new BlockedError());
        await Promise.resolve();
        await Promise.resolve();
    });

    expect(screen.getByText('All-time Ada')).toBeTruthy();
    expect(screen.queryByText('ranking.error')).toBeNull();
});

it('automatically retries a pending personal best and reflects completion without reloading the board', async () => {
    let resolveRetry: (() => void) | undefined;
    let currentLocalState = {
        ...localState,
        month: { ...localState.month, synced: false },
    };
    jest.mocked(getLocalState).mockImplementation(() => currentLocalState);
    jest.mocked(retryPending).mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                resolveRetry = resolve;
            }),
    );

    const screen = render(<RankingScreen />);

    act(() => mockFocusEffect?.());
    await waitFor(() => expect(retryPending).toHaveBeenCalledTimes(1));
    expect(screen.getByText('ranking.syncing')).toBeTruthy();

    currentLocalState = localState;
    await act(async () => resolveRetry?.());

    await waitFor(() => expect(screen.queryByText('ranking.syncing')).toBeNull());
    expect(screen.queryByLabelText('ranking.retrySync')).toBeNull();
    expect(countEntries).toHaveBeenCalledTimes(1);
});

it('clears pending state when the focus retry resolves immediately', async () => {
    let currentLocalState = {
        ...localState,
        month: { ...localState.month, synced: false },
    };
    jest.mocked(getLocalState).mockImplementation(() => currentLocalState);
    jest.mocked(retryPending).mockImplementation(() => {
        currentLocalState = localState;
        return Promise.resolve();
    });

    const screen = render(<RankingScreen />);

    expect(screen.getByLabelText('ranking.retrySync')).toBeTruthy();
    act(() => mockFocusEffect?.());

    await waitFor(() => expect(screen.queryByLabelText('ranking.retrySync')).toBeNull());
    expect(retryPending).toHaveBeenCalledTimes(1);
});

it('offers manual retry when the automatic focus attempt remains pending', async () => {
    jest.mocked(getLocalState).mockReturnValue({
        ...localState,
        month: { ...localState.month, synced: false },
    });
    const screen = render(<RankingScreen />);

    act(() => mockFocusEffect?.());
    await waitFor(() => expect(retryPending).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByLabelText('ranking.retrySync'));

    await waitFor(() => expect(retryPending).toHaveBeenCalledTimes(2));
});
