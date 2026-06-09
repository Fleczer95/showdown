import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    runOnJS,
    FadeIn,
    FadeOutUp,
    FadeInDown,
} from 'react-native-reanimated';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Input from '../../components/molecules/Input';
import Leaderboard from '../../components/molecules/Leaderboard';
import WheelGraphic from './WheelGraphic';
import GameOverCard from '../../components/molecules/GameOverCard';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import ProgressBar from '../../components/molecules/ProgressBar';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useGameAccent } from '../useGameAccent';
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
    attemptSolve,
} from './logic';
import { speedBonus, wheelScore } from '../scoring';

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
    const { accent, onAccent, glow } = useGameAccent(GAME_ID);
    const { t: tr, locale } = useTranslation();
    const ALPHABET = locale === 'pl' ? PL_ALPHABET : EN_ALPHABET;

    const [game, setGame] = useState<GameState>(() => createGame(pickPuzzles(locale, TOTAL_PUZZLES)));
    const [phase, setPhase] = useState<Phase>('awaitSpin');
    const [spinValue, setSpinValue] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [solveText, setSolveText] = useState('');
    const [solveMode, setSolveMode] = useState(false);
    const [status, setStatus] = useState('');
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    // Hidden per-puzzle stopwatch + run accumulators for the unified points
    // score. `boughtVowel` tracks the clean-solve (no-vowel) bonus per puzzle.
    const decisionStartedAt = useRef(Date.now());
    const speedTotal = useRef(0);
    const cleanPuzzles = useRef(0);
    const boughtVowel = useRef(false);
    // Puzzles solved correctly — the board's primary ranking key for The Wheel.
    const solvedCount = useRef(0);

    // Mark each puzzle shown the moment it begins (display-time), and restart the
    // solve timer + clean-solve tracking. Fires once per puzzle actually reached,
    // so quitting early only marks puzzles played.
    const currentId = currentPuzzle(game).id;
    useEffect(() => {
        markShown(GAME_ID, currentId);
        decisionStartedAt.current = Date.now();
        boughtVowel.current = false;
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
        const landingMod = (((-segmentAngle * result.index) % 360) + 360) % 360;
        const currentMod = ((rotation.value % 360) + 360) % 360;
        const forward = (((landingMod - currentMod) % 360) + 360) % 360;
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
            boughtVowel.current = true;
            setGame(buyVowel(game, ch));
        },
        [game],
    );

    const handleSolve = useCallback(() => {
        const correct = attemptSolve(currentPuzzle(game).phrase, solveText);
        if (correct) {
            // Bank cash earns a speed bonus (puzzle shown → correct solve), plus a
            // clean-solve bonus if no vowel was bought for this puzzle.
            const seconds = (Date.now() - decisionStartedAt.current) / 1000;
            speedTotal.current += speedBonus(game.roundCash, seconds);
            solvedCount.current += 1;
            if (!boughtVowel.current) cleanPuzzles.current += 1;
        }
        setStatus(correct ? '✓' : '✗');
        setGame(solve(game, solveText));
        resetTurnInputs();
    }, [game, solveText, resetTurnInputs]);

    const handlePlayAgain = useCallback(() => {
        speedTotal.current = 0;
        cleanPuzzles.current = 0;
        solvedCount.current = 0;
        boughtVowel.current = false;
        decisionStartedAt.current = Date.now();
        setGame(createGame(pickPuzzles(locale, TOTAL_PUZZLES)));
        resetTurnInputs();
        setStatus('');
        rotation.value = 0;
    }, [locale, resetTurnInputs, rotation]);

    if (game.status === 'over') {
        const breakdown = wheelScore({
            bankedCash: game.score,
            speed: speedTotal.current,
            cleanPuzzles: cleanPuzzles.current,
        });
        return (
            <ScrollView style={styles.flex} contentContainerStyle={styles.gameOver} keyboardShouldPersistTaps='handled'>
                <GameOverCard gameId={GAME_ID}>
                    {({ accent, onAccent }) => (
                        <>
                            <Stack gap='xs' align='center'>
                                <Text variant='display' weight='bold' align='center'>
                                    {tr('game.the-wheel.score.gameOver')}
                                </Text>
                                <Text variant='overline' color='textSecondary'>
                                    {tr('leaderboard.totalPoints')}
                                </Text>
                                <Text variant='display' weight='bold' color={accent}>
                                    {breakdown.total.toLocaleString(locale)}
                                </Text>
                                <ScoreBreakdownLine breakdown={breakdown} />
                            </Stack>
                            <Leaderboard
                                gameId={GAME_ID}
                                pendingScore={breakdown.total}
                                pendingProgress={solvedCount.current}
                            />
                            <Stack gap='sm' align='stretch'>
                                <Button
                                    variant='primary'
                                    fullWidth
                                    onPress={handlePlayAgain}
                                    style={{ backgroundColor: accent, borderColor: accent }}
                                    textColor={onAccent}
                                >
                                    {tr('game.the-wheel.score.playAgain')}
                                </Button>
                                <Button variant='ghost' fullWidth onPress={onExit}>
                                    {tr('game.the-wheel.score.endGame')}
                                </Button>
                            </Stack>
                        </>
                    )}
                </GameOverCard>
            </ScrollView>
        );
    }

    const puzzle = currentPuzzle(game);
    const masked = maskedPhrase(game);
    const canSolve = !isFullyRevealed(game);

    return (
        <ScrollView
            contentContainerStyle={[
                styles.content,
                { padding: t.spacing.lg, paddingBottom: t.spacing.xxl + t.spacing.lg },
            ]}
            keyboardShouldPersistTaps='handled'
        >
            <Stack gap='lg' flex={1}>
                {/* Header: progress + banked score + round cash */}
                <Stack gap='sm'>
                    <Stack direction='horizontal' gap='sm'>
                        <Card variant='outlined' padding='sm' style={styles.headerCard}>
                            <Stack gap='xs' align='center'>
                                <Text variant='caption' weight='semibold' color='textSecondary'>
                                    {tr('game.the-wheel.active.puzzle')}
                                </Text>
                                <Text variant='subheading' weight='bold'>
                                    {game.currentPuzzle + 1}/{TOTAL_PUZZLES}
                                </Text>
                            </Stack>
                        </Card>
                        <Card variant='outlined' padding='sm' style={styles.headerCard}>
                            <Stack gap='xs' align='center'>
                                <Text variant='caption' weight='semibold' color='textSecondary'>
                                    {tr('game.the-wheel.active.banked')}
                                </Text>
                                <Text variant='subheading' weight='bold'>
                                    {game.score}
                                </Text>
                            </Stack>
                        </Card>
                        <Card
                            variant='elevated'
                            padding='sm'
                            style={[styles.headerCard, { borderColor: accent, borderWidth: 2 }]}
                        >
                            <Stack gap='xs' align='center'>
                                <Text variant='caption' weight='semibold' color={accent}>
                                    {tr('game.the-wheel.active.roundCash')}
                                </Text>
                                <Text variant='subheading' weight='bold' color={accent}>
                                    {game.roundCash}
                                </Text>
                            </Stack>
                        </Card>
                    </Stack>
                    <View style={[styles.progressGlow, { shadowColor: accent }]}>
                        <ProgressBar progress={game.currentPuzzle / TOTAL_PUZZLES} color={accent} height={10} />
                    </View>
                </Stack>

                {/* Puzzle */}
                <Animated.View key={currentId} entering={FadeInDown.springify().damping(20).stiffness(150)}>
                    <Card variant='elevated' padding='lg' gap='sm' style={glow}>
                        <View style={[styles.accentTab, { backgroundColor: accent }]} />
                        <Text variant='overline' color={accent} weight='bold' align='center'>
                            {puzzle.category}
                        </Text>
                        <Text variant='heading' weight='bold' align='center' style={styles.phrase}>
                            {masked}
                        </Text>
                    </Card>
                </Animated.View>

                {/* Wheel — slides up and hides while the letter keyboard is up so
                    the keyboard can rise into the freed space. Otherwise it absorbs
                    the leftover vertical space and stays centered. */}
                {phase === 'awaitGuess' && !solveMode ? null : (
                    <Animated.View
                        entering={FadeIn.duration(250)}
                        exiting={FadeOutUp.duration(200)}
                        style={styles.centerRegion}
                    >
                        <Stack gap='sm' align='center'>
                            <View style={[styles.pointer, { borderTopColor: accent }]} />
                            <Animated.View style={[styles.wheel, wheelStyle]}>
                                <WheelGraphic accent={accent} />
                            </Animated.View>
                            <View style={styles.statusSlot}>
                                {status ? (
                                    <Text variant='subheading' weight='bold' color={accent} align='center'>
                                        {status}
                                    </Text>
                                ) : null}
                            </View>
                        </Stack>
                    </Animated.View>
                )}

                {/* Actions */}
                {phase === 'awaitSpin' && !solveMode ? (
                    <Button
                        variant='primary'
                        size='lg'
                        fullWidth
                        onPress={handleSpin}
                        disabled={spinning}
                        style={spinning ? undefined : { backgroundColor: accent, borderColor: accent }}
                        textColor={spinning ? undefined : onAccent}
                    >
                        {spinning ? tr('game.the-wheel.active.spinning') : tr('game.the-wheel.active.spin')}
                    </Button>
                ) : null}

                {phase === 'awaitGuess' && !solveMode ? (
                    <Animated.View
                        entering={FadeInDown.duration(250)}
                        exiting={FadeOutUp.duration(200)}
                        style={styles.centerRegion}
                    >
                        <Stack gap='sm'>
                            <Text variant='caption' weight='medium' color='textSecondary' align='center'>
                                {tr('game.the-wheel.active.guessLetter')}
                                {' ('}
                                {tr('game.the-wheel.active.vowelHint', { cost: VOWEL_COST })}
                                {')'}
                            </Text>
                            <View style={styles.keyboard}>
                                {ALPHABET.map((ch, i) => {
                                    const vowel = isVowel(ch);
                                    const guessed = alreadyGuessed(game, ch);
                                    const disabled = guessed || (vowel && game.roundCash < VOWEL_COST);
                                    const keyColor = vowel ? t.colors.secondary : accent;
                                    return (
                                        <Animated.View key={ch} entering={FadeInDown.delay(i * 12).springify().damping(20).stiffness(150)}>
                                            <Pressable
                                                haptic='light'
                                                disabled={disabled}
                                                onPress={() => (vowel ? handleBuyVowel(ch) : handleGuessConsonant(ch))}
                                                accessibilityLabel={ch}
                                                style={[
                                                    styles.key,
                                                    {
                                                        borderColor: guessed ? t.colors.border : keyColor,
                                                        backgroundColor: guessed
                                                            ? t.colors.surfaceVariant
                                                            : hexToRgba(keyColor, 0.14),
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    variant='subheading'
                                                    weight='bold'
                                                    color={guessed ? t.colors.textMuted : keyColor}
                                                >
                                                    {ch}
                                                </Text>
                                            </Pressable>
                                        </Animated.View>
                                    );
                                })}
                            </View>
                        </Stack>
                    </Animated.View>
                ) : null}

                {solveMode ? (
                    <Stack gap='sm'>
                        <Input
                            value={solveText}
                            onChangeText={setSolveText}
                            placeholder={tr('game.the-wheel.active.solve')}
                            autoCapitalize='characters'
                            autoFocus
                            wrapperStyle={{ paddingHorizontal: 0 }}
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
                    <Stack direction='horizontal' gap='sm'>
                        <View style={styles.flex}>
                            <Button
                                variant='secondary'
                                fullWidth
                                onPress={() => setSolveMode(true)}
                                disabled={!canSolve || spinning}
                            >
                                {tr('game.the-wheel.active.solve')}
                            </Button>
                        </View>
                        <View style={styles.flex}>
                            <Button variant='ghost' fullWidth onPress={() => setShowLeaveConfirm(true)}>
                                {tr('game.the-wheel.active.leave')}
                            </Button>
                        </View>
                    </Stack>
                )}
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
        // padding moved to themed inline style
        flexGrow: 1,
    },
    gameOver: {
        padding: 24,
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    flex: {
        flex: 1,
    },
    headerCard: {
        flex: 1,
    },
    centerRegion: {
        flex: 1,
        justifyContent: 'center',
    },
    statusSlot: {
        minHeight: 32,
        justifyContent: 'center',
    },
    phrase: {
        letterSpacing: 2,
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
        alignItems: 'center',
        justifyContent: 'center',
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
