import { createActor } from 'xstate';
import { gameSessionMachine } from './gameSessionMachine';

const start = (input = { gameId: 'the-ladder' }) => {
    const actor = createActor(gameSessionMachine, { input });
    actor.start();
    return actor;
};

describe('gameSessionMachine', () => {
    it('starts in setup with input applied to config', () => {
        const actor = start({ gameId: 'the-grid', players: 4, category: 'sports' } as any);
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('setup');
        expect(snapshot.context.config).toEqual({ gameId: 'the-grid', players: 4, category: 'sports' });
        expect(snapshot.context.round).toBe(0);
    });

    it('defaults players to 2 and category to null', () => {
        const snapshot = start().getSnapshot();
        expect(snapshot.context.config.players).toBe(2);
        expect(snapshot.context.config.category).toBeNull();
    });

    it('merges CONFIGURE events while in setup', () => {
        const actor = start();
        actor.send({ type: 'CONFIGURE', config: { category: 'history' } });
        actor.send({ type: 'CONFIGURE', config: { players: 6 } });
        expect(actor.getSnapshot().context.config).toEqual({
            gameId: 'the-ladder',
            players: 6,
            category: 'history',
        });
    });

    it('transitions setup -> playing on START', () => {
        const actor = start();
        actor.send({ type: 'START' });
        expect(actor.getSnapshot().value).toBe('playing');
    });

    it('advances rounds and ends the game', () => {
        const actor = start();
        actor.send({ type: 'START' });
        actor.send({ type: 'NEXT_ROUND' });
        actor.send({ type: 'NEXT_ROUND' });
        expect(actor.getSnapshot().context.round).toBe(2);
        actor.send({ type: 'END_GAME' });
        expect(actor.getSnapshot().value).toBe('gameOver');
    });

    it('resets rounds on PLAY_AGAIN', () => {
        const actor = start();
        actor.send({ type: 'START' });
        actor.send({ type: 'NEXT_ROUND' });
        actor.send({ type: 'END_GAME' });
        actor.send({ type: 'PLAY_AGAIN' });
        expect(actor.getSnapshot().value).toBe('playing');
        expect(actor.getSnapshot().context.round).toBe(0);
    });

    it('returns to setup on EXIT from gameOver', () => {
        const actor = start();
        actor.send({ type: 'START' });
        actor.send({ type: 'END_GAME' });
        actor.send({ type: 'EXIT' });
        expect(actor.getSnapshot().value).toBe('setup');
    });
});
