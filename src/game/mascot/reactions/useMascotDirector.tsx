import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { createReactionDirector, type DirectorState, type ReactionDirector } from './reactionDirector';
import type { EventContext, EventName } from './events';
import { surfaceForRoute } from './emit';
import type { Surface } from './events';
import { useSettings } from '../../../hooks/useSettings';

interface MascotContextValue {
    emit: (name: EventName, ctx?: EventContext) => void;
    state: DirectorState;
    surface: Surface;
    chatter: boolean;
    reduced: boolean;
    onAutoHide: () => void;
    /** Double-tapping the Home fox jumps to its look customizer. */
    openCustomizer: () => void;
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
    if (!directorRef.current) {
        directorRef.current = createReactionDirector({
            // Resolve the surface live at emit time so a screen's emit is never
            // dropped by a not-yet-applied scope update.
            getSurface: () => surfaceForRoute(navigationRef.getCurrentRoute?.()?.name ?? ''),
        });
    }
    const director = directorRef.current;
    const navSeqRef = useRef(0);

    const { mascotChatter } = useSettings();
    const reduced = useReducedMotion();
    const [state, setState] = useState<DirectorState>(director.getState());
    const [surface, setSurface] = useState<Surface>('other');

    useEffect(() => {
        const unsub = director.subscribe(setState);
        return () => {
            unsub();
        };
    }, [director]);

    // Navigation route → surface (+ nav-quiet + idle start/stop).
    useEffect(() => {
        function sync() {
            const route = navigationRef.getCurrentRoute?.();
            const nextSurface = surfaceForRoute(route?.name ?? '');
            navSeqRef.current += 1;
            director.onNavigate();
            director.setScope({ surface: nextSurface, navSeq: navSeqRef.current, roundId: route?.key });
            setSurface(nextSurface);
            if (nextSurface === 'home') director.startIdle();
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
            surface,
            chatter: mascotChatter,
            reduced,
            onAutoHide: director.clearUtterance,
            openCustomizer: () => navigationRef.navigate('Mascot' as never),
        }),
        [director, state, surface, mascotChatter, reduced, navigationRef],
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
            surface: 'other',
            chatter: true,
            reduced: false,
            onAutoHide: () => {},
            openCustomizer: () => {},
        }
    );
}
