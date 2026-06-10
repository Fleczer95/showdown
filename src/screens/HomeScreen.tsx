import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { Settings, ArrowRight, ShoppingBag } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import { useTheme } from '../theme';
import { hexToRgba, darken, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS, type Game } from '../data/games';
import { useProgression } from '../hooks/useProgression';
import Pressable from '../components/atoms/HapticPressable';

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
 * Brand wordmark: "ShowDown" rendered as an SVG gradient (theme.wordmarkGradient)
 * on a transparent background. Auto-fits the font size to the measured width so it
 * never clips beside the header icons.
 */
function Wordmark() {
    const theme = useTheme();
    const [width, setWidth] = useState(220);
    const stops = theme.wordmarkGradient;
    const fontSize = Math.min(40, Math.max(24, width / 4.6));
    const h = Math.round(fontSize * 1.25);

    return (
        <View
            style={{ height: h, justifyContent: 'center' }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
            <Svg width={width} height={h}>
                <Defs>
                    <SvgGradient id='home-wordmark' x1='0' y1='0' x2='1' y2='0'>
                        <Stop offset='0' stopColor={stops[0]} />
                        <Stop offset='1' stopColor={stops[stops.length - 1]} />
                    </SvgGradient>
                </Defs>
                <SvgText
                    fill='url(#home-wordmark)'
                    fontFamily='Fredoka_700Bold'
                    fontSize={fontSize}
                    x={0}
                    y={fontSize}
                    letterSpacing={-1}
                >
                    ShowDown
                </SvgText>
            </Svg>
        </View>
    );
}

/**
 * Full-width level progress strip for the Home header: "Poz. N ▰▰▰▱▱▱". Sits on its
 * own row below the wordmark so it never competes for width. Opens the Progress
 * screen, the home for the Level Map, achievements and earned cosmetics.
 */
function LevelBar({ onPress }: { onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { level, progress } = useProgression();
    const fill = progress.span > 0 ? Math.max(0, Math.min(1, progress.intoLevel / progress.span)) : 1;

    return (
        <Pressable
            onPress={onPress}
            haptic='light'
            accessibilityLabel={t('progression.title')}
            style={[
                styles.levelBar,
                {
                    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                    borderRadius: theme.radii.full,
                    paddingHorizontal: theme.spacing.md,
                },
            ]}
        >
            <Text variant='caption' weight='bold' color={theme.colors.primary}>
                {t('progression.levelShort', { n: level })}
            </Text>
            <View style={[styles.levelBarTrack, { backgroundColor: hexToRgba(theme.colors.primary, 0.25) }]}>
                <View style={[styles.levelBarFill, { width: `${fill * 100}%`, backgroundColor: theme.colors.primary }]} />
            </View>
        </Pressable>
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
                <View style={{ gap: theme.spacing.md }}>
                    <View style={styles.header}>
                        <View style={[styles.titleContainer, { paddingLeft: theme.spacing.xs }]}>
                            <Wordmark />
                        </View>
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
                    <LevelBar onPress={() => navigation.navigate('Progress')} />
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
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    levelBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 36,
    },
    levelBarTrack: {
        flex: 1,
        height: 6,
        borderRadius: 9999,
        overflow: 'hidden',
    },
    levelBarFill: {
        height: 6,
        borderRadius: 9999,
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
