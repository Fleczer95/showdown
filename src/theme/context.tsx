import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import type {
    ResolvedTheme,
    ColorToken,
    ThemeTypography,
    ThemeSpacing,
    ThemeRadii,
    ShadowToken,
    ShadowStyle,
    AnimationPresets,
} from './contract';
import type { Breakpoint } from '../responsive/breakpoints';
import { getBreakpoint } from '../responsive/breakpoints';
import { themeRegistry } from './registry';
import { resolveTheme } from './resolveTheme';
import { loadThemePreference, saveThemePreference } from './persistence';
import { defaultTokens } from './defaults';
import * as SystemUI from 'expo-system-ui';

// ── Context shape ─────────────────────────────────────────────────

interface ThemeContextValue {
    theme: ResolvedTheme;
    themeId: string;
    breakpoint: Breakpoint;
    isBlurry: boolean;
    setTheme: (id: string) => void;
    setIsBlurry: (isBlurry: boolean) => void;
}

// ── Fallback for outside provider (e.g. tests) ────────────────────

const fallbackResolved: ResolvedTheme = resolveTheme({ ...defaultTokens, id: 'party', name: 'Party' }, 'regular');

const ThemeContext = createContext<ThemeContextValue>({
    theme: fallbackResolved,
    themeId: 'party',
    breakpoint: 'regular',
    isBlurry: false,
    setTheme: () => {},
    setIsBlurry: () => {},
});

// ── Provider ──────────────────────────────────────────────────────

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultThemeId?: string;
}

export function ThemeProvider({ children, defaultThemeId }: ThemeProviderProps) {
    const [themeId, setThemeId] = useState<string>(() => defaultThemeId ?? loadThemePreference());
    const [isBlurry, setIsBlurry] = useState(false);
    const { width, height } = useWindowDimensions();

    // Memoize on breakpoint, not raw dimensions
    const breakpoint = useMemo(() => getBreakpoint(width, height), [width, height]);

    const handleSetTheme = useCallback((id: string) => {
        setThemeId(id);
        saveThemePreference(id);
    }, []);

    const shortestSide = Math.min(width, height);

    const theme = useMemo(() => {
        // Find theme in registry array
        const found = themeRegistry.find((t) => t.value === themeId) || themeRegistry[0];
        return resolveTheme(found.theme, breakpoint, shortestSide);
    }, [themeId, breakpoint, shortestSide]);

    React.useEffect(() => {
        SystemUI.setBackgroundColorAsync(theme.colors.background);
    }, [theme.colors.background]);

    const value = useMemo(
        () => ({ theme, themeId, breakpoint, isBlurry, setTheme: handleSetTheme, setIsBlurry }),
        [theme, themeId, breakpoint, isBlurry, handleSetTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ── Hooks ─────────────────────────────────────────────────────────

/** Full resolved theme with pre-baked responsive tokens */
export function useTheme(): ResolvedTheme {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme() must be used within <ThemeProvider>.');
    }
    return ctx.theme;
}

/** Theme ID + setter for settings UI */
export function useThemeActions(): {
    themeId: string;
    setTheme: (id: string) => void;
} {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useThemeActions() must be used within <ThemeProvider>.');
    }
    return { themeId: ctx.themeId, setTheme: ctx.setTheme };
}

/** Global blur state for modals/overlays */
export function useBlur(): {
    isBlurry: boolean;
    setIsBlurry: (isBlurry: boolean) => void;
} {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useBlur() must be used within <ThemeProvider>.');
    }
    return { isBlurry: ctx.isBlurry, setIsBlurry: ctx.setIsBlurry };
}

/** Type-safe color access */
export function useColor(key: ColorToken): string {
    return useTheme().colors[key];
}

/** Current breakpoint */
export function useBreakpoint(): Breakpoint {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useBreakpoint() must be used within <ThemeProvider>.');
    }
    return ctx.breakpoint;
}

/** Convenience: get typography token */
export function useTypography(): ThemeTypography {
    return useTheme().typography;
}

/** Convenience: get spacing token */
export function useSpacing(): ThemeSpacing {
    return useTheme().spacing;
}

/** Convenience: get radii token */
export function useRadii(): ThemeRadii {
    return useTheme().radii;
}

/** Convenience: get shadow by name */
export function useShadow(token: ShadowToken): ShadowStyle | null {
    return useTheme().shadows[token];
}

/** Convenience: get animation presets */
export function useAnimationPresets(): AnimationPresets {
    return useTheme().animation;
}
