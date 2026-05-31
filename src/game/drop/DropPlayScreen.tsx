import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';

import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Icon from '../../components/atoms/Icon';
import Slider from '../../components/molecules/Slider';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';

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

const formatMoney = (value: number): string => value.toLocaleString('en-US');

export default function DropPlayScreen({ onExit }: { onExit: () => void }) {
    const t = useTheme();
    const { t: translate, locale } = useTranslation();
    const insets = useSafeAreaInsets();
    const lang = locale as Language;

    const [state, setState] = useState<DropState>(() =>
        buildGame(dropQuestions, getHistory(GAME_ID)),
    );
    const [allocation, setAllocation] = useState<number[]>(EMPTY_ALLOCATION);
    // While set, the round is revealed and we await the player advancing.
    const [revealed, setRevealed] = useState(false);

    const reset = useCallback(() => {
        // Re-read history so the next run reflects questions just shown.
        setState(buildGame(dropQuestions, getHistory(GAME_ID)));
        setAllocation(EMPTY_ALLOCATION);
        setRevealed(false);
    }, []);

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
        setRevealed(true);
    }, [canConfirm]);

    const onAdvance = useCallback(() => {
        setState((prev) => applyRound(prev, allocation));
        setAllocation(EMPTY_ALLOCATION);
        setRevealed(false);
    }, [allocation]);

    // --- Game over ---------------------------------------------------------
    if (state.status === 'over') {
        const won = state.bank > 0;
        return (
            <View style={[styles.container, { backgroundColor: t.colors.background, paddingTop: insets.top + 24 }]}>
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

    // --- Active round ------------------------------------------------------
    return (
        <View style={[styles.container, { backgroundColor: t.colors.background, paddingTop: insets.top + 16 }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
                <Stack gap='lg'>
                    {/* Header */}
                    <Stack direction='horizontal' justify='between' align='center'>
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

                    {!revealed && (
                        <Text variant='caption' weight='medium' align='center' color={t.colors.textSecondary}>
                            {translate('game.the-drop.active.instruction', { max: maxCover })}
                        </Text>
                    )}

                    {/* Options */}
                    <Stack gap='md'>
                        {question.options.map((option, i) => {
                            const amount = allocation[i];
                            const isCorrect = i === question.correctIndex;
                            // Once max options are covered, empty slots lock at 0.
                            const lockedByCover = !revealed && amount === 0 && coveredCount >= maxCover;
                            // Every slider shares a fixed scale (the full bank) so adjusting
                            // one doesn't visually shift the others. Over-allocation is still
                            // prevented by setSlot's clamp against the remaining bank.
                            const sliderMax = state.bank;

                            let borderColor = t.colors.border;
                            let accent = t.colors.primary;
                            if (revealed) {
                                if (isCorrect) {
                                    borderColor = t.colors.success;
                                    accent = t.colors.success;
                                } else if (amount > 0) {
                                    borderColor = t.colors.error;
                                    accent = t.colors.error;
                                }
                            }

                            return (
                                <Card
                                    key={`${state.round}-${i}`}
                                    variant='outlined'
                                    padding='md'
                                    style={{ borderColor, opacity: lockedByCover ? 0.5 : 1 }}
                                >
                                    <Stack gap='sm'>
                                        <Stack direction='horizontal' justify='between' align='center'>
                                            <Text variant='body' weight='semibold' style={styles.optionText}>
                                                {option[lang]}
                                            </Text>
                                            {revealed && (
                                                <Icon
                                                    name={isCorrect ? Check : X}
                                                    size={20}
                                                    color={isCorrect ? t.colors.success : t.colors.error}
                                                />
                                            )}
                                        </Stack>

                                        {revealed ? (
                                            <Text variant='caption' weight='bold' color={accent}>
                                                {amount > 0
                                                    ? isCorrect
                                                        ? translate('game.the-drop.reveal.survived', {
                                                              amount: formatMoney(amount),
                                                          })
                                                        : translate('game.the-drop.reveal.dropped', {
                                                              amount: formatMoney(amount),
                                                          })
                                                    : translate('game.the-drop.reveal.empty')}
                                            </Text>
                                        ) : (
                                            <Slider
                                                label={translate('game.the-drop.active.placed')}
                                                value={amount}
                                                min={0}
                                                max={Math.max(BUNDLE, sliderMax)}
                                                step={BUNDLE}
                                                onChange={(v) => !lockedByCover && setSlot(i, v)}
                                                accentColor={accent}
                                                renderValue={() => formatMoney(amount)}
                                            />
                                        )}
                                    </Stack>
                                </Card>
                            );
                        })}
                    </Stack>

                    {/* Actions */}
                    {revealed ? (
                        <Animated.View entering={FadeIn.duration(250)}>
                            <Button variant='primary' onPress={onAdvance} fullWidth>
                                {state.round + 1 >= TOTAL_ROUNDS ||
                                allocation[question.correctIndex] === 0
                                    ? translate('game.the-drop.reveal.seeResult')
                                    : translate('game.the-drop.reveal.next')}
                            </Button>
                        </Animated.View>
                    ) : (
                        <Stack gap='sm'>
                            <Button variant='primary' onPress={onConfirm} disabled={!canConfirm} fullWidth>
                                {translate('game.the-drop.active.lockIn')}
                            </Button>
                            <Button variant='ghost' onPress={onExit}>
                                {translate('game.the-drop.active.leave')}
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
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
});
