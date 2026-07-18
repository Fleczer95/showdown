import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Settings, ArrowRight, ShoppingBag, Swords, Trophy } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import { useResponsive } from '../responsive/useResponsive';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import { useTheme } from '../theme';
import { hexToRgba, darken, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS, type Game } from '../data/games';
import { useProgression } from '../hooks/useProgression';
import Pressable from '../components/atoms/HapticPressable';
import SegmentedProgress from '../components/molecules/SegmentedProgress';
import { useMascotEmit } from '../game/mascot/reactions/useMascotDirector';
import { canUpsell } from '../game/challenge/limit';
import { remainingOfflineRuns } from '../game/offline/limit';
import { useStore } from '../hooks/store/useStore';

/**
 * Accent-forward game card: a dark elevated card whose per-game color shows up
 * as an icon medallion, accent chevron, and a soft accent border + glow.
 */
function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { scale, iconSize } = useResponsive();
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
                <View style={[styles.iconContainer, { width: scale(56), height: scale(56), borderRadius: theme.radii.xl }]}>
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
                    {GameIcon ? <Icon name={GameIcon} size={iconSize(28)} color={onAccent} /> : null}
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
                    style={[styles.ctaPill, { width: scale(40), height: scale(40), backgroundColor: hexToRgba(accent, 0.16), borderRadius: theme.radii.full }]}
                    pointerEvents='none'
                >
                    <Icon name={ArrowRight} size={iconSize(20)} color={accent} />
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
 * Full-width level progress strip for the Home header: a solid level chip, a row
 * of glowing segmented pips (▰▰▰▱▱), then the XP count. Sits on its own row below
 * the wordmark so it never competes for width. Opens the Progress screen, the
 * home for the Level Map, achievements and earned cosmetics.
 */
function LevelBar({ onPress }: { onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { scale } = useResponsive();
    const { level, progress } = useProgression();
    const fill = progress.span > 0 ? Math.max(0, Math.min(1, progress.intoLevel / progress.span)) : 1;

    return (
        <Pressable
            onPress={onPress}
            haptic='light'
            accessibilityLabel={t('progression.title')}
            style={[
                styles.levelBar,
                theme.shadows.sm,
                {
                    height: scale(44),
                    gap: theme.spacing.md,
                    paddingLeft: theme.spacing.sm,
                    paddingRight: theme.spacing.lg,
                    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                    borderRadius: theme.radii.full,
                    borderWidth: 1,
                    borderColor: hexToRgba(theme.colors.primary, 0.18),
                },
            ]}
        >
            <View style={[styles.levelChip, { height: scale(28), paddingHorizontal: scale(12), backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
                <Text variant='caption' weight='bold' color={readableOn(theme.colors.primary)}>
                    {t('progression.levelShort', { n: level })}
                </Text>
            </View>
            <SegmentedProgress progress={fill} color='primary' style={styles.levelPips} />
            {progress.span > 0 ? (
                <Text variant='caption' weight='bold' color='textSecondary'>
                    {`${progress.intoLevel}/${progress.span}`}
                </Text>
            ) : null}
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
    const { tabletColumn, iconSize, width, fontScale } = useResponsive();
    const competeColor = theme.components.button.secondary.text;
    // Preserve the compact two-up dock when both labels have room. Dynamic Type
    // effectively narrows that room, so treat width relative to font scale just
    // like a physically compact screen and stack before either label truncates.
    const stackCompeteDock = width / Math.max(fontScale, 1) < 360;
    const { purchasedItemIds, isPremium } = useStore();
    const ownedIds = useMemo(() => new Set(purchasedItemIds), [purchasedItemIds]);
    const { streak } = useProgression();

    // Tell the mascot director we've landed on Home (greeting + idle drip live in
    // the app-root host now); nudge the offline-limit upsell when it applies.
    const emitMascot = useMascotEmit();
    useFocusEffect(
        useCallback(() => {
            emitMascot('home-focus', { streak });
            if (remainingOfflineRuns(ownedIds, isPremium) === 0 && canUpsell(ownedIds, isPremium)) {
                emitMascot('offline-limit', {});
            }
        }, [emitMascot, streak, ownedIds, isPremium]),
    );

    const openGame = (game: Game) => navigation.navigate(game.setupRoute, { gameId: game.id });

    // Themed container style
    const contentContainerStyle = [
        styles.content,
        {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.lg, // fixed footer holds the bottom action
            gap: theme.spacing.xl,
        },
        tabletColumn,
    ];

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                testID='home-scroll'
                style={styles.root}
                contentContainerStyle={contentContainerStyle}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ gap: theme.spacing.md }}>
                    <View style={styles.header}>
                        <View style={[styles.titleContainer, { paddingLeft: theme.spacing.md }]}>
                            <Wordmark />
                        </View>
                        <View style={[styles.headerActions, { gap: theme.spacing.sm }]}>
                            <IconButton
                                icon={<ShoppingBag size={iconSize(24)} color={theme.colors.text} />}
                                onPress={() => navigation.navigate('Store')}
                                size='md'
                                accessibilityLabel={t('screen.home.store')}
                            />
                            <IconButton
                                icon={<Settings size={iconSize(24)} color={theme.colors.text} />}
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

            {/* Fixed Compete dock: both social destinations stay labeled and in the thumb zone. */}
            <View
                testID='home-compete-footer'
                style={[
                    styles.footer,
                    {
                        paddingHorizontal: theme.spacing.xl,
                        paddingTop: theme.spacing.md,
                        paddingBottom: theme.spacing.sm,
                    },
                    tabletColumn,
                ]}
            >
                <View
                    testID='home-compete-dock'
                    style={[
                        styles.competeDock,
                        { gap: theme.spacing.sm },
                        stackCompeteDock && styles.competeDockStacked,
                    ]}
                >
                    <View
                        testID='home-challenges-action'
                        style={stackCompeteDock ? styles.competeActionStacked : styles.competeAction}
                    >
                        <Button
                            variant='secondary'
                            fullWidth
                            contentGap='sm'
                            onPress={() => navigation.navigate('ChallengeHistory')}
                            icon={<Icon name={Swords} size={iconSize(20)} color={competeColor} />}
                            accessibilityLabel={t('screen.home.challenges')}
                        >
                            {t('screen.home.challenges')}
                        </Button>
                    </View>
                    <View
                        testID='home-rankings-action'
                        style={stackCompeteDock ? styles.competeActionStacked : styles.competeAction}
                    >
                        <Button
                            variant='secondary'
                            fullWidth
                            contentGap='sm'
                            onPress={() => navigation.navigate('Ranking')}
                            icon={<Icon name={Trophy} size={iconSize(20)} color={competeColor} />}
                            accessibilityLabel={t('ranking.title')}
                        >
                            {t('screen.home.rankings')}
                        </Button>
                    </View>
                </View>
            </View>
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
    footer: {
        // pinned below the ScrollView; horizontal/vertical padding from theme
    },
    competeDock: {
        flexDirection: 'row',
        width: '100%',
    },
    competeDockStacked: {
        flexDirection: 'column',
    },
    competeAction: {
        flex: 1,
        minWidth: 0,
    },
    competeActionStacked: {
        width: '100%',
        minWidth: 0,
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
        alignItems: 'center',
    },
    levelBar: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    levelChip: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    levelPips: {
        flex: 1,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ctaPill: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
