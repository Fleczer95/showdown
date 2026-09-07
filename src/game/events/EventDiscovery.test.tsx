import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { EventDiscovery } from './EventDiscovery';
import { visibleEvents } from './catalogue';
import { halloweenPreviewEdition } from '../../../shared/events/fixtures';

const mockNavigate = jest.fn();
let mockNow = 0;
const day = 86400000;
const edition = { ...halloweenPreviewEdition, startsAt: 20 * day, endsAt: 30 * day };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('./useEventNow', () => ({ useEventNow: () => mockNow }));
jest.mock('./catalogue', () => ({ ...jest.requireActual('./catalogue'), visibleEvents: jest.fn() }));
jest.mock('../../i18n', () => ({
    useTranslation: () => ({
        locale: 'en',
        t: (key: string, args?: { count: number }) => (args ? `${key}:${args.count}` : key),
    }),
}));
jest.mock('react-native-reanimated', () => ({
    ...jest.requireActual('react-native-reanimated/mock'),
    useReducedMotion: () => true,
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(visibleEvents).mockReturnValue([edition]);
});

test.each([
    [13 * day, 'events.startsInDays:7'],
    [20 * day - 1000, 'events.startsSoon'],
    [20 * day, 'events.play'],
    [30 * day, 'events.viewResults'],
])('the seasonal button at %s names the event and shows %s', (now, label) => {
    mockNow = now as number;
    const screen = render(
        <ThemeProvider>
            <EventDiscovery />
        </ThemeProvider>,
    );
    const button = screen.getByLabelText(`${edition.name.en}. ${label}`);
    fireEvent.press(button);
    expect(mockNavigate).toHaveBeenCalledWith('EventHub', { editionId: edition.id });
    expect(screen.queryByText('events.title')).toBeNull();
});

test('no permanent generic button or reserved space when the promotion window is over', () => {
    jest.mocked(visibleEvents).mockReturnValue([]);
    const screen = render(
        <ThemeProvider>
            <EventDiscovery />
        </ThemeProvider>,
    );
    expect(screen.queryByTestId('event-discovery')).toBeNull();
});

test('overlapping events retain separate named entry points', () => {
    mockNow = 20 * day;
    const other = { ...edition, id: 'other-event', name: { en: 'Another event', pl: 'Inne wydarzenie' } };
    jest.mocked(visibleEvents).mockReturnValue([edition, other]);
    const screen = render(
        <ThemeProvider>
            <EventDiscovery />
        </ThemeProvider>,
    );
    fireEvent.press(screen.getByLabelText('Another event. events.play'));
    expect(mockNavigate).toHaveBeenCalledWith('EventHub', { editionId: other.id });
});
