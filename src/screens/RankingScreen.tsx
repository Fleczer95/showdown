import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChevronLeft, RefreshCw, WifiOff } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Glyph from '../components/atoms/Glyph';
import RankBadge from '../components/atoms/RankBadge';
import Pressable from '../components/atoms/HapticPressable';
import ActivityIndicator from '../components/atoms/ActivityIndicator';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import ToggleGroup from '../components/molecules/ToggleGroup';
import { useTheme } from '../theme';
import { hexToRgba, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS } from '../data/games';
import { useResponsive } from '../responsive/useResponsive';
import type { RootStackParamList } from '../navigation/types';
import {
    ALLTIME_PERIOD,
    RANKED_GAMES,
    ROLLOVER_THRESHOLD,
    monthBucketId,
    previousMonthBucketId,
    type RankedGame,
    type RankingScope,
} from '../game/ranking/config';
import { resolveDisplayedMonth } from '../game/ranking/rank';
import { getBoard, countEntries } from '../game/ranking/store';
import { readCachedBoard, writeCachedBoard } from '../game/ranking/cache';
import { getLocalState } from '../game/ranking/local';
import { retryPending } from '../game/ranking/push';
import { signatureEmoji } from '../game/progression';
import { OfflineError, BlockedError } from '../game/challenge/store';
import type { LocalBest, RankingEntry } from '../game/ranking/types';

/** A locale-aware "May 2026" label for a `YYYY-MM` bucket. */
function formatMonth(monthId: string, locale: string): string {
    const [year, month] = monthId.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** Variant A: a compact accent medallion tile, one per ranked game. */
function GameTab({ game, active, onPress }: { game: RankedGame; active: boolean; onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { iconSize, scale } = useResponsive();
    const def = games.find((g) => g.id === game);
    const accent = def ? resolveAccent(theme, def.accent) : theme.colors.primary;
    const GameIcon = def ? GAME_ICONS[def.iconName] : null;

    return (
        <Pressable
            onPress={onPress}
            haptic='light'
            accessibilityLabel={t(`game.${game}.name`)}
            style={[
                styles.gameTab,
                {
                    gap: scale(6),
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: scale(6),
                    borderRadius: theme.radii.lg,
                    backgroundColor: active ? accent : hexToRgba(accent, 0.12),
                    borderColor: active ? accent : hexToRgba(accent, 0.35),
                },
            ]}
        >
            {GameIcon ? <Icon name={GameIcon} size={iconSize(24)} color={active ? readableOn(accent) : accent} /> : null}
            <Text variant='caption' weight='bold' color={active ? readableOn(accent) : 'text'} numberOfLines={1}>
                {t(`game.${game}.name`)}
            </Text>
        </Pressable>
    );
}

function BoardRow({ rank, entry }: { rank: number; entry: RankingEntry }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { iconSize, scale } = useResponsive();
    const sig = signatureEmoji(entry.signature);
    const isTop3 = rank <= 3;

    return (
        <View
            style={[
                styles.row,
                { 
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.md,
                    gap: theme.spacing.md,
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.lg,
                    borderWidth: StyleSheet.hairlineWidth,
                    shadowColor: theme.shadows.sm.shadowColor,
                    shadowOffset: theme.shadows.sm.shadowOffset,
                    shadowOpacity: theme.shadows.sm.shadowOpacity,
                    shadowRadius: theme.shadows.sm.shadowRadius,
                    elevation: theme.shadows.sm.elevation,
                    marginBottom: theme.spacing.sm,
                },
            ]}
        >
            <RankBadge rank={rank} />


            <View style={[styles.name, { gap: scale(6) }]}>
                {sig ? <Glyph emoji={sig} size={iconSize(16)} /> : null}
                <Text variant='body' weight='semibold' numberOfLines={1} style={styles.nameText}>
                    {entry.nickname}
                </Text>
            </View>
            <Text variant='body' weight='bold' style={styles.score} color={isTop3 ? 'text' : 'textSecondary'}>
                {`${entry.score.toLocaleString(locale)} ${t('leaderboard.points')}`}
            </Text>
        </View>
    );
}

/** The player's own best for the active scope: score plus synced/pending status. */
function BestChip({ best, onRetry }: { best: LocalBest; onRetry: () => void }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { iconSize, scale } = useResponsive();
    return (
        <View
            style={[
                styles.chip,
                { 
                    gap: theme.spacing.md,
                    padding: scale(14),
                    borderRadius: theme.radii.lg, 
                    backgroundColor: hexToRgba(theme.colors.primary, 0.1),
                    borderColor: hexToRgba(theme.colors.primary, 0.3),
                    borderWidth: 1,
                },
            ]}
        >
            <Stack gap='xs' flex={1}>
                <Text variant='caption' weight='bold' color='primary'>
                    {t('ranking.yourBest')}
                </Text>
                <Text variant='body' weight='bold'>
                    {`${best.score.toLocaleString(locale)} ${t('leaderboard.points')}`}
                </Text>
            </Stack>
            {best.synced ? (
                <View style={{ backgroundColor: hexToRgba(theme.colors.success, 0.15), paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.full }}>
                    <Text variant='caption' weight='bold' color='success'>
                        {t('ranking.synced')}
                    </Text>
                </View>
            ) : (
                <Pressable onPress={onRetry} haptic='light' style={[styles.retry, { gap: scale(6) }]}>
                    <Icon name={RefreshCw} size={iconSize(14)} color={theme.colors.primary} />
                    <Text variant='caption' weight='bold' color='primary'>
                        {t('ranking.pending')} · {t('ranking.retry')}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}

/**
 * Global ranking boards (ADR-0004). A per-game, score-only bounded leaderboard
 * fed by async challenges, with This Month / All Time tabs and the delayed
 * monthly switch (show the previous month until the current one fills up).
 */
export function RankingScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'Ranking'>>();
    const theme = useTheme();
    const { tabletColumn, iconSize, scale } = useResponsive();
    const { t, locale } = useTranslation();
    const reduceMotion = useReducedMotion();

    const initialGame = (RANKED_GAMES as readonly string[]).includes(route.params?.gameId ?? '')
        ? (route.params!.gameId as RankedGame)
        : RANKED_GAMES[0];
    const [game, setGame] = useState<RankedGame>(initialGame);
    const [scope, setScope] = useState<RankingScope>('month');

    const [board, setBoard] = useState<RankingEntry[] | null>(null);
    const [displayedMonth, setDisplayedMonth] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading');

    const currentMonth = monthBucketId();

    const load = useCallback(async () => {
        setStatus('loading');
        // A board barely moves minute-to-minute, so serve a day-fresh cached pull
        // when there is one — zero Firestore reads, and it works offline (ADR-0004).
        const cached = readCachedBoard(game, scope);
        if (cached) {
            setBoard(cached.board);
            setDisplayedMonth(cached.displayedMonth);
            setStatus('ready');
            return;
        }
        try {
            let nextBoard: RankingEntry[];
            let displayed: string | null;
            if (scope === 'alltime') {
                nextBoard = await getBoard(game, ALLTIME_PERIOD);
                displayed = null;
            } else {
                // Delayed switch: stay on the previous month until the current one
                // reaches the threshold (count() decides, no full read).
                const currentCount = await countEntries(game, currentMonth);
                const previousMonth = previousMonthBucketId(currentMonth);
                // Only skip the previous-month read once the current month has rolled
                // over (>= threshold); below it we still need previousCount to decide
                // whether to keep showing last month's fuller board (ADR-0004).
                const previousCount = currentCount >= ROLLOVER_THRESHOLD ? 0 : await countEntries(game, previousMonth);
                const which = resolveDisplayedMonth({ currentCount, previousCount });
                displayed = which === 'current' ? currentMonth : previousMonth;
                nextBoard = await getBoard(game, displayed);
            }
            writeCachedBoard(game, scope, nextBoard, displayed);
            setBoard(nextBoard);
            setDisplayedMonth(displayed);
            setStatus('ready');
        } catch (err) {
            if (err instanceof BlockedError) setStatus('error');
            else if (err instanceof OfflineError) setStatus('offline');
            else setStatus('ready');
        }
    }, [game, scope, currentMonth]);

    useEffect(() => {
        load();
    }, [load]);

    // The player's own best for the chip (month scope only counts this month).
    const localState = getLocalState(game);
    const best =
        scope === 'alltime'
            ? localState.allTime
            : localState.month?.monthId === currentMonth
              ? localState.month
              : undefined;

    const handleRetrySync = useCallback(async () => {
        await retryPending();
        load();
    }, [load]);

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('common.home')}
                />
                <View style={styles.titleCol}>
                    <Text variant='heading' weight='bold' align='center'>
                        {t('ranking.title')}
                    </Text>
                    <Text variant='caption' color='textSecondary' align='center'>
                        {t('ranking.subtitle')}
                    </Text>
                </View>
                <View style={{ width: scale(44) }} />
            </View>

            <View style={[{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.lg, flex: 1 }, tabletColumn]}>
                {/* Variant A — accent game medallions */}
                <Stack direction='horizontal' gap='sm'>
                    {RANKED_GAMES.map((g) => (
                        <View key={g} style={styles.gameTabSlot}>
                            <GameTab game={g} active={g === game} onPress={() => setGame(g)} />
                        </View>
                    ))}
                </Stack>

                <ToggleGroup
                    value={scope}
                    onChange={(v) => setScope(v as RankingScope)}
                    options={[
                        { value: 'month', label: t('ranking.month') },
                        { value: 'alltime', label: t('ranking.allTime') },
                    ]}
                />

                {scope === 'month' && displayedMonth ? (
                    <Text variant='caption' weight='bold' color='textSecondary'>
                        {formatMonth(displayedMonth, locale)}
                    </Text>
                ) : null}

                <Animated.View
                    key={status}
                    entering={reduceMotion ? undefined : FadeIn.duration(250)}
                    style={styles.contentArea}
                >
                {status === 'loading' ? (
                    <View style={[styles.centered, { gap: theme.spacing.md }]}>
                        <ActivityIndicator />
                    </View>
                ) : status === 'offline' || status === 'error' ? (
                    <View style={[styles.centered, { gap: theme.spacing.md }]}>
                        <Icon name={WifiOff} size={iconSize(36)} color={theme.colors.textMuted} />
                        <Text variant='body' weight='bold' align='center'>
                            {t(status === 'error' ? 'ranking.error' : 'ranking.offline')}
                        </Text>
                        <Text variant='caption' color='textSecondary' align='center'>
                            {t(status === 'error' ? 'ranking.errorDesc' : 'ranking.offlineDesc')}
                        </Text>
                        <Button
                            variant='secondary'
                            onPress={load}
                            icon={<RefreshCw size={iconSize(18)} color={theme.colors.text} />}
                        >
                            {t('ranking.loadRetry')}
                        </Button>
                    </View>
                ) : (
                    <FlatList
                        data={board ?? []}
                        keyExtractor={(_, i) => `${i}`}
                        renderItem={({ item, index }) => <BoardRow rank={index + 1} entry={item} />}
                        ListEmptyComponent={
                            <Text
                                variant='body'
                                color='textMuted'
                                align='center'
                                style={{ marginTop: theme.spacing.xl }}
                            >
                                {t('ranking.empty')}
                            </Text>
                        }
                        ListFooterComponent={
                            <Stack gap='md' style={{ marginTop: theme.spacing.lg }}>
                                {best ? <BestChip best={best} onRetry={handleRetrySync} /> : null}

                                <Text variant='caption' color='textMuted'>
                                    {t('ranking.updatesNote')}
                                </Text>
                                <Text variant='caption' color='textMuted'>
                                    {t('ranking.rolloverNote')}
                                </Text>
                                {best && !best.synced ? (
                                    <Text variant='caption' color='textMuted'>
                                        {t('ranking.connectivityNote')}
                                    </Text>
                                ) : null}
                            </Stack>
                        }
                        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
                </Animated.View>
            </View>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleCol: {
        flex: 1,
        alignItems: 'center',
    },
    contentArea: {
        flex: 1,
    },
    gameTabSlot: {
        flex: 1,
    },
    gameTab: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    name: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameText: {
        flexShrink: 1,
    },
    score: {
        textAlign: 'right',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    retry: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
