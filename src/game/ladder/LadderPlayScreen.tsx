import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
    useReducedMotion,
} from 'react-native-reanimated';
import { Scissors, HelpCircle, SkipForward, Check, X } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Leaderboard from '../../components/molecules/Leaderboard';
import GameOverCard from '../../components/molecules/GameOverCard';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import ProgressBar from '../../components/molecules/ProgressBar';
import Icon from '../../components/atoms/Icon';
import IndexBadge, { type IndexBadgeState } from '../../components/atoms/IndexBadge';
import { useTheme, useColor, useAnimationPresets } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useGameAccent } from '../useGameAccent';
import { useTranslation } from '../../i18n/TranslationContext';
import { buildLocalizedRungs, type Language } from './buildRuns';
import { getHistory, markShown } from '../history';
import {
    buildRun,
    applyAnswer,
    canUseLifeline,
    consumeLifeline,
    fiftyFiftyHidden,
    skipQuestion,
    currentQuestion,
    reachedRung,
    RUN_LENGTH,
    type LadderRun,
    type Lifeline,
} from './logic';
import { speedBonus, ladderScore, LADDER_RUNG_POINTS, type ScoreBreakdown } from '../scoring';

const GAME_ID = 'the-ladder';

const LIFELINE_META: { key: Lifeline; icon: typeof Scissors; labelKey: string }[] = [
    { key: 'fiftyFifty', icon: Scissors, labelKey: 'game.the-ladder.lifelines.fiftyFifty' },
    { key: 'askStudio', icon: HelpCircle, labelKey: 'game.the-ladder.lifelines.askStudio' },
    { key: 'skip', icon: SkipForward, labelKey: 'game.the-ladder.lifelines.skip' },
];

export default function LadderPlayScreen({ onExit }: { onExit: () => void }) {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const { accent, glow } = useGameAccent(GAME_ID);
    const { t, locale } = useTranslation();
    const lang = (locale === 'pl' ? 'pl' : 'en') as Language;

    const success = useColor('success');
    const error = useColor('error');
    const textMuted = useColor('textMuted');
    const surface = useColor('surface');

    const [run, setRun] = useState<LadderRun>(() => buildRun(buildLocalizedRungs(lang), getHistory(GAME_ID)));

    // Hidden per-decision stopwatch + run accumulators for the unified points
    // score. The timer resets on every new question (including after a Skip);
    // base + speed accrue only on correct answers, the lifeline bonus at run end.
    const decisionStartedAt = useRef(Date.now());
    const baseTotal = useRef(0);
    const speedTotal = useRef(0);

    // Count a question as shown once per distinct question displayed, and restart
    // the decision timer. Skipping changes the current id, so this refires for the
    // swapped-in question while the skipped one was already counted when first shown.
    useEffect(() => {
        markShown(GAME_ID, currentQuestion(run).id);
        decisionStartedAt.current = Date.now();
    }, [currentQuestion(run).id]);
    // Per-question transient UI state.
    const [hidden, setHidden] = useState<number[]>([]);
    const [studioHint, setStudioHint] = useState<string | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    const question = currentQuestion(run);

    function resetTransient() {
        setHidden([]);
        setStudioHint(null);
        setSelected(null);
    }

    function startFreshRun() {
        setRun(buildRun(buildLocalizedRungs(lang), getHistory(GAME_ID)));
        baseTotal.current = 0;
        speedTotal.current = 0;
        resetTransient();
    }

    function handleAnswer(index: number) {
        if (run.status !== 'active' || selected !== null) {
            return;
        }
        setSelected(index);
        // Score a correct answer at press time (the reveal delay must not count
        // against the speed timer): base = rung × points, plus its speed bonus.
        if (index === question.correctIndex) {
            const base = (run.currentIndex + 1) * LADDER_RUNG_POINTS;
            const seconds = (Date.now() - decisionStartedAt.current) / 1000;
            baseTotal.current += base;
            speedTotal.current += speedBonus(base, seconds);
        }
        // Brief reveal of correct/incorrect before transitioning.
        const next = applyAnswer(run, index);
        setTimeout(() => {
            setRun(next);
            if (next.status === 'active') {
                resetTransient();
            }
        }, 700);
    }

    function handleLifeline(key: Lifeline) {
        if (!canUseLifeline(run, key) || selected !== null) {
            return;
        }
        if (key === 'fiftyFifty') {
            setHidden(fiftyFiftyHidden(run));
            setRun(consumeLifeline(run, 'fiftyFifty'));
        } else if (key === 'askStudio') {
            setStudioHint(question.hint ?? '');
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
        return (
            <GameOverView
                won={run.status === 'won'}
                rung={reachedRung(run)}
                progress={correctAnswered}
                breakdown={breakdown}
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
            <Stack gap='lg'>
                <Stack gap='sm'>
                    <Stack direction='horizontal' justify='between' align='center'>
                        <View style={[styles.counterPill, { backgroundColor: hexToRgba(accent, 0.16) }]}>
                            <Text variant='overline' color={accent} weight='bold'>
                                {`${t('game.the-ladder.active.question', { number: run.currentIndex + 1 })} / ${RUN_LENGTH}`}
                            </Text>
                        </View>
                        <Button variant='ghost' size='sm' onPress={() => setShowLeaveConfirm(true)}>
                            {t('game.the-ladder.active.leave')}
                        </Button>
                    </Stack>
                    <View style={[styles.progressGlow, { shadowColor: accent }]}>
                        <ProgressBar progress={run.currentIndex / RUN_LENGTH} color={accent} height={10} />
                    </View>
                </Stack>

                <Animated.View key={run.currentIndex} entering={reduceMotion ? undefined : FadeInDown.springify().damping(20).stiffness(150)}>
                    <Card variant='elevated' padding='lg' gap='md' style={glow}>
                        <View style={[styles.accentTab, { backgroundColor: accent }]} />
                        <Text variant='heading' weight='bold' align='center'>
                            {question.prompt}
                        </Text>
                    </Card>
                </Animated.View>

                <Stack gap='sm'>
                    {question.options.map((option, index) => {
                        const isHidden = hidden.includes(index);
                        const isSelected = selected === index;
                        const revealCorrect = selected !== null && index === question.correctIndex;
                        const revealWrong = isSelected && index !== question.correctIndex;

                        let borderColor = theme.colors.border;
                        let backgroundColor = surface;
                        if (revealCorrect) {
                            borderColor = success;
                            backgroundColor = hexToRgba(success, 0.12);
                        } else if (revealWrong) {
                            borderColor = error;
                            backgroundColor = hexToRgba(error, 0.12);
                        }

                        const badgeState: IndexBadgeState = revealCorrect
                            ? 'correct'
                            : revealWrong
                              ? 'wrong'
                              : isHidden
                                ? 'muted'
                                : 'default';

                        return (
                            <AnswerOption
                                key={`${run.currentIndex}-${index}`}
                                index={index}
                                label={isHidden ? '' : option}
                                letter={String.fromCharCode(65 + index)}
                                accent={accent}
                                badgeState={badgeState}
                                borderColor={borderColor}
                                backgroundColor={backgroundColor}
                                isHidden={isHidden}
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

                {studioHint ? (
                    <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(20).stiffness(150)}>
                        <Card variant='flat' padding='md'>
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Icon name={HelpCircle} size={18} color={accent} />
                                <Text variant='caption' color='textSecondary' style={styles.answerText}>
                                    {studioHint}
                                </Text>
                            </Stack>
                        </Card>
                    </Animated.View>
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
                onConfirm={onExit}
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
    badgeState,
    borderColor,
    backgroundColor,
    isHidden,
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
    badgeState: IndexBadgeState;
    borderColor: string;
    backgroundColor: string;
    isHidden: boolean;
    revealCorrect: boolean;
    revealWrong: boolean;
    success: string;
    error: string;
    disabled: boolean;
    onPress: () => void;
}) {
    const reduceMotion = useReducedMotion();
    const { springBouncy, spring } = useAnimationPresets();
    const pop = useSharedValue(1);
    const resolved = revealCorrect || revealWrong;

    useEffect(() => {
        if (resolved && !reduceMotion) {
            pop.value = withSequence(withSpring(1.04, springBouncy as never), withSpring(1, spring as never));
        }
    }, [resolved, reduceMotion, pop, springBouncy, spring]);

    const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

    return (
        <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.delay(index * 70).springify().damping(20).stiffness(150)}
            style={popStyle}
        >
            <Card
                variant='outlined'
                padding='md'
                onPress={onPress}
                disabled={disabled}
                style={[styles.answer, { borderColor, opacity: isHidden ? 0.3 : 1, backgroundColor }]}
            >
                <Stack direction='horizontal' gap='md' align='center' justify='between'>
                    <Stack direction='horizontal' gap='md' align='center' flex={1}>
                        <IndexBadge label={letter} accent={accent} state={badgeState} size={36} />
                        <Text variant='body' weight='semibold' style={styles.answerText}>
                            {label}
                        </Text>
                    </Stack>
                    {revealCorrect ? <Icon name={Check} size={20} color={success} /> : null}
                    {revealWrong ? <Icon name={X} size={20} color={error} /> : null}
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
                        borderColor: available ? accent : border,
                        backgroundColor: available ? hexToRgba(accent, 0.12) : surfaceVariant,
                        opacity: available ? 1 : 0.5,
                    },
                ]}
            >
                <Stack gap='xs' align='center'>
                    <Icon name={icon} size={22} color={available ? accent : textMuted} />
                    <Text
                        variant='caption'
                        weight='semibold'
                        align='center'
                        color={available ? accent : textMuted}
                        numberOfLines={2}
                    >
                        {label}
                    </Text>
                </Stack>
            </Pressable>
        </View>
    );
}

function GameOverView({
    won,
    rung,
    progress,
    breakdown,
    onPlayAgain,
    onExit,
}: {
    won: boolean;
    rung: number;
    progress: number;
    breakdown: ScoreBreakdown;
    onPlayAgain: () => void;
    onExit: () => void;
}) {
    const { t, locale } = useTranslation();

    return (
        <ScrollView style={styles.flex} contentContainerStyle={styles.center} keyboardShouldPersistTaps='handled'>
            <GameOverCard gameId={GAME_ID}>
                {({ accent, onAccent }) => (
                    <>
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
                            <ScoreBreakdownLine breakdown={breakdown} />
                        </Stack>
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
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    progressGlow: {
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    accentTab: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
    },
    chipCol: {
        flex: 1,
    },
    chip: {
        width: '100%',
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 8,
        height: 84,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
});
