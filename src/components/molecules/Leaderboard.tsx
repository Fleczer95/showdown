import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Crown, Medal } from 'lucide-react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import Glyph from '../atoms/Glyph';
import Input from './Input';
import Button from './Button';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n/TranslationContext';
import { games } from '../../data/games';
import {
    getBoard,
    saveScore,
    getLastNickname,
    setLastNickname,
    qualifies,
    MAX_NICKNAME_LENGTH,
    type LeaderboardEntry,
} from '../../game/leaderboard';
import { signatureEmoji } from '../../game/progression';

interface LeaderboardProps {
    gameId: string;
    /** When set, enables the post-game entry flow for this just-achieved score. */
    pendingScore?: number;
    /** How far the just-played run got; primary ranking key and the no-empty-run gate. */
    pendingProgress?: number;
}

const RANK_COLORS = {
    1: '#FFD700', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
};

function Leaderboard({ gameId, pendingScore, pendingProgress }: LeaderboardProps) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const reduceMotion = useReducedMotion();

    const [board, setBoard] = useState<LeaderboardEntry[]>(() => getBoard(gameId));
    const [nickname, setNickname] = useState<string>(() => getLastNickname());
    const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);

    const canEnter =
        pendingScore !== undefined &&
        pendingProgress !== undefined &&
        pendingProgress > 0 &&
        savedTimestamp === null &&
        qualifies(board, pendingProgress, pendingScore);
    const trimmed = nickname.trim();

    const formatScore = (score: number): string => `${score.toLocaleString(locale)} ${t('leaderboard.points')}`;

    const formatDate = (timestamp: number): string =>
        new Date(timestamp).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

    const formatProgress = (progress: number): string => {
        const game = games.find((g) => g.id === gameId);
        return game ? t(game.progressLabelKey, { n: progress }) : '';
    };

    const handleSave = () => {
        if (pendingScore === undefined || pendingProgress === undefined || trimmed.length === 0) return;
        const entry = saveScore(gameId, trimmed, pendingScore, pendingProgress);
        setLastNickname(entry.nickname);
        setBoard(getBoard(gameId));
        setSavedTimestamp(entry.timestamp);
    };

    const rows = useMemo(
        () =>
            board.map((entry, i) => {
                const rank = i + 1;
                const highlighted = entry.timestamp === savedTimestamp;
                const sig = signatureEmoji(entry.signature);
                const rankColor = rank <= 3 ? RANK_COLORS[rank as keyof typeof RANK_COLORS] : theme.colors.textMuted;
                const isTop3 = rank <= 3;
                
                return (
                    <Animated.View
                        key={`${entry.timestamp}-${i}`}
                        entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).duration(400)}
                        style={[
                            styles.row,
                            { 
                                backgroundColor: highlighted ? hexToRgba(theme.colors.primary, 0.15) : theme.colors.surface,
                                borderColor: highlighted ? theme.colors.primary : theme.colors.border,
                                borderRadius: theme.radii.lg,
                                borderWidth: highlighted ? 1 : StyleSheet.hairlineWidth,
                                shadowColor: theme.shadows.sm.shadowColor,
                                shadowOffset: theme.shadows.sm.shadowOffset,
                                shadowOpacity: theme.shadows.sm.shadowOpacity,
                                shadowRadius: theme.shadows.sm.shadowRadius,
                                elevation: theme.shadows.sm.elevation,
                            },
                        ]}
                    >
                        <View style={[styles.rankBadge, isTop3 && { backgroundColor: hexToRgba(rankColor, 0.2) }]}>
                            {rank === 1 ? (
                                <Icon name={Crown} size={16} color={rankColor} />
                            ) : rank === 2 || rank === 3 ? (
                                <Icon name={Medal} size={16} color={rankColor} />
                            ) : (
                                <Text variant="caption" weight="bold" color="textMuted">
                                    {rank}
                                </Text>
                            )}
                        </View>
                        
                        <View style={styles.nameCol}>
                            <View style={styles.nameLine}>
                                {sig ? <Glyph emoji={sig} size={16} /> : null}
                                <Text
                                    variant='body'
                                    weight={highlighted ? 'bold' : 'semibold'}
                                    numberOfLines={1}
                                    style={styles.nameText}
                                >
                                    {entry.nickname}
                                </Text>
                            </View>
                            <Text variant='caption' color='textSecondary' numberOfLines={1}>
                                {formatProgress(entry.progress)}
                            </Text>
                        </View>
                        
                        <Stack align="end" gap="xs">
                            <Text variant='body' weight='bold' style={styles.score} color={isTop3 ? 'text' : 'textSecondary'}>
                                {formatScore(entry.score)}
                            </Text>
                            <Text variant='caption' color='textMuted' style={styles.date}>
                                {formatDate(entry.timestamp)}
                            </Text>
                        </Stack>
                    </Animated.View>
                );
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [board, savedTimestamp, theme, gameId, reduceMotion],
    );

    return (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)} style={styles.container}>
            <Stack gap='md' align='stretch' style={styles.listContainer}>
                {board.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text variant='body' color='textMuted' align='center'>
                            {t('leaderboard.empty')}
                        </Text>
                    </View>
                ) : (
                    <Stack gap='sm'>{rows}</Stack>
                )}

                {savedTimestamp !== null ? (
                    <Animated.View entering={FadeIn} style={styles.successMessage}>
                        <Text variant='caption' weight='bold' color='success' align='center'>
                            {t('leaderboard.saved')}
                        </Text>
                    </Animated.View>
                ) : null}

                {canEnter ? (
                    <Animated.View entering={FadeInDown.delay(200)} style={[styles.entryForm, { backgroundColor: hexToRgba(theme.colors.primary, 0.05), borderRadius: theme.radii.lg, borderColor: hexToRgba(theme.colors.primary, 0.2), borderWidth: 1 }]}>
                        <Stack gap='sm' align='stretch'>
                            <Text variant="caption" weight="bold" color="primary" align="center">
                                {t('leaderboard.newHighScore')}
                            </Text>
                            <Input
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder={t('leaderboard.nicknamePlaceholder')}
                                maxLength={MAX_NICKNAME_LENGTH}
                                clearable
                                autoFocus
                                autoCapitalize='words'
                                returnKeyType='done'
                                onSubmitEditing={handleSave}
                                accessibilityLabel={t('leaderboard.nicknamePlaceholder')}
                                textAlign='center'
                                wrapperStyle={styles.inputWrapper}
                            />
                            <Button variant='primary' fullWidth disabled={trimmed.length === 0} onPress={handleSave}>
                                {t('leaderboard.save')}
                            </Button>
                        </Stack>
                    </Animated.View>
                ) : null}
            </Stack>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    listContainer: {
        width: '100%',
    },
    emptyContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entryForm: {
        padding: 16,
        marginTop: 8,
    },
    successMessage: {
        marginTop: 8,
    },
    inputWrapper: {
        paddingHorizontal: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 12,
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameCol: {
        flex: 1,
        gap: 2,
    },
    nameLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    nameText: {
        flexShrink: 1,
    },
    date: {
        textAlign: 'right',
    },
    score: {
        textAlign: 'right',
    },
});

export default React.memo(Leaderboard);

