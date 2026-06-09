import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Scissors, HelpCircle, SkipForward, Check, X } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Leaderboard from '../../components/molecules/Leaderboard';
import GameOverCard from '../../components/molecules/GameOverCard';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import ProgressBar from '../../components/molecules/ProgressBar';
import Icon from '../../components/atoms/Icon';
import IndexBadge, { type IndexBadgeState } from '../../components/atoms/IndexBadge';
import { useTheme, useColor } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useGameAccent } from '../useGameAccent';
import { useTranslation } from '../../i18n/TranslationContext';
import { ALL_PACK } from './content';
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
    type LadderQuestion,
    type Lifeline,
} from './logic';
import { speedBonus, ladderScore, LADDER_RUNG_POINTS, type ScoreBreakdown } from '../scoring';

type Language = 'en' | 'pl';

const GAME_ID = 'the-ladder';

/** Turn the bilingual content pack into a per-rung pool for the chosen locale. */
function buildLocalizedRungs(lang: Language): LadderQuestion[][] {
    const rawRungs = ALL_PACK.rungs.map((rung) =>
        rung.map((q) => ({
            id: q.id,
            prompt: q.question[lang],
            options: q.options.map((o) => o[lang]),
            correctIndex: 0,
            hint: q.hint[lang],
        })),
    );

    // We group the 15 rungs into 5 broader difficulty pools (3 rungs each).
    // This increases variety at each step (e.g. any question from levels 1-3
    // can appear in any of the first three rungs of a run).
    const pooled: LadderQuestion[][] = [];
    for (let i = 0; i < 5; i++) {
        const startIndex = i * 3;
        const combinedPool = [...rawRungs[startIndex], ...rawRungs[startIndex + 1], ...rawRungs[startIndex + 2]];
        // We push the same large pool for all 3 rungs in the group.
        // buildRun() will then pick distinct least-shown questions for each.
        pooled.push(combinedPool, combinedPool, combinedPool);
    }
    return pooled;
}

const LIFELINE_META: { key: Lifeline; icon: typeof Scissors; labelKey: string }[] = [
    { key: 'fiftyFifty', icon: Scissors, labelKey: 'game.the-ladder.lifelines.fiftyFifty' },
    { key: 'askStudio', icon: HelpCircle, labelKey: 'game.the-ladder.lifelines.askStudio' },
    { key: 'skip', icon: SkipForward, labelKey: 'game.the-ladder.lifelines.skip' },
];

export default function LadderPlayScreen({ onExit }: { onExit: () => void }) {
    const theme = useTheme();
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
                        <Text variant='overline' color={accent} weight='bold'>
                            {t('game.the-ladder.active.question', { number: run.currentIndex + 1 })}
                        </Text>
                        <Button variant='ghost' size='sm' onPress={() => setShowLeaveConfirm(true)}>
                            {t('game.the-ladder.active.leave')}
                        </Button>
                    </Stack>
                    <ProgressBar progress={run.currentIndex / RUN_LENGTH} color={accent} height={6} />
                </Stack>

                <Card variant='elevated' padding='lg' style={glow}>
                    <Text variant='subheading' weight='bold' align='center'>
                        {question.prompt}
                    </Text>
                </Card>

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
                            <Card
                                key={index}
                                variant='outlined'
                                padding='md'
                                onPress={() => handleAnswer(index)}
                                disabled={isHidden || selected !== null}
                                style={[styles.answer, { borderColor, opacity: isHidden ? 0.3 : 1, backgroundColor }]}
                            >
                                <Stack direction='horizontal' gap='md' align='center' justify='between'>
                                    <Stack direction='horizontal' gap='md' align='center' flex={1}>
                                        <IndexBadge
                                            label={String.fromCharCode(65 + index)}
                                            accent={accent}
                                            state={badgeState}
                                            size={36}
                                        />
                                        <Text variant='body' weight='semibold' style={styles.answerText}>
                                            {isHidden ? '' : option}
                                        </Text>
                                    </Stack>
                                    {revealCorrect ? <Icon name={Check} size={20} color={success} /> : null}
                                    {revealWrong ? <Icon name={X} size={20} color={error} /> : null}
                                </Stack>
                            </Card>
                        );
                    })}
                </Stack>

                {studioHint ? (
                    <Card variant='flat' padding='md'>
                        <Stack direction='horizontal' gap='sm' align='center'>
                            <Icon name={HelpCircle} size={18} color={accent} />
                            <Text variant='caption' color='textSecondary' style={styles.answerText}>
                                {studioHint}
                            </Text>
                        </Stack>
                    </Card>
                ) : null}

                <Stack gap='sm'>
                    <Text variant='overline' color={accent} weight='bold'>
                        {`${t('game.the-ladder.active.lifelinesLeft')}: ${lifelinesLeft}`}
                    </Text>
                    {LIFELINE_META.map((meta) => {
                        const available = canUseLifeline(run, meta.key);
                        return (
                            <Button
                                key={meta.key}
                                variant='secondary'
                                size='md'
                                fullWidth
                                disabled={!available || selected !== null}
                                onPress={() => handleLifeline(meta.key)}
                                icon={<Icon name={meta.icon} size={18} color={available ? accent : textMuted} />}
                            >
                                {t(meta.labelKey)}
                            </Button>
                        );
                    })}
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
    center: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
});
