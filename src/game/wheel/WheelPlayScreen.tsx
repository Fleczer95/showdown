import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Input from '../../components/molecules/Input';
import Leaderboard from '../../components/molecules/Leaderboard';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import { getPack } from './content';
import { createDeck } from '../deck';
import { getHistory, markShown } from '../history';
import {
    WHEEL,
    VOWEL_COST,
    TOTAL_PUZZLES,
    type GameState,
    type PuzzleContent,
    createGame,
    currentPuzzle,
    maskedPhrase,
    isVowel,
    isFullyRevealed,
    alreadyGuessed,
    spin,
    type SpinResult,
    guessConsonant,
    buyVowel,
    applyBankrupt,
    solve,
} from './logic';

type Phase = 'awaitSpin' | 'awaitGuess';

const GAME_ID = 'the-wheel';

const EN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PL_ALPHABET = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ'.split('');

/** Pick `count` puzzles from the pack, localized, ordered least-shown-first. */
function pickPuzzles(locale: 'en' | 'pl', count: number): PuzzleContent[] {
    const pool = getPack('all').puzzles.map((p) => ({
        id: p.id,
        phrase: p.phrase[locale],
        category: p.category[locale],
    }));
    return createDeck(pool, getHistory(GAME_ID)).slice(0, count);
}

export default function WheelPlayScreen({ onExit }: { onExit: () => void }) {
    const t = useTheme();
    const { t: tr, locale } = useTranslation();
    const ALPHABET = locale === 'pl' ? PL_ALPHABET : EN_ALPHABET;

    const [game, setGame] = useState<GameState>(() =>
        createGame(pickPuzzles(locale, TOTAL_PUZZLES)),
    );
    const [phase, setPhase] = useState<Phase>('awaitSpin');
    const [spinValue, setSpinValue] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [solveText, setSolveText] = useState('');
    const [solveMode, setSolveMode] = useState(false);
    const [status, setStatus] = useState('');
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Mark each puzzle shown the moment it begins (display-time). Fires once per
    // puzzle actually reached, so quitting early only marks puzzles played.
    const currentId = currentPuzzle(game).id;
    useEffect(() => {
        markShown(GAME_ID, currentId);
    }, [currentId]);

    const rotation = useSharedValue(0);
    const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

    const resetTurnInputs = useCallback(() => {
        setPhase('awaitSpin');
        setSpinValue(0);
        setSolveText('');
        setSolveMode(false);
    }, []);

    const settleSpin = useCallback(
        (result: SpinResult) => {
            setSpinning(false);
            if (result.segment.bankrupt) {
                setGame((g) => applyBankrupt(g));
                setStatus(tr('game.the-wheel.active.bankrupt'));
                setPhase('awaitSpin');
                setSpinValue(0);
            } else {
                setSpinValue(result.segment.value);
                setStatus(`${result.segment.value}`);
                setPhase('awaitGuess');
            }
        },
        [tr],
    );

    const handleSpin = useCallback(() => {
        if (spinning) return;
        setSpinning(true);
        setStatus('');

        // Choose the landing segment first, then rotate so it stops under the
        // top pointer — the visual result and the awarded value always match.
        const result = spin();
        const segmentAngle = 360 / WHEEL.length;
        // Final angle (mod 360) that places `index` at the top pointer.
        const landingMod = ((-segmentAngle * result.index) % 360 + 360) % 360;
        const currentMod = ((rotation.value % 360) + 360) % 360;
        const forward = ((landingMod - currentMod) % 360 + 360) % 360;
        const target = rotation.value + 6 * 360 + forward;

        rotation.value = withTiming(
            target,
            // Quintic ease-out + longer duration: fast launch, then a long,
            // gradual slowdown as it settles on the segment.
            { duration: 4200, easing: Easing.out(Easing.poly(5)) },
            (finished) => {
                if (finished) runOnJS(settleSpin)(result);
            },
        );
    }, [spinning, settleSpin, rotation]);

    const handleGuessConsonant = useCallback(
        (ch: string) => {
            if (alreadyGuessed(game, ch)) return;
            const next = guessConsonant(game, ch, spinValue);
            const award = next.roundCash - game.roundCash;
            setGame(next);
            setSpinValue(0);
            setPhase('awaitSpin');
            setStatus(award > 0 ? `${ch}: +${award}` : `${ch}: 0`);
        },
        [game, spinValue],
    );

    const handleBuyVowel = useCallback(
        (ch: string) => {
            if (alreadyGuessed(game, ch) || game.roundCash < VOWEL_COST) return;
            setGame(buyVowel(game, ch));
        },
        [game],
    );

    const handleSolve = useCallback(() => {
        const correct = solve(game, solveText);
        setStatus(correct.score > game.score ? '✓' : '✗');
        setGame(correct);
        resetTurnInputs();
    }, [game, solveText, resetTurnInputs]);

    const handlePlayAgain = useCallback(() => {
        setGame(createGame(pickPuzzles(locale, TOTAL_PUZZLES)));
        resetTurnInputs();
        setStatus('');
        rotation.value = 0;
    }, [locale, resetTurnInputs, rotation]);

    if (game.status === 'over') {
        return (
            <ScrollView contentContainerStyle={styles.gameOver}>
                <Stack gap='lg' align='center'>
                    <Text variant='display' weight='bold' align='center'>
                        {tr('game.the-wheel.score.gameOver')}
                    </Text>
                    <Card variant='outlined' padding='lg' style={styles.fullWidth}>
                        <Stack gap='xs' align='center'>
                            <Text variant='overline' color='textSecondary'>
                                {tr('game.the-wheel.active.banked')}
                            </Text>
                            <Text variant='display' weight='bold' color='primary'>
                                {game.score}
                            </Text>
                        </Stack>
                    </Card>
                    <Leaderboard gameId='the-wheel' pendingScore={game.score} />
                    <Stack gap='sm' style={styles.fullWidth}>
                        <Button variant='primary' fullWidth onPress={handlePlayAgain}>
                            {tr('game.the-wheel.score.playAgain')}
                        </Button>
                        <Button variant='ghost' fullWidth onPress={onExit}>
                            {tr('game.the-wheel.score.endGame')}
                        </Button>
                    </Stack>
                </Stack>
            </ScrollView>
        );
    }

    const puzzle = currentPuzzle(game);
    const masked = maskedPhrase(game);
    const canSolve = !isFullyRevealed(game);

    return (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
            <Stack gap='md'>
                {/* Header: progress + banked score + round cash */}
                <Stack direction='horizontal' gap='sm' justify='center' wrap>
                    <Card variant='outlined' padding='sm'>
                        <Stack gap='xs' align='center'>
                            <Text variant='caption' weight='semibold' color='textSecondary'>
                                {tr('game.the-wheel.active.puzzleProgress', {
                                    current: game.currentPuzzle + 1,
                                    total: TOTAL_PUZZLES,
                                })}
                            </Text>
                        </Stack>
                    </Card>
                    <Card variant='outlined' padding='sm'>
                        <Stack gap='xs' align='center'>
                            <Text variant='caption' weight='semibold' color='textSecondary'>
                                {tr('game.the-wheel.active.banked')}
                            </Text>
                            <Text variant='subheading' weight='bold'>
                                {game.score}
                            </Text>
                        </Stack>
                    </Card>
                    <Card variant='elevated' padding='sm' style={{ borderColor: t.colors.primary, borderWidth: 2 }}>
                        <Stack gap='xs' align='center'>
                            <Text variant='caption' weight='semibold' color='primary'>
                                {tr('game.the-wheel.active.roundCash')}
                            </Text>
                            <Text variant='subheading' weight='bold' color='primary'>
                                {game.roundCash}
                            </Text>
                        </Stack>
                    </Card>
                </Stack>

                {/* Puzzle */}
                <Card variant='elevated' padding='lg' gap='sm'>
                    <Text variant='overline' color='textSecondary' align='center'>
                        {puzzle.category}
                    </Text>
                    <Text variant='heading' weight='bold' align='center' style={styles.phrase}>
                        {masked}
                    </Text>
                </Card>

                {/* Wheel */}
                <Stack gap='sm' align='center'>
                    <View style={[styles.pointer, { borderTopColor: t.colors.primary }]} />
                    <Animated.View style={[styles.wheel, { borderColor: t.colors.primary }, wheelStyle]}>
                        {WHEEL.map((seg, i) => (
                            <View
                                key={i}
                                style={[styles.segment, { transform: [{ rotate: `${(360 / WHEEL.length) * i}deg` }] }]}
                            >
                                <Text
                                    variant='caption'
                                    weight='bold'
                                    color={seg.bankrupt ? 'error' : 'text'}
                                    numberOfLines={1}
                                >
                                    {seg.bankrupt ? '✖' : seg.label}
                                </Text>
                            </View>
                        ))}
                    </Animated.View>
                    {status ? (
                        <Text variant='subheading' weight='bold' color='primary' align='center'>
                            {status}
                        </Text>
                    ) : null}
                </Stack>

                {/* Actions */}
                {phase === 'awaitSpin' && !solveMode ? (
                    <Button variant='primary' size='lg' fullWidth onPress={handleSpin} disabled={spinning}>
                        {spinning ? tr('game.the-wheel.active.spinning') : tr('game.the-wheel.active.spin')}
                    </Button>
                ) : null}

                {phase === 'awaitGuess' && !solveMode ? (
                    <Stack gap='sm'>
                        <Text variant='caption' weight='medium' color='textSecondary' align='center'>
                            {tr('game.the-wheel.active.guessLetter')}{' ('}
                            {tr('game.the-wheel.active.vowelHint', { cost: VOWEL_COST })}{')'}
                        </Text>
                        <View style={styles.keyboard}>
                            {ALPHABET.map((ch) => {
                                const vowel = isVowel(ch);
                                const guessed = alreadyGuessed(game, ch);
                                const disabled = guessed || (vowel && game.roundCash < VOWEL_COST);
                                const accent = vowel ? t.colors.secondary : t.colors.primary;
                                return (
                                    <Pressable
                                        key={ch}
                                        haptic='light'
                                        disabled={disabled}
                                        onPress={() => (vowel ? handleBuyVowel(ch) : handleGuessConsonant(ch))}
                                        accessibilityLabel={ch}
                                        style={[
                                            styles.key,
                                            {
                                                borderColor: guessed ? t.colors.border : accent,
                                                backgroundColor: guessed ? t.colors.surfaceVariant : t.colors.surface,
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant='subheading'
                                            weight='bold'
                                            color={guessed ? t.colors.textMuted : accent}
                                        >
                                            {ch}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </Stack>
                ) : null}

                {solveMode ? (
                    <Stack gap='sm'>
                        <Input
                            value={solveText}
                            onChangeText={setSolveText}
                            placeholder={tr('game.the-wheel.active.solve')}
                            autoCapitalize='characters'
                            autoFocus
                        />
                        <Stack direction='horizontal' gap='sm'>
                            <View style={styles.flex}>
                                <Button variant='primary' fullWidth onPress={handleSolve} disabled={!solveText.trim()}>
                                    {tr('common.ok')}
                                </Button>
                            </View>
                            <View style={styles.flex}>
                                <Button variant='ghost' fullWidth onPress={() => setSolveMode(false)}>
                                    {tr('common.cancel')}
                                </Button>
                            </View>
                        </Stack>
                    </Stack>
                ) : (
                    <Button
                        variant='secondary'
                        fullWidth
                        onPress={() => setSolveMode(true)}
                        disabled={!canSolve || spinning}
                    >
                        {tr('game.the-wheel.active.solve')}
                    </Button>
                )}

                <Button variant='danger' fullWidth onPress={() => setShowLeaveConfirm(true)}>
                    {tr('game.the-wheel.active.leave')}
                </Button>
            </Stack>
            <LeaveConfirmModal
                visible={showLeaveConfirm}
                gameKey='the-wheel'
                onConfirm={onExit}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </ScrollView>
    );
}

const WHEEL_SIZE = 240;

const styles = StyleSheet.create({
    content: {
        padding: 16,
        paddingBottom: 48,
    },
    gameOver: {
        padding: 24,
        flexGrow: 1,
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    flex: {
        flex: 1,
    },
    phrase: {
        letterSpacing: 2,
    },
    keyboard: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    key: {
        width: 44,
        height: 44,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wheel: {
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        borderRadius: WHEEL_SIZE / 2,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segment: {
        // Fill the wheel so each label shares the wheel's center; the per-segment
        // rotate then pivots about that center, fanning labels around the rim.
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingTop: 14,
    },
    pointer: {
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 18,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        zIndex: 2,
    },
});
