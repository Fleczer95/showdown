import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { GameId } from '../../utils/firebase/events';

function randomId(): string {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        const v = ch === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export interface ActiveSession {
    id: string;
    gameId: GameId;
    startedAt: number;
    categoryId: string;
    isPremiumCategory: boolean;
    targetScore: number;
    roundSeconds: number;
    roundsPlayed: number;
    lastSessionId?: string;
    lastCategoryId?: string;
    completed: boolean;
}

interface GameSessionContextValue {
    activeSession: ActiveSession | null;
    lastSession: { id: string; categoryId: string; gameId: GameId } | null;
    startSession: (input: Omit<ActiveSession, 'id' | 'startedAt' | 'roundsPlayed' | 'completed'>) => ActiveSession;
    incrementRoundsPlayed: () => void;
    markCompleted: () => void;
    clearSession: () => void;
    getSetupOpenedAt: (gameId: GameId) => number | undefined;
    markSetupOpened: (gameId: GameId) => void;
}

const GameSessionContext = createContext<GameSessionContextValue | undefined>(undefined);

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [lastSession, setLastSession] = useState<{ id: string; categoryId: string; gameId: GameId } | null>(null);
    const setupOpenedAtRef = useRef<Partial<Record<GameId, number>>>({});

    const startSession = useCallback<GameSessionContextValue['startSession']>((input) => {
        const session: ActiveSession = {
            ...input,
            id: randomId(),
            startedAt: Date.now(),
            roundsPlayed: 0,
            completed: false,
        };
        setActiveSession(session);
        return session;
    }, []);

    const incrementRoundsPlayed = useCallback(() => {
        setActiveSession((s) => (s ? { ...s, roundsPlayed: s.roundsPlayed + 1 } : s));
    }, []);

    const markCompleted = useCallback(() => {
        setActiveSession((s) => {
            if (!s) return s;
            setLastSession({ id: s.id, categoryId: s.categoryId, gameId: s.gameId });
            return { ...s, completed: true };
        });
    }, []);

    const clearSession = useCallback(() => {
        setActiveSession((s) => {
            if (s && !s.completed) {
                setLastSession({ id: s.id, categoryId: s.categoryId, gameId: s.gameId });
            }
            return null;
        });
    }, []);

    const markSetupOpened = useCallback((gameId: GameId) => {
        setupOpenedAtRef.current[gameId] = Date.now();
    }, []);

    const getSetupOpenedAt = useCallback((gameId: GameId) => setupOpenedAtRef.current[gameId], []);

    const value = useMemo(
        () => ({
            activeSession,
            lastSession,
            startSession,
            incrementRoundsPlayed,
            markCompleted,
            clearSession,
            markSetupOpened,
            getSetupOpenedAt,
        }),
        [
            activeSession,
            lastSession,
            startSession,
            incrementRoundsPlayed,
            markCompleted,
            clearSession,
            markSetupOpened,
            getSetupOpenedAt,
        ],
    );

    return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSessionContextValue {
    const ctx = useContext(GameSessionContext);
    if (!ctx) throw new Error('useGameSession must be used within GameSessionProvider');
    return ctx;
}
