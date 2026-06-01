import { createTheme } from '../createTheme';

/**
 * Clean dark mode theme with neutral grays and high contrast.
 * Designed for comfortable reading in low-light environments.
 */
export const darkTheme = createTheme({
    id: 'dark',
    name: 'Dark',
    colors: {
        background: '#0A0A0F',
        surface: '#16161E',
        surfaceVariant: '#22222E',
        primary: '#BB86FC',
        onPrimary: '#000000',
        secondary: '#03DAC6',
        onSecondary: '#000000',
        error: '#CF6679',
        success: '#4CAF50',
        text: '#ECECF1',
        textSecondary: '#A0A0B8',
        textMuted: '#7A7A8A',
        border: '#2A2A3A',
        borderLight: '#363648',
        overlay: 'rgba(0, 0, 0, 0.6)',
        shadow: '#000000',
        onError: '#000000',
        onSuccess: '#000000',
        warning: '#FFA502',
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
