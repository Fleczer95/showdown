import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { playDeadline } from '../../../../shared/events/definitions';
import type { ChallengeResult } from '../ChallengeHandoff';
import { checkpointSession, getSession, type ChallengeSession } from './store';
import { settleCompletion } from './recovery';

/** Active decision clock is separate from the absolute play deadline. */
export function useSessionCheckpoint(
    id: string | undefined,
    decisionKey: string,
    running: boolean,
    onExpire: () => void,
) {
    const initial = useRef<ChallengeSession | null | undefined>(undefined);
    if (initial.current === undefined) initial.current = id ? (getSession(id) ?? null) : null;
    const deadline = initial.current ? playDeadline(initial.current.record) : Infinity;
    const expire = useRef(onExpire);
    expire.current = onExpire;
    const requestedRunning = useRef(running);
    requestedRunning.current = running;
    const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    running = running && foreground.current;
    const clock = useRef({ key: decisionKey, elapsed: initial.current?.elapsedMs ?? 0, since: Date.now(), running });
    if (clock.current.key !== decisionKey) clock.current = { key: decisionKey, elapsed: 0, since: Date.now(), running };
    if (clock.current.running !== running) {
        if (clock.current.running) clock.current.elapsed += Date.now() - clock.current.since;
        clock.current.since = Date.now();
        clock.current.running = running;
    }
    const elapsed = useCallback(
        () => clock.current.elapsed + (clock.current.running ? Date.now() - clock.current.since : 0),
        [],
    );
    const canPlay = useCallback(() => {
        if (!id) return true;
        const session = getSession(id);
        return (
            !!session &&
            session.status === 'active' &&
            !session.awaitingStart &&
            Date.now() < playDeadline(session.record)
        );
    }, [id]);
    const commit = useCallback(
        (value: unknown, result?: ChallengeResult, resetTime = false) => {
            if (!id) return true;
            const ok = checkpointSession(id, value, resetTime ? 0 : elapsed(), result);
            if (!ok) expire.current();
            else {
                if (resetTime) {
                    clock.current.elapsed = 0;
                    clock.current.since = Date.now();
                    clock.current.running = false;
                }
                if (result) settleCompletion(id);
            }
            return ok;
        },
        [id, elapsed],
    );
    useEffect(() => {
        if (!id) return;
        const persist = () => {
            // React may still display the PRE-decision animation frame. The
            // journal, not a render closure, is authoritative for logical state.
            const saved = getSession(id);
            if (saved && clock.current.running) checkpointSession(id, saved.checkpoint, elapsed());
        };
        const listener = AppState.addEventListener('change', (state) => {
            foreground.current = state === 'active';
            if (state !== 'active') {
                persist();
                clock.current.elapsed = elapsed();
                clock.current.running = false;
            } else {
                clock.current.since = Date.now();
                clock.current.running = requestedRunning.current;
                const session = getSession(id);
                if (session?.status === 'active' && Date.now() >= playDeadline(session.record)) expire.current();
            }
        });
        const interval = setInterval(() => {
            if (Date.now() >= deadline && getSession(id)?.status === 'active') expire.current();
        }, 500);
        return () => {
            persist();
            listener.remove();
            clearInterval(interval);
        };
    }, [id, elapsed, deadline]);
    const pause = useCallback(() => {
        const saved = id ? getSession(id) : undefined;
        if (id && saved && clock.current.running) checkpointSession(id, saved.checkpoint, elapsed());
    }, [id, elapsed]);
    return useMemo(() => ({ commit, elapsed, canPlay, pause }), [commit, elapsed, canPlay, pause]);
}
