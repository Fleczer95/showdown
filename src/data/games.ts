import { ListOrdered, Grid3x3, BarChart3, Disc3, Banknote } from 'lucide-react-native';

/**
 * Navigation route for each game's setup screen. The navigator aligns its param
 * list to these names. (Grid/Poll routes were retired with the solo pivot.)
 */
export type SetupRoute = 'ladderSetup' | 'wheelSetup' | 'dropSetup';

export interface Game {
    id: string;
    emoji: string;
    iconName: string;
    setupRoute: SetupRoute;
}

export const GAME_ICONS: Record<string, any> = {
    ListOrdered,
    Grid3x3,
    BarChart3,
    Disc3,
    Banknote,
};

/**
 * MVP games, all solo. The Grid (Jeopardy-style) is built but deferred — its
 * code stays in `src/game/grid/` but it is intentionally not listed here. The
 * Opinion Poll was cut and replaced by The Drop. See
 * `docs/decisions/0001-solo-mvp-over-pass-and-play.md`.
 */
export const games: Game[] = [
    {
        id: 'the-ladder',
        emoji: '🪜',
        iconName: 'ListOrdered',
        setupRoute: 'ladderSetup',
    },
    {
        id: 'the-drop',
        emoji: '💰',
        iconName: 'Banknote',
        setupRoute: 'dropSetup',
    },
    {
        id: 'the-wheel',
        emoji: '🎡',
        iconName: 'Disc3',
        setupRoute: 'wheelSetup',
    },
];
