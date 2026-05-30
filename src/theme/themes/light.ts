import { createTheme } from '../createTheme';

/**
 * Clean light mode theme with neutral grays and high contrast.
 * Designed for comfortable reading in well-lit environments.
 */
export const lightTheme = createTheme({
    id: 'light',
    name: 'Light',
    colors: {
        background: '#F5F5F8',
        surface: '#FFFFFF',
        surfaceVariant: '#EEEFF3',
        primary: '#6C3CE1',
        onPrimary: '#FFFFFF',
        secondary: '#03363D',
        onSecondary: '#FFFFFF',
        error: '#B3261E',
        success: '#388E3C',
        text: '#1A1A2E',
        textSecondary: '#55556A',
        textMuted: '#8A8AA0',
        border: '#DDDEE4',
        borderLight: '#EAEAF0',
        overlay: 'rgba(0, 0, 0, 0.35)',
        shadow: '#000000',
        onError: '#FFFFFF',
        onSuccess: '#FFFFFF',
        warning: '#E8960A',
        onWarning: '#FFFFFF',
    },
    radii: {
        sm: 8,
        md: 14,
        lg: 20,
        xl: 28,
        full: 9999,
    },
});
