import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { createReactionDirector, type DirectorState, type ReactionDirector } from './reactionDirector';
import type { EventContext, EventName } from './events';
import { surfaceForRoute } from './emit';
import { useSettings } from '../../../hooks/useSettings';

interface MascotContextValue {
    emit: (name: EventName, ctx?: EventContext) => void;
    state: DirectorState;
    chatter: boolean;
    reduced: boolean;
    onAutoHide: () => void;
}

const NEUTRAL: DirectorState = { utterance: null, expression: 'neutral' };

const MascotContext = createContext<MascotContextValue | null>(null);

/**
 * Owns the single reaction director for the app's lifetime and wires the
 * cross-cutting inputs the director can't see on its own: the current navigation
 * surface (+ nav-quiet window + idle start/stop), app-background drops, the idle
 * drip clock, the chatter setting, and reduced-motion. Screens/games only call
 * `useMascotEmit()`; the host reads `useMascotState()`.
 */
export function MascotDirectorProvider({
    navigationRef,
    children,
}: {
    navigationRef: NavigationContainerRefWithCurrent<Record<string, object | undefined>>;
    children: React.ReactNode;
}) {
    const directorRef = useRef<ReactionDirector | null>(null);
    if (!directorRef.current) directorRef.current = createReactionDirector();
    const director = directorRef.current;
    const navSeqRef = useRef(0);

    const { mascotChatter } = useSettings();
    const reduced = useReducedMotion();
    const [state, setState] = useState<DirectorState>(director.getState());

    useEffect(() => director.subscribe(setState), [director]);

    // Navigation route → surface (+ nav-quiet + idle start/stop).
    useEffect(() => {
        function sync() {
            const route = navigationRef.getCurrentRoute?.();
            const surface = surfaceForRoute(route?.name ?? '');
            navSeqRef.current += 1;
            director.onNavigate();
            director.setScope({ surface, navSeq: navSeqRef.current, roundId: route?.key });
            if (surface === 'home') director.startIdle();
            else director.stopIdle();
        }
        const unsub = navigationRef.addListener?.('state', sync);
        if (navigationRef.isReady?.()) sync();
        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, [director, navigationRef]);

    // App background → drop pending reactions (no stale lines on resume).
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s !== 'active') director.onBackground();
        });
        return () => sub.remove();
    }, [director]);

    // Idle drip clock.
    useEffect(() => {
        const id = setInterval(() => director.tick(), 1000);
        return () => clearInterval(id);
    }, [director]);

    const value = useMemo<MascotContextValue>(
        () => ({
            emit: director.emit,
            state,
            chatter: mascotChatter,
            reduced,
            onAutoHide: director.clearUtterance,
        }),
        [director, state, mascotChatter, reduced],
    );

    return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascotEmit(): (name: EventName, ctx?: EventContext) => void {
    const ctx = useContext(MascotContext);
    return ctx ? ctx.emit : () => {};
}

export function useMascotState(): MascotContextValue {
    return (
        useContext(MascotContext) ?? {
            emit: () => {},
            state: NEUTRAL,
            chatter: true,
            reduced: false,
            onAutoHide: () => {},
        }
    );
}
