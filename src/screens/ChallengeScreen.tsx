import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { springEnter } from '../game/transitions';
import { SafeAnalytics } from '../utils/firebase/init';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Card from '../components/molecules/Card';
import Button from '../components/molecules/Button';
import Input from '../components/molecules/Input';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n/TranslationContext';
import { APP_VERSION } from '../utils/version';
import { games } from '../data/games';
import { useStore } from '../hooks/store/useStore';
import {
    getLastNickname,
    setLastNickname,
    rankEntries,
    MAX_NICKNAME_LENGTH,
    type LeaderboardEntry,
} from '../game/leaderboard';
import { getDeviceId } from '../game/challenge/deviceId';
import { getChallenge, getAttempt, getAttempts, submitAttempt } from '../game/challenge/store';
import {
    gateChallenge,
    ladderRunFromRecord,
    dropStateFromRecord,
    wheelGameFromRecord,
    ownedQuestionIds,
} from '../game/challenge/resolve';
import type { ChallengeResult } from '../game/challenge/ChallengeHandoff';
import type { ChallengeRecord } from '../game/challenge/types';
import LadderPlayScreen from '../game/ladder/LadderPlayScreen';
import DropPlayScreen from '../game/drop/DropPlayScreen';
import WheelPlayScreen from '../game/wheel/WheelPlayScreen';
import type { RootStackParamList } from '../navigation/types';

type Phase =
    | 'loading'
    | 'offline' // couldn't load the record
    | 'expired'
    | 'updateRequired'
    | 'intro' // VS card before play
    | 'playing'
    | 'submitting'
    | 'submitOffline' // run finished but the write failed; result held for retry
    | 'results';

/**
 * Orchestrates one async challenge (ADR-0003): load the frozen record, gate it
 * (expired / needs-update), run the same play screen with the frozen deck, then
 * submit this device's attempt and reveal the ranked board. The three online
 * moments — load, submit, reveal — each fall back to a connect+retry screen and
 * never lose the completed run.
 */
export function ChallengeScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'Challenge'>>();
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { purchasedItemIds } = useStore();
    const reduceMotion = useReducedMotion();

    const challengeId = route.params.challengeId;
    const deviceId = useMemo(() => getDeviceId(), []);

    const [phase, setPhase] = useState<Phase>('loading');
    const [record, setRecord] = useState<ChallengeRecord | null>(null);
    const [nickname, setNickname] = useState<string>(() => getLastNickname());
    const [attempts, setAttempts] = useState<LeaderboardEntry[]>([]);
    const [myTimestamp, setMyTimestamp] = useState<number | null>(null);

    // The nickname used to submit, and the held result, kept in refs so the
    // injected play element (memoised below) never rebuilds mid-run when these change.
    const nicknameRef = useRef(nickname);
    const pendingResult = useRef<ChallengeResult | null>(null);

    const exit = useCallback(() => navigation.navigate('Home'), [navigation]);

    const showResults = useCallback(
        async (mine: number | null) => {
            try {
                const all = await getAttempts(challengeId);
                setAttempts(rankEntries(all));
                setMyTimestamp(mine);
                setPhase('results');
            } catch {
                setPhase('offline');
            }
        },
        [challengeId],
    );

    const load = useCallback(async () => {
        setPhase('loading');
        try {
            const rec = await getChallenge(challengeId);
            if (!rec) {
                setPhase('expired');
                return;
            }
            setRecord(rec);
            SafeAnalytics.logEvent({ name: 'challenge_opened', params: { game: rec.game } });
            const gate = gateChallenge(rec, APP_VERSION, Date.now());
            if (gate === 'expired') {
                setPhase('expired');
                return;
            }
            if (gate === 'updateRequired') {
                SafeAnalytics.logEvent({ name: 'challenge_update_required', params: { game: rec.game } });
                setPhase('updateRequired');
                return;
            }
            // Already played on this device? Go straight to the result reveal.
            const mine = await getAttempt(challengeId, deviceId);
            if (mine) {
                await showResults(mine.timestamp);
                return;
            }
            setPhase('intro');
        } catch {
            setPhase('offline');
        }
    }, [challengeId, deviceId, showResults]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = useCallback(
        async (result: ChallengeResult) => {
            pendingResult.current = result;
            setPhase('submitting');
            const attempt: LeaderboardEntry = {
                nickname: nicknameRef.current,
                progress: result.progress,
                score: result.score,
                timestamp: Date.now(),
            };
            try {
                await submitAttempt(challengeId, deviceId, attempt);
                pendingResult.current = null;
                if (record) {
                    SafeAnalytics.logEvent({
                        name: 'challenge_completed',
                        params: { game: record.game, progress: result.progress, score: result.score },
                    });
                }
                await showResults(attempt.timestamp);
            } catch {
                setPhase('submitOffline');
            }
        },
        [challengeId, deviceId, record, showResults],
    );

    const handleComplete = useCallback((result: ChallengeResult) => submit(result), [submit]);

    const startPlay = useCallback(() => {
        const trimmed = nickname.trim();
        if (!trimmed) return;
        nicknameRef.current = trimmed;
        setLastNickname(trimmed);
        setPhase('playing');
    }, [nickname]);

    // The play screen wired to the frozen deck. Memoised on the record so it is
    // built once and isn't reset by unrelated re-renders during the run.
    const playElement = useMemo(() => {
        if (!record) return null;
        const owned = ownedQuestionIds(record.game, new Set(purchasedItemIds));
        const base = { ownedIds: owned, onComplete: handleComplete };
        switch (record.game) {
            case 'the-ladder':
                return (
                    <LadderPlayScreen
                        onExit={exit}
                        challenge={{ ...base, initial: ladderRunFromRecord(record, locale) }}
                    />
                );
            case 'the-drop':
                return <DropPlayScreen onExit={exit} challenge={{ ...base, initial: dropStateFromRecord(record) }} />;
            case 'the-wheel':
                return (
                    <WheelPlayScreen
                        onExit={exit}
                        challenge={{ ...base, initial: wheelGameFromRecord(record, locale) }}
                    />
                );
            default:
                return null;
        }
    }, [record, purchasedItemIds, locale, handleComplete, exit]);

    if (phase === 'playing' && playElement) {
        return <SafeContainer edges={['top']}>{playElement}</SafeContainer>;
    }

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <View style={styles.center}>
                {phase === 'loading' || phase === 'submitting' ? (
                    <Stack gap='md' align='center'>
                        <ActivityIndicator color={theme.colors.primary} />
                        <Text variant='body' color='textSecondary' align='center'>
                            {t(phase === 'loading' ? 'challenge.loading' : 'challenge.submitting')}
                        </Text>
                    </Stack>
                ) : phase === 'offline' || phase === 'submitOffline' ? (
                    <MessageCard
                        title={t('challenge.offline')}
                        body={t(phase === 'offline' ? 'challenge.offlineDesc' : 'challenge.submitFailed')}
                        actionLabel={t('challenge.retry')}
                        onAction={() =>
                            phase === 'submitOffline' && pendingResult.current ? submit(pendingResult.current) : load()
                        }
                        onSecondary={exit}
                        secondaryLabel={t('common.home')}
                    />
                ) : phase === 'expired' ? (
                    <MessageCard
                        title={t('challenge.expired')}
                        body={t('challenge.expiredDesc')}
                        actionLabel={t('common.home')}
                        onAction={exit}
                    />
                ) : phase === 'updateRequired' ? (
                    <MessageCard
                        title={t('challenge.updateRequired')}
                        body={t('challenge.updateRequiredDesc')}
                        actionLabel={t('common.home')}
                        onAction={exit}
                    />
                ) : phase === 'intro' && record ? (
                    <Animated.View style={styles.card} entering={reduceMotion ? undefined : springEnter()}>
                        <Card variant='elevated' padding='lg' gap='md'>
                            <Stack gap='xs' align='center'>
                                <Text variant='overline' color='textSecondary' weight='bold'>
                                    {t(`game.${record.game}.name`)}
                                </Text>
                                <Text variant='heading' weight='bold' align='center'>
                                    {t('challenge.vsTitle', { name: record.createdBy.nickname })}
                                </Text>
                                <Text variant='body' color='textSecondary' align='center'>
                                    {t('challenge.vsSubtitle')}
                                </Text>
                            </Stack>
                            {getLastNickname().trim().length === 0 ? (
                                <Input
                                    value={nickname}
                                    onChangeText={setNickname}
                                    placeholder={t('leaderboard.nicknamePlaceholder')}
                                    maxLength={MAX_NICKNAME_LENGTH}
                                    autoCapitalize='words'
                                    textAlign='center'
                                    wrapperStyle={styles.input}
                                />
                            ) : null}
                            <Button
                                variant='primary'
                                fullWidth
                                disabled={nickname.trim().length === 0}
                                onPress={startPlay}
                            >
                                {t('challenge.start')}
                            </Button>
                        </Card>
                    </Animated.View>
                ) : phase === 'results' && record ? (
                    <ResultsCard
                        record={record}
                        attempts={attempts}
                        myTimestamp={myTimestamp}
                        onExit={exit}
                        t={t}
                        locale={locale}
                    />
                ) : null}
            </View>
        </SafeContainer>
    );
}

function MessageCard({
    title,
    body,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
}: {
    title: string;
    body: string;
    actionLabel: string;
    onAction: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
}) {
    return (
        <Card variant='elevated' padding='lg' gap='md' style={styles.card}>
            <Stack gap='xs' align='center'>
                <Text variant='heading' weight='bold' align='center'>
                    {title}
                </Text>
                <Text variant='body' color='textSecondary' align='center'>
                    {body}
                </Text>
            </Stack>
            <Stack gap='sm' align='stretch'>
                <Button variant='primary' fullWidth onPress={onAction}>
                    {actionLabel}
                </Button>
                {secondaryLabel && onSecondary ? (
                    <Button variant='ghost' fullWidth onPress={onSecondary}>
                        {secondaryLabel}
                    </Button>
                ) : null}
            </Stack>
        </Card>
    );
}

function ResultsCard({
    record,
    attempts,
    myTimestamp,
    onExit,
    t,
    locale,
}: {
    record: ChallengeRecord;
    attempts: LeaderboardEntry[];
    myTimestamp: number | null;
    onExit: () => void;
    t: (key: string, options?: Record<string, unknown>) => string;
    locale: string;
}) {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const game = games.find((g) => g.id === record.game);
    const winner = attempts[0];
    const youWon = winner && myTimestamp !== null && winner.timestamp === myTimestamp;
    const headline = !winner
        ? t('challenge.results')
        : youWon
          ? t('challenge.youWin')
          : t('challenge.won', { name: winner.nickname });

    return (
        <Card variant='elevated' padding='lg' gap='md' style={styles.card}>
            <Stack gap='xs' align='center'>
                <Text variant='overline' color='textSecondary' weight='bold'>
                    {t(`game.${record.game}.name`)}
                </Text>
                <Text variant='heading' weight='bold' align='center'>
                    {headline}
                </Text>
            </Stack>
            <Stack gap='xs' align='stretch'>
                {attempts.map((entry, i) => {
                    const mine = myTimestamp !== null && entry.timestamp === myTimestamp;
                    return (
                        <Animated.View
                            key={`${entry.timestamp}-${i}`}
                            entering={reduceMotion ? undefined : springEnter(i * 80)}
                            style={[
                                styles.row,
                                { borderBottomColor: theme.colors.border },
                                mine && { backgroundColor: theme.colors.primary + '22', borderRadius: theme.radii.sm },
                            ]}
                        >
                            <Text variant='body' weight='bold' color='textSecondary' style={styles.rank}>
                                {i + 1}
                            </Text>
                            <View style={styles.nameCol}>
                                <Text variant='body' weight={mine ? 'bold' : 'semibold'} numberOfLines={1}>
                                    {entry.nickname}
                                    {mine ? ` (${t('challenge.you')})` : ''}
                                </Text>
                                {game ? (
                                    <Text variant='caption' color='textMuted' numberOfLines={1}>
                                        {t(game.progressLabelKey, { n: entry.progress })}
                                    </Text>
                                ) : null}
                            </View>
                            <Text variant='body' weight='bold' style={styles.score}>
                                {`${entry.score.toLocaleString(locale)} ${t('leaderboard.points')}`}
                            </Text>
                        </Animated.View>
                    );
                })}
            </Stack>
            <Button variant='primary' fullWidth onPress={onExit}>
                {t('common.home')}
            </Button>
        </Card>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
    },
    input: {
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
    score: {
        minWidth: 64,
        textAlign: 'right',
    },
});
