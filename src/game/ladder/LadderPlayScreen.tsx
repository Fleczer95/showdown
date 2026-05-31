import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Scissors, HelpCircle, SkipForward, Trophy, Check, X } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Icon from '../../components/atoms/Icon';
import { useTheme, useColor } from '../../theme';
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
    type LadderRun,
    type LadderQuestion,
    type Lifeline,
} from './logic';

type Language = 'en' | 'pl';

/** Turn the bilingual content pack into a per-rung pool for the chosen locale. */
function buildLocalizedRungs(lang: Language): LadderQuestion[][] {
    return ALL_PACK.rungs.map((rung) =>
        rung.map((q) => ({
            id: q.id,
            prompt: q.question[lang],
            options: q.options.map((o) => o[lang]),
            correctIndex: 0,
            hint: q.hint[lang],
        })),
    );
}

const LIFELINE_META: { key: Lifeline; icon: typeof Scissors; labelKey: string }[] = [
    { key: 'fiftyFifty', icon: Scissors, labelKey: 'game.the-ladder.lifelines.fiftyFifty' },
    { key: 'askStudio', icon: HelpCircle, labelKey: 'game.the-ladder.lifelines.askStudio' },
    { key: 'skip', icon: SkipForward, labelKey: 'game.the-ladder.lifelines.skip' },
];

export default function LadderPlayScreen({ onExit }: { onExit: () => void }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const lang = (locale === 'pl' ? 'pl' : 'en') as Language;

    const primary = useColor('primary');
    const success = useColor('success');
    const error = useColor('error');
    const textMuted = useColor('textMuted');
    const surface = useColor('surface');

    const [run, setRun] = useState<LadderRun>(() =>
        buildRun(buildLocalizedRungs(lang), getHistory('the-ladder')),
    );

    // Count a question as shown once per distinct question displayed. Skipping
    // changes the current id, so this refires for the swapped-in question while
    // the skipped one was already counted when it was first shown.
    useEffect(() => {
        markShown('the-ladder', currentQuestion(run).id);
    }, [currentQuestion(run).id]);
    // Per-question transient UI state.
    const [hidden, setHidden] = useState<number[]>([]);
    const [studioHint, setStudioHint] = useState<string | null>(null);
    const [selected, setSelected] = useState<number | null>(null);

    const question = currentQuestion(run);

    function resetTransient() {
        setHidden([]);
        setStudioHint(null);
        setSelected(null);
    }

    function startFreshRun() {
        setRun(buildRun(buildLocalizedRungs(lang), getHistory('the-ladder')));
        resetTransient();
    }

    function handleAnswer(index: number) {
        if (run.status !== 'active' || selected !== null) {
            return;
        }
        setSelected(index);
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
        return (
            <GameOverView
                won={run.status === 'won'}
                rung={reachedRung(run)}
                onPlayAgain={startFreshRun}
                onExit={onExit}
            />
        );
    }

    const lifelinesLeft = LIFELINE_META.length - run.usedLifelines.length;

    return (
        <ScrollView
            style={{ backgroundColor: theme.colors.background }}
            contentContainerStyle={styles.scroll}
        >
            <Stack gap='lg'>
                <Stack direction='horizontal' justify='between' align='center'>
                    <Text variant='caption' color='textSecondary' weight='semibold'>
                        {t('game.the-ladder.active.question', { number: run.currentIndex + 1 })}
                    </Text>
                    <Button variant='ghost' size='sm' onPress={onExit}>
                        {t('game.the-ladder.active.leave')}
                    </Button>
                </Stack>

                <Card variant='outlined' padding='lg'>
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
                        if (revealCorrect) borderColor = success;
                        else if (revealWrong) borderColor = error;

                        return (
                            <Card
                                key={index}
                                variant='outlined'
                                padding='md'
                                onPress={() => handleAnswer(index)}
                                disabled={isHidden || selected !== null}
                                style={[
                                    styles.answer,
                                    { borderColor, opacity: isHidden ? 0.3 : 1, backgroundColor: surface },
                                ]}
                            >
                                <Stack direction='horizontal' gap='sm' align='center' justify='between'>
                                    <Text variant='body' weight='medium' style={styles.answerText}>
                                        {isHidden ? '' : option}
                                    </Text>
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
                            <Icon name={HelpCircle} size={18} color={primary} />
                            <Text variant='caption' color='textSecondary' style={styles.answerText}>
                                {studioHint}
                            </Text>
                        </Stack>
                    </Card>
                ) : null}

                <Stack gap='sm'>
                    <Text variant='overline' color='textMuted'>
                        {`${t('game.the-ladder.active.lifelinesLeft')}: ${lifelinesLeft}`}
                    </Text>
                    <Stack direction='horizontal' gap='sm' justify='between'>
                        {LIFELINE_META.map((meta) => {
                            const available = canUseLifeline(run, meta.key);
                            return (
                                <View key={meta.key} style={styles.lifeline}>
                                    <Button
                                        variant='secondary'
                                        size='sm'
                                        fullWidth
                                        disabled={!available || selected !== null}
                                        onPress={() => handleLifeline(meta.key)}
                                        icon={
                                            <Icon
                                                name={meta.icon}
                                                size={16}
                                                color={available ? primary : textMuted}
                                            />
                                        }
                                    >
                                        {t(meta.labelKey)}
                                    </Button>
                                </View>
                            );
                        })}
                    </Stack>
                </Stack>
            </Stack>
        </ScrollView>
    );
}

function GameOverView({
    won,
    rung,
    onPlayAgain,
    onExit,
}: {
    won: boolean;
    rung: number;
    onPlayAgain: () => void;
    onExit: () => void;
}) {
    const theme = useTheme();
    const { t } = useTranslation();
    const success = useColor('success');
    const textMuted = useColor('textMuted');

    return (
        <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
            <Stack gap='lg' align='center'>
                <Icon name={Trophy} size={64} color={won ? success : textMuted} />
                <Text variant='heading' weight='bold' align='center'>
                    {won ? t('game.the-ladder.score.youWon') : t('game.the-ladder.score.gameOver')}
                </Text>
                <Text variant='body' color='textSecondary' align='center'>
                    {t('game.the-ladder.score.reached', { number: rung })}
                </Text>
                <Stack gap='sm' align='stretch' style={styles.actions}>
                    <Button variant='primary' fullWidth onPress={onPlayAgain}>
                        {t('game.the-ladder.score.playAgain')}
                    </Button>
                    <Button variant='ghost' fullWidth onPress={onExit}>
                        {t('game.the-ladder.score.endGame')}
                    </Button>
                </Stack>
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        padding: 16,
        paddingBottom: 48,
    },
    answer: {
        borderWidth: 2,
    },
    answerText: {
        flexShrink: 1,
    },
    lifeline: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    actions: {
        width: '100%',
        maxWidth: 320,
    },
});
