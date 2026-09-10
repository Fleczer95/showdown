import React from 'react';
import { View as MockView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { EventHubScreen } from './EventHubScreen';
import { visibleEvents } from '../game/events/catalogue';
import { startEvent } from '../game/events/participation';
import { getPendingEventStart } from '../game/challenge/session/store';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import { useProgression } from '../hooks/useProgression';
import { halloweenPreviewEdition } from '../../shared/events/fixtures';

const day = 86400000;
const edition = { ...halloweenPreviewEdition, startsAt: 20 * day, endsAt: 30 * day };
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockNow = 20 * day;
let mockParams: { editionId?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => ({ params: mockParams }),
    usePreventRemove: () => undefined,
}));
jest.mock('../game/events/useEventNow', () => ({ useEventNow: () => mockNow }));
jest.mock('../game/events/catalogue', () => ({ visibleEvents: jest.fn() }));
jest.mock('../game/events/participation', () => ({ remainingEventPlays: () => 3, startEvent: jest.fn() }));
jest.mock('../game/challenge/session/store', () => ({ getPendingEventStart: jest.fn() }));
jest.mock('../game/challenge/nickname', () => ({
    getChallengeNickname: jest.fn(() => 'Ada'),
    setChallengeNickname: jest.fn(() => true),
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
    jest.mocked(getChallengeNickname).mockReturnValue('Ada');
    jest.mocked(setChallengeNickname).mockReturnValue(true);
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
    // The nickname stays editable outside active play — only the start actions go.
    expect(screen.getByTestId('event-nickname', options)).toBeTruthy();
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

test('the hub reaches the edition’s own ranking board', () => {
    const screen = mount();
    fireEvent.press(screen.getByText('events.ranking', options));
    expect(mockNavigate).toHaveBeenCalledWith('Ranking', { editionId: edition.id });
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

test('the header carries a back control, matching the other screens', async () => {
    const screen = mount();
    const back = await screen.findByLabelText('screen.settings.back', options);
    fireEvent.press(back);
    expect(mockGoBack).toHaveBeenCalled();
});

test('editing the nickname is saved without starting a round', async () => {
    jest.mocked(setChallengeNickname).mockReturnValue(true);
    jest.mocked(getChallengeNickname).mockReturnValue('Ada');
    const screen = mount();
    const field = screen.getByTestId('event-nickname', options);

    fireEvent.changeText(field, 'Nowa Nazwa');
    await act(async () => {
        fireEvent(field, 'blur');
    });

    expect(setChallengeNickname).toHaveBeenCalledWith('Nowa Nazwa');
    expect(startEvent).not.toHaveBeenCalled();
});

test('a rejected nickname is reverted rather than left on screen', async () => {
    jest.mocked(getChallengeNickname).mockReturnValue('Ada');
    jest.mocked(setChallengeNickname).mockReturnValue(false);
    const screen = mount();
    const field = screen.getByTestId('event-nickname', options);

    fireEvent.changeText(field, 'rude-word');
    await act(async () => {
        fireEvent(field, 'blur');
    });

    expect(screen.getByDisplayValue('Ada', options)).toBeTruthy();
});
