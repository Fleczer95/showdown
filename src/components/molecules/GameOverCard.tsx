import React from 'react';
import { StyleSheet } from 'react-native';
import Stack from '../atoms/Stack';
import Card from './Card';
import { useTheme } from '../../theme';
import { hexToRgba, readableOn, resolveAccent } from '../../theme/colorUtils';
import { useResponsive } from '../../responsive/useResponsive';
import { games } from '../../data/games';

interface GameOverCardProps {
    gameId: string;
    /** Receives the resolved per-game accent so the screen's actions can match the brand. */
    children: (colors: { accent: string; onAccent: string }) => React.ReactNode;
}

/**
 * End-of-game result panel: an accent-tinted border with a soft colored glow,
 * extra-rounded corners, and airy vertical rhythm. The mascot now anchors the
 * header (see each game's Results screen), so the game-icon medallion was dropped.
 */
function GameOverCard({ gameId, children }: GameOverCardProps) {
    const theme = useTheme();
    const { scale } = useResponsive();
    const game = games.find((g) => g.id === gameId) ?? games[0];
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);

    return (
        <Card
            variant='elevated'
            padding='lg'
            style={[
                styles.card,
                {
                    maxWidth: scale(380),
                    borderRadius: theme.radii.xl,
                    borderColor: hexToRgba(accent, 0.5),
                    shadowColor: accent,
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 8,
                },
            ]}
        >
            <Stack gap='xl' align='stretch'>
                {children({ accent, onAccent })}
            </Stack>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
    },
});

export default React.memo(GameOverCard);
