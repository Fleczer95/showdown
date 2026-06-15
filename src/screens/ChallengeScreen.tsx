import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Swords, Trophy, Hourglass, Crown, type LucideIcon } from 'lucide-react-native';
import { springEnter } from '../game/transitions';
import { SafeAnalytics } from '../utils/firebase/init';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import Button from '../components/molecules/Button';
import Input from '../components/molecules/Input';
import { useTheme } from '../theme';
import { resolveAccent, readableOn, hexToRgba, darken } from '../theme/colorUtils';
import { useTranslation } from '../i18n/TranslationContext';
import { APP_VERSION } from '../utils/version';
import { games } from '../data/games';
import { useStore } from '../hooks/store/useStore';
import { rankEntries, MAX_NICKNAME_LENGTH, type LeaderboardEntry } from '../game/leaderboard';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import { getDeviceId } from '../game/challenge/deviceId';
import { getChallenge, getAttempt, getAttempts, submitAttempt } from '../game/challenge/store';
import { recordChallenge, markChallengePlayed } from '../game/challenge/log';
import { pushRanking } from '../game/ranking/push';
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

    const challengeId = route.params.challengeId;
    const deviceId = useMemo(() => getDeviceId(), []);

    const [phase, setPhase] = useState<Phase>('loading');
    const [record, setRecord] = useState<ChallengeRecord | null>(null);
    const [nickname, setNickname] = useState<string>(() => getChallengeNickname());
    const [nicknameError, setNicknameError] = useState<string | null>(null);
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
            if (gate === 'updateRequired') {
                // Don't index a challenge this app can't open — it would surface as
                // a playable "your turn" row in history. Reopening the link after an
                // update records it with a correct, actionable status.
                SafeAnalytics.logEvent({ name: 'challenge_update_required', params: { game: rec.game } });
                setPhase('updateRequired');
                return;
            }
            // Index it locally so the player can leave and resume it from the
            // Challenge History screen. `played` is settled below / on submit.
            const role = rec.createdBy.uuid === deviceId ? 'created' : 'received';
            recordChallenge({
                id: challengeId,
                game: rec.game,
                role,
                opponent: role === 'received' ? rec.createdBy.nickname : '',
                played: false,
                expiresAt: rec.expiresAt,
            });
            if (gate === 'expired') {
                setPhase('expired');
                return;
            }
            // Already played on this device? Go straight to the result reveal.
            const mine = await getAttempt(challengeId, deviceId);
            if (mine) {
                markChallengePlayed(challengeId);
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
                markChallengePlayed(challengeId);
                if (record) {
                    SafeAnalytics.logEvent({
                        name: 'challenge_completed',
                        params: { game: record.game, progress: result.progress, score: result.score },
                    });
                    // Feed the global ranking (ADR-0004). Best-effort and fire-and-forget
                    // so the result reveal is never blocked; a failed push stays pending
                    // locally and is retried on next app open / rankings view.
                    void pushRanking(record.game, result.score, attempt.nickname);
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
        // The challenge nickname is public (opponent view + global ranking); the
        // setter gates profanity, so a rejected name surfaces an error here.
        if (!setChallengeNickname(trimmed)) {
            setNicknameError(t('challenge.nicknameRejected'));
            return;
        }
        nicknameRef.current = trimmed;
        setPhase('playing');
    }, [nickname, t]);

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
                    <IntroCard
                        record={record}
                        isCreator={record.createdBy.uuid === deviceId}
                        nickname={nickname}
                        onChangeNickname={(value) => {
                            setNickname(value);
                            setNicknameError(null);
                        }}
                        nicknameError={nicknameError}
                        onStart={startPlay}
                        onHome={exit}
                        t={t}
                    />
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

/** Per-game accent for a challenge, falling back to the first accent token. */
function challengeAccent(theme: ReturnType<typeof useTheme>, gameId: string): string {
    const game = games.find((g) => g.id === gameId);
    return resolveAccent(theme, game?.accent ?? 'accent1');
}

/** Accent-tinted border + glow applied to a challenge card, mirroring the game setup screen. */
function accentCardStyle(accent: string): ViewStyle {
    return {
        borderColor: hexToRgba(accent, 0.5),
        shadowColor: accent,
        shadowOpacity: 0.3,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    };
}

/**
 * The gradient medallion used across the app's hero cards (see GameSetupScreen):
 * a rounded-square with an accent→darker gradient fill, accent glow, and a
 * centered icon. Used here to give the challenge intro/results a hero focal point.
 */
function Medallion({
    icon,
    accent,
    gradientId,
    size = 88,
}: {
    icon: LucideIcon;
    accent: string;
    gradientId: string;
    size?: number;
}) {
    const theme = useTheme();
    const onAccent = readableOn(accent);
    return (
        <View
            style={[
                styles.medallion,
                {
                    width: size,
                    height: size,
                    borderRadius: theme.radii.xl,
                    borderWidth: 1,
                    borderColor: hexToRgba(accent, 0.5),
                    shadowColor: accent,
                    shadowOpacity: 0.45,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 8,
                },
            ]}
        >
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
            <Icon name={icon} size={Math.round(size * 0.46)} color={onAccent} />
        </View>
    );
}

function IntroCard({
    record,
    isCreator,
    nickname,
    onChangeNickname,
    nicknameError,
    onStart,
    onHome,
    t,
}: {
    record: ChallengeRecord;
    isCreator: boolean;
    nickname: string;
    onChangeNickname: (value: string) => void;
    nicknameError: string | null;
    onStart: () => void;
    onHome: () => void;
    t: (key: string, options?: Record<string, unknown>) => string;
}) {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const accent = challengeAccent(theme, record.game);
    const onAccent = readableOn(accent);

    return (
        <Animated.View style={styles.card} entering={reduceMotion ? undefined : springEnter()}>
            <Card variant='elevated' padding='lg' gap='lg' style={accentCardStyle(accent)}>
                <Stack gap='md' align='center'>
                    <Medallion icon={Swords} accent={accent} gradientId='challenge-intro' />
                    <Stack gap='xs' align='center'>
                        <Text variant='overline' color='textSecondary' weight='bold'>
                            {t(`game.${record.game}.name`)}
                        </Text>
                        <Text variant='heading' weight='bold' align='center'>
                            {isCreator
                                ? t('challenge.vsTitleCreator')
                                : t('challenge.vsTitle', { name: record.createdBy.nickname })}
                        </Text>
                        <Text variant='body' color='textSecondary' align='center'>
                            {t(isCreator ? 'challenge.vsSubtitleCreator' : 'challenge.vsSubtitle')}
                        </Text>
                    </Stack>
                </Stack>
                <Stack gap='xs' align='stretch'>
                    <Input
                        value={nickname}
                        onChangeText={onChangeNickname}
                        placeholder={t('leaderboard.nicknamePlaceholder')}
                        maxLength={MAX_NICKNAME_LENGTH}
                        autoCapitalize='words'
                        textAlign='center'
                        wrapperStyle={styles.input}
                    />
                    {nicknameError ? (
                        <Text variant='caption' color='error' align='center'>
                            {nicknameError}
                        </Text>
                    ) : null}
                </Stack>
                <Button
                    variant='primary'
                    fullWidth
                    disabled={nickname.trim().length === 0}
                    onPress={onStart}
                    style={{ backgroundColor: accent, borderColor: accent }}
                    textColor={onAccent}
                    icon={<Swords size={20} color={onAccent} />}
                >
                    {t('challenge.start')}
                </Button>
                <Button variant='ghost' fullWidth onPress={onHome}>
                    {t('challenge.playLater')}
                </Button>
            </Card>
        </Animated.View>
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
    const accent = challengeAccent(theme, record.game);
    const onAccent = readableOn(accent);
    // Only one attempt so far means this device is the only one that has played —
    // there's no opponent to beat yet, so show a "waiting" state rather than
    // crowning the sole player the winner.
    const waiting = attempts.length <= 1;
    const winner = attempts[0];
    // A genuine tie on the ranking key (same progress AND same score) is a draw,
    // not a win — the timestamp tiebreak in rankEntries only fixes row order, it
    // shouldn't crown anyone (e.g. both players score 0). Applies to every game.
    const isTopTie = (e: LeaderboardEntry) =>
        !!winner && e.progress === winner.progress && e.score === winner.score;
    const draw = !waiting && !!attempts[1] && isTopTie(attempts[1]);
    const youWon = !waiting && !draw && winner && myTimestamp !== null && winner.timestamp === myTimestamp;
    const headline = waiting
        ? t('challenge.waiting')
        : !winner
          ? t('challenge.results')
          : draw
            ? t('challenge.draw')
            : youWon
              ? t('challenge.youWin')
              : t('challenge.won', { name: winner.nickname });

    return (
        <Animated.View style={styles.card} entering={reduceMotion ? undefined : springEnter()}>
            <Card variant='elevated' padding='lg' gap='lg' style={accentCardStyle(accent)}>
                <Stack gap='md' align='center'>
                    <Medallion icon={waiting ? Hourglass : Trophy} accent={accent} gradientId='challenge-results' />
                    <Stack gap='xs' align='center'>
                        <Text variant='overline' color='textSecondary' weight='bold'>
                            {t(`game.${record.game}.name`)}
                        </Text>
                        <Text variant='heading' weight='bold' align='center'>
                            {headline}
                        </Text>
                        {waiting ? (
                            <Text variant='body' color='textSecondary' align='center'>
                                {t('challenge.waitingDesc')}
                            </Text>
                        ) : null}
                    </Stack>
                </Stack>
                <Stack gap='xs' align='stretch'>
                    {attempts.map((entry, i) => {
                        const mine = myTimestamp !== null && entry.timestamp === myTimestamp;
                        // Crown every entry tied at the top (one winner normally; all
                        // tied players on a draw) rather than just the first row.
                        const isWinner = !waiting && isTopTie(entry);
                        return (
                            <Animated.View
                                key={`${entry.timestamp}-${i}`}
                                entering={reduceMotion ? undefined : springEnter(i * 80)}
                                style={[
                                    styles.row,
                                    { borderBottomColor: theme.colors.border },
                                    mine && { backgroundColor: hexToRgba(accent, 0.13), borderRadius: theme.radii.sm },
                                ]}
                            >
                                <Text
                                    variant='body'
                                    weight='bold'
                                    color={isWinner ? undefined : 'textSecondary'}
                                    style={[styles.rank, isWinner && { color: accent }]}
                                >
                                    {i + 1}
                                </Text>
                                <View style={styles.nameCol}>
                                    <Stack direction='horizontal' gap='xs' align='center'>
                                        <Text
                                            variant='body'
                                            weight={mine ? 'bold' : 'semibold'}
                                            numberOfLines={1}
                                            style={styles.name}
                                        >
                                            {entry.nickname}
                                            {mine ? ` (${t('challenge.you')})` : ''}
                                        </Text>
                                        {isWinner ? <Crown size={14} color={accent} /> : null}
                                    </Stack>
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
                <Button
                    variant='primary'
                    fullWidth
                    onPress={onExit}
                    style={{ backgroundColor: accent, borderColor: accent }}
                    textColor={onAccent}
                >
                    {t('common.home')}
                </Button>
            </Card>
        </Animated.View>
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
    medallion: {
        alignItems: 'center',
        justifyContent: 'center',
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
    name: {
        flexShrink: 1,
    },
    score: {
        minWidth: 64,
        textAlign: 'right',
    },
});
