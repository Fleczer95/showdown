import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Animated, {
    FadeIn,
    Easing,
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';

import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Leaderboard from '../../components/molecules/Leaderboard';
import GameOverCard from '../../components/molecules/GameOverCard';
import GameOverHeader from '../GameOverHeader';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import RunCelebration from '../../components/molecules/RunCelebration';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import ProgressBar from '../../components/molecules/ProgressBar';
import type { GameRunResult } from '../progression';
import Icon from '../../components/atoms/Icon';
import IndexBadge, { type IndexBadgeState } from '../../components/atoms/IndexBadge';
import AccentTab from '../../components/atoms/AccentTab';
import Slider from '../../components/molecules/Slider';
import { springEnter } from '../transitions';
import { useTheme, useAnimationPresets } from '../../theme';
import { useGameAccent } from '../useGameAccent';
import { useTranslation } from '../../i18n/TranslationContext';
import { useHaptics } from '../../hooks/useHaptics';
import { useSound } from '../../hooks/useSound';
import { useResponsive } from '../../responsive/useResponsive';

import { dropQuestions, zipDropCard, type DropPackCard, type Language } from './content';
import { getHistory, markShown } from '../history';
import { useStore } from '../../hooks/store/useStore';
import { getOwnedPackContentBilingual } from '../../data/store/packContent';
import {
    buildGame,
    applyRound,
    isValidAllocation,
    coverableOptions,
    BUNDLE,
    TOTAL_ROUNDS,
    type DropState,
    type DropQuestion,
} from './logic';
import { dropScore, speedBonus, DROP_ROUND_SURVIVAL_POINTS } from '../scoring';
import { ChallengeHandoff, type ChallengePlay } from '../challenge/ChallengeHandoff';

const EMPTY_ALLOCATION = [0, 0, 0, 0];

const GAME_ID = 'the-drop';

// ── Reveal choreography timing (ms) ───────────────────────────────
// Losses-first sequence, paced so every beat is readable on its own:
//   hold → each wrong stake "disappears" then settles back as a red tally
//   (so the player sees what was lost) → the answer is revealed last →
//   Continue appears once it has all settled.
const SUSPENSE_MS = 1400; // Phase 1: held tension before anything resolves.
const DROP_STAGGER = 900; // Phase 2: gap between the START of consecutive losses.
const ANSWER_GAP = 600; // Phase 3: dwell after the last loss settles, before the answer.

// A single loss "beat": the staked text falls away and fades (disappear),
// a short empty gap, then the loss tally fades back in and stays (return).
const DISAPPEAR_MS = 460;
const GAP_MS = 180;
const RETURN_MS = 420;
const RESOLVE_MS = DISAPPEAR_MS + GAP_MS + RETURN_MS; // full length of one beat
const FALL_DISTANCE = 56; // how far the text falls while disappearing
const RETURN_RISE = 12; // how far below the tally rises from as it returns

type Phase = 'allocating' | 'suspense' | 'reveal';
type Reveal = 'none' | 'drop' | 'win';

const formatMoney = (value: number): string => value.toLocaleString('en-US');

export default function DropPlayScreen({
    onExit,
    challenge,
}: {
    onExit: () => void;
    challenge?: ChallengePlay<DropState>;
}) {
    const t = useTheme();
    const reduceMotion = useReducedMotion();
    const { accent, onAccent, glow } = useGameAccent(GAME_ID);
    const { fade } = useAnimationPresets();
    const haptics = useHaptics();
    const { play } = useSound();
    const { t: translate, locale } = useTranslation();
    const lang = locale as Language;
    const { tabletColumn, isTablet } = useResponsive();

    // Free bank plus any owned premium pack questions (reconstructed bilingual).
    const { purchasedItemIds } = useStore();
    const pool = useMemo(
        () => [
            ...dropQuestions,
            ...getOwnedPackContentBilingual<DropPackCard, DropQuestion>(
                GAME_ID,
                new Set(purchasedItemIds),
                zipDropCard,
            ),
        ],
        [purchasedItemIds],
    );

    const [state, setState] = useState<DropState>(() => challenge?.initial ?? buildGame(pool, getHistory(GAME_ID)));
    const [allocation, setAllocation] = useState<number[]>(EMPTY_ALLOCATION);
    // Drives the lock-in → suspense → reveal choreography.
    const [phase, setPhase] = useState<Phase>('allocating');
    // Per-option reveal state, flipped on a timeline during the reveal.
    const [reveals, setReveals] = useState<Reveal[]>(['none', 'none', 'none', 'none']);
    // Continue only appears once the whole sequence has played out.
    const [canAdvance, setCanAdvance] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Hidden per-round stopwatch (allocating phase → Lock In). Each *survived*
    // round banks a timing bonus (faster = more); these accumulate into the
    // unified points speed total. A busted round earns no timing.
    const decisionStartedAt = useRef(Date.now());
    const survivalSpeed = useRef(0);

    // Restart the round timer whenever a fresh allocating phase begins.
    useEffect(() => {
        if (phase === 'allocating') {
            decisionStartedAt.current = Date.now();
        }
    }, [phase, state.round]);

    // Timers driving the suspense ticks + the staged reveal.
    const ticks = useRef<ReturnType<typeof setTimeout>[]>([]);
    const clearTicks = useCallback(() => {
        ticks.current.forEach(clearTimeout);
        ticks.current = [];
    }, []);
    useEffect(() => clearTicks, [clearTicks]);

    const reset = useCallback(() => {
        clearTicks();
        survivalSpeed.current = 0;
        // Re-read history so the next run reflects questions just shown.
        setState(buildGame(pool, getHistory(GAME_ID)));
        setAllocation(EMPTY_ALLOCATION);
        setPhase('allocating');
        setReveals(['none', 'none', 'none', 'none']);
        setCanAdvance(false);
    }, [clearTicks, pool]);

    const placed = allocation.reduce((sum, a) => sum + a, 0);
    const remaining = state.bank - placed;
    const coveredCount = allocation.filter((a) => a > 0).length;
    const maxCover = coverableOptions(state.bank);

    const setSlot = useCallback(
        (index: number, value: number) => {
            setAllocation((prev) => {
                const others = prev.reduce((sum, a, i) => (i === index ? sum : sum + a), 0);
                // Clamp so the total never exceeds the bank.
                const clamped = Math.min(value, state.bank - others);
                const next = prev.slice();
                next[index] = Math.max(0, clamped);
                return next;
            });
        },
        [state.bank],
    );

    const canConfirm = isValidAllocation(state.bank, allocation);
    const question = state.questions[state.round];

    // Count a question as shown the moment its round is displayed (once per
    // distinct question), so the next run can avoid repeating it.
    const currentQuestionId = question?.id;
    useEffect(() => {
        // In challenge mode only mark owned questions, so embedded premium content
        // the player doesn't own never pollutes their local rotation.
        if (currentQuestionId && (!challenge || challenge.ownedIds.has(currentQuestionId))) {
            markShown(GAME_ID, currentQuestionId);
        }
    }, [currentQuestionId, challenge]);

    const onConfirm = useCallback(() => {
        if (!canConfirm) {
            return;
        }
        // Record this round's decision time at Lock In, before the suspense/
        // reveal plays out (that animation must not count). Only a survived round
        // (a stake on the correct option) banks its timing bonus toward the score.
        const seconds = (Date.now() - decisionStartedAt.current) / 1000;
        if (allocation[question.correctIndex] > 0) {
            survivalSpeed.current += speedBonus(DROP_ROUND_SURVIVAL_POINTS, seconds);
        }
        clearTicks();
        setReveals(['none', 'none', 'none', 'none']);
        setCanAdvance(false);
        setPhase('suspense');

        const push = (delay: number, fn: () => void) => {
            ticks.current.push(setTimeout(fn, delay));
        };

        // Phase 1 — accelerating ticks build the pressure across the hold.
        push(120, haptics.light);
        push(430, haptics.light);
        push(700, haptics.medium);
        push(950, haptics.medium);
        push(1180, haptics.medium);
        push(1360, haptics.medium);

        const correctIndex = question.correctIndex;
        const wrongCovered = [0, 1, 2, 3].filter((i) => allocation[i] > 0 && i !== correctIndex);

        // Phase 2 — losses resolve one at a time; each is a full disappear→
        // return beat, so they are spaced far enough apart to read.
        push(SUSPENSE_MS, () => setPhase('reveal'));
        wrongCovered.forEach((idx, k) => {
            push(SUSPENSE_MS + k * DROP_STAGGER, () => {
                setReveals((prev) => {
                    const next = prev.slice();
                    next[idx] = 'drop';
                    return next;
                });
                haptics.heavy();
                play('wrong');
            });
        });

        // Phase 3 — the correct answer is revealed last, once the final loss
        // has fully settled.
        const lastResolveEnd =
            wrongCovered.length > 0 ? SUSPENSE_MS + (wrongCovered.length - 1) * DROP_STAGGER + RESOLVE_MS : SUSPENSE_MS;
        const answerTime = lastResolveEnd + ANSWER_GAP;
        push(answerTime, () => {
            setReveals((prev) => {
                const next = prev.slice();
                next[correctIndex] = 'win';
                return next;
            });
            // Relief if points survived; a somber "womp" if the round busted.
            if (allocation[correctIndex] > 0) {
                haptics.notification();
                play('correct');
            } else {
                haptics.heavy();
                play('bust');
            }
        });

        // Phase 4 — Continue appears once the answer beat has settled too.
        push(answerTime + RESOLVE_MS, () => setCanAdvance(true));
    }, [canConfirm, clearTicks, haptics, play, allocation, question]);

    const onAdvance = useCallback(() => {
        clearTicks();
        setState((prev) => applyRound(prev, allocation));
        setAllocation(EMPTY_ALLOCATION);
        setPhase('allocating');
        setReveals(['none', 'none', 'none', 'none']);
        setCanAdvance(false);
    }, [allocation, clearTicks]);

    // --- Game over ---------------------------------------------------------
    if (state.status === 'over') {
        const won = state.bank > 0;
        // Rounds survived ranks the board; a win cleared them all, a bust survived
        // every round before the one that wiped the bank.
        const roundsSurvived = Math.max(0, won ? state.round : state.round - 1);
        const breakdown = dropScore({ bank: state.bank, roundsSurvived, speed: survivalSpeed.current });
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won,
            finalBank: state.bank,
            roundsSurvived,
        };
        // Challenge mode reports the result to the orchestrator instead of the board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={roundsSurvived}
                    run={runResult}
                    onComplete={challenge.onComplete}
                />
            );
        }
        return (
            <View style={styles.container}>
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={[styles.gameOverContent, { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.xxl }]}
                    keyboardShouldPersistTaps='handled'
                >
                    <GameOverCard gameId={GAME_ID}>
                        {({ accent, onAccent }) => (
                            <>
                                {/* The Drop classifies by score: any banked cash cheers, a bust draws a dismay (plan §3). */}
                                <GameOverHeader pose={won ? 'cheer' : 'dismay'}>
                                    <Stack gap='xs' align='center'>
                                        <Text variant='display' weight='bold' align='center'>
                                            {translate('game.the-drop.over.title')}
                                        </Text>
                                        <Text
                                            variant='caption'
                                            weight='semibold'
                                            align='center'
                                            color={t.colors.textSecondary}
                                        >
                                            {won
                                                ? translate('game.the-drop.over.survived')
                                                : translate('game.the-drop.over.busted')}
                                        </Text>
                                    </Stack>
                                    <Stack gap='xs' align='center'>
                                        <Text variant='overline' weight='semibold' color={t.colors.textMuted}>
                                            {translate('leaderboard.totalPoints')}
                                        </Text>
                                        <Text
                                            variant='display'
                                            weight='bold'
                                            align='center'
                                            color={won ? t.colors.success : t.colors.error}
                                        >
                                            {breakdown.total.toLocaleString(locale)}
                                        </Text>
                                    </Stack>
                                </GameOverHeader>
                                <ScoreBreakdownLine breakdown={breakdown} />
                                <RunCelebration result={runResult} accent={accent} />
                                <Leaderboard
                                    gameId={GAME_ID}
                                    pendingScore={breakdown.total}
                                    pendingProgress={roundsSurvived}
                                />
                                <Stack gap='sm' align='stretch'>
                                    <Button
                                        variant='primary'
                                        onPress={reset}
                                        fullWidth
                                        style={{ backgroundColor: accent, borderColor: accent }}
                                        textColor={onAccent}
                                    >
                                        {translate('game.the-drop.over.playAgain')}
                                    </Button>
                                    <Button variant='secondary' onPress={onExit} fullWidth>
                                        {translate('game.the-drop.over.exit')}
                                    </Button>
                                </Stack>
                            </>
                        )}
                    </GameOverCard>
                </ScrollView>
            </View>
        );
    }

    const answerShown = reveals[question.correctIndex] === 'win';

    // --- Active round ------------------------------------------------------
    return (
        <View style={styles.container}>
            {/* Top fixed content */}
            <View style={[styles.staticHeader, { borderBottomColor: t.colors.border, paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.md }]}>
                <Stack gap='lg' style={tabletColumn}>
                    {/* Header */}
                    <Stack direction='horizontal' justify='between' align='center' style={[styles.header, { paddingHorizontal: t.spacing.md + 2 }]}>
                    <Stack gap='xs'>
                        <Text variant='overline' weight='bold' color={accent}>
                            {translate('game.the-drop.header.round', {
                                current: state.round + 1,
                                total: TOTAL_ROUNDS,
                            })}
                        </Text>
                        <Text variant='heading' weight='bold' color={accent}>
                            {formatMoney(state.bank)}
                        </Text>
                    </Stack>
                    <Stack gap='xs' align='end'>
                        <Text variant='overline' weight='bold' color={accent}>
                            {translate('game.the-drop.header.toPlace')}
                        </Text>
                        <Text
                            variant='subheading'
                            weight='bold'
                            color={remaining === 0 ? t.colors.success : t.colors.text}
                        >
                            {formatMoney(remaining)}
                        </Text>
                    </Stack>
                </Stack>

                <ProgressBar
                    progress={(state.round + (phase === 'reveal' ? 1 : 0)) / TOTAL_ROUNDS}
                    color={accent}
                    glowColor={accent}
                    height={10}
                />

                {/* Question */}
                <Animated.View key={question.id} entering={reduceMotion ? undefined : springEnter()}>
                    <Card variant='elevated' padding='md' gap='sm' style={glow}>
                        <AccentTab color={accent} />
                        <Text variant='subheading' weight='bold' align='center'>
                            {question.prompt[lang]}
                        </Text>
                    </Card>
                </Animated.View>

                {phase === 'allocating' && (
                    <Text variant='caption' weight='medium' align='center' color={t.colors.textSecondary}>
                        {translate('game.the-drop.active.instruction', { count: maxCover, max: maxCover })}
                    </Text>
                )}
                </Stack>
            </View>

            {/* Scrollable middle content (options) */}
            <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={[styles.optionsContent, { padding: t.spacing.md }]}
                showsVerticalScrollIndicator={true}
            >
                <Stack gap='md' style={tabletColumn}>
                    {question.options.map((option, i) => (
                        <DropOption
                            key={`${state.round}-${i}`}
                            index={i}
                            label={option[lang]}
                            accent={accent}
                            amount={allocation[i]}
                            phase={phase}
                            reveal={reveals[i]}
                            answerShown={answerShown}
                            lockedByCover={phase === 'allocating' && allocation[i] === 0 && coveredCount >= maxCover}
                            sliderMax={state.bank}
                            isTablet={isTablet}
                            onChange={(v) => setSlot(i, v)}
                        />
                    ))}
                </Stack>
            </ScrollView>

            {/* Bottom fixed content (actions) */}
            <View style={[styles.footer, { borderTopColor: t.colors.border, padding: t.spacing.md }]}>
                <View style={tabletColumn}>
                    {phase === 'allocating' ? (
                        <Stack gap='sm'>
                            <Button
                                variant='primary'
                                onPress={onConfirm}
                                disabled={!canConfirm}
                                fullWidth
                                style={canConfirm ? { backgroundColor: accent, borderColor: accent } : undefined}
                                textColor={canConfirm ? onAccent : undefined}
                            >
                                {translate('game.the-drop.active.lockIn')}
                            </Button>
                            <Button variant='ghost' fullWidth onPress={() => setShowLeaveConfirm(true)}>
                                {translate('game.the-drop.active.leave')}
                            </Button>
                        </Stack>
                    ) : canAdvance ? (
                        <Animated.View entering={FadeIn.duration(fade.duration)}>
                            <Button
                                variant='primary'
                                onPress={onAdvance}
                                fullWidth
                                style={{ backgroundColor: accent, borderColor: accent }}
                                textColor={onAccent}
                            >
                                {state.round + 1 >= TOTAL_ROUNDS || allocation[question.correctIndex] === 0
                                    ? translate('game.the-drop.reveal.seeResult')
                                    : translate('game.the-drop.reveal.next')}
                            </Button>
                        </Animated.View>
                    ) : (
                        phase === 'suspense' && <SuspenseStatus label={translate('game.the-drop.active.lockingIn')} />
                    )}
                </View>
            </View>

            <LeaveConfirmModal
                visible={showLeaveConfirm}
                gameKey='the-drop'
                onConfirm={() => {
                    setShowLeaveConfirm(false);
                    onExit();
                }}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </View>
    );
}

interface DropOptionProps {
    index: number;
    label: string;
    /** Per-game accent for neutral chrome (prefix + slider) before any reveal. */
    accent: string;
    amount: number;
    phase: Phase;
    reveal: Reveal;
    answerShown: boolean;
    lockedByCover: boolean;
    sliderMax: number;
    isTablet: boolean;
    onChange: (value: number) => void;
}

/**
 * A single answer option. Owns its own reveal choreography, driven by `reveal`:
 *  - while unresolved during suspense/reveal, a covered card "breathes"
 *    (theme `pulse` token) — the nervous survivor as neighbours fall,
 *  - `drop`: the staked text falls away and fades (disappear), then the loss
 *    tally fades back in and stays, so the player sees what was lost,
 *  - `win`: the same text crossfades to the survived amount as the card pops.
 * All motion is skipped under "reduce motion"; the result still shows and the
 * timed sequence still plays, so the outcome stays readable.
 */
function DropOption({
    index,
    label,
    accent,
    amount,
    phase,
    reveal,
    answerShown,
    lockedByCover,
    sliderMax,
    isTablet,
    onChange,
}: DropOptionProps) {
    const t = useTheme();
    const { t: translate } = useTranslation();
    const prefix = String.fromCharCode(65 + index);
    const reduceMotion = useReducedMotion();
    const { spring, springBouncy, pulse } = useAnimationPresets();
    const { iconSize } = useResponsive();

    const scale = useSharedValue(1);
    const textOpacity = useSharedValue(1);
    const textY = useSharedValue(0);
    // Flips at the bottom of the disappear act (while invisible) so the text
    // content swaps from the staked amount to the result tally unseen.
    const [showResult, setShowResult] = useState(false);

    const covered = amount > 0;

    useEffect(() => {
        if (reveal === 'none') {
            // Unresolved: breathe if covered & in play, otherwise rest.
            setShowResult(false);
            cancelAnimation(scale);
            textOpacity.value = 1;
            textY.value = 0;
            if (reduceMotion) {
                scale.value = 1;
                return;
            }
            const breathing = (phase === 'suspense' || phase === 'reveal') && covered;
            scale.value = breathing
                ? withRepeat(
                      withTiming(pulse.scale, {
                          duration: pulse.duration,
                          easing: Easing.inOut(Easing.quad),
                      }),
                      -1,
                      true,
                  )
                : withTiming(1, { duration: 150 });
            return;
        }

        // Resolving (drop | win).
        cancelAnimation(scale);
        if (reduceMotion) {
            scale.value = 1;
            textOpacity.value = 1;
            textY.value = 0;
            setShowResult(true);
            return;
        }

        // Card: win pops, a loss just settles flat.
        scale.value =
            reveal === 'win'
                ? withSequence(withSpring(pulse.scale, springBouncy as never), withSpring(1, spring as never))
                : withSpring(1, spring as never);

        // Text: disappear (fall + fade) → swap content while hidden → return.
        const fall = reveal === 'drop' ? FALL_DISTANCE : 0;
        setShowResult(false);
        textOpacity.value = withSequence(
            withTiming(0, { duration: DISAPPEAR_MS, easing: Easing.in(Easing.quad) }, (finished) => {
                if (finished) {
                    runOnJS(setShowResult)(true);
                }
            }),
            withDelay(GAP_MS, withTiming(1, { duration: RETURN_MS, easing: Easing.out(Easing.quad) })),
        );
        textY.value = withSequence(
            withTiming(fall, { duration: DISAPPEAR_MS, easing: Easing.in(Easing.cubic) }),
            withTiming(RETURN_RISE, { duration: 0 }),
            withDelay(GAP_MS, withTiming(0, { duration: RETURN_MS, easing: Easing.out(Easing.quad) })),
        );
    }, [
        reveal,
        phase,
        covered,
        reduceMotion,
        scale,
        textOpacity,
        textY,
        pulse.scale,
        pulse.duration,
        spring,
        springBouncy,
    ]);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { scaleX: isTablet ? 1 : scale.value },
            { scaleY: scale.value }
        ]
    }));
    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textY.value }],
    }));

    let borderColor = t.colors.border;
    // Slider tints with the game accent while allocating; the reveal phase hides
    // the slider, so the success/error overrides only keep the value coherent.
    let sliderAccent = accent;
    if (reveal === 'win') {
        borderColor = t.colors.success;
        sliderAccent = t.colors.success;
    } else if (reveal === 'drop') {
        borderColor = t.colors.error;
        sliderAccent = t.colors.error;
    }

    const badgeState: IndexBadgeState = reveal === 'win' ? 'correct' : reveal === 'drop' ? 'wrong' : 'default';

    let cardOpacity = 1;
    if (lockedByCover) {
        cardOpacity = 0.5;
    } else if (answerShown && reveal === 'none') {
        // Answers that never mattered recede once the result is in.
        cardOpacity = 0.5;
    }

    // Outcome text shows the frozen stake until the content swap, then the tally.
    const resolved = showResult && reveal !== 'none';
    let outcomeText: string;
    let outcomeColor: string;
    let outcomeWeight: 'semibold' | 'bold';
    if (!resolved) {
        outcomeText = covered
            ? `${translate('game.the-drop.active.placed')}: ${formatMoney(amount)}`
            : translate('game.the-drop.reveal.empty');
        outcomeColor = t.colors.textSecondary;
        outcomeWeight = 'semibold';
    } else if (reveal === 'win') {
        outcomeText = covered
            ? translate('game.the-drop.reveal.survived', { amount: formatMoney(amount) })
            : translate('game.the-drop.reveal.empty');
        outcomeColor = t.colors.success;
        outcomeWeight = 'bold';
    } else {
        outcomeText = covered
            ? translate('game.the-drop.reveal.dropped', { amount: formatMoney(amount) })
            : translate('game.the-drop.reveal.empty');
        outcomeColor = t.colors.error;
        outcomeWeight = 'bold';
    }

    return (
        <Animated.View entering={reduceMotion ? undefined : springEnter(index * 70)} style={cardStyle}>
            <Card variant='outlined' padding='md' style={{ borderColor, opacity: cardOpacity }}>
                <Stack gap='sm'>
                    <Stack direction='horizontal' justify='between' align='center' style={[styles.optionHeader, { paddingHorizontal: t.spacing.md }]}>
                        <Stack direction='horizontal' gap='md' align='center' flex={1}>
                            <IndexBadge label={prefix} accent={accent} state={badgeState} size={t.typography.lineHeight.xl + t.spacing.xs} />
                            <Text variant='body' weight='semibold' style={[styles.optionText, { marginRight: t.spacing.md }]}>
                                {label}
                            </Text>
                        </Stack>
                        {phase === 'allocating' ? (
                            <Stack gap='xs' align='end'>
                                <Text variant='overline' weight='semibold' color={t.colors.textSecondary}>
                                    {translate('game.the-drop.active.placed')}
                                </Text>
                                <Text variant='body' weight='bold' color={sliderAccent}>
                                    {formatMoney(amount)}
                                </Text>
                            </Stack>
                        ) : reveal !== 'none' ? (
                            <Icon
                                name={reveal === 'win' ? Check : X}
                                size={iconSize(20)}
                                color={reveal === 'win' ? t.colors.success : t.colors.error}
                            />
                        ) : null}
                    </Stack>

                    {phase === 'allocating' ? (
                        <Slider
                            value={amount}
                            min={0}
                            max={Math.max(BUNDLE, sliderMax)}
                            step={BUNDLE}
                            onChange={(v) => !lockedByCover && onChange(v)}
                            accentColor={sliderAccent}
                        />
                    ) : (
                        <Animated.View style={[textStyle, styles.optionOutcome]}>
                            <Text variant='caption' weight={outcomeWeight} color={outcomeColor}>
                                {outcomeText}
                            </Text>
                        </Animated.View>
                    )}
                </Stack>
            </Card>
        </Animated.View>
    );
}

/** Pulsing "Locking in…" status shown while the reveal is held in suspense. */
function SuspenseStatus({ label }: { label: string }) {
    const t = useTheme();
    const { pulse } = useAnimationPresets();
    const reduceMotion = useReducedMotion();
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (reduceMotion) {
            return;
        }
        opacity.value = withRepeat(withTiming(0.45, { duration: pulse.duration }), -1, true);
        return () => cancelAnimation(opacity);
    }, [reduceMotion, pulse.duration, opacity]);

    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View entering={FadeIn.duration(180)} style={style}>
            <Text variant='caption' weight='semibold' align='center' color={t.colors.textSecondary}>
                {label}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
    },
    staticHeader: {
        borderBottomWidth: 1,
    },
    optionsScroll: {
        flex: 1,
    },
    optionsContent: {
    },
    footer: {
        borderTopWidth: 1,
    },
    header: {
    },
    gameOverContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionText: {
        flexShrink: 1,
    },
    optionHeader: {
        // Horizontal padding is set dynamically via t.spacing.md to match the slider track indent.
    },
    optionOutcome: {
        paddingHorizontal: 0,
    },
});
