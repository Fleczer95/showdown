import type { WithSpringConfig } from 'react-native-reanimated';

// ── Identity ──────────────────────────────────────────────────────

export interface ThemeMetadata {
    labelKey: string;
    icon: any; // Lucide icon component
}

export interface ThemeIdentity {
    id: string;
    name: string;
    metadata?: ThemeMetadata;
}

// ── Colors ────────────────────────────────────────────────────────

export interface ThemeColors {
    background: string;
    surface: string;
    surfaceVariant: string;
    primary: string;
    onPrimary: string;
    secondary: string;
    onSecondary: string;
    error: string;
    onError: string;
    success: string;
    onSuccess: string;
    warning: string;
    onWarning: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderLight: string;
    overlay: string;
    shadow: string;
    glass: string;
    glassBorder: string;
}

export type ColorToken = keyof ThemeColors;

/**
 * Optional per-game accent overrides. When a theme omits a key, consumers fall
 * back to a role token (primary/secondary/warning) so accents still vary per
 * theme automatically; a theme (e.g. a light one) can set these to override.
 */
export interface ThemeGameAccents {
    accent1?: string;
    accent2?: string;
    accent3?: string;
}

// ── Typography ────────────────────────────────────────────────────

export type FontSizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'display';

export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export interface ThemeTypography {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    display: number;
    lineHeight: Record<FontSizeToken, number>;
    letterSpacing: Partial<Record<'overline', number>>;
    fontFamily?: {
        regular?: string;
        medium?: string;
        semibold?: string;
        bold?: string;
        /** Display face for the `display`/`heading` variants (brand wordmark + section titles). */
        display?: string;
    };
}

export type TypographyToken = keyof ThemeTypography;

// ── Spacing ───────────────────────────────────────────────────────

export interface ThemeSpacing {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
}

export type SpacingToken = keyof ThemeSpacing;

// ── Radii ─────────────────────────────────────────────────────────

export interface ThemeRadii {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
}

// ── Shadows ───────────────────────────────────────────────────────

export interface ShadowStyle {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
}

export interface ThemeShadows {
    sm: ShadowStyle;
    md: ShadowStyle;
    lg: ShadowStyle;
    none: null;
}

export type ShadowToken = 'sm' | 'md' | 'lg' | 'none';

// ── Animation ─────────────────────────────────────────────────────

export type SpringConfig = Pick<WithSpringConfig, 'damping' | 'stiffness' | 'mass'>;

export interface AnimationPresets {
    press: { scale: number; duration: number };
    spring: SpringConfig;
    springBouncy: SpringConfig;
    springGentle: SpringConfig;
    fade: { duration: number };
    slideUp: SpringConfig;
    slideDown: SpringConfig;
    scaleIn: SpringConfig;
    shake: { duration: number; offset: number };
    pulse: { duration: number; scale: number };
}

// ── Z-Index ───────────────────────────────────────────────────────

export interface ThemeZIndex {
    toast: number;
    modal: number;
    sheet: number;
    header: number;
    content: number;
}

export type ZIndexToken = keyof ThemeZIndex;

// ── Component Variants ────────────────────────────────────────────

export interface ColorVariant {
    bg: ColorToken;
    text: ColorToken;
    border: ColorToken;
}

export interface CardVariant {
    bg: ColorToken;
    border: ColorToken;
    shadow: ShadowToken;
}

export interface BadgeVariant {
    bg: ColorToken;
    text: ColorToken;
}

export interface InputDefaultVariant {
    bg: ColorToken;
    border: ColorToken;
    text: ColorToken;
    placeholder: ColorToken;
}

export interface InputStateVariant {
    border: ColorToken;
}

export interface ThemeComponentVariants {
    button?: {
        primary?: ColorVariant;
        secondary?: ColorVariant;
        ghost?: ColorVariant;
        danger?: ColorVariant;
    };
    card?: {
        elevated?: CardVariant;
        outlined?: CardVariant;
        flat?: CardVariant;
        glass?: CardVariant;
    };
    input?: {
        default?: InputDefaultVariant;
        focused?: InputStateVariant;
        error?: InputStateVariant;
    };
    badge?: {
        default?: BadgeVariant;
        primary?: BadgeVariant;
        success?: BadgeVariant;
        error?: BadgeVariant;
        warning?: BadgeVariant;
    };
    toggleGroup?: {
        active?: BadgeVariant;
        inactive?: BadgeVariant;
    };
}

// ── Resolved Variants (hex values, not key refs) ──────────────────

export interface ResolvedColorVariant {
    bg: string;
    text: string;
    border: string;
}

export interface ResolvedCardVariant {
    bg: string;
    border: string;
    shadow: ShadowToken;
}

export interface ResolvedBadgeVariant {
    bg: string;
    text: string;
}

export interface ResolvedInputDefaultVariant {
    bg: string;
    border: string;
    text: string;
    placeholder: string;
}

export interface ResolvedInputStateVariant {
    border: string;
}

export interface ResolvedComponentVariants {
    button: {
        primary: ResolvedColorVariant;
        secondary: ResolvedColorVariant;
        ghost: ResolvedColorVariant;
        danger: ResolvedColorVariant;
    };
    card: {
        elevated: ResolvedCardVariant;
        outlined: ResolvedCardVariant;
        flat: ResolvedCardVariant;
        glass: ResolvedCardVariant;
    };
    input: {
        default: ResolvedInputDefaultVariant;
        focused: ResolvedInputStateVariant;
        error: ResolvedInputStateVariant;
    };
    badge: {
        default: ResolvedBadgeVariant;
        primary: ResolvedBadgeVariant;
        success: ResolvedBadgeVariant;
        error: ResolvedBadgeVariant;
        warning: ResolvedBadgeVariant;
    };
    toggleGroup: {
        active: ResolvedBadgeVariant;
        inactive: ResolvedBadgeVariant;
    };
}

// ── Full Theme (all optional except identity) ─────────────────────

export interface Theme extends ThemeIdentity {
    colors?: Partial<ThemeColors>;
    gameAccents?: ThemeGameAccents;
    /** Gradient stops for the home wordmark. Hex or color-token names. Defaults to [primary, secondary]. */
    wordmarkGradient?: string[];
    typography?: Partial<ThemeTypography>;
    spacing?: Partial<ThemeSpacing>;
    radii?: Partial<ThemeRadii>;
    shadows?: Partial<ThemeShadows>;
    zIndex?: Partial<ThemeZIndex>;
    animation?: Partial<AnimationPresets>;
    components?: ThemeComponentVariants;
}

// ── Resolved Theme (after deep merge + responsive scaling + color resolution) ──

export interface ResolvedTheme extends ThemeIdentity {
    colors: ThemeColors;
    gameAccents?: ThemeGameAccents;
    /** Resolved gradient stops (hex) for the home wordmark. */
    wordmarkGradient: string[];
    typography: ThemeTypography;
    spacing: ThemeSpacing;
    radii: ThemeRadii;
    shadows: ThemeShadows;
    zIndex: ThemeZIndex;
    animation: AnimationPresets;
    breakpoint: string;
    components: ResolvedComponentVariants;
}
