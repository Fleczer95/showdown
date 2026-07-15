import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swords, Crown } from 'lucide-react-native';
import { springEnter } from '../game/transitions';
import { SafeAnalytics } from '../utils/firebase/init';
import { SafeSentry } from '../utils/sentry/init';
import SafeContainer from '../responsive/SafeContainer';
import { useResponsive } from '../responsive/useResponsive';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Card from '../components/molecules/Card';
import Button from '../components/molecules/Button';
import Input from '../components/molecules/Input';
import { useTheme } from '../theme';
import { resolveAccent, readableOn, hexToRgba } from '../theme/colorUtils';
import { useTranslation } from '../i18n/TranslationContext';
import { games } from '../data/games';
import { useStore } from '../hooks/store/useStore';
import { rankEntries, MAX_NICKNAME_LENGTH, type LeaderboardEntry } from '../game/leaderboard';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import { getDeviceId } from '../game/challenge/deviceId';
import { getChallenge, getAttempt, getAttempts, submitAttempt, BlockedError } from '../game/challenge/store';
import { recordChallenge, markChallengePlayed } from '../game/challenge/log';
import { shareChallenge } from '../game/challenge/share';
import { registerAutoShareAfterTransition } from '../game/challenge/autoShare';
import { pushRanking } from '../game/ranking/push';
import {
    gateChallenge,
    missingContentIds,
    ladderRunFromRecord,
    dropStateFromRecord,
    wheelGameFromRecord,
    ownedQuestionIds,
} from '../game/challenge/resolve';
import type { ChallengeResult } from '../game/challenge/ChallengeHandoff';
import type { ChallengeRecord } from '../game/challenge/types';
import { Mascot } from '../game/mascot/Mascot';
import type { LookMap } from '../game/mascot/look';
import { useMascotEmit } from '../game/mascot/reactions/useMascotDirector';
import { useSound } from '../hooks/useSound';
import { useHaptics } from '../hooks/useHaptics';
import LadderPlayScreen from '../game/ladder/LadderPlayScreen';
import DropPlayScreen from '../game/drop/DropPlayScreen';
import WheelPlayScreen from '../game/wheel/WheelPlayScreen';
import type { RootStackParamList } from '../navigation/types';

type Phase =
    | 'loading'
    | 'offline' // couldn't load the record — device appears offline
    | 'error' // couldn't load the record — server rejected the request (e.g. App Check)
    | 'expired'
    | 'updateRequired'
    | 'intro' // VS card before play
    | 'playing'
    | 'submitting'
    | 'submitOffline' // run finished but the write failed (offline); result held for retry
    | 'submitError' // run finished but the write was rejected; result held for retry
    | 'results';

/**
 * Orchestrates one async challenge (ADR-0003): load the frozen record, gate it
 * (expired / needs-update), run the same play screen with the frozen deck, then
 * submit this device's attempt and reveal the ranked board. The three online
 * moments — load, submit, reveal — each fall back to a connect+retry screen and
 * never lose the completed run.
 */
export function ChallengeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Challenge'>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Challenge'>>();
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { purchasedItemIds } = useStore();
    const { tabletColumn } = useResponsive();

    const challengeId = route.params.challengeId;
    const deviceId = useMemo(() => getDeviceId(), []);
    const emitMascot = useMascotEmit();

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
    const autoSharedChallengeId = useRef<string | null>(null);

    // A freshly created challenge asks to share only after the native stack has
    // finished opening this screen. The share promise is deliberately detached:
    // a slow extension or failed UIKit presentation must never block loading/play.
    useFocusEffect(
        useCallback(() => {
            if (route.params.autoShare !== true || autoSharedChallengeId.current === challengeId) return;
            return registerAutoShareAfterTransition({
                challengeId,
                subscribe: (listener) =>
                    navigation.addListener('transitionEnd', (event) =>
                        listener({ data: { closing: event.data.closing } }),
                    ),
                consume: () => {
                    autoSharedChallengeId.current = challengeId;
                    navigation.setParams({ autoShare: false });
                },
                share: shareChallenge,
                onError: (error) => {
                    SafeSentry.captureException(error, {
                        tags: { area: 'challenge-share', source: 'create' },
                    });
                },
                onFallback: () => {
                    SafeSentry.captureMessage('Challenge auto-share transition timed out', {
                        level: 'warning',
                        tags: { area: 'challenge-share', source: 'create' },
                    });
                },
            });
        }, [challengeId, navigation, route.params.autoShare]),
    );

    // Once the frozen record loads, the fox reacts by the player's true role:
    // this device created it (sent) vs. opened someone else's (received). Reading
    // the record — not a nav flag — keeps history reopens correct too.
    useEffect(() => {
        if (record) emitMascot(record.createdBy.uuid === deviceId ? 'challenge-sent' : 'challenge-received');
    }, [emitMascot, record, deviceId]);

    const exit = useCallback(() => navigation.navigate('Home'), [navigation]);

    const showResults = useCallback(
        async (mine: number | null) => {
            try {
                const all = await getAttempts(challengeId);
                setAttempts(rankEntries(all));
                setMyTimestamp(mine);
                setPhase('results');
            } catch (err) {
                setPhase(err instanceof BlockedError ? 'error' : 'offline');
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
            if (missingContentIds(rec).length > 0) {
                // A question id this app doesn't have yet — a pack added in a newer
                // app version. Don't index a challenge this app can't open (it would
                // surface as a playable "your turn" row in history); reopening the
                // link after an update records it with a correct, actionable status.
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
            if (gateChallenge(rec, Date.now()) === 'expired') {
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
        } catch (err) {
            setPhase(err instanceof BlockedError ? 'error' : 'offline');
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
            } catch (err) {
                setPhase(err instanceof BlockedError ? 'submitError' : 'submitOffline');
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
            <View style={[styles.center, tabletColumn, { padding: theme.spacing.xl }]}>
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
                ) : phase === 'error' || phase === 'submitError' ? (
                    <MessageCard
                        title={t('challenge.errorTitle')}
                        body={t(phase === 'error' ? 'challenge.errorDesc' : 'challenge.submitError')}
                        actionLabel={t('challenge.retry')}
                        onAction={() =>
                            phase === 'submitError' && pendingResult.current ? submit(pendingResult.current) : load()
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
                    <KeyboardAvoidingView behavior='padding' style={styles.keyboardAvoider}>
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
                    </KeyboardAvoidingView>
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
    const { iconSize } = useResponsive();
    const accent = challengeAccent(theme, record.game);
    const onAccent = readableOn(accent);

    return (
        <Animated.View style={styles.card} entering={reduceMotion ? undefined : springEnter()}>
            <Card variant='elevated' padding='lg' gap='lg' style={accentCardStyle(accent)}>
                <Stack direction='horizontal' gap='md' align='center'>
                    {/* The challenger's equipped look, rendered from its slot→colorId
                        identifiers. Ownership-agnostic: shows even colors this device
                        doesn't own, with unknown ids falling back to slot defaults. */}
                    <Stack flex={1} align='center'>
                        <Mascot look={record.mascot as LookMap} pose='idle' size={120} />
                    </Stack>
                    <Stack gap='xs' align='center' flex={1}>
                        <Text variant='overline' color='textSecondary' weight='bold' align='center'>
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
                    icon={<Swords size={iconSize(20)} color={onAccent} />}
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
    const { iconSize, scale } = useResponsive();
    const emitMascot = useMascotEmit();
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
    const isTopTie = (e: LeaderboardEntry) => !!winner && e.progress === winner.progress && e.score === winner.score;
    const draw = !waiting && !!attempts[1] && isTopTie(attempts[1]);
    const youWon = !waiting && !draw && winner && myTimestamp !== null && winner.timestamp === myTimestamp;
    const { play } = useSound();
    const haptics = useHaptics();
    // Sting the verdict once per reveal: a fanfare for beating the challenger, a
    // buzz for losing. Waiting (no opponent yet) and draws stay silent.
    const stung = useRef(false);
    useEffect(() => {
        if (youWon) emitMascot('challenge-beaten');
        if (waiting || draw || stung.current || myTimestamp === null) return;
        stung.current = true;
        if (youWon) {
            play('levelUp');
            haptics.notification();
        } else {
            play('wrong');
            haptics.heavy();
        }
    }, [emitMascot, youWon, waiting, draw, myTimestamp, play, haptics]);
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
                <Stack direction='horizontal' gap='md' align='center'>
                    {/* The challenger's mascot stays present through to the result,
                        rendered from its slot→colorId identifiers (ownership-agnostic). */}
                    <Stack flex={1} align='center'>
                        <Mascot look={record.mascot as LookMap} pose='idle' size={120} />
                    </Stack>
                    <Stack gap='xs' align='center' flex={1}>
                        <Text variant='overline' color='textSecondary' weight='bold' align='center'>
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
                                    {
                                        gap: theme.spacing.sm,
                                        paddingVertical: scale(10),
                                        paddingHorizontal: theme.spacing.sm,
                                        borderBottomColor: theme.colors.border,
                                    },
                                    mine && { backgroundColor: hexToRgba(accent, 0.13), borderRadius: theme.radii.sm },
                                ]}
                            >
                                <Text
                                    variant='body'
                                    weight='bold'
                                    color={isWinner ? undefined : 'textSecondary'}
                                    style={[styles.rank, { width: scale(24) }, isWinner && { color: accent }]}
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
                                        {isWinner ? <Crown size={iconSize(14)} color={accent} /> : null}
                                    </Stack>
                                    {game ? (
                                        <Text variant='caption' color='textMuted' numberOfLines={1}>
                                            {t(game.progressLabelKey, { count: entry.progress, n: entry.progress })}
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
    },
    keyboardAvoider: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
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
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rank: {
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
