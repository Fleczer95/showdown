import React from 'react';
import { View as MockView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { EventHubScreen } from './EventHubScreen';
import { visibleEvents } from '../game/events/catalogue';
import { startEvent } from '../game/events/participation';
import { getPendingEventStart } from '../game/challenge/session/store';
import { useProgression } from '../hooks/useProgression';
import { halloweenPreviewEdition } from '../../shared/events/fixtures';

const day = 86400000;
const edition = { ...halloweenPreviewEdition, startsAt: 20 * day, endsAt: 30 * day };
const mockNavigate = jest.fn();
let mockNow = 20 * day;
let mockParams: { editionId?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    useRoute: () => ({ params: mockParams }),
    usePreventRemove: () => undefined,
}));
jest.mock('../game/events/useEventNow', () => ({ useEventNow: () => mockNow }));
jest.mock('../game/events/catalogue', () => ({ visibleEvents: jest.fn() }));
jest.mock('../game/events/participation', () => ({ remainingEventPlays: () => 3, startEvent: jest.fn() }));
jest.mock('../game/challenge/session/store', () => ({ getPendingEventStart: jest.fn() }));
jest.mock('../game/challenge/nickname', () => ({
    getChallengeNickname: () => 'Ada',
    setChallengeNickname: () => true,
}));
jest.mock('../game/challenge/store', () => ({ BlockedError: class extends Error {} }));
jest.mock('../hooks/store/useStore', () => ({ useStore: () => ({ purchasedItemIds: [], isPremium: false }) }));
jest.mock('../hooks/useProgression', () => ({ useProgression: jest.fn() }));
jest.mock('../game/events/EventRewardPreview', () => ({ EventRewardPreview: () => null }));
jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));
const mockT = jest.fn((key: string) => key);
jest.mock('../i18n', () => ({ useTranslation: () => ({ locale: 'en', t: mockT }) }));
jest.mock('react-native-reanimated', () => ({
    ...jest.requireActual('react-native-reanimated/mock'),
    useReducedMotion: () => true,
}));
const options = { includeHiddenElements: true };
const mount = () =>
    render(
        <ThemeProvider>
            <EventHubScreen />
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    mockParams = undefined;
    mockNow = 20 * day;
    jest.mocked(visibleEvents).mockReturnValue([edition]);
    jest.mocked(getPendingEventStart).mockReturnValue(undefined);
    jest.mocked(startEvent).mockResolvedValue({ id: 'saved-event', share: false });
    jest.mocked(useProgression).mockReturnValue({
        stats: { eventCompletedRuns: { 'local-halloween-preview-v2': 2 } },
    } as unknown as ReturnType<typeof useProgression>);
});

test.each([
    [19 * day, 'events.upcoming'],
    [30 * day, 'events.finished'],
])('no new-game actions outside active play (%s)', (now, copy) => {
    mockNow = now as number;
    const screen = mount();
    expect(screen.getByText(copy as string, options)).toBeTruthy();
    expect(screen.queryByTestId('event-nickname')).toBeNull();
    expect(screen.queryByText('events.friend', options)).toBeNull();
    expect(screen.queryByText('events.random', options)).toBeNull();
    expect(startEvent).not.toHaveBeenCalled();
});

test('active editions retain admission', async () => {
    const screen = mount();
    await act(async () => fireEvent.press(screen.getByText('events.random', options)));
    expect(startEvent).toHaveBeenCalledWith(expect.objectContaining({ edition, mode: 'random' }));
    expect(mockNavigate).toHaveBeenCalledWith('Challenge', { challengeId: 'saved-event', autoShare: false });
});

test('closed edition exposes results through history', () => {
    mockNow = 30 * day;
    const screen = mount();
    fireEvent.press(screen.getByText('events.viewResults', options));
    expect(mockNavigate).toHaveBeenCalledWith('ChallengeHistory');
});

test('each seasonal entry opens its own edition when events overlap', () => {
    const other = { ...edition, id: 'other-event', name: { en: 'Other event', pl: 'Inne wydarzenie' } };
    jest.mocked(visibleEvents).mockReturnValue([edition, other]);
    mockParams = { editionId: other.id };
    const screen = mount();
    expect(screen.getByText('Other event', options)).toBeTruthy();
    expect(screen.queryByText(edition.name.en, options)).toBeNull();
});

test('pending admission retry remains reachable even after promotion disappears', async () => {
    jest.mocked(visibleEvents).mockReturnValue([]);
    jest.mocked(getPendingEventStart).mockReturnValue({ editionId: edition.id, mode: 'random' } as ReturnType<
        typeof getPendingEventStart
    >);
    const screen = mount();
    expect(screen.getByText('events.pendingStart', options)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('challenge.retry', options)));
    expect(startEvent).toHaveBeenCalled();
});

test('the hub reports wins remaining to the next prize for a player with no wins yet', async () => {
    const poolEdition = { ...edition, winsPerPrize: 13, prizePool: ['theme-champion', 'mascot-fur-pumpkin'] };
    jest.mocked(visibleEvents).mockReturnValue([poolEdition]);
    jest.mocked(useProgression).mockReturnValue({
        stats: { eventWinIds: {}, earnedRewardIds: [] },
    } as unknown as ReturnType<typeof useProgression>);
    mount();
    await waitFor(() => expect(mockT).toHaveBeenCalledWith('events.nextPrize', { count: 13 }));
    expect(mockT).not.toHaveBeenCalledWith('events.poolComplete');
});

test('the hub reports the pool complete once every prize has been earned', async () => {
    const poolEdition = { ...edition, winsPerPrize: 13, prizePool: ['theme-champion', 'mascot-fur-pumpkin'] };
    jest.mocked(visibleEvents).mockReturnValue([poolEdition]);
    jest.mocked(useProgression).mockReturnValue({
        stats: {
            eventWinIds: { [poolEdition.id]: Array.from({ length: 13 }, (_, i) => `run-${i}`) },
            earnedRewardIds: poolEdition.prizePool,
        },
    } as unknown as ReturnType<typeof useProgression>);
    mount();
    await waitFor(() => expect(mockT).toHaveBeenCalledWith('events.poolComplete'));
    expect(mockT).not.toHaveBeenCalledWith('events.nextPrize', expect.anything());
});

test('the prize list starts hidden and expands when its header is tapped', async () => {
    const poolEdition = { ...edition, winsPerPrize: 13, prizePool: ['theme-champion', 'mascot-fur-pumpkin'] };
    jest.mocked(visibleEvents).mockReturnValue([poolEdition]);
    jest.mocked(useProgression).mockReturnValue({
        stats: { eventWinIds: {}, earnedRewardIds: ['theme-champion'] },
    } as unknown as ReturnType<typeof useProgression>);
    const screen = mount();

    // Hidden by default: the header is there, the prize rows are not, and the
    // header states the action it performs rather than looking like a heading.
    await waitFor(() => expect(mockT).toHaveBeenCalledWith('events.prizesTitle'));
    expect(mockT).toHaveBeenCalledWith('events.showPrizes');
    expect(mockT).not.toHaveBeenCalledWith('events.hidePrizes');
    expect(mockT).not.toHaveBeenCalledWith('events.preview');

    mockT.mockClear();
    await act(async () => {
        fireEvent.press(screen.getByTestId(`event-prizes-toggle-${poolEdition.id}`, options));
    });

    // Expanded: every prize row renders and the verb flips to the inverse action.
    expect(mockT).toHaveBeenCalledWith('events.hidePrizes');
    expect(mockT).not.toHaveBeenCalledWith('events.showPrizes');
    expect(mockT).toHaveBeenCalledWith('events.preview');
    expect(mockT).toHaveBeenCalledWith('events.earned');
    expect(mockT).toHaveBeenCalledWith('events.locked');

    mockT.mockClear();
    await act(async () => {
        fireEvent.press(screen.getByTestId(`event-prizes-toggle-${poolEdition.id}`, options));
    });
    expect(mockT).not.toHaveBeenCalledWith('events.preview');
});
