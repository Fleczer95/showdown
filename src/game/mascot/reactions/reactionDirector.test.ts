import { createReactionDirector } from './reactionDirector';

function makeDirector(now = { t: 0 }) {
    return createReactionDirector({ cooldownMs: 5000, navQuietMs: 500, recentSize: 3, now: () => now.t });
}

describe('reactionDirector', () => {
    it('emits a spoken utterance on the right surface', () => {
        const now = { t: 1000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        now.t = 2000; // past navQuiet
        d.emit('home-focus', {});
        expect(d.getState().utterance?.textKey).toMatch(/^mascot\.greeting\./);
        expect(d.getState().expression).toBe('happy');
    });

    it('drops events whose surface is not allowed', () => {
        const d = makeDirector();
        d.setScope({ surface: 'store', navSeq: 1 });
        d.emit('run-won', {}); // run-won only allowed on game
        expect(d.getState().utterance).toBeNull();
    });

    it('respects cooldown but lets higher priority preempt', () => {
        const now = { t: 10000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.emit('home-focus', {}); // greeting, prio 20
        expect(d.getState().utterance?.bucketId).toBe('greeting');
        now.t = 10100; // still within cooldown
        d.emit('idle', {}); // prio 5 — dropped
        expect(d.getState().utterance?.bucketId).toBe('greeting');
        d.emit('level-up', {}); // prio 90 — preempts
        expect(d.getState().utterance?.bucketId).toBe('level-up');
    });

    it('drops when a blocker is active', () => {
        const d = makeDirector();
        d.setScope({ surface: 'game', roundId: 'r1', navSeq: 1 });
        d.setBlockers({ timerRunning: true });
        d.emit('run-won', {});
        expect(d.getState().utterance).toBeNull();
    });

    it('expression-only bucket sets face but no text', () => {
        const d = makeDirector();
        d.setScope({ surface: 'game', roundId: 'r1', navSeq: 1 });
        d.emit('streak-milestone', { count: 5 });
        expect(d.getState().expression).toBe('happy');
        expect(d.getState().utterance?.textKey).toBeUndefined();
    });

    it('clearUtterance returns the face to neutral (no stranded expression)', () => {
        const d = makeDirector();
        d.setScope({ surface: 'home', navSeq: 1 });
        d.emit('home-focus', {});
        expect(d.getState().expression).toBe('happy');
        d.clearUtterance();
        expect(d.getState().utterance).toBeNull();
        expect(d.getState().expression).toBe('neutral');
    });

    it('onBackground clears everything to neutral', () => {
        const now = { t: 5000 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.emit('home-focus', {});
        d.onBackground();
        expect(d.getState().utterance).toBeNull();
        expect(d.getState().expression).toBe('neutral');
    });

    it('onNavigate within navQuiet suppresses a reactive emit', () => {
        const now = { t: 0 };
        const d = makeDirector(now);
        d.setScope({ surface: 'game', navSeq: 1 });
        d.onNavigate(); // records nav at t=0
        now.t = 200; // < navQuietMs (500)
        d.emit('run-won', {});
        expect(d.getState().utterance).toBeNull();
    });

    it('lets an ambient greeting bypass nav quiet', () => {
        const now = { t: 0 };
        const d = makeDirector(now);
        d.setScope({ surface: 'home', navSeq: 1 });
        d.onNavigate(); // records nav at t=0
        now.t = 100; // < navQuietMs
        d.emit('home-focus', {});
        expect(d.getState().utterance?.bucketId).toBe('greeting');
    });

    it('resolves the surface live via getSurface', () => {
        let surf: 'other' | 'game' = 'other';
        const d = createReactionDirector({ getSurface: () => surf, cooldownMs: 0, navQuietMs: 0, now: () => 0 });
        d.emit('run-won', {}); // surface 'other' → dropped
        expect(d.getState().utterance).toBeNull();
        surf = 'game';
        d.emit('run-won', {}); // surface 'game' → accepted
        expect(d.getState().utterance?.bucketId).toBe('run-won');
    });
});

describe('idle drip', () => {
    it('drips one line at a time, hides between, and alternates idle banter with a tip', () => {
        const now = { t: 0 };
        const d = createReactionDirector({ now: () => now.t, idleShowMs: 3000, idleGapMs: 2000, cooldownMs: 0, navQuietMs: 0 });
        d.setScope({ surface: 'home', navSeq: 1 });
        d.startIdle();
        d.tick(); // first line shows -> idle
        expect(d.getState().utterance?.bucketId).toBe('idle');
        now.t = 3001;
        d.tick(); // past show window -> hidden
        expect(d.getState().utterance).toBeNull();
        now.t = 5002;
        d.tick(); // past gap -> next line, now a tip
        expect(d.getState().utterance?.bucketId).toBe('tip');
    });

    it('navigation cancels the drip', () => {
        const now = { t: 0 };
        const d = createReactionDirector({ now: () => now.t, cooldownMs: 0, navQuietMs: 0 });
        d.setScope({ surface: 'home', navSeq: 1 });
        d.startIdle();
        d.tick();
        d.onNavigate();
        now.t = 10000;
        d.tick();
        expect(d.getState().utterance).toBeNull();
    });
});
