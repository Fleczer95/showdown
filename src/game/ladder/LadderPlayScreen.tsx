import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    cancelAnimation,
    useReducedMotion,
} from 'react-native-reanimated';
import { Scissors, HelpCircle, SkipForward, Check, X, Users } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Leaderboard from '../../components/molecules/Leaderboard';
import GameOverCard from '../../components/molecules/GameOverCard';
import GameOverHeader from '../GameOverHeader';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import RunCelebration from '../../components/molecules/RunCelebration';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import { isQuickWit, type GameRunResult } from '../progression';
import ProgressBar from '../../components/molecules/ProgressBar';
import Icon from '../../components/atoms/Icon';
import IndexBadge, { type IndexBadgeState } from '../../components/atoms/IndexBadge';
import AccentTab from '../../components/atoms/AccentTab';
import { springEnter } from '../transitions';
import { useTheme, useColor, useAnimationPresets } from '../../theme';
import { hexToRgba, readableOn } from '../../theme/colorUtils';
import { useGameAccent } from '../useGameAccent';
import { useTranslation } from '../../i18n/TranslationContext';
import { buildLocalizedRungs, type Language, type LadderPackCard } from './buildRuns';
import { getHistory, markShown } from '../history';
import { useSound } from '../../hooks/useSound';
import { useHaptics } from '../../hooks/useHaptics';
import { useStore } from '../../hooks/store/useStore';
import { getOwnedPackContent } from '../../data/store/packContent';
import { useResponsive } from '../../responsive/useResponsive';
import {
    buildRun,
    applyAnswer,
    canUseLifeline,
    consumeLifeline,
    fiftyFiftyHidden,
    audienceVote,
    skipQuestion,
    currentQuestion,
    reachedRung,
    RUN_LENGTH,
    type LadderRun,
    type Lifeline,
} from './logic';
import { speedBonus, ladderScore, LADDER_RUNG_POINTS, type ScoreBreakdown } from '../scoring';
import { ChallengeHandoff, type ChallengePlay } from '../challenge/ChallengeHandoff';

const GAME_ID = 'the-ladder';

// Reveal drama scales with the stake. After locking an answer the screen holds a
// suspended "pending" state (amber, no verdict yet) before the correct/wrong
// reveal lands: brief on the low rungs, stretched out near the top of the climb.
// The floor sits above one full heartbeat cycle (see PULSE_HALF_MS) so even the
// low rungs land a clean "lock → breathe → reveal" beat rather than a flicker.
const SUSPENSE_MIN_MS = 800;
const SUSPENSE_MAX_MS = 1900;
// How long the green/red verdict stays on screen before the run advances.
const REVEAL_HOLD_MS = 850;
// Reduced-motion players get a short, fixed pause with no pulsing/heartbeats.
const SUSPENSE_REDUCED_MS = 500;
// One half of the locked-answer heartbeat (scale up, then back). A full cycle is
// 2× this; SUSPENSE_MIN_MS must exceed it so the floor shows a complete breath.
const PULSE_HALF_MS = 360;

const LIFELINE_META: { key: Lifeline; icon: typeof Scissors; labelKey: string }[] = [
    { key: 'fiftyFifty', icon: Scissors, labelKey: 'game.the-ladder.lifelines.fiftyFifty' },
    { key: 'askStudio', icon: HelpCircle, labelKey: 'game.the-ladder.lifelines.askStudio' },
    { key: 'skip', icon: SkipForward, labelKey: 'game.the-ladder.lifelines.skip' },
];

export default function LadderPlayScreen({
    onExit,
    challenge,
}: {
    onExit: () => void;
    challenge?: ChallengePlay<LadderRun>;
}) {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const { accent, glow } = useGameAccent(GAME_ID);
    const { t, locale } = useTranslation();
    const lang = (locale === 'pl' ? 'pl' : 'en') as Language;

    // Owned premium pack questions, localized + slotted into rungs by difficulty.
    const { purchasedItemIds } = useStore();
    const ownedCards = useMemo(
        () => getOwnedPackContent<LadderPackCard>(GAME_ID, lang, new Set(purchasedItemIds)),
        [purchasedItemIds, lang],
    );

    const success = useColor('success');
    const error = useColor('error');
    const warning = useColor('warning');
    const textMuted = useColor('textMuted');
    const surface = useColor('surface');

    const { play } = useSound();
    const haptics = useHaptics();
    const { tabletColumn, isTablet } = useResponsive();

    const [run, setRun] = useState<LadderRun>(
        () => challenge?.initial ?? buildRun(buildLocalizedRungs(lang, ownedCards), getHistory(GAME_ID)),
    );

    // Hidden per-decision stopwatch + run accumulators for the unified points
    // score. The timer resets on every new question (including after a Skip);
    // base + speed accrue only on correct answers, the lifeline bonus at run end.
    const decisionStartedAt = useRef(Date.now());
    const baseTotal = useRef(0);
    const speedTotal = useRef(0);
    // "Quick Wit": a single fast, correct answer at a high rung this run.
    const quickWit = useRef(false);

    // Count a question as shown once per distinct question displayed, and restart
    // the decision timer. Skipping changes the current id, so this refires for the
    // swapped-in question while the skipped one was already counted when first shown.
    useEffect(() => {
        const id = currentQuestion(run).id;
        // In challenge mode only mark questions the player owns, so embedded
        // premium content they don't own never pollutes their local rotation.
        if (!challenge || challenge.ownedIds.has(id)) markShown(GAME_ID, id);
        decisionStartedAt.current = Date.now();
    }, [currentQuestion(run).id, challenge]);
    // Per-question transient UI state.
    const [hidden, setHidden] = useState<number[]>([]);
    const [audience, setAudience] = useState<number[] | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    // The verdict is withheld during the suspense beat: `selected` marks the
    // locked-in choice, `revealed` flips on only when the correct/wrong reveal
    // lands. Until then the chosen option sits in a neutral "pending" state.
    const [revealed, setRevealed] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Pending reveal timers, cleared on unmount so a verdict never fires into a
    // torn-down screen (e.g. the player leaves mid-suspense).
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    useEffect(() => () => timers.current.forEach(clearTimeout), []);
    const schedule = (fn: () => void, ms: number) => {
        timers.current.push(setTimeout(fn, ms));
    };

    const question = currentQuestion(run);

    function resetTransient() {
        setHidden([]);
        setAudience(null);
        setSelected(null);
        setRevealed(false);
    }

    function startFreshRun() {
        setRun(buildRun(buildLocalizedRungs(lang, ownedCards), getHistory(GAME_ID)));
        baseTotal.current = 0;
        speedTotal.current = 0;
        quickWit.current = false;
        resetTransient();
    }

    function handleAnswer(index: number) {
        if (run.status !== 'active' || selected !== null) {
            return;
        }
        setSelected(index);
        haptics.medium(); // the "thunk" of locking your answer in
        const correct = index === question.correctIndex;
        // Score a correct answer at lock time (the suspense + reveal delay must
        // not count against the speed timer): base = rung × points + speed bonus.
        if (correct) {
            const rung = run.currentIndex + 1;
            const base = rung * LADDER_RUNG_POINTS;
            const seconds = (Date.now() - decisionStartedAt.current) / 1000;
            baseTotal.current += base;
            speedTotal.current += speedBonus(base, seconds);
            if (isQuickWit(rung, seconds)) quickWit.current = true;
        }
        const next = applyAnswer(run, index);
        // Tension scales with the stake: higher rungs hold the verdict longer and,
        // near the top, throb a heartbeat or two before it lands.
        const stake = RUN_LENGTH > 1 ? run.currentIndex / (RUN_LENGTH - 1) : 0;
        const suspenseMs = reduceMotion
            ? SUSPENSE_REDUCED_MS
            : Math.round(SUSPENSE_MIN_MS + (SUSPENSE_MAX_MS - SUSPENSE_MIN_MS) * stake);
        if (!reduceMotion) {
            // 0 heartbeats low on the ladder, ramping to 3 near the top, spaced
            // evenly across the suspense window.
            const beats = Math.floor(stake * 4);
            for (let b = 1; b <= beats; b++) {
                schedule(() => haptics.light(), (suspenseMs * b) / (beats + 1));
            }
        }
        // Phase 2 → 3: hold the suspense, then drop the verdict (colour + sound +
        // payoff haptic), let it breathe, and advance the run.
        schedule(() => {
            setRevealed(true);
            play(correct ? 'correct' : 'wrong');
            if (correct) haptics.notification();
            else haptics.heavy();
            schedule(() => {
                setRun(next);
                if (next.status === 'active') {
                    resetTransient();
                }
            }, REVEAL_HOLD_MS);
        }, suspenseMs);
    }

    function handleLifeline(key: Lifeline) {
        if (!canUseLifeline(run, key) || selected !== null) {
            return;
        }
        if (key === 'fiftyFifty') {
            setHidden(fiftyFiftyHidden(run));
            setRun(consumeLifeline(run, 'fiftyFifty'));
        } else if (key === 'askStudio') {
            // Poll the audience over whatever options are still live (50:50 may
            // have removed two), then lock the result in for this question.
            setAudience(audienceVote(run, hidden));
            setRun(consumeLifeline(run, 'askStudio'));
        } else if (key === 'skip') {
            // Swap to a different same-rung question; player must still answer it.
            setRun(skipQuestion(run));
            resetTransient();
        }
    }

    if (run.status !== 'active') {
        const breakdown = ladderScore({
            base: baseTotal.current,
            speed: speedTotal.current,
            usedLifelines: run.usedLifelines.length,
        });
        // Questions answered correctly drives the ranking: a Q1 miss is 0 (and so
        // never reaches the board), a win clears all RUN_LENGTH rungs.
        const correctAnswered = run.status === 'won' ? RUN_LENGTH : run.currentIndex;
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won: run.status === 'won',
            rungReached: reachedRung(run),
            lifelinesUsed: run.usedLifelines.length,
            quickWit: quickWit.current,
        };
        // Challenge mode hands the result to the Challenge orchestrator (submit +
        // reveal) instead of the normal game-over board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={correctAnswered}
                    run={runResult}
                    onComplete={challenge.onComplete}
                />
            );
        }
        return (
            <GameOverView
                won={run.status === 'won'}
                rung={reachedRung(run)}
                progress={correctAnswered}
                breakdown={breakdown}
                runResult={runResult}
                onPlayAgain={startFreshRun}
                onExit={onExit}
            />
        );
    }

    const lifelinesLeft = LIFELINE_META.length - run.usedLifelines.length;

    return (
        <ScrollView
            contentContainerStyle={[
                styles.scroll,
                { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + theme.spacing.lg },
            ]}
        >
            <Stack gap='lg' style={tabletColumn}>
                <Stack gap='sm'>
                    <Stack direction='horizontal' justify='between' align='center'>
                        <View style={[styles.counterPill, { backgroundColor: hexToRgba(accent, 0.16), paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }]}>
                            <Text variant='overline' color={accent} weight='bold' style={{ flexShrink: 1 }}>
                                {`${t('game.the-ladder.active.question', { number: run.currentIndex + 1 })} / ${RUN_LENGTH}`}
                            </Text>
                        </View>
                        <Button variant='ghost' size={isTablet ? 'md' : 'sm'} style={{ flexShrink: 1 }} onPress={() => setShowLeaveConfirm(true)}>
                            {t('game.the-ladder.active.leave')}
                        </Button>
                    </Stack>
                    <ProgressBar
                        progress={(run.currentIndex + (selected !== null ? 1 : 0)) / RUN_LENGTH}
                        color={accent}
                        glowColor={accent}
                        height={10}
                    />
                </Stack>

                <Animated.View key={run.currentIndex} entering={reduceMotion ? undefined : springEnter()}>
                    <Card variant='elevated' padding='lg' gap='md' style={glow}>
                        <AccentTab color={accent} />
                        <Text variant='heading' weight='bold' align='center'>
                            {question.prompt}
                        </Text>
                    </Card>
                </Animated.View>

                <Stack gap='sm'>
                    {question.options.map((option, index) => {
                        const isHidden = hidden.includes(index);
                        const isSelected = selected === index;
                        // Locked but not yet judged — the suspense beat.
                        const isLocked = isSelected && !revealed;
                        const revealCorrect = revealed && index === question.correctIndex;
                        const revealWrong = revealed && isSelected && index !== question.correctIndex;

                        let borderColor = theme.colors.border;
                        let backgroundColor = surface;
                        if (revealCorrect) {
                            borderColor = success;
                            backgroundColor = hexToRgba(success, 0.12);
                        } else if (revealWrong) {
                            borderColor = error;
                            backgroundColor = hexToRgba(error, 0.12);
                        } else if (isLocked) {
                            borderColor = warning;
                            backgroundColor = hexToRgba(warning, 0.14);
                        }

                        return (
                            <AnswerOption
                                key={`${run.currentIndex}-${index}`}
                                index={index}
                                label={isHidden ? '' : option}
                                letter={String.fromCharCode(65 + index)}
                                accent={accent}
                                borderColor={borderColor}
                                backgroundColor={backgroundColor}
                                isHidden={isHidden}
                                isLocked={isLocked}
                                revealCorrect={revealCorrect}
                                revealWrong={revealWrong}
                                success={success}
                                error={error}
                                disabled={isHidden || selected !== null}
                                onPress={() => handleAnswer(index)}
                            />
                        );
                    })}
                </Stack>

                {audience ? (
                    <AudienceResult
                        percentages={audience}
                        accent={accent}
                        reduceMotion={reduceMotion}
                    />
                ) : null}

                <Stack gap='sm'>
                    <Text variant='overline' color={accent} weight='bold'>
                        {`${t('game.the-ladder.active.lifelinesLeft')}: ${lifelinesLeft}`}
                    </Text>
                    <Stack direction='horizontal' gap='sm' align='stretch'>
                        {LIFELINE_META.map((meta) => (
                            <LifelineChip
                                key={meta.key}
                                icon={meta.icon}
                                label={t(meta.labelKey)}
                                accent={accent}
                                textMuted={textMuted}
                                surfaceVariant={theme.colors.surfaceVariant}
                                border={theme.colors.border}
                                available={canUseLifeline(run, meta.key) && selected === null}
                                onPress={() => handleLifeline(meta.key)}
                            />
                        ))}
                    </Stack>
                </Stack>
            </Stack>
            <LeaveConfirmModal
                visible={showLeaveConfirm}
                gameKey='the-ladder'
                onConfirm={() => {
                    setShowLeaveConfirm(false);
                    onExit();
                }}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </ScrollView>
    );
}

/**
 * One answer option: staggered entrance as the question appears, then a springy
 * "pop" the moment it resolves correct/wrong. Press feedback comes from Card's
 * underlying HapticPressable.
 */
function AnswerOption({
    index,
    label,
    letter,
    accent,
    borderColor,
    backgroundColor,
    isHidden,
    isLocked,
    revealCorrect,
    revealWrong,
    success,
    error,
    disabled,
    onPress,
}: {
    index: number;
    label: string;
    letter: string;
    accent: string;
    borderColor: string;
    backgroundColor: string;
    isHidden: boolean;
    isLocked: boolean;
    revealCorrect: boolean;
    revealWrong: boolean;
    success: string;
    error: string;
    disabled: boolean;
    onPress: () => void;
}) {
    const reduceMotion = useReducedMotion();
    const { springBouncy, spring } = useAnimationPresets();
    const theme = useTheme();
    const { iconSize } = useResponsive();
    const pop = useSharedValue(1);
    // A slow heartbeat throb while the answer is locked but unjudged — the visual
    // half of the suspense beat (haptic heartbeats run in parallel on the screen).
    const pulse = useSharedValue(1);
    const resolved = revealCorrect || revealWrong;
    const badgeState: IndexBadgeState = revealCorrect
        ? 'correct'
        : revealWrong
          ? 'wrong'
          : isHidden
            ? 'muted'
            : 'default';

    useEffect(() => {
        if (resolved && !reduceMotion) {
            pop.value = withSequence(withSpring(1.04, springBouncy as never), withSpring(1, spring as never));
        }
    }, [resolved, reduceMotion, pop, springBouncy, spring]);

    useEffect(() => {
        if (isLocked && !reduceMotion) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.03, { duration: PULSE_HALF_MS }),
                    withTiming(1, { duration: PULSE_HALF_MS }),
                ),
                -1,
                false,
            );
        } else {
            cancelAnimation(pulse);
            pulse.value = withTiming(1, { duration: 150 });
        }
    }, [isLocked, reduceMotion, pulse]);

    const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value * pulse.value }] }));

    return (
        <Animated.View entering={reduceMotion ? undefined : springEnter(index * 70)} style={popStyle}>
            <Card
                variant='outlined'
                padding='md'
                onPress={onPress}
                disabled={disabled}
                style={[styles.answer, { borderColor, opacity: isHidden ? 0.3 : 1, backgroundColor }]}
            >
                <Stack direction='horizontal' gap='md' align='center' justify='between'>
                    <Stack direction='horizontal' gap='md' align='center' flex={1}>
                        <IndexBadge label={letter} accent={accent} state={badgeState} size={theme.typography.lineHeight.xl + theme.spacing.xs} />
                        <Text variant='body' weight='semibold' style={styles.answerText}>
                            {label}
                        </Text>
                    </Stack>
                    {revealCorrect ? <Icon name={Check} size={iconSize(20)} color={success} /> : null}
                    {revealWrong ? <Icon name={X} size={iconSize(20)} color={error} /> : null}
                </Stack>
            </Card>
        </Animated.View>
    );
}

/** Game-show style lifeline: an accent-tinted chip with a stacked icon + label. */
function LifelineChip({
    icon,
    label,
    accent,
    textMuted,
    surfaceVariant,
    border,
    available,
    onPress,
}: {
    icon: typeof Scissors;
    label: string;
    accent: string;
    textMuted: string;
    surfaceVariant: string;
    border: string;
    available: boolean;
    onPress: () => void;
}) {
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();
    // Reserve a constant two-line height for the label so every chip's content
    // block is the same height regardless of how the label wraps — this keeps
    // the stacked icons aligned on a single baseline across all chips. The
    // line-height token already scales for tablet via the theme.
    const labelHeight = theme.typography.lineHeight.sm * 2;
    return (
        <View style={styles.chipCol}>
            <Pressable
                haptic='light'
                disabled={!available}
                onPress={onPress}
                accessibilityLabel={label}
                style={[
                    styles.chip,
                    {
                        // Chip box + padding grow with the device so the larger
                        // tablet text/icon don't get cramped against the edges.
                        height: scale(84),
                        paddingHorizontal: scale(8),
                        borderRadius: scale(16),
                        borderColor: available ? accent : border,
                        backgroundColor: available ? hexToRgba(accent, 0.12) : surfaceVariant,
                        opacity: available ? 1 : 0.5,
                    },
                ]}
            >
                <Stack gap='xs' align='center'>
                    <Icon name={icon} size={iconSize(22)} color={available ? accent : textMuted} />
                    <View style={{ height: labelHeight, justifyContent: 'center' }}>
                        <Text
                            variant='caption'
                            weight='semibold'
                            align='center'
                            color={available ? accent : textMuted}
                            numberOfLines={2}
                        >
                            {label}
                        </Text>
                    </View>
                </Stack>
            </Pressable>
        </View>
    );
}

/**
 * "Ask the Studio" result: an audience poll with one animated bar per surviving
 * option. The crowd's leading pick is highlighted — it is usually, but not
 * always, the correct answer (see `audienceVote`).
 */
function AudienceResult({
    percentages,
    accent,
    reduceMotion,
}: {
    percentages: number[];
    accent: string;
    reduceMotion: boolean;
}) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { iconSize, scale } = useResponsive();
    const leading = percentages.indexOf(Math.max(...percentages));
    // Hidden options carry 0%; show only the options the crowd actually voted on.
    const rows = percentages.map((value, index) => ({ value, index })).filter((r) => r.value > 0);

    const badgeSize = theme.typography.lineHeight.md + theme.spacing.xs * 1.5; // ~28 on mobile

    return (
        <Animated.View entering={reduceMotion ? undefined : springEnter()}>
            <Card variant='flat' padding='md' gap='md'>
                <Stack direction='horizontal' gap='sm' align='center'>
                    <View style={[styles.audienceHeaderIcon, { width: scale(28) }]}>
                        <Icon name={Users} size={iconSize(18)} color={accent} />
                    </View>
                    <Text variant='overline' weight='bold' color={accent}>
                        {t('game.the-ladder.audience.title')}
                    </Text>
                </Stack>
                <Stack gap='sm'>
                    {rows.map((row, order) => (
                        <Stack key={row.index} direction='horizontal' gap='sm' align='center'>
                            <View style={[styles.audienceBadge, { backgroundColor: accent, borderRadius: theme.radii.md, width: badgeSize, height: badgeSize }]}>
                                <Text variant='body' weight='bold' color={readableOn(accent)} align='center' style={{ lineHeight: badgeSize }}>
                                    {String.fromCharCode(65 + row.index)}
                                </Text>
                            </View>
                            <View style={styles.audienceBarSlot}>
                                <AudienceBar
                                    value={row.value}
                                    color={accent}
                                    track={theme.colors.surfaceVariant}
                                    leading={row.index === leading}
                                    delay={120 + order * 110}
                                    reduceMotion={reduceMotion}
                                />
                            </View>
                            <Text
                                variant='caption'
                                weight={row.index === leading ? 'bold' : 'semibold'}
                                color={row.index === leading ? accent : 'textSecondary'}
                                style={[styles.audiencePct, { width: scale(42) }]}
                            >
                                {`${row.value}%`}
                            </Text>
                        </Stack>
                    ))}
                </Stack>
            </Card>
        </Animated.View>
    );
}

/** One audience bar that fills from 0 to its vote share on mount. */
function AudienceBar({
    value,
    color,
    track,
    leading,
    delay,
    reduceMotion,
}: {
    value: number;
    color: string;
    track: string;
    leading: boolean;
    delay: number;
    reduceMotion: boolean;
}) {
    const { scale } = useResponsive();
    const width = useSharedValue(reduceMotion ? value : 0);

    useEffect(() => {
        width.value = reduceMotion ? value : withDelay(delay, withTiming(value, { duration: 650 }));
    }, [value, delay, reduceMotion, width]);

    const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

    return (
        <View style={[styles.audienceTrack, { backgroundColor: track, height: scale(12), borderRadius: scale(6) }]}>
            <Animated.View
                style={[styles.audienceFill, fillStyle, { backgroundColor: color, opacity: leading ? 1 : 0.5, borderRadius: scale(6) }]}
            />
        </View>
    );
}

function GameOverView({
    won,
    rung,
    progress,
    breakdown,
    runResult,
    onPlayAgain,
    onExit,
}: {
    won: boolean;
    rung: number;
    progress: number;
    breakdown: ScoreBreakdown;
    runResult: GameRunResult;
    onPlayAgain: () => void;
    onExit: () => void;
}) {
    const { t, locale } = useTranslation();
    const theme = useTheme();

    return (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.center, { padding: theme.spacing.xl }]} keyboardShouldPersistTaps='handled'>
            <GameOverCard gameId={GAME_ID}>
                {({ accent, onAccent }) => (
                    <>
                        {/* The Ladder classifies its own outcome: banked (won) cheers, busted draws a dismay (plan §3). */}
                        <GameOverHeader pose={won ? 'cheer' : 'dismay'}>
                            <Stack gap='xs' align='center'>
                                <Text variant='heading' weight='bold' align='center'>
                                    {won ? t('game.the-ladder.score.youWon') : t('game.the-ladder.score.gameOver')}
                                </Text>
                                <Text variant='body' color='textSecondary' align='center'>
                                    {t('game.the-ladder.score.reached', { number: rung })}
                                </Text>
                            </Stack>
                            <Stack gap='xs' align='center'>
                                <Text variant='overline' weight='semibold' color='textMuted'>
                                    {t('leaderboard.totalPoints')}
                                </Text>
                                <Text variant='display' weight='bold' align='center' color={accent}>
                                    {breakdown.total.toLocaleString(locale)}
                                </Text>
                            </Stack>
                        </GameOverHeader>
                        <ScoreBreakdownLine breakdown={breakdown} />
                        <RunCelebration result={runResult} accent={accent} />
                        <Leaderboard gameId={GAME_ID} pendingScore={breakdown.total} pendingProgress={progress} />
                        <Stack gap='sm' align='stretch'>
                            <Button
                                variant='primary'
                                fullWidth
                                onPress={onPlayAgain}
                                style={{ backgroundColor: accent, borderColor: accent }}
                                textColor={onAccent}
                            >
                                {t('game.the-ladder.score.playAgain')}
                            </Button>
                            <Button variant='ghost' fullWidth onPress={onExit}>
                                {t('game.the-ladder.score.endGame')}
                            </Button>
                        </Stack>
                    </>
                )}
            </GameOverCard>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    scroll: {
        // padding moved to themed inline style
    },
    answer: {
        borderWidth: 2,
    },
    answerText: {
        flexShrink: 1,
    },
    counterPill: {
        flexShrink: 1,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    audienceHeaderIcon: {
        alignItems: 'center',
    },
    audienceBadge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    audienceBarSlot: {
        flex: 1,
    },
    audienceTrack: {
        width: '100%',
        overflow: 'hidden',
    },
    audienceFill: {
        height: '100%',
        borderRadius: 6,
    },
    audiencePct: {
        textAlign: 'right',
    },
    chipCol: {
        flex: 1,
    },
    chip: {
        width: '100%',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
