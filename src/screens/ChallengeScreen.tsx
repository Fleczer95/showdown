import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    View,
    type ViewStyle,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect, useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swords, Crown, Trophy, Play, Lock } from 'lucide-react-native';
import { springEnter } from '../game/transitions';
import { SafeAnalytics } from '../utils/firebase/init';
import { SafeSentry } from '../utils/sentry/init';
import SafeContainer from '../responsive/SafeContainer';
import { useResponsive } from '../responsive/useResponsive';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import Button from '../components/molecules/Button';
import Input from '../components/molecules/Input';
import BottomSheet from '../components/molecules/BottomSheet';
import { useTheme } from '../theme';
import { resolveAccent, readableOn, hexToRgba } from '../theme/colorUtils';
import { useTranslation } from '../i18n/TranslationContext';
import { games } from '../data/games';
import { useStore } from '../hooks/store/useStore';
import { useContentAccess } from '../game/events/access';
import { rankEntries, MAX_NICKNAME_LENGTH, type LeaderboardEntry } from '../game/leaderboard';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import { getDeviceId } from '../game/challenge/deviceId';
import {
    getChallenge,
    getAttempt,
    getAttempts,
    submitAttempt,
    createRematch,
    getRematch,
    newChallengeId,
    prewarmChallengeAuth,
    BlockedError,
} from '../game/challenge/store';
import {
    recordChallenge,
    markChallengePlayed,
    markChallengeOpponentPlayed,
    countCreatedToday,
} from '../game/challenge/log';
import { shareChallenge } from '../game/challenge/share';
import { registerAutoShareAfterTransition } from '../game/challenge/autoShare';
import { buildChallenge } from '../game/challenge/build';
import { getHistory } from '../game/history';
import { dailyCap, canUpsell } from '../game/challenge/limit';
import { getEquippedLook } from '../game/mascot/equippedLook';
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
import { recordRun, type RecordRunDiff } from '../game/progression';
import { CelebrationCard } from '../components/molecules/RunCelebration';
import { Mascot } from '../game/mascot/Mascot';
import type { LookMap } from '../game/mascot/look';
import { useMascotEmit } from '../game/mascot/reactions/useMascotDirector';
import { useSound } from '../hooks/useSound';
import { useHaptics } from '../hooks/useHaptics';
import LadderPlayScreen from '../game/ladder/LadderPlayScreen';
import DropPlayScreen from '../game/drop/DropPlayScreen';
import WheelPlayScreen from '../game/wheel/WheelPlayScreen';
import type { RootStackParamList } from '../navigation/types';
import {
    getSession,
    getCheckpoint,
    participationId,
    startSession,
    beginSessionPlay,
    checkpointSession,
    abandonSession,
    updateSessionEffects,
    UnsupportedSessionError,
} from '../game/challenge/session/store';
import { initialCheckpoint } from '../game/challenge/session/initial';
import { settleCompletion, uploadCompletion } from '../game/challenge/session/recovery';
import { playDeadline, findEdition } from '../../shared/events/definitions';
import { EventAccentContext } from '../game/events/presentation';
import { startEvent } from '../game/events/participation';
import type { LadderCheckpoint, DropCheckpoint, WheelCheckpoint } from '../game/challenge/session/checkpoints';

type Phase =
    | 'loading'
    | 'offline' // couldn't load the record — device appears offline
    | 'full'
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
    const { purchasedItemIds, isPremium } = useStore();
    const { tabletColumn } = useResponsive();
    const ownedIds = useMemo(() => new Set(purchasedItemIds), [purchasedItemIds]);
    const contentAccess = useContentAccess();
    const accessibleIds = useMemo(() => new Set(contentAccess), [contentAccess]);

    const challengeId = route.params.challengeId;
    const deviceId = useMemo(() => getDeviceId(), []);
    const emitMascot = useMascotEmit();
    const sessionId = participationId(challengeId, deviceId);

    const [phase, setPhase] = useState<Phase>('loading');
    const [record, setRecord] = useState<ChallengeRecord | null>(null);
    const [nickname, setNickname] = useState<string>(() => getChallengeNickname());
    const [nicknameError, setNicknameError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState<LeaderboardEntry[]>([]);
    const [myTimestamp, setMyTimestamp] = useState<number | null>(null);
    const [celebrationDiff, setCelebrationDiff] = useState<RecordRunDiff | null>(null);
    const [rematchConfirmSheet, setRematchConfirmSheet] = useState(false);
    const [rematchLimitSheet, setRematchLimitSheet] = useState(false);
    const [rematchBusy, setRematchBusy] = useState(false);
    const [eventStartBusy, setEventStartBusy] = useState(false);
    const liveAccess = useRef({ purchasedIds: ownedIds, premium: isPremium });
    liveAccess.current = { purchasedIds: ownedIds, premium: isPremium };
    const [rematchLookup, setRematchLookup] = useState<{ checked: boolean; id: string | null }>({
        checked: false,
        id: null,
    });

    // The nickname used to submit, and the held result, kept in refs so the
    // injected play element (memoised below) never rebuilds mid-run when these change.
    const nicknameRef = useRef(nickname);
    const pendingResult = useRef<ChallengeResult | null>(null);
    const pendingAttempt = useRef<LeaderboardEntry | null>(null);
    const pendingRematch = useRef<{ id: string; record: ChallengeRecord } | null>(null);
    const rematchInFlight = useRef(false);
    const autoSharedChallengeId = useRef<string | null>(null);

    // An immutable create can still finish after a timeout, so do not let a back
    // gesture remove the route while its result is allowed to navigate.
    usePreventRemove(rematchBusy || eventStartBusy, () => undefined);

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

    // navigate('Home') can push Home above this still-mounted play screen in
    // React Navigation 7. Pop it instead so its modal, timers and clock unmount.
    const exit = useCallback(() => navigation.popTo('Home'), [navigation]);
    const viewRanking = useCallback(() => {
        if (record) navigation.navigate('Ranking', { gameId: record.game });
    }, [navigation, record]);

    const showResults = useCallback(
        async (mine: number | null) => {
            try {
                const all = await getAttempts(challengeId);
                if (all.length >= 2) markChallengeOpponentPlayed(challengeId);
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
            const saved = getSession(sessionId);
            if (saved) {
                recordChallenge({
                    id: challengeId,
                    game: saved.record.game,
                    role: saved.record.createdBy.uuid === deviceId ? 'created' : 'received',
                    opponent: saved.record.createdBy.uuid === deviceId ? '' : saved.record.createdBy.nickname,
                    played: saved.upload === 'sent',
                    expiresAt: saved.record.expiresAt,
                    eventId: saved.record.event?.editionId,
                });
                setRecord(saved.record);
                nicknameRef.current = saved.nickname;
                setNickname(saved.nickname);
                if (saved.status === 'completed' && saved.result) {
                    pendingResult.current = saved.result;
                    const diff = settleCompletion(sessionId);
                    if (!saved.celebrationSeen) setCelebrationDiff(diff);
                    setPhase('submitting');
                    try {
                        await uploadCompletion(sessionId);
                        await showResults(saved.attempt?.timestamp ?? null);
                    } catch (error) {
                        setPhase(error instanceof BlockedError ? 'submitError' : 'submitOffline');
                    }
                    return;
                }
                if (saved.status === 'abandoned' || Date.now() >= playDeadline(saved.record)) {
                    setPhase('expired');
                    return;
                }
                setPhase(saved.awaitingStart ? 'intro' : 'playing');
                return;
            }
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
                eventId: rec.event?.editionId,
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
            // Random opponents are assigned only by the queue. Shared links are
            // status views, never a second admission path into a random round.
            if (rec.event?.mode === 'random') {
                await showResults(null);
                return;
            }
            setPhase('intro');
        } catch (err) {
            setPhase(
                err instanceof UnsupportedSessionError
                    ? 'updateRequired'
                    : err instanceof BlockedError
                      ? 'error'
                      : 'offline',
            );
        }
    }, [challengeId, deviceId, showResults, sessionId]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = useCallback(
        async (result: ChallengeResult) => {
            pendingResult.current = result;
            setPhase('submitting');
            const saved = getSession(sessionId);
            const attempt: LeaderboardEntry = saved?.attempt ??
                pendingAttempt.current ?? {
                    nickname: nicknameRef.current,
                    progress: result.progress,
                    score: result.run.score,
                    timestamp: Date.now(),
                };
            pendingAttempt.current = attempt;
            try {
                if (saved) await uploadCompletion(sessionId);
                else await submitAttempt(challengeId, deviceId, attempt);
                pendingResult.current = null;
                pendingAttempt.current = null;
                markChallengePlayed(challengeId);
                if (record) {
                    SafeAnalytics.logEvent({
                        name: 'challenge_completed',
                        params: { game: record.game, progress: result.progress, score: result.run.score },
                    });
                    // Feed the global ranking (ADR-0004). Best-effort and fire-and-forget
                    // so the result reveal is never blocked; a failed push stays pending
                    // locally and is retried on next app open / rankings view.
                    if (!saved) void pushRanking(record.game, result.run.score, attempt.nickname);
                }
                await showResults(attempt.timestamp);
            } catch (err) {
                setPhase(err instanceof BlockedError ? 'submitError' : 'submitOffline');
            }
        },
        [challengeId, deviceId, record, showResults, sessionId],
    );

    const handleComplete = useCallback(
        (result: ChallengeResult) => {
            // Bank the run's XP/achievements the moment it ends, before the submit:
            // a failed or abandoned submit never loses them, and submit retries
            // (which re-enter submit, not this callback) can't double-record.
            const saved = getSession(sessionId);
            if (saved) {
                // Games commit terminal decisions before their reveals. Keep this
                // fallback for compatible older checkpoint adapters only.
                if (saved.status === 'active') checkpointSession(sessionId, saved.checkpoint, saved.elapsedMs, result);
                setCelebrationDiff(settleCompletion(sessionId));
            } else setCelebrationDiff(recordRun({ ...result.run, challenge: true }));
            return submit(result);
        },
        [submit, sessionId],
    );

    const startPlay = useCallback(async () => {
        const trimmed = nickname.trim();
        if (!trimmed) return;
        // The challenge nickname is public (opponent view + global ranking); the
        // setter gates profanity, so a rejected name surfaces an error here.
        if (!setChallengeNickname(trimmed)) {
            setNicknameError(t('challenge.nicknameRejected'));
            return;
        }
        nicknameRef.current = trimmed;
        if (!record || Date.now() >= playDeadline(record)) {
            setPhase('expired');
            return;
        }
        try {
            if (getSession(sessionId)) {
                // Admission and its charge already persisted when the invite was
                // created. Starting later is local, including after an app restart.
                if (!beginSessionPlay(sessionId, trimmed)) {
                    setPhase('expired');
                    return;
                }
            } else if (record.event) {
                const edition = findEdition(record.event.editionId, __DEV__);
                if (!edition) {
                    setPhase('updateRequired');
                    return;
                }
                setEventStartBusy(true);
                const admitted = await startEvent({
                    edition,
                    mode: 'friend',
                    nickname: trimmed,
                    locale,
                    challengeId,
                    record,
                    entitlements: () => liveAccess.current,
                });
                if (admitted.id !== challengeId) {
                    navigation.push('Challenge', { challengeId: admitted.id, autoShare: admitted.share });
                    return;
                }
            } else
                startSession({ challengeId, deviceId, record, nickname: trimmed }, initialCheckpoint(record, locale));
            setPhase('playing');
        } catch (error) {
            setPhase(
                error instanceof BlockedError && error.status === 409
                    ? 'full'
                    : error instanceof BlockedError && error.status === 410
                      ? 'expired'
                      : 'error',
            );
        } finally {
            setEventStartBusy(false);
        }
    }, [nickname, t, record, challengeId, deviceId, locale, navigation, sessionId]);

    useEffect(() => {
        if (celebrationDiff && (phase === 'results' || phase === 'submitError' || phase === 'submitOffline'))
            updateSessionEffects(sessionId, { celebrationSeen: true });
    }, [celebrationDiff, phase, sessionId]);

    const rematchOpponent = useMemo(
        () => (myTimestamp === null ? null : (attempts.find((entry) => entry.timestamp !== myTimestamp) ?? null)),
        [attempts, myTimestamp],
    );

    // Resolve availability in the background so a lock is shown only after the
    // server confirms there is no existing successor. Offline leaves the CTA in
    // its neutral state; tapping it still performs the authoritative lookup.
    useEffect(() => {
        if (record?.event || phase !== 'results' || attempts.length !== 2 || !rematchOpponent) return;
        let active = true;
        void getRematch(challengeId, deviceId)
            .then((existing) => {
                if (active) setRematchLookup({ checked: true, id: existing?.id ?? null });
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [attempts.length, challengeId, deviceId, phase, rematchOpponent, record]);

    const rematchLimitReached =
        rematchLookup.checked && !rematchLookup.id && countCreatedToday() >= dailyCap(ownedIds, isPremium);

    // Resolve first: if either participant already created the sole successor,
    // opening it must not consume another daily allowance.
    const beginRematch = useCallback(async () => {
        if (!record || record.event || attempts.length !== 2 || !rematchOpponent || rematchInFlight.current) return;
        if (rematchLookup.id) {
            navigation.push('Challenge', { challengeId: rematchLookup.id });
            return;
        }
        rematchInFlight.current = true;
        setRematchBusy(true);
        try {
            const existing = await getRematch(challengeId, deviceId);
            if (existing) {
                setRematchLookup({ checked: true, id: existing.id });
                navigation.push('Challenge', { challengeId: existing.id });
                return;
            }
            setRematchLookup({ checked: true, id: null });
            if (countCreatedToday() >= dailyCap(ownedIds, isPremium)) {
                SafeAnalytics.logEvent({ name: 'challenge_limit_hit', params: { game: record.game } });
                setRematchLimitSheet(true);
                return;
            }
            prewarmChallengeAuth();
            setRematchConfirmSheet(true);
        } catch (error) {
            Alert.alert(
                t(error instanceof BlockedError ? 'challenge.errorTitle' : 'challenge.offline'),
                t(error instanceof BlockedError ? 'challenge.errorDesc' : 'challenge.rematch.offlineBody'),
            );
        } finally {
            rematchInFlight.current = false;
            setRematchBusy(false);
        }
    }, [
        attempts.length,
        challengeId,
        deviceId,
        isPremium,
        navigation,
        ownedIds,
        record,
        rematchLookup.id,
        rematchOpponent,
        t,
    ]);

    const confirmRematch = useCallback(async () => {
        if (!record || record.event || !rematchOpponent || rematchInFlight.current) return;
        rematchInFlight.current = true;
        setRematchConfirmSheet(false);
        setRematchBusy(true);
        try {
            let draft = pendingRematch.current;
            if (!draft) {
                const creatorNickname =
                    attempts.find((entry) => entry.timestamp === myTimestamp)?.nickname ?? getChallengeNickname();
                const nextRecord = buildChallenge({
                    gameId: record.game,
                    history: getHistory(record.game),
                    ownedIds: accessibleIds,
                    createdBy: { uuid: deviceId, nickname: creatorNickname },
                    lang: locale === 'pl' ? 'pl' : 'en',
                    mascot: getEquippedLook(),
                });
                draft = { id: newChallengeId(), record: nextRecord };
                pendingRematch.current = draft;
            }

            const result = await createRematch(challengeId, deviceId, draft.record, draft.id);
            if (result.created) {
                // Index before navigation so an app close in the transition cannot
                // lose the daily count or the target's display name.
                recordChallenge({
                    id: result.id,
                    game: draft.record.game,
                    role: 'created',
                    opponent: result.recipientNickname,
                    played: false,
                    expiresAt: draft.record.expiresAt,
                    isRematch: true,
                    sourceChallengeId: challengeId,
                });
                SafeAnalytics.logEvent({ name: 'rematch_created', params: { game: record.game } });
            }
            pendingRematch.current = null;
            navigation.push('Challenge', { challengeId: result.id });
        } catch (error) {
            Alert.alert(
                t(error instanceof BlockedError ? 'challenge.errorTitle' : 'challenge.offline'),
                t(error instanceof BlockedError ? 'challenge.rematch.errorBody' : 'challenge.rematch.offlineBody'),
            );
        } finally {
            rematchInFlight.current = false;
            setRematchBusy(false);
        }
    }, [attempts, challengeId, deviceId, locale, myTimestamp, navigation, accessibleIds, record, rematchOpponent, t]);

    // The play screen wired to the frozen deck. Memoised on the record so it is
    // built once and isn't reset by unrelated re-renders during the run.
    const playElement = useMemo(() => {
        // Resolving reads content by id and throws when this build lacks it, so it must
        // not run before `load` has vetted the record — `phase` is only 'playing' after
        // the `missingContentIds` gate passed.
        if (phase !== 'playing' || !record) return null;
        const owned = ownedQuestionIds(record.game, accessibleIds);
        const base = {
            ownedIds: owned,
            onComplete: handleComplete,
            sessionId,
            onAbandon: () => abandonSession(sessionId),
        };
        switch (record.game) {
            case 'the-ladder':
                return (
                    <LadderPlayScreen
                        key={sessionId}
                        onExit={exit}
                        challenge={{
                            ...base,
                            initial:
                                getCheckpoint<LadderCheckpoint>(sessionId)?.run ?? ladderRunFromRecord(record, locale),
                        }}
                    />
                );
            case 'the-drop':
                return (
                    <DropPlayScreen
                        key={sessionId}
                        onExit={exit}
                        challenge={{
                            ...base,
                            initial: getCheckpoint<DropCheckpoint>(sessionId)?.state ?? dropStateFromRecord(record),
                        }}
                    />
                );
            case 'the-wheel':
                return (
                    <WheelPlayScreen
                        key={sessionId}
                        onExit={exit}
                        challenge={{
                            ...base,
                            initial:
                                getCheckpoint<WheelCheckpoint>(sessionId)?.game ?? wheelGameFromRecord(record, locale),
                        }}
                    />
                );
            default:
                return null;
        }
    }, [phase, record, accessibleIds, locale, handleComplete, exit, sessionId]);

    if (phase === 'playing' && playElement) {
        return (
            <EventAccentContext.Provider
                value={record?.event ? findEdition(record.event.editionId, true)?.accent : undefined}
            >
                <SafeContainer edges={['top']}>{playElement}</SafeContainer>
            </EventAccentContext.Provider>
        );
    }

    if (phase === 'results' && record) {
        return (
            <SafeContainer edges={['top', 'bottom']}>
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={[
                        styles.resultsContent,
                        { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxl + theme.spacing.xl },
                    ]}
                    keyboardShouldPersistTaps='handled'
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.card, tabletColumn]}>
                        <ResultsCard
                            record={record}
                            attempts={attempts}
                            myTimestamp={myTimestamp}
                            celebrationDiff={celebrationDiff}
                            rematchBusy={rematchBusy}
                            existingRematch={rematchLookup.id !== null}
                            rematchLimitReached={rematchLimitReached}
                            onRematch={beginRematch}
                            onViewRanking={viewRanking}
                            onExit={exit}
                            t={t}
                            locale={locale}
                        />
                    </View>
                </ScrollView>

                <BottomSheet
                    visible={rematchConfirmSheet}
                    onClose={() => setRematchConfirmSheet(false)}
                    title={t('challenge.rematch.confirmTitle', {
                        name: rematchOpponent?.nickname ?? '',
                    })}
                >
                    <Stack gap='md' align='stretch'>
                        <Text variant='body' color='textSecondary' align='center'>
                            {t('challenge.rematch.confirmBody', {
                                game: t(`game.${record.game}.name`),
                            })}
                        </Text>
                        <Button variant='primary' fullWidth loading={rematchBusy} onPress={confirmRematch}>
                            {t('challenge.rematch.confirmAction')}
                        </Button>
                        <Button variant='ghost' fullWidth onPress={() => setRematchConfirmSheet(false)}>
                            {t('common.cancel')}
                        </Button>
                    </Stack>
                </BottomSheet>

                <BottomSheet
                    visible={rematchLimitSheet}
                    onClose={() => setRematchLimitSheet(false)}
                    title={t('challenge.limit.title')}
                >
                    <Stack gap='md' align='stretch'>
                        <Text variant='body' color='textSecondary' align='center'>
                            {t('challenge.limit.body')}
                        </Text>
                        {canUpsell(ownedIds, isPremium) ? (
                            <Button
                                variant='primary'
                                fullWidth
                                onPress={() => {
                                    setRematchLimitSheet(false);
                                    navigation.navigate('Store');
                                }}
                            >
                                {t('challenge.limit.cta')}
                            </Button>
                        ) : null}
                        <Button
                            variant={canUpsell(ownedIds, isPremium) ? 'ghost' : 'primary'}
                            fullWidth
                            onPress={() => setRematchLimitSheet(false)}
                        >
                            {t('challenge.limit.dismiss')}
                        </Button>
                    </Stack>
                </BottomSheet>
            </SafeContainer>
        );
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
                ) : phase === 'full' ? (
                    <MessageCard
                        title={t('events.full')}
                        body={t('events.fullBody')}
                        actionLabel={t('challenge.results')}
                        onAction={() => showResults(null)}
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
                            onStart={() => {
                                if (!eventStartBusy) void startPlay();
                            }}
                            onHome={exit}
                            t={t}
                        />
                    </KeyboardAvoidingView>
                ) : null}
                {celebrationDiff && (phase === 'submitOffline' || phase === 'submitError') ? (
                    <CelebrationCard diff={celebrationDiff} accent={theme.colors.primary} />
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
    celebrationDiff,
    rematchBusy,
    existingRematch,
    rematchLimitReached,
    onRematch,
    onViewRanking,
    onExit,
    t,
    locale,
}: {
    record: ChallengeRecord;
    attempts: LeaderboardEntry[];
    myTimestamp: number | null;
    /** Set only in the session where the run just finished — reopened links never celebrate. */
    celebrationDiff: RecordRunDiff | null;
    rematchBusy: boolean;
    existingRematch: boolean;
    rematchLimitReached: boolean;
    onRematch: () => void;
    onViewRanking: () => void;
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
    const rematchOpponent =
        !record.event && attempts.length === 2 && myTimestamp !== null
            ? attempts.find((entry) => entry.timestamp !== myTimestamp)
            : undefined;
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
                {celebrationDiff ? <CelebrationCard diff={celebrationDiff} accent={accent} /> : null}
                <View style={{ gap: theme.spacing.sm }}>
                    {rematchOpponent ? (
                        <Button
                            variant='primary'
                            fullWidth
                            contentGap='sm'
                            loading={rematchBusy}
                            disabled={rematchBusy}
                            onPress={onRematch}
                            accessibilityLabel={t(
                                existingRematch
                                    ? 'challenge.rematch.openA11y'
                                    : rematchLimitReached
                                      ? 'challenge.rematch.limitA11y'
                                      : 'challenge.rematch.actionA11y',
                                { name: rematchOpponent.nickname },
                            )}
                            style={{
                                backgroundColor: accent,
                                borderColor: accent,
                                opacity: rematchLimitReached ? 0.7 : 1,
                            }}
                            textColor={onAccent}
                            icon={
                                <Icon
                                    name={existingRematch ? Play : rematchLimitReached ? Lock : Swords}
                                    size={iconSize(20)}
                                    color={onAccent}
                                />
                            }
                        >
                            {existingRematch
                                ? t('challenge.rematch.open')
                                : t('challenge.rematch.action', { name: rematchOpponent.nickname })}
                        </Button>
                    ) : null}
                    <Button
                        variant={rematchOpponent ? 'secondary' : 'primary'}
                        fullWidth
                        contentGap='sm'
                        onPress={onViewRanking}
                        accessibilityLabel={t('challenge.viewGlobalRankings')}
                        style={rematchOpponent ? undefined : { backgroundColor: accent, borderColor: accent }}
                        textColor={rematchOpponent ? undefined : onAccent}
                        icon={
                            <Icon
                                name={Trophy}
                                size={iconSize(20)}
                                color={rematchOpponent ? theme.components.button.secondary.text : onAccent}
                            />
                        }
                    >
                        {t('challenge.viewGlobalRankings')}
                    </Button>
                    <Button variant='ghost' fullWidth onPress={onExit} accessibilityLabel={t('common.home')}>
                        {t('common.home')}
                    </Button>
                </View>
            </Card>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    resultsContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
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
