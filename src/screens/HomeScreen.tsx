import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { Settings, ArrowRight, ShoppingBag } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import { useTheme, type ResolvedTheme } from '../theme';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS, type Game, type GameAccent } from '../data/games';

// ── Color helpers ─────────────────────────────────────────────────

/** Normalize #RGB / #RRGGBB to [r, g, b]. */
function toRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function hexToRgba(hex: string, alpha: number): string {
    const [r, g, b] = toRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex toward black by `amount` (0..1) — used for the medallion gradient. */
function darken(hex: string, amount: number): string {
    const [r, g, b] = toRgb(hex).map((c) => Math.round(c * (1 - amount)));
    return `rgb(${r}, ${g}, ${b})`;
}

/** Pick a readable glyph color (#1A1A2E or #FFFFFF) for an icon sitting on `hex`. */
function readableOn(hex: string): string {
    const [r, g, b] = toRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#1A1A2E' : '#FFFFFF';
}

/** Resolve a game's themeable accent, falling back to a role token. */
const ACCENT_FALLBACK: Record<GameAccent, 'primary' | 'secondary' | 'warning'> = {
    accent1: 'primary',
    accent2: 'warning',
    accent3: 'secondary',
};
function resolveAccent(theme: ResolvedTheme, token: GameAccent): string {
    return theme.gameAccents?.[token] ?? theme.colors[ACCENT_FALLBACK[token]];
}

/**
 * Accent-forward game card: a dark elevated card whose per-game color shows up
 * as an icon medallion, accent chevron, and a soft accent border + glow.
 */
function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);
    const GameIcon = GAME_ICONS[game.iconName];
    const gradientId = `medallion-${game.id}`;

    return (
        <Card
            variant='elevated'
            padding='lg'
            onPress={onPress}
            haptic='light'
            accessibilityLabel={t(`game.${game.id}.name`)}
            style={{
                borderRadius: theme.radii.xl,
                borderColor: hexToRgba(accent, 0.5),
                shadowColor: accent,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
            }}
        >
            <Stack direction='horizontal' gap='lg' align='center'>
                <View style={[styles.iconContainer, { borderRadius: theme.radii.xl }]}>
                    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
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
                    {GameIcon ? <Icon name={GameIcon} size={28} color={onAccent} /> : null}
                </View>
                <Stack gap='xs' flex={1}>
                    <Text variant='heading' weight='bold'>
                        {t(`game.${game.id}.name`)}
                    </Text>
                    <Text variant='caption' color='textSecondary' numberOfLines={2}>
                        {t(`game.${game.id}.desc`)}
                    </Text>
                </Stack>
                <View
                    style={[styles.ctaPill, { backgroundColor: hexToRgba(accent, 0.16), borderRadius: theme.radii.full }]}
                    pointerEvents='none'
                >
                    <Icon name={ArrowRight} size={20} color={accent} />
                </View>
            </Stack>
        </Card>
    );
}

/**
 * Home screen. Lists the ShowDown game modes; tapping a card opens that game's
 * setup screen via the root navigator.
 */
export function HomeScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();

    const openGame = (game: Game) => navigation.navigate(game.setupRoute, { gameId: game.id });

    // Themed container style
    const contentContainerStyle = [
        styles.content,
        {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xxl + theme.spacing.sm, // approx 40
            gap: theme.spacing.xl,
        },
    ];

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                style={styles.root}
                contentContainerStyle={contentContainerStyle}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Stack gap='xs' style={[styles.titleContainer, { paddingLeft: theme.spacing.xs }]}>
                        <Text variant='display' weight='bold' color='primary' style={styles.title}>
                            ShowDown
                        </Text>
                        <Text variant='subheading' color='textSecondary' weight='medium'>
                            {t('screen.home.tagline')}
                        </Text>
                    </Stack>
                    <View style={styles.headerActions}>
                        <IconButton
                            icon={<ShoppingBag size={24} color={theme.colors.text} />}
                            onPress={() => navigation.navigate('Store')}
                            size='md'
                            accessibilityLabel={t('screen.home.store')}
                        />
                        <IconButton
                            icon={<Settings size={24} color={theme.colors.text} />}
                            onPress={() => navigation.navigate('Settings')}
                            size='md'
                            accessibilityLabel={t('screen.home.settings')}
                        />
                    </View>
                </View>

                <Stack gap='lg'>
                    {games.map((game) => (
                        <GameCard key={game.id} game={game} onPress={() => openGame(game)} />
                    ))}
                </Stack>
            </ScrollView>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        // padding/gap moved to themed style
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    title: {
        letterSpacing: -1,
    },
    iconContainer: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ctaPill: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
