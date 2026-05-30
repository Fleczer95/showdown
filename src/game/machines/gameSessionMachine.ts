import { setup, assign } from 'xstate';

/**
 * Shared game-session lifecycle for every ShowDown mode.
 *
 * The four games (Ladder, Grid, Opinion Poll, Wheel) differ in their round
 * mechanics but share the same outer flow: configure on a setup screen, play a
 * series of rounds, then land on a score screen that can restart or exit. Each
 * game's play screen drives this machine and layers its own round logic on top
 * of the `playing` state. Keeping the lifecycle here gives every mode the same
 * predictable transitions, which is the reason XState was chosen for ShowDown.
 */

export interface GameConfig {
    /** Matches an `id` in `src/data/games.ts`. */
    gameId: string;
    players: number;
    /** Selected category/board/survey/pack; `null` until chosen. */
    category: string | null;
}

export interface GameSessionContext {
    config: GameConfig;
    /** Zero-based index of the current round within a playthrough. */
    round: number;
}

export type GameSessionEvent =
    | { type: 'CONFIGURE'; config: Partial<GameConfig> }
    | { type: 'START' }
    | { type: 'NEXT_ROUND' }
    | { type: 'END_GAME' }
    | { type: 'PLAY_AGAIN' }
    | { type: 'EXIT' };

export interface GameSessionInput {
    gameId: string;
    players?: number;
    category?: string | null;
}

export const gameSessionMachine = setup({
    types: {
        context: {} as GameSessionContext,
        events: {} as GameSessionEvent,
        input: {} as GameSessionInput,
    },
    actions: {
        applyConfig: assign({
            config: ({ context, event }) => {
                if (event.type !== 'CONFIGURE') return context.config;
                return { ...context.config, ...event.config };
            },
        }),
        resetRounds: assign({ round: 0 }),
        advanceRound: assign({ round: ({ context }) => context.round + 1 }),
    },
}).createMachine({
    id: 'gameSession',
    initial: 'setup',
    context: ({ input }) => ({
        config: {
            gameId: input.gameId,
            players: input.players ?? 2,
            category: input.category ?? null,
        },
        round: 0,
    }),
    states: {
        setup: {
            on: {
                CONFIGURE: { actions: 'applyConfig' },
                START: { target: 'playing', actions: 'resetRounds' },
            },
        },
        playing: {
            on: {
                NEXT_ROUND: { actions: 'advanceRound' },
                END_GAME: { target: 'gameOver' },
                EXIT: { target: 'setup' },
            },
        },
        gameOver: {
            on: {
                PLAY_AGAIN: { target: 'playing', actions: 'resetRounds' },
                EXIT: { target: 'setup' },
            },
        },
    },
});
