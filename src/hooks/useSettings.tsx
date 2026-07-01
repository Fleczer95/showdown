import React, { createContext, useContext, useState, useCallback } from 'react';
import { createMMKV } from 'react-native-mmkv';
import * as Localization from 'expo-localization';

const SUPPORTED_LANGUAGES = ['en', 'pl'];

function getDeviceLanguage(): string {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
        const lang = locales[0]?.languageCode;
        if (lang && SUPPORTED_LANGUAGES.includes(lang)) {
            return lang;
        }
    }
    return 'en';
}

const storage = createMMKV({ id: 'showdown-settings' });

interface SettingsState {
    roundTimer: number; // Global default
    gameTimers: Record<string, number>; // Game-specific timers
    soundEffects: boolean;
    hapticFeedback: boolean;
    mascotChatter: boolean;
    language: string;
    lastPlayedGameId?: string;
}

interface SettingsContextValue extends SettingsState {
    setRoundTimer: (v: number) => void;
    setGameTimer: (gameId: string, v: number) => void;
    setSoundEffects: (v: boolean) => void;
    setHapticFeedback: (v: boolean) => void;
    setMascotChatter: (v: boolean) => void;
    setLanguage: (v: string) => void;
    setLastPlayedGameId: (v: string) => void;
}

const defaults: SettingsState = {
    roundTimer: 60,
    gameTimers: {
        'forbidden-words': 60,
        'who-am-i': 60,
        'would-you-rather': 60,
        icebreaker: 60,
    },
    soundEffects: true,
    hapticFeedback: true,
    mascotChatter: true,
    language: getDeviceLanguage(),
};

function load(): SettingsState {
    const gameTimersStr = storage.getString('gameTimers');
    const gameTimers = gameTimersStr ? JSON.parse(gameTimersStr) : defaults.gameTimers;

    return {
        roundTimer: storage.getNumber('roundTimer') ?? defaults.roundTimer,
        gameTimers,
        soundEffects: storage.getBoolean('soundEffects') ?? defaults.soundEffects,
        hapticFeedback: storage.getBoolean('hapticFeedback') ?? defaults.hapticFeedback,
        mascotChatter: storage.getBoolean('mascotChatter') ?? defaults.mascotChatter,
        language: storage.getString('language') ?? defaults.language,
        lastPlayedGameId: storage.getString('lastPlayedGameId'),
    };
}

const SettingsContext = createContext<SettingsContextValue>({
    ...defaults,
    setRoundTimer: () => {},
    setGameTimer: () => {},
    setSoundEffects: () => {},
    setHapticFeedback: () => {},
    setMascotChatter: () => {},
    setLanguage: () => {},
    setLastPlayedGameId: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<SettingsState>(load);

    const setRoundTimer = useCallback((v: number) => {
        setState((s) => ({ ...s, roundTimer: v }));
        storage.set('roundTimer', v);
    }, []);

    const setGameTimer = useCallback((gameId: string, v: number) => {
        setState((s) => {
            const newTimers = { ...s.gameTimers, [gameId]: v };
            storage.set('gameTimers', JSON.stringify(newTimers));
            return { ...s, gameTimers: newTimers };
        });
    }, []);

    const setSoundEffects = useCallback((v: boolean) => {
        setState((s) => ({ ...s, soundEffects: v }));
        storage.set('soundEffects', v);
    }, []);

    const setHapticFeedback = useCallback((v: boolean) => {
        setState((s) => ({ ...s, hapticFeedback: v }));
        storage.set('hapticFeedback', v);
    }, []);

    const setMascotChatter = useCallback((v: boolean) => {
        setState((s) => ({ ...s, mascotChatter: v }));
        storage.set('mascotChatter', v);
    }, []);

    const setLanguage = useCallback((v: string) => {
        setState((s) => ({ ...s, language: v }));
        storage.set('language', v);
    }, []);

    const setLastPlayedGameId = useCallback((v: string) => {
        setState((s) => ({ ...s, lastPlayedGameId: v }));
        storage.set('lastPlayedGameId', v);
    }, []);

    const value = {
        ...state,
        setRoundTimer,
        setGameTimer,
        setSoundEffects,
        setHapticFeedback,
        setMascotChatter,
        setLanguage,
        setLastPlayedGameId,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
    return useContext(SettingsContext);
}
