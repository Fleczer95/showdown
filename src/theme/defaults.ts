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
} from './contract';

// ── Color defaults ────────────────────────────────────────────────

const colors: ThemeColors = {
    background: '#1A1A2E',
    surface: '#16213E',
    surfaceVariant: '#0F3460',
    primary: '#FF6B6B',
    onPrimary: '#FFFFFF',
    secondary: '#4ECDC4',
    onSecondary: '#1A1A2E',
    error: '#FF4757',
    onError: '#FFFFFF',
    success: '#2ED573',
    onSuccess: '#1A1A2E',
    warning: '#FFA502',
    onWarning: '#1A1A2E',
    text: '#FFFFFF',
    textSecondary: '#B0B0C0',
    textMuted: '#6B6B80',
    border: '#2A2A4A',
    borderLight: '#3A3A5A',
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: '#000000',
    glass: '#1E1E3E',
    glassBorder: '#5A5A7A',
};

// ── Typography defaults ───────────────────────────────────────────

const lineHeight: ThemeTypography['lineHeight'] = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 26,
    xl: 32,
    xxl: 40,
    display: 52,
};

const typography: ThemeTypography = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 17,
    xl: 21,
    xxl: 26,
    display: 36,
    lineHeight,
    letterSpacing: { overline: 1.5 },
};

// ── Spacing defaults ──────────────────────────────────────────────

const spacing: ThemeSpacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};

// ── Radii defaults ────────────────────────────────────────────────

const radii: ThemeRadii = {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

// ── Shadow defaults ───────────────────────────────────────────────

const shadows: ThemeShadows = {
    sm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    none: null,
};

// ── Animation defaults ────────────────────────────────────────────

const animation: AnimationPresets = {
    press: { scale: 0.96, duration: 150 },
    spring: { damping: 20, stiffness: 180 },
    springBouncy: { damping: 12, stiffness: 300 },
    springGentle: { damping: 20, stiffness: 120 },
    fade: { duration: 250 },
    slideUp: { damping: 22, stiffness: 160 },
    slideDown: { damping: 22, stiffness: 160 },
    scaleIn: { damping: 15, stiffness: 200 },
    shake: { duration: 400, offset: 10 },
    pulse: { duration: 500, scale: 1.08 },
};

// ── Z-Index defaults ──────────────────────────────────────────────

const zIndex: ThemeZIndex = {
    toast: 9999,
    modal: 1000,
    sheet: 900,
    header: 100,
    content: 0,
};

// ── Default component variants (color key refs, resolved by resolveTheme) ──

const defaultComponentVariants: ThemeComponentVariants = {
    button: {
        primary: { bg: 'primary', text: 'onPrimary', border: 'primary' },
        secondary: { bg: 'surface', text: 'secondary', border: 'secondary' },
        ghost: { bg: 'background', text: 'text', border: 'background' },
        danger: { bg: 'error', text: 'onError', border: 'error' },
    },
    card: {
        elevated: { bg: 'surface', border: 'border', shadow: 'md' },
        outlined: { bg: 'background', border: 'border', shadow: 'none' },
        flat: { bg: 'surface', border: 'background', shadow: 'none' },
        glass: { bg: 'glass', border: 'glassBorder', shadow: 'lg' },
    },
    input: {
        default: { bg: 'surface', border: 'border', text: 'text', placeholder: 'textMuted' },
        focused: { border: 'primary' },
        error: { border: 'error' },
    },
    badge: {
        default: { bg: 'border', text: 'textSecondary' },
        primary: { bg: 'primary', text: 'onPrimary' },
        success: { bg: 'success', text: 'onSuccess' },
        error: { bg: 'error', text: 'onError' },
        warning: { bg: 'warning', text: 'onWarning' },
    },
    toggleGroup: {
        active: { bg: 'primary', text: 'onPrimary' },
        inactive: { bg: 'surface', text: 'textSecondary' },
    },
};

// ── Exported default theme (identity placeholder) ─────────────────

export const defaultTokens: Theme = {
    id: '__default__',
    name: 'Default',
    colors,
    typography,
    spacing,
    radii,
    shadows,
    zIndex,
    animation,
};

export { defaultComponentVariants };
