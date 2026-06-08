import type {
    Theme,
    ThemeColors,
    ThemeTypography,
    ThemeSpacing,
    ThemeRadii,
    ThemeShadows,
    ThemeZIndex,
    AnimationPresets,
    ThemeComponentVariants,
    ResolvedComponentVariants,
    ResolvedTheme,
    ColorToken,
} from './contract';
import { deepMerge } from './createTheme';
import { defaultTokens, defaultComponentVariants } from './defaults';
import type { Breakpoint } from '../responsive/breakpoints';
import { typeScaleFactor, spaceScaleFactor } from '../responsive/scale';

// ── Generic recursive color reference resolution ──────────────────

function resolveValue(value: unknown, colors: ThemeColors): unknown {
    if (typeof value === 'string' && value !== 'transparent' && value in colors) {
        return colors[value as ColorToken];
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const resolved: Record<string, unknown> = {};
        for (const key of Object.keys(value)) {
            resolved[key] = resolveValue((value as Record<string, unknown>)[key], colors);
        }
        return resolved;
    }
    return value;
}

function resolveColorRefs(
    overrides: ThemeComponentVariants | undefined,
    colors: ThemeColors,
): ResolvedComponentVariants {
    // Merge defaults with overrides first
    const merged = overrides
        ? (deepMerge(defaultComponentVariants, overrides) as ThemeComponentVariants)
        : defaultComponentVariants;

    // Resolve all color key refs recursively
    return resolveValue(merged, colors) as ResolvedComponentVariants;
}

// ── Responsive scaling ────────────────────────────────────────────

// Representative shortest-side widths used when only a breakpoint is known
// (tests, out-of-provider fallback). Keeps prior discrete factors intact.
const BREAKPOINT_SHORTEST: Record<Breakpoint, number> = {
    compact: 320,
    regular: 380,
    expanded: 840,
};

function scaleTypography(typography: ThemeTypography, shortestSide: number): ThemeTypography {
    const scale = typeScaleFactor(shortestSide);
    const base = {
        xs: typography.xs * scale,
        sm: typography.sm * scale,
        md: typography.md * scale,
        lg: typography.lg * scale,
        xl: typography.xl * scale,
        xxl: typography.xxl * scale,
        display: typography.display * scale,
    };
    return {
        ...base,
        lineHeight: {
            xs: typography.lineHeight.xs * scale,
            sm: typography.lineHeight.sm * scale,
            md: typography.lineHeight.md * scale,
            lg: typography.lineHeight.lg * scale,
            xl: typography.lineHeight.xl * scale,
            xxl: typography.lineHeight.xxl * scale,
            display: typography.lineHeight.display * scale,
        },
        letterSpacing: typography.letterSpacing,
        fontFamily: typography.fontFamily,
    };
}

function scaleSpacing(spacing: ThemeSpacing, shortestSide: number): ThemeSpacing {
    const scale = spaceScaleFactor(shortestSide);
    return {
        xs: spacing.xs * scale,
        sm: spacing.sm * scale,
        md: spacing.md * scale,
        lg: spacing.lg * scale,
        xl: spacing.xl * scale,
        xxl: spacing.xxl * scale,
    };
}

// ── Public resolver ───────────────────────────────────────────────

export function resolveTheme(theme: Theme, breakpoint: Breakpoint, shortestSide?: number): ResolvedTheme {
    const merged = deepMerge(defaultTokens, theme);
    const colors = merged.colors as ThemeColors;
    const typography = merged.typography as ThemeTypography;
    const spacing = merged.spacing as ThemeSpacing;
    const shortest = shortestSide ?? BREAKPOINT_SHORTEST[breakpoint];

    // Wordmark gradient accepts hex or color-token names; defaults to brand colors.
    const resolveCol = (c: string) => (c in colors ? colors[c as ColorToken] : c);
    const wordmarkGradient = (merged.wordmarkGradient ?? ['primary', 'secondary']).map(resolveCol);

    return {
        ...merged,
        id: merged.id,
        name: merged.name,
        colors,
        wordmarkGradient,
        typography: scaleTypography(typography, shortest),
        spacing: scaleSpacing(spacing, shortest),
        radii: merged.radii as ThemeRadii,
        shadows: merged.shadows as ThemeShadows,
        zIndex: merged.zIndex as ThemeZIndex,
        animation: merged.animation as AnimationPresets,
        breakpoint,
        components: resolveColorRefs(merged.components, colors),
    };
}
