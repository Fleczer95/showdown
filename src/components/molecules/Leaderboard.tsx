import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
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
}

function Leaderboard({ gameId, pendingScore }: LeaderboardProps) {
    const theme = useTheme();
    const { t, locale } = useTranslation();

    const [board, setBoard] = useState<LeaderboardEntry[]>(() => getBoard(gameId));
    const [nickname, setNickname] = useState<string>(() => getLastNickname());
    const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);

    const canEnter = pendingScore !== undefined && savedTimestamp === null && qualifies(board, pendingScore);
    const trimmed = nickname.trim();

    const formatScore = (score: number): string =>
        gameId === 'the-ladder' ? t('leaderboard.rung', { number: score }) : score.toLocaleString(locale);

    const formatDate = (timestamp: number): string =>
        new Date(timestamp).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

    const handleSave = () => {
        if (pendingScore === undefined || trimmed.length === 0) return;
        const entry = saveScore(gameId, trimmed, pendingScore);
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
                        <Text
                            variant='body'
                            weight={highlighted ? 'bold' : 'semibold'}
                            style={styles.name}
                            numberOfLines={1}
                        >
                            {entry.nickname}
                        </Text>
                        <Text variant='caption' color='textMuted' style={styles.date}>
                            {formatDate(entry.timestamp)}
                        </Text>
                        <Text variant='body' weight='bold' style={styles.score}>
                            {formatScore(entry.score)}
                        </Text>
                    </View>
                );
            }),
        // formatScore/formatDate are stable per render; board + highlight drive updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [board, savedTimestamp, theme],
    );

    return (
        <Stack gap='md' align='stretch'>
            {canEnter ? (
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
                    />
                    <Button variant='primary' fullWidth disabled={trimmed.length === 0} onPress={handleSave}>
                        {t('leaderboard.save')}
                    </Button>
                </Stack>
            ) : null}

            {savedTimestamp !== null ? (
                <Text variant='caption' color='success' align='center'>
                    {t('leaderboard.saved')}
                </Text>
            ) : null}

            {board.length === 0 ? (
                <Text variant='body' color='textMuted' align='center'>
                    {t('leaderboard.empty')}
                </Text>
            ) : (
                <View>{rows}</View>
            )}
        </Stack>
    );
}

const styles = StyleSheet.create({
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
    name: {
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
