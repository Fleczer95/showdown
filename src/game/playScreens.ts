import type { ComponentType } from 'react';
import LadderPlayScreen from './ladder/LadderPlayScreen';
import WheelPlayScreen from './wheel/WheelPlayScreen';
import DropPlayScreen from './drop/DropPlayScreen';

/**
 * Props every game's in-session play screen receives. The shared
 * `GameSetupScreen` renders the screen mapped to the active `gameId` while the
 * session machine is in its `playing` state. All games are solo.
 */
export interface PlayScreenProps {
    onExit: () => void;
}

/** Maps a `games.ts` `id` to its play screen. (The Grid is deferred — not listed.) */
export const playScreens: Record<string, ComponentType<PlayScreenProps>> = {
    'the-ladder': LadderPlayScreen,
    'the-wheel': WheelPlayScreen,
    'the-drop': DropPlayScreen,
};
