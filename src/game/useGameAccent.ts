import { useTheme } from '../theme';
import { hexToRgba, readableOn, resolveAccent } from '../theme/colorUtils';
import { games } from '../data/games';

/**
 * Resolves a game's accent for in-round play screens, plus the shared "accent
 * glow" surface style used on Home / Setup / GameOverCard (soft colored shadow,
 * accent-tinted border, extra-round corners). Keeps the active gameplay UI in
 * the same visual language as the rest of the app.
 */
export function useGameAccent(gameId: string) {
    const theme = useTheme();
    const game = games.find((g) => g.id === gameId) ?? games[0];
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);

    const glow = {
        borderRadius: theme.radii.xl,
        borderColor: hexToRgba(accent, 0.5),
        shadowColor: accent,
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    } as const;

    return { accent, onAccent, glow };
}
