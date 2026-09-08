import React from 'react';
import { View as MockView } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { EventHubScreen } from './EventHubScreen';
import { visibleEvents } from '../game/events/catalogue';
import { startEvent } from '../game/events/participation';
import { getPendingEventStart } from '../game/challenge/session/store';
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
jest.mock('../hooks/useProgression', () => ({
    useProgression: () => ({ stats: { eventCompletedRuns: { 'local-halloween-preview-v2': 2 } } }),
}));
jest.mock('../game/events/EventRewardPreview', () => ({ EventRewardPreview: () => null }));
jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));
jest.mock('../i18n', () => ({ useTranslation: () => ({ locale: 'en', t: (key: string) => key }) }));
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

test('the hub lists the pool and the wins remaining to the next prize', async () => {
    const { findByText } = mount();
    expect(await findByText('events.winsGoal', options)).toBeTruthy();
    expect(await findByText('events.randomPrize', options)).toBeTruthy();
});
