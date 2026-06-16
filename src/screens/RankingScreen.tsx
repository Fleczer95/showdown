import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChevronLeft, RefreshCw, WifiOff } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Pressable from '../components/atoms/HapticPressable';
import ActivityIndicator from '../components/atoms/ActivityIndicator';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import ToggleGroup from '../components/molecules/ToggleGroup';
import { useTheme } from '../theme';
import { hexToRgba, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS } from '../data/games';
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
import { getLocalState } from '../game/ranking/local';
import { retryPending } from '../game/ranking/push';
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
                    borderRadius: theme.radii.lg,
                    backgroundColor: active ? accent : hexToRgba(accent, 0.12),
                    borderColor: active ? accent : hexToRgba(accent, 0.35),
                },
            ]}
        >
            {GameIcon ? <Icon name={GameIcon} size={24} color={active ? readableOn(accent) : accent} /> : null}
            <Text variant='caption' weight='bold' color={active ? readableOn(accent) : 'text'} numberOfLines={1}>
                {t(`game.${game}.name`)}
            </Text>
        </Pressable>
    );
}

function BoardRow({ rank, entry }: { rank: number; entry: RankingEntry }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    return (
        <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <Text variant='body' weight='bold' color='textSecondary' style={styles.rank}>
                {rank}
            </Text>
            <Text variant='body' weight='semibold' numberOfLines={1} style={styles.name}>
                {entry.nickname}
            </Text>
            <Text variant='body' weight='bold' style={styles.score}>
                {`${entry.score.toLocaleString(locale)} ${t('leaderboard.points')}`}
            </Text>
        </View>
    );
}

/** The player's own best for the active scope: score plus synced/pending status. */
function BestChip({ best, onRetry }: { best: LocalBest; onRetry: () => void }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    return (
        <View
            style={[styles.chip, { borderRadius: theme.radii.lg, backgroundColor: hexToRgba(theme.colors.primary, 0.1) }]}
        >
            <Stack gap='xs' flex={1}>
                <Text variant='caption' color='textSecondary'>
                    {t('ranking.yourBest')}
                </Text>
                <Text variant='body' weight='bold'>
                    {`${best.score.toLocaleString(locale)} ${t('leaderboard.points')}`}
                </Text>
            </Stack>
            {best.synced ? (
                <Text variant='caption' color='success'>
                    {t('ranking.synced')}
                </Text>
            ) : (
                <Pressable onPress={onRetry} haptic='light' style={styles.retry}>
                    <Icon name={RefreshCw} size={14} color={theme.colors.primary} />
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
    const { t, locale } = useTranslation();

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
        try {
            if (scope === 'alltime') {
                setBoard(await getBoard(game, ALLTIME_PERIOD));
                setDisplayedMonth(null);
            } else {
                // Delayed switch: stay on the previous month until the current one
                // reaches the threshold (count() decides, no full read).
                const currentCount = await countEntries(game, currentMonth);
                const previousMonth = previousMonthBucketId(currentMonth);
                // Only skip the previous-month read once the current month has rolled
                // over (>= threshold); below it we still need previousCount to decide
                // whether to keep showing last month's fuller board (ADR-0004).
                const previousCount =
                    currentCount >= ROLLOVER_THRESHOLD ? 0 : await countEntries(game, previousMonth);
                const which = resolveDisplayedMonth({ currentCount, previousCount });
                const period = which === 'current' ? currentMonth : previousMonth;
                setBoard(await getBoard(game, period));
                setDisplayedMonth(period);
            }
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
        <SafeContainer edges={['top', 'bottom']}>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={24} color={theme.colors.text} />}
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
                <View style={{ width: 44 }} />
            </View>

            <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.lg, flex: 1 }}>
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

                {status === 'loading' ? (
                    <View style={styles.centered}>
                        <ActivityIndicator />
                    </View>
                ) : status === 'offline' || status === 'error' ? (
                    <View style={styles.centered}>
                        <Icon name={WifiOff} size={36} color={theme.colors.textMuted} />
                        <Text variant='body' weight='bold' align='center'>
                            {t(status === 'error' ? 'ranking.error' : 'ranking.offline')}
                        </Text>
                        <Text variant='caption' color='textSecondary' align='center'>
                            {t(status === 'error' ? 'ranking.errorDesc' : 'ranking.offlineDesc')}
                        </Text>
                        <Button variant='secondary' onPress={load} icon={<RefreshCw size={18} color={theme.colors.text} />}>
                            {t('ranking.loadRetry')}
                        </Button>
                    </View>
                ) : (
                    <FlatList
                        data={board ?? []}
                        keyExtractor={(_, i) => `${i}`}
                        renderItem={({ item, index }) => <BoardRow rank={index + 1} entry={item} />}
                        ListEmptyComponent={
                            <Text variant='body' color='textMuted' align='center' style={{ marginTop: theme.spacing.xl }}>
                                {t('ranking.empty')}
                            </Text>
                        }
                        ListFooterComponent={
                            <Stack gap='md' style={{ marginTop: theme.spacing.lg }}>
                                {best ? <BestChip best={best} onRetry={handleRetrySync} /> : null}

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
    gameTabSlot: {
        flex: 1,
    },
    gameTab: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rank: {
        width: 28,
        textAlign: 'center',
    },
    name: {
        flex: 1,
    },
    score: {
        textAlign: 'right',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
    },
    retry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
});
