import React from 'react';
import { Pressable as MockPressable, StyleSheet, Text as MockText, View as MockView } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

const mockNavigate = jest.fn();
const mockButton = jest.fn();
let mockTabletColumn: { maxWidth: number; width: '100%'; alignSelf: 'center' } | undefined;
let mockWidth: number;
let mockFontScale: number;

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: () => undefined,
}));

jest.mock('lucide-react-native', () => ({
    Settings: () => null,
    ArrowRight: () => null,
    ShoppingBag: () => null,
    Swords: () => null,
    Trophy: () => null,
}));

jest.mock('react-native-svg', () => {
    const Node = ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>;
    return {
        __esModule: true,
        default: Node,
        Defs: Node,
        LinearGradient: Node,
        Stop: Node,
        Rect: Node,
        Text: Node,
    };
});

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../responsive/useResponsive', () => ({
    useResponsive: () => ({
        width: mockWidth,
        fontScale: mockFontScale,
        tabletColumn: mockTabletColumn,
        scale: (value: number) => value,
        iconSize: (value: number) => value,
    }),
}));

jest.mock('../components/atoms/Text', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockText>{children}</MockText>,
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

jest.mock('../components/atoms/HapticPressable', () => ({
    __esModule: true,
    default: ({ children, onPress, accessibilityLabel }: any) => (
        <MockPressable onPress={onPress} accessibilityLabel={accessibilityLabel}>
            {children}
        </MockPressable>
    ),
}));

jest.mock('../components/molecules/Card', () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
}));

jest.mock('../components/molecules/IconButton', () => ({
    __esModule: true,
    default: ({ onPress, accessibilityLabel }: any) => (
        <MockPressable onPress={onPress} accessibilityLabel={accessibilityLabel} />
    ),
}));

jest.mock('../components/molecules/Button', () => ({
    __esModule: true,
    default: (props: any) => {
        mockButton(props);
        return (
            <MockPressable
                onPress={props.onPress}
                accessibilityLabel={props.accessibilityLabel}
                accessibilityRole='button'
            >
                <MockText>{props.children}</MockText>
            </MockPressable>
        );
    },
}));

jest.mock('../components/molecules/SegmentedProgress', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../theme', () => ({
    useTheme: () => ({
        colors: { text: '#ffffff', primary: '#ff0000' },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        radii: { full: 9999, xl: 24 },
        shadows: { sm: {} },
        components: { button: { secondary: { text: '#00ffff' } } },
        wordmarkGradient: ['#ff0000', '#00ffff'],
    }),
}));

jest.mock('../theme/colorUtils', () => ({
    hexToRgba: (color: string) => color,
    darken: (color: string) => color,
    readableOn: () => '#ffffff',
    resolveAccent: () => '#ff0000',
}));

jest.mock('../i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'screen.home.challenges') return 'Challenges';
            if (key === 'screen.home.rankings') return 'Rankings';
            if (key === 'ranking.title') return 'Global Rankings';
            return key;
        },
    }),
}));

jest.mock('../data/games', () => ({
    games: [
        {
            id: 'the-ladder',
            accent: 'accent1',
            iconName: 'ListOrdered',
            setupRoute: 'ladderSetup',
        },
    ],
    GAME_ICONS: {},
}));

jest.mock('../hooks/useProgression', () => ({
    useProgression: () => ({
        level: 1,
        progress: { span: 100, intoLevel: 25 },
        streak: 0,
    }),
}));

jest.mock('../game/mascot/reactions/useMascotDirector', () => ({
    useMascotEmit: () => jest.fn(),
}));

jest.mock('../game/challenge/limit', () => ({ canUpsell: () => false }));
jest.mock('../game/offline/limit', () => ({ remainingOfflineRuns: () => 3 }));
jest.mock('../hooks/store/useStore', () => ({
    useStore: () => ({ purchasedItemIds: [], isPremium: false }),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockTabletColumn = undefined;
    mockWidth = 390;
    mockFontScale = 1;
});

it.each([
    ['Challenges', 'ChallengeHistory'],
    ['Global Rankings', 'Ranking'],
] as const)('%s opens %s', (label, route) => {
    const screen = render(<HomeScreen />);

    fireEvent.press(screen.getByLabelText(label));

    expect(mockNavigate).toHaveBeenCalledWith(route);
});

it('stretches the compete actions across the full content width', () => {
    const screen = render(<HomeScreen />);
    const competeDock = screen.getByTestId('home-compete-dock');
    const challengesAction = screen.getByTestId('home-challenges-action');
    const rankingsAction = screen.getByTestId('home-rankings-action');

    expect(competeDock).toHaveStyle({ flexDirection: 'row', width: '100%' });
    expect(challengesAction).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(rankingsAction).toHaveStyle({ flex: 1, minWidth: 0 });
});

it.each([
    ['a 320pt screen', 320, 1],
    ['large text on a 390pt screen', 390, 1.5],
] as const)('stacks the compete actions for %s', (_case, width, fontScale) => {
    mockWidth = width;
    mockFontScale = fontScale;
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId('home-compete-dock')).toHaveStyle({ flexDirection: 'column', width: '100%' });
    expect(screen.getByTestId('home-challenges-action')).toHaveStyle({ width: '100%', minWidth: 0 });
    expect(screen.getByTestId('home-rankings-action')).toHaveStyle({ width: '100%', minWidth: 0 });
});

it('keeps the dock and game cards on the same inset tablet column', () => {
    mockTabletColumn = { maxWidth: 720, width: '100%', alignSelf: 'center' };
    const screen = render(<HomeScreen />);

    const contentStyle = StyleSheet.flatten(screen.getByTestId('home-scroll').props.contentContainerStyle);
    const footerStyle = StyleSheet.flatten(screen.getByTestId('home-compete-footer').props.style);

    expect(contentStyle).toMatchObject({ ...mockTabletColumn, paddingHorizontal: 24 });
    expect(footerStyle).toMatchObject({ ...mockTabletColumn, paddingHorizontal: 24 });
});

it('uses matching centered icon-label groups for both dock actions', () => {
    render(<HomeScreen />);

    const propsFor = (label: string) =>
        mockButton.mock.calls.map(([props]) => props).find((props) => props.children === label);
    const challenges = propsFor('Challenges');
    const rankings = propsFor('Rankings');

    for (const props of [challenges, rankings]) {
        expect(props).toEqual(expect.objectContaining({ variant: 'secondary', fullWidth: true, contentGap: 'sm' }));
        expect(props.icon.props.color).toBe('#00ffff');
    }
});
