import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Divider from '../atoms/Divider';
import Input from './Input';
import Button from './Button';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import {
    getBoard,
    saveScore,
    getLastNickname,
    setLastNickname,
    qualifies,
    MAX_NICKNAME_LENGTH,
    type LeaderboardEntry,
} from '../../game/leaderboard';

interface LeaderboardProps {
    gameId: string;
    /** When set, enables the post-game entry flow for this just-achieved score. */
    pendingScore?: number;
    /** How far the just-played run got; primary ranking key and the no-empty-run gate. */
    pendingProgress?: number;
}

function Leaderboard({ gameId, pendingScore, pendingProgress }: LeaderboardProps) {
    const theme = useTheme();
    const { t, locale } = useTranslation();

    const [board, setBoard] = useState<LeaderboardEntry[]>(() => getBoard(gameId));
    const [nickname, setNickname] = useState<string>(() => getLastNickname());
    const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);

    // Only offer to save a run that actually got somewhere — a zero-progress run
    // (busted immediately, missed question 1, solved nothing) never reaches the board.
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

    // Per-game label for the ranking metric shown beneath each nickname.
    const formatProgress = (progress: number): string => {
        if (gameId === 'the-ladder') return t('leaderboard.progress.ladder', { n: progress });
        if (gameId === 'the-wheel') return t('leaderboard.progress.wheel', { n: progress });
        if (gameId === 'the-drop') return t('leaderboard.progress.drop', { n: progress });
        return '';
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
                const highlighted = entry.timestamp === savedTimestamp;
                return (
                    <View
                        key={`${entry.timestamp}-${i}`}
                        style={[
                            styles.row,
                            { borderBottomColor: theme.colors.border },
                            highlighted && {
                                backgroundColor: theme.colors.primary + '22',
                                borderRadius: theme.radii.sm,
                            },
                        ]}
                    >
                        <Text variant='body' weight='bold' color='textSecondary' style={styles.rank}>
                            {i + 1}
                        </Text>
                        <View style={styles.nameCol}>
                            <Text variant='body' weight={highlighted ? 'bold' : 'semibold'} numberOfLines={1}>
                                {entry.nickname}
                            </Text>
                            <Text variant='caption' color='textMuted' numberOfLines={1}>
                                {formatProgress(entry.progress)}
                            </Text>
                        </View>
                        <Text variant='caption' color='textMuted' style={styles.date}>
                            {formatDate(entry.timestamp)}
                        </Text>
                        <Text variant='body' weight='bold' style={styles.score}>
                            {formatScore(entry.score)}
                        </Text>
                    </View>
                );
            }),
        // formatScore/formatDate/formatProgress are stable per render; board + highlight drive updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [board, savedTimestamp, theme, gameId],
    );

    return (
        <Stack gap='md' align='stretch' style={styles.container}>
            {board.length === 0 ? (
                <Text variant='body' color='textMuted' align='center'>
                    {t('leaderboard.empty')}
                </Text>
            ) : (
                <View>{rows}</View>
            )}

            {savedTimestamp !== null ? (
                <Text variant='caption' color='success' align='center'>
                    {t('leaderboard.saved')}
                </Text>
            ) : null}

            {canEnter ? (
                <>
                    {board.length > 0 ? <Divider /> : null}
                    <Stack gap='sm' align='stretch'>
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
                </>
            ) : null}
        </Stack>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    inputWrapper: {
        paddingHorizontal: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    rank: {
        width: 24,
        textAlign: 'center',
    },
    nameCol: {
        flex: 1,
    },
    date: {
        width: 56,
        textAlign: 'right',
    },
    score: {
        minWidth: 64,
        textAlign: 'right',
    },
});

export default React.memo(Leaderboard);
