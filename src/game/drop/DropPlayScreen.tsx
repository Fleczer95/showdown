import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import Icon from '../../components/atoms/Icon';
import Slider from '../../components/molecules/Slider';
import { useTheme, useAnimationPresets } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import { useHaptics } from '../../hooks/useHaptics';

import { dropQuestions, type Language } from './content';
import { getHistory, markShown } from '../history';
import {
    buildGame,
    applyRound,
    isValidAllocation,
    coverableOptions,
    BUNDLE,
    TOTAL_ROUNDS,
    type DropState,
} from './logic';

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

export default function DropPlayScreen({ onExit }: { onExit: () => void }) {
    const t = useTheme();
    const { fade } = useAnimationPresets();
    const haptics = useHaptics();
    const { t: translate, locale } = useTranslation();
    const lang = locale as Language;

    const [state, setState] = useState<DropState>(() =>
        buildGame(dropQuestions, getHistory(GAME_ID)),
    );
    const [allocation, setAllocation] = useState<number[]>(EMPTY_ALLOCATION);
    // Drives the lock-in → suspense → reveal choreography.
    const [phase, setPhase] = useState<Phase>('allocating');
    // Per-option reveal state, flipped on a timeline during the reveal.
    const [reveals, setReveals] = useState<Reveal[]>(['none', 'none', 'none', 'none']);
    // Continue only appears once the whole sequence has played out.
    const [canAdvance, setCanAdvance] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Timers driving the suspense ticks + the staged reveal.
    const ticks = useRef<ReturnType<typeof setTimeout>[]>([]);
    const clearTicks = useCallback(() => {
        ticks.current.forEach(clearTimeout);
        ticks.current = [];
    }, []);
    useEffect(() => clearTicks, [clearTicks]);

    const reset = useCallback(() => {
        clearTicks();
        // Re-read history so the next run reflects questions just shown.
        setState(buildGame(dropQuestions, getHistory(GAME_ID)));
        setAllocation(EMPTY_ALLOCATION);
        setPhase('allocating');
        setReveals(['none', 'none', 'none', 'none']);
        setCanAdvance(false);
    }, [clearTicks]);

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
        if (currentQuestionId) {
            markShown(GAME_ID, currentQuestionId);
        }
    }, [currentQuestionId]);

    const onConfirm = useCallback(() => {
        if (!canConfirm) {
            return;
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
        const wrongCovered = [0, 1, 2, 3].filter(
            (i) => allocation[i] > 0 && i !== correctIndex,
        );

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
            });
        });

        // Phase 3 — the correct answer is revealed last, once the final loss
        // has fully settled.
        const lastResolveEnd =
            wrongCovered.length > 0
                ? SUSPENSE_MS + (wrongCovered.length - 1) * DROP_STAGGER + RESOLVE_MS
                : SUSPENSE_MS;
        const answerTime = lastResolveEnd + ANSWER_GAP;
        push(answerTime, () => {
            setReveals((prev) => {
                const next = prev.slice();
                next[correctIndex] = 'win';
                return next;
            });
            // Relief if points survived; a somber thud if the round busted.
            if (allocation[correctIndex] > 0) {
                haptics.notification();
            } else {
                haptics.heavy();
            }
        });

        // Phase 4 — Continue appears once the answer beat has settled too.
        push(answerTime + RESOLVE_MS, () => setCanAdvance(true));
    }, [canConfirm, clearTicks, haptics, allocation, question]);

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
        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.gameOverContent}>
                    <Stack gap='xl' align='center'>
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
                        <Stack gap='xs' align='center'>
                            <Text variant='overline' weight='semibold' color={t.colors.textMuted}>
                                {translate('game.the-drop.over.finalBank')}
                            </Text>
                            <Text
                                variant='display'
                                weight='bold'
                                align='center'
                                color={won ? t.colors.success : t.colors.error}
                            >
                                {formatMoney(state.bank)}
                            </Text>
                        </Stack>
                        <Stack gap='sm' align='stretch' style={styles.fullWidth}>
                            <Button variant='primary' onPress={reset} fullWidth>
                                {translate('game.the-drop.over.playAgain')}
                            </Button>
                            <Button variant='secondary' onPress={onExit} fullWidth>
                                {translate('game.the-drop.over.exit')}
                            </Button>
                        </Stack>
                    </Stack>
                </ScrollView>
            </View>
        );
    }

    const answerShown = reveals[question.correctIndex] === 'win';

    // --- Active round ------------------------------------------------------
    return (
        <View style={styles.container}>
            {/* Top fixed content */}
            <Stack gap='lg' style={[styles.staticHeader, { borderBottomColor: t.colors.border }]}>
                {/* Header */}
                <Stack direction='horizontal' justify='between' align='center' style={styles.header}>
                    <Stack gap='xs'>
                        <Text variant='overline' weight='semibold' color={t.colors.textMuted}>
                            {translate('game.the-drop.header.round', {
                                current: state.round + 1,
                                total: TOTAL_ROUNDS,
                            })}
                        </Text>
                        <Text variant='heading' weight='bold' color={t.colors.primary}>
                            {formatMoney(state.bank)}
                        </Text>
                    </Stack>
                    <Stack gap='xs' align='end'>
                        <Text variant='overline' weight='semibold' color={t.colors.textMuted}>
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

                {/* Question */}
                <Card variant='outlined' padding='md'>
                    <Text variant='subheading' weight='bold' align='center'>
                        {question.prompt[lang]}
                    </Text>
                </Card>

                {phase === 'allocating' && (
                    <Text variant='caption' weight='medium' align='center' color={t.colors.textSecondary}>
                        {translate('game.the-drop.active.instruction', { max: maxCover })}
                    </Text>
                )}
            </Stack>

            {/* Scrollable middle content (options) */}
            <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={styles.optionsContent}
                showsVerticalScrollIndicator={true}
            >
                <Stack gap='md'>
                    {question.options.map((option, i) => (
                        <DropOption
                            key={`${state.round}-${i}`}
                            index={i}
                            label={option[lang]}
                            amount={allocation[i]}
                            phase={phase}
                            reveal={reveals[i]}
                            answerShown={answerShown}
                            lockedByCover={
                                phase === 'allocating' &&
                                allocation[i] === 0 &&
                                coveredCount >= maxCover
                            }
                            sliderMax={state.bank}
                            onChange={(v) => setSlot(i, v)}
                        />
                    ))}
                </Stack>
            </ScrollView>

            {/* Bottom fixed content (actions) */}
            <View style={[styles.footer, { borderTopColor: t.colors.border }]}>
                {phase === 'allocating' ? (
                    <Stack gap='sm'>
                        <Button variant='primary' onPress={onConfirm} disabled={!canConfirm} fullWidth>
                            {translate('game.the-drop.active.lockIn')}
                        </Button>
                        <Button variant='ghost' onPress={() => setShowLeaveConfirm(true)}>
                            {translate('game.the-drop.active.leave')}
                        </Button>
                    </Stack>
                ) : canAdvance ? (
                    <Animated.View entering={FadeIn.duration(fade.duration)}>
                        <Button variant='primary' onPress={onAdvance} fullWidth>
                            {state.round + 1 >= TOTAL_ROUNDS ||
                            allocation[question.correctIndex] === 0
                                ? translate('game.the-drop.reveal.seeResult')
                                : translate('game.the-drop.reveal.next')}
                        </Button>
                    </Animated.View>
                ) : (
                    phase === 'suspense' && (
                        <SuspenseStatus label={translate('game.the-drop.active.lockingIn')} />
                    )
                )}
            </View>

            <LeaveConfirmModal
                visible={showLeaveConfirm}
                gameKey='the-drop'
                onConfirm={onExit}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </View>
    );
}

interface DropOptionProps {
    index: number;
    label: string;
    amount: number;
    phase: Phase;
    reveal: Reveal;
    answerShown: boolean;
    lockedByCover: boolean;
    sliderMax: number;
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
    amount,
    phase,
    reveal,
    answerShown,
    lockedByCover,
    sliderMax,
    onChange,
}: DropOptionProps) {
    const t = useTheme();
    const { t: translate } = useTranslation();
    const prefix = String.fromCharCode(65 + index);
    const reduceMotion = useReducedMotion();
    const { spring, springBouncy, pulse } = useAnimationPresets();

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
                ? withSequence(
                      withSpring(pulse.scale, springBouncy as never),
                      withSpring(1, spring as never),
                  )
                : withSpring(1, spring as never);

        // Text: disappear (fall + fade) → swap content while hidden → return.
        const fall = reveal === 'drop' ? FALL_DISTANCE : 0;
        setShowResult(false);
        textOpacity.value = withSequence(
            withTiming(
                0,
                { duration: DISAPPEAR_MS, easing: Easing.in(Easing.quad) },
                (finished) => {
                    if (finished) {
                        runOnJS(setShowResult)(true);
                    }
                },
            ),
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

    const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textY.value }],
    }));

    let borderColor = t.colors.border;
    let accent = t.colors.primary;
    if (reveal === 'win') {
        borderColor = t.colors.success;
        accent = t.colors.success;
    } else if (reveal === 'drop') {
        borderColor = t.colors.error;
        accent = t.colors.error;
    }

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
        <Animated.View style={cardStyle}>
            <Card variant='outlined' padding='md' style={{ borderColor, opacity: cardOpacity }}>
                <Stack gap='sm'>
                    <Stack
                        direction='horizontal'
                        justify='between'
                        align='center'
                        style={styles.optionHeader}
                    >
                        <Stack direction='horizontal' gap='xs' align='center' flex={1}>
                            <Text variant='body' weight='bold' color='primary'>
                                {prefix}:
                            </Text>
                            <Text variant='body' weight='semibold' style={styles.optionText}>
                                {label}
                            </Text>
                        </Stack>
                        {reveal !== 'none' && (
                            <Icon
                                name={reveal === 'win' ? Check : X}
                                size={20}
                                color={reveal === 'win' ? t.colors.success : t.colors.error}
                            />
                        )}
                    </Stack>

                    {phase === 'allocating' ? (
                        <Slider
                            label={translate('game.the-drop.active.placed')}

                            value={amount}
                            min={0}
                            max={Math.max(BUNDLE, sliderMax)}
                            step={BUNDLE}
                            onChange={(v) => !lockedByCover && onChange(v)}
                            accentColor={accent}
                            renderValue={() => formatMoney(amount)}
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
        paddingHorizontal: 16,
    },
    staticHeader: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    optionsScroll: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.05)', // Subtle contrast for the scroll area
    },
    optionsContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
    },
    header: {
        paddingHorizontal: 18, // content (16) + 12 = 28px total indent
    },
    gameOverContent: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        flexGrow: 1,
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    optionText: {
        flexShrink: 1,
        marginRight: 12,
    },
    optionHeader: {
        paddingHorizontal: 12, // card (12) + 0 = 12px from card border, 28px total indent
    },
    optionOutcome: {
        paddingHorizontal: 0,
    },
});
