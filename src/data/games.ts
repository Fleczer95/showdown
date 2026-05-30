import { ListOrdered, Grid3x3, BarChart3, Disc3 } from 'lucide-react-native';

/**
 * Navigation route for each game's setup screen. Defined locally for the
 * skeleton; the navigator (next phase) aligns its param list to these names.
 */
export type SetupRoute = 'ladderSetup' | 'gridSetup' | 'pollSetup' | 'wheelSetup';

export interface Game {
    id: string;
    emoji: string;
    iconName: string;
    name: string;
    description: string;
    players: string;
    setupRoute: SetupRoute;
}

export const GAME_ICONS: Record<string, any> = {
    ListOrdered,
    Grid3x3,
    BarChart3,
    Disc3,
};

export const games: Game[] = [
    {
        id: 'the-ladder',
        emoji: '🪜',
        iconName: 'ListOrdered',
        name: 'The Ladder',
        description: 'Climb a 15-question trivia curve — use your lifelines wisely!',
        players: '1-6',
        setupRoute: 'ladderSetup',
    },
    {
        id: 'the-grid',
        emoji: '🎯',
        iconName: 'Grid3x3',
        name: 'The Grid',
        description: 'Pick a category, wager your points, and answer the clue.',
        players: '2-6',
        setupRoute: 'gridSetup',
    },
    {
        id: 'the-opinion-poll',
        emoji: '📊',
        iconName: 'BarChart3',
        name: 'The Opinion Poll',
        description: 'We surveyed 100 people — can you guess the top answers?',
        players: '2-8',
        setupRoute: 'pollSetup',
    },
    {
        id: 'the-wheel',
        emoji: '🎡',
        iconName: 'Disc3',
        name: 'The Wheel',
        description: 'Spin for a multiplier and solve the word puzzle!',
        players: '2-6',
        setupRoute: 'wheelSetup',
    },
];
