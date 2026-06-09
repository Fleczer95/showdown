import type { ResolvedTheme } from './contract';
import type { GameAccent } from '../data/games';

// ── Color helpers ─────────────────────────────────────────────────
// Shared by the home cards and the game setup screen so their accent
// treatment (medallion gradient, glow, readable glyphs) stays identical.

/** Normalize #RGB / #RRGGBB to [r, g, b]. */
export function toRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function hexToRgba(hex: string, alpha: number): string {
    const [r, g, b] = toRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex toward black by `amount` (0..1) — used for the medallion gradient. */
export function darken(hex: string, amount: number): string {
    const [r, g, b] = toRgb(hex).map((c) => Math.round(c * (1 - amount)));
    return `rgb(${r}, ${g}, ${b})`;
}

/** Pick a readable glyph color (#1A1A2E or #FFFFFF) for an icon sitting on `hex`. */
export function readableOn(hex: string): string {
    const [r, g, b] = toRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#1A1A2E' : '#FFFFFF';
}

/** Pick a strict black or white contrast color for text sitting on `hex`. */
export function getContrastColor(hex: string): string {
    const [r, g, b] = toRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000000' : '#FFFFFF';
}

/** Resolve a game's themeable accent, falling back to a role token. */
const ACCENT_FALLBACK: Record<GameAccent, 'primary' | 'secondary' | 'warning'> = {
    accent1: 'primary',
    accent2: 'warning',
    accent3: 'secondary',
};
export function resolveAccent(theme: ResolvedTheme, token: GameAccent): string {
    return theme.gameAccents?.[token] ?? theme.colors[ACCENT_FALLBACK[token]];
}
