import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import Stack from '../atoms/Stack';
import Icon from '../atoms/Icon';
import Card from './Card';
import { useTheme } from '../../theme';
import { hexToRgba, darken, readableOn, resolveAccent } from '../../theme/colorUtils';
import { games, GAME_ICONS } from '../../data/games';

interface GameOverCardProps {
    gameId: string;
    /** Receives the resolved per-game accent so the screen's actions can match the brand. */
    children: (colors: { accent: string; onAccent: string }) => React.ReactNode;
}

/**
 * End-of-game result panel. Mirrors the home/setup visual language: an accent
 * gradient medallion of the game's icon, an accent-tinted border with a soft
 * colored glow, extra-rounded corners, and airy vertical rhythm.
 */
function GameOverCard({ gameId, children }: GameOverCardProps) {
    const theme = useTheme();
    const game = games.find((g) => g.id === gameId) ?? games[0];
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);
    const GameIcon = GAME_ICONS[game.iconName];
    const gradientId = `gameover-medallion-${game.id}`;

    return (
        <Card
            variant='elevated'
            padding='lg'
            style={[
                styles.card,
                {
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
                <View style={[styles.medallion, { borderRadius: theme.radii.xl }]}>
                    <View
                        style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.xl, overflow: 'hidden' }]}
                        pointerEvents='none'
                    >
                        <Svg width='100%' height='100%'>
                            <Defs>
                                <SvgGradient id={gradientId} x1='0' y1='0' x2='1' y2='1'>
                                    <Stop offset='0' stopColor={accent} />
                                    <Stop offset='1' stopColor={darken(accent, 0.4)} />
                                </SvgGradient>
                            </Defs>
                            <Rect x='0' y='0' width='100%' height='100%' fill={`url(#${gradientId})`} />
                        </Svg>
                    </View>
                    {GameIcon ? <Icon name={GameIcon} size={44} color={onAccent} /> : null}
                </View>
                {children({ accent, onAccent })}
            </Stack>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        maxWidth: 380,
    },
    medallion: {
        width: 88,
        height: 88,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});

export default React.memo(GameOverCard);
