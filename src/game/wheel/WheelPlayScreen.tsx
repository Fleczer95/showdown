import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    cancelAnimation,
    Easing,
    runOnJS,
    FadeIn,
    FadeOutUp,
    FadeInDown,
    useReducedMotion,
} from 'react-native-reanimated';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import Icon from '../../components/atoms/Icon';
import { Delete } from 'lucide-react-native';
import Leaderboard from '../../components/molecules/Leaderboard';
import WheelGraphic from './WheelGraphic';
import GameOverCard from '../../components/molecules/GameOverCard';
import ScoreBreakdownLine from '../../components/molecules/ScoreBreakdownLine';
import RunCelebration from '../../components/molecules/RunCelebration';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import ProgressBar from '../../components/molecules/ProgressBar';
import AccentTab from '../../components/atoms/AccentTab';
import type { GameRunResult } from '../progression';
import { springEnter } from '../transitions';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useGameAccent } from '../useGameAccent';
import { useTranslation } from '../../i18n/TranslationContext';
import { getPack } from './content';
import { createDeck } from '../deck';
import { getHistory, markShown } from '../history';
import { useStore } from '../../hooks/store/useStore';
import { getOwnedPackContent } from '../../data/store/packContent';
import {
    WHEEL,
    VOWEL_COST,
    TOTAL_PUZZLES,
    SPIN_TURNS,
    POWER_TURNS,
    CHARGE_MS,
    type GameState,
    type PuzzleContent,
    createGame,
    currentPuzzle,
    maskedPhrase,
    isVowel,
    isLetter,
    isFullyRevealed,
    alreadyGuessed,
    spinWithPower,
    type SpinResult,
    guessConsonant,
    buyVowel,
    applyBankrupt,
    solve,
    attemptSolve,
} from './logic';
import { speedBonus, wheelScore } from '../scoring';
import { ChallengeHandoff, type ChallengePlay } from '../challenge/ChallengeHandoff';

type Phase = 'awaitSpin' | 'awaitGuess' | 'resolving';

const GAME_ID = 'the-wheel';

// Discrete force levels offered as taps in the reduced-motion fallback (the
// oscillating meter is replaced by these so no continuous animation is needed).
const POWER_LEVELS = [0.1, 0.3, 0.5, 0.7, 0.9];

const EN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PL_ALPHABET = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ'.split('');

/**
 * Pick `count` puzzles from the free pack plus any owned premium pack puzzles,
 * localized, ordered least-shown-first.
 */
function pickPuzzles(locale: 'en' | 'pl', count: number, owned: PuzzleContent[] = []): PuzzleContent[] {
    const pool = [
        ...getPack('all').puzzles.map((p) => ({
            id: p.id,
            phrase: p.phrase[locale],
            category: p.category[locale],
        })),
        ...owned,
    ];
    return createDeck(pool, getHistory(GAME_ID)).slice(0, count);
}

export default function WheelPlayScreen({
    onExit,
    challenge,
}: {
    onExit: () => void;
    challenge?: ChallengePlay<GameState>;
}) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const { accent, onAccent, glow } = useGameAccent(GAME_ID);
    const { t: tr, locale } = useTranslation();
    const ALPHABET = locale === 'pl' ? PL_ALPHABET : EN_ALPHABET;

    // Owned premium pack puzzles, localized, merged into the puzzle pool.
    const { purchasedItemIds } = useStore();
    const ownedPuzzles = useMemo(
        () => getOwnedPackContent<PuzzleContent>(GAME_ID, locale, new Set(purchasedItemIds)),
        [purchasedItemIds, locale],
    );

    const [game, setGame] = useState<GameState>(
        () => challenge?.initial ?? createGame(pickPuzzles(locale, TOTAL_PUZZLES, ownedPuzzles)),
    );
    const [phase, setPhase] = useState<Phase>('awaitSpin');
    const [spinValue, setSpinValue] = useState(0);
    const [spinning, setSpinning] = useState(false);
    // True while the player holds the spin button and the power meter oscillates.
    const [charging, setCharging] = useState(false);
    // Letters the player has tapped into the blank slots, in reading order.
    const [filled, setFilled] = useState<string[]>([]);
    const [solveMode, setSolveMode] = useState(false);
    const [status, setStatus] = useState('');
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    // Set when a puzzle resolves: the state to apply once the player taps Continue.
    // Holds the result on screen so the outcome can be read before advancing.
    const [pendingNext, setPendingNext] = useState<GameState | null>(null);
    // The player's incorrect solve attempt, shown alongside the answer on a miss.
    const [wrongGuess, setWrongGuess] = useState<string | null>(null);

    // Hidden per-puzzle stopwatch + run accumulators for the unified points
    // score. `boughtVowel` tracks the clean-solve (no-vowel) bonus per puzzle.
    const decisionStartedAt = useRef(Date.now());
    const speedTotal = useRef(0);
    const cleanPuzzles = useRef(0);
    const boughtVowel = useRef(false);
    // Puzzles solved correctly — the board's primary ranking key for The Wheel.
    const solvedCount = useRef(0);
    // "Comeback": did the player solve a puzzle after surviving a Bankrupt this run?
    const sawBankruptThisPuzzle = useRef(false);
    const bankruptRecovered = useRef(false);

    // Mark each puzzle shown the moment it begins (display-time), and restart the
    // solve timer + clean-solve tracking. Fires once per puzzle actually reached,
    // so quitting early only marks puzzles played.
    const currentId = currentPuzzle(game).id;
    useEffect(() => {
        // In challenge mode only mark owned puzzles, so embedded premium content
        // the player doesn't own never pollutes their local rotation.
        if (!challenge || challenge.ownedIds.has(currentId)) markShown(GAME_ID, currentId);
        decisionStartedAt.current = Date.now();
        boughtVowel.current = false;
        sawBankruptThisPuzzle.current = false;
    }, [currentId, challenge]);

    const rotation = useSharedValue(0);
    const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
    // Charged power level [0,1]; drives both the meter fill and the landing segment.
    const power = useSharedValue(0);
    const powerBarStyle = useAnimatedStyle(() => ({ width: `${power.value * 100}%` }));

    const resetTurnInputs = useCallback(() => {
        setPhase('awaitSpin');
        setSpinValue(0);
        setFilled([]);
        setSolveMode(false);
    }, []);

    // Bank a solved puzzle (typed correctly or board fully revealed) after the
    // shared reveal beat. `solvedState` must already be a correct/complete board;
    // its phrase is used to drive the win path through `solve`.
    const finishSolvedPuzzle = useCallback((solvedState: GameState) => {
        // Bank cash earns a speed bonus (puzzle shown → solved), plus a
        // clean-solve bonus if no vowel was bought for this puzzle.
        const seconds = (Date.now() - decisionStartedAt.current) / 1000;
        speedTotal.current += speedBonus(solvedState.roundCash, seconds);
        solvedCount.current += 1;
        if (!boughtVowel.current) cleanPuzzles.current += 1;
        if (sawBankruptThisPuzzle.current) bankruptRecovered.current = true;
        const next = solve(solvedState, currentPuzzle(solvedState).phrase);
        setStatus('✓');
        setSolveMode(false);
        setSpinValue(0);
        setPhase('resolving');
        setPendingNext(next);
    }, []);

    const settleSpin = useCallback(
        (result: SpinResult) => {
            setSpinning(false);
            if (result.segment.bankrupt) {
                sawBankruptThisPuzzle.current = true;
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

    // Land the wheel from a charged power level. Power picks the segment; a small
    // jitter (in logic) drifts it ±1-2. The wheel continues from its current
    // position — extra full turns are cosmetic and never change the result.
    const runSpin = useCallback(
        (level: number) => {
            if (spinning) return;
            setCharging(false);
            setSpinning(true);
            setStatus('');

            const result = spinWithPower(level);
            const segmentAngle = 360 / WHEEL.length;
            // Final angle (mod 360) that places `index` at the top pointer.
            const landingMod = (((-segmentAngle * result.index) % 360) + 360) % 360;
            const currentMod = ((rotation.value % 360) + 360) % 360;
            const forward = (((landingMod - currentMod) % 360) + 360) % 360;
            // Stronger charge = more turns AND a longer spin, but the turns scale
            // faster than the time, so a hard spin is still clearly faster (weak =
            // lazy & short, strong = fast & long — like a real wheel). Whole turns
            // are 360deg multiples, so this never changes the landing segment —
            // purely feel. Reduced motion skips the decorative turns entirely.
            const turns = reduceMotion ? 0 : SPIN_TURNS + Math.round(level * POWER_TURNS);
            const duration = reduceMotion ? 700 : 3400 + Math.round(level * 2000);
            const target = rotation.value + turns * 360 + forward;

            // Quadratic ease-out models a coasting wheel under constant friction
            // (constant angular deceleration): it carries speed through the spin then
            // slows smoothly to a stop on the segment, without the floaty creep of a
            // flatter curve. Whole turns are 360deg multiples, so they never change
            // the landed segment — the wheel always rests on exactly `target`.
            rotation.value = withTiming(target, { duration, easing: Easing.out(Easing.quad) }, (finished) => {
                if (finished) runOnJS(settleSpin)(result);
            });
        },
        [spinning, reduceMotion, settleSpin, rotation],
    );

    // Hold to start the power meter oscillating 0->1->0 in a loop.
    const handleChargeStart = useCallback(() => {
        if (spinning) return;
        setCharging(true);
        setStatus('');
        power.value = 0;
        power.value = withRepeat(withTiming(1, { duration: CHARGE_MS, easing: Easing.linear }), -1, true);
    }, [spinning, power]);

    // Release to lock the current power level and spin.
    const handleRelease = useCallback(() => {
        if (!charging) return;
        cancelAnimation(power);
        runSpin(power.value);
    }, [charging, power, runSpin]);

    const handleGuessConsonant = useCallback(
        (ch: string) => {
            if (alreadyGuessed(game, ch)) return;
            const next = guessConsonant(game, ch, spinValue);
            setGame(next);
            // Revealing the final letter completes the puzzle — bank it instead of
            // stranding the player on a full board with the wheel still up.
            if (isFullyRevealed(next)) {
                finishSolvedPuzzle(next);
                return;
            }
            const award = next.roundCash - game.roundCash;
            setSpinValue(0);
            setPhase('awaitSpin');
            setStatus(award > 0 ? `${ch}: +${award}` : `${ch}: 0`);
        },
        [game, spinValue, finishSolvedPuzzle],
    );

    const handleBuyVowel = useCallback(
        (ch: string) => {
            if (alreadyGuessed(game, ch) || game.roundCash < VOWEL_COST) return;
            boughtVowel.current = true;
            const next = buyVowel(game, ch);
            setGame(next);
            // Buying the last hidden letter completes the puzzle.
            if (isFullyRevealed(next)) finishSolvedPuzzle(next);
        },
        [game, finishSolvedPuzzle],
    );

    // Solve view: group the current phrase into words, tagging each character as a
    // fixed (already-revealed) letter, a blank the player must fill (numbered in
    // reading order), or punctuation shown verbatim. Drives the slot preview.
    const solveWords = useMemo(() => {
        const phrase = currentPuzzle(game).phrase;
        const words: { ch: string; kind: 'fixed' | 'blank' | 'punct'; slot?: number }[][] = [[]];
        let slot = 0;
        for (const ch of phrase) {
            if (ch === ' ') {
                words.push([]);
                continue;
            }
            const word = words[words.length - 1];
            if (!isLetter(ch)) {
                word.push({ ch, kind: 'punct' });
            } else if (game.revealed.has(ch.toUpperCase())) {
                word.push({ ch: ch.toUpperCase(), kind: 'fixed' });
            } else {
                word.push({ ch: '', kind: 'blank', slot: slot++ });
            }
        }
        return { words, blankCount: slot };
    }, [game]);

    const solveComplete = filled.length === solveWords.blankCount;

    // Tap a letter into the next empty blank; ignore taps once every blank is full.
    const handleSolveKey = useCallback(
        (ch: string) => {
            setFilled((f) => (f.length >= solveWords.blankCount ? f : [...f, ch.toUpperCase()]));
        },
        [solveWords.blankCount],
    );

    // Clear the most recently entered letter (the "clear char" button).
    const handleSolveClear = useCallback(() => {
        setFilled((f) => f.slice(0, -1));
    }, []);

    const enterSolveMode = useCallback(() => {
        setFilled([]);
        setSolveMode(true);
    }, []);

    const cancelSolveMode = useCallback(() => {
        setFilled([]);
        setSolveMode(false);
    }, []);

    const handleSolve = useCallback(() => {
        // Rebuild the full guess: revealed letters + punctuation verbatim, blanks
        // taken from the player's filled slots in reading order.
        let slot = 0;
        let guess = '';
        for (const ch of currentPuzzle(game).phrase) {
            if (isLetter(ch) && !game.revealed.has(ch.toUpperCase())) {
                guess += filled[slot] ?? '';
                slot++;
            } else {
                guess += ch;
            }
        }
        if (attemptSolve(currentPuzzle(game).phrase, guess)) {
            finishSolvedPuzzle(game);
            return;
        }
        // Reveal the full answer and hold it on screen; the player taps Continue to
        // see the result before the run ends. A wrong solve ends the run.
        const next = solve(game, guess);
        setWrongGuess(guess.trim());
        setStatus('✗');
        setSolveMode(false);
        setPhase('resolving');
        setPendingNext(next);
    }, [game, filled, finishSolvedPuzzle]);

    // Apply the resolved state once the player has read the result.
    const handleContinue = useCallback(() => {
        if (!pendingNext) return;
        setGame(pendingNext);
        setPendingNext(null);
        setWrongGuess(null);
        resetTurnInputs();
        setStatus('');
    }, [pendingNext, resetTurnInputs]);

    const handlePlayAgain = useCallback(() => {
        speedTotal.current = 0;
        cleanPuzzles.current = 0;
        solvedCount.current = 0;
        boughtVowel.current = false;
        sawBankruptThisPuzzle.current = false;
        bankruptRecovered.current = false;
        decisionStartedAt.current = Date.now();
        setGame(createGame(pickPuzzles(locale, TOTAL_PUZZLES, ownedPuzzles)));
        setPendingNext(null);
        setWrongGuess(null);
        resetTurnInputs();
        setStatus('');
        rotation.value = 0;
        power.value = 0;
        setCharging(false);
    }, [locale, ownedPuzzles, resetTurnInputs, rotation, power]);

    if (game.status === 'over' || game.status === 'lost') {
        const breakdown = wheelScore({
            bankedCash: game.score,
            speed: speedTotal.current,
            cleanPuzzles: cleanPuzzles.current,
        });
        // Challenge mode reports the result to the orchestrator instead of the board.
        if (challenge) {
            return (
                <ChallengeHandoff
                    progress={solvedCount.current}
                    score={breakdown.total}
                    onComplete={challenge.onComplete}
                />
            );
        }
        const runResult: GameRunResult = {
            gameId: GAME_ID,
            score: breakdown.total,
            won: game.status === 'over',
            puzzlesSolved: solvedCount.current,
            cleanPuzzles: cleanPuzzles.current,
            bankruptRecovered: bankruptRecovered.current,
        };
        return (
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.gameOver, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
                keyboardShouldPersistTaps='handled'
            >
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
                            <RunCelebration result={runResult} accent={accent} />
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
    // On a successful resolve the board fills in to show the solved answer. On a
    // miss we keep the partial board — the answer + the wrong guess are shown in a
    // dedicated comparison card below. We widen word gaps to make it easier to read.
    const rawMasked = phase === 'resolving' && wrongGuess === null ? puzzle.phrase : maskedPhrase(game);
    const masked = rawMasked.replace(/ /g, '   ');
    const canSolve = !isFullyRevealed(game);

    return (
        <ScrollView
            contentContainerStyle={[
                styles.content,
                {
                    padding: t.spacing.lg,
                    paddingBottom: Math.max(insets.bottom, t.spacing.lg) + t.spacing.xxl,
                },
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
                    <ProgressBar
                        progress={(game.currentPuzzle + 1) / TOTAL_PUZZLES}
                        color={accent}
                        glowColor={accent}
                        height={10}
                    />
                </Stack>

                {/* Puzzle */}
                <Animated.View key={currentId} entering={reduceMotion ? undefined : springEnter()}>
                    <Card variant='elevated' padding='lg' gap='sm' style={glow}>
                        <AccentTab color={accent} />
                        <Text variant='overline' color={accent} weight='bold' align='center'>
                            {puzzle.category}
                        </Text>
                        {solveMode ? (
                            <View style={styles.slotWords}>
                                {solveWords.words.map((word, wi) => (
                                    <View key={wi} style={styles.slotWord}>
                                        {word.map((tok, ci) => {
                                            if (tok.kind === 'punct') {
                                                return (
                                                    <Text
                                                        key={ci}
                                                        variant='heading'
                                                        weight='bold'
                                                        style={styles.slotPunct}
                                                    >
                                                        {tok.ch}
                                                    </Text>
                                                );
                                            }
                                            if (tok.kind === 'fixed') {
                                                return (
                                                    <View key={ci} style={styles.slotBox}>
                                                        <Text variant='heading' weight='bold' color={accent}>
                                                            {tok.ch}
                                                        </Text>
                                                    </View>
                                                );
                                            }
                                            const isNext = tok.slot === filled.length;
                                            const letter = tok.slot! < filled.length ? filled[tok.slot!] : '';
                                            return (
                                                <View
                                                    key={ci}
                                                    style={[
                                                        styles.slotBox,
                                                        styles.slotBlank,
                                                        {
                                                            borderBottomColor: isNext ? accent : t.colors.border,
                                                            backgroundColor: isNext
                                                                ? hexToRgba(accent, 0.12)
                                                                : 'transparent',
                                                        },
                                                    ]}
                                                >
                                                    <Text variant='heading' weight='bold'>
                                                        {letter}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text variant='heading' weight='bold' align='center' style={styles.phrase}>
                                {masked}
                            </Text>
                        )}
                    </Card>
                </Animated.View>

                {/* Failed solve: show the wrong guess next to the answer to compare. */}
                {phase === 'resolving' && wrongGuess !== null ? (
                    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(250)}>
                        <Card variant='outlined' padding='md' gap='sm' style={{ borderColor: t.colors.error }}>
                            <Text variant='subheading' weight='bold' color={t.colors.error} align='center'>
                                {tr('game.the-wheel.active.failed')}
                            </Text>
                            <Stack gap='xs'>
                                <Text variant='overline' color='textSecondary' align='center'>
                                    {tr('game.the-wheel.active.yourGuess')}
                                </Text>
                                <Text variant='subheading' weight='bold' color={t.colors.error} align='center'>
                                    {wrongGuess.toUpperCase()}
                                </Text>
                            </Stack>
                            <Stack gap='xs'>
                                <Text variant='overline' color='textSecondary' align='center'>
                                    {tr('game.the-wheel.active.correctAnswer')}
                                </Text>
                                <Text variant='subheading' weight='bold' color={accent} align='center'>
                                    {puzzle.phrase}
                                </Text>
                            </Stack>
                        </Card>
                    </Animated.View>
                ) : null}

                {/* Wheel — slides up and hides while either keyboard is up (the
                    letter keys or the solve-text input) so the keyboard can rise
                    into the freed space and the input stays visible. Otherwise it
                    absorbs the leftover vertical space and stays centered. */}
                {solveMode || phase === 'awaitGuess' ? null : (
                    <Animated.View
                        entering={reduceMotion ? undefined : FadeIn.duration(250)}
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

                {/* Actions — hold to charge a power meter, release to spin. The
                    charged level steers where it lands (logic adds a ±1-2 jitter).
                    Reduced motion swaps the oscillating meter for discrete taps. */}
                {phase === 'awaitSpin' && !solveMode ? (
                    reduceMotion ? (
                        <Stack gap='sm' align='center'>
                            <Text variant='caption' weight='medium' color='textSecondary' align='center'>
                                {tr('game.the-wheel.active.choosePower')}
                            </Text>
                            <View style={styles.powerChips}>
                                {POWER_LEVELS.map((lvl, i) => (
                                    <Pressable
                                        key={i}
                                        haptic='medium'
                                        disabled={spinning}
                                        onPress={() => runSpin(lvl)}
                                        accessibilityLabel={`${tr('game.the-wheel.active.power')} ${i + 1}`}
                                        style={[
                                            styles.powerChip,
                                            {
                                                height: 20 + i * 12,
                                                borderColor: accent,
                                                backgroundColor: hexToRgba(accent, 0.16),
                                            },
                                        ]}
                                    >
                                        <View />
                                    </Pressable>
                                ))}
                            </View>
                        </Stack>
                    ) : (
                        <Stack gap='sm'>
                            <View style={[styles.powerTrack, { backgroundColor: t.colors.surfaceVariant }]}>
                                <Animated.View
                                    style={[styles.powerFill, powerBarStyle, { backgroundColor: accent }]}
                                />
                            </View>
                            <Pressable
                                haptic='medium'
                                disabled={spinning}
                                onPressIn={handleChargeStart}
                                onPressOut={handleRelease}
                                accessibilityLabel={tr('game.the-wheel.active.spin')}
                                accessibilityHint={tr('game.the-wheel.active.charge')}
                                style={[
                                    styles.spinButton,
                                    {
                                        backgroundColor: spinning ? t.colors.surfaceVariant : accent,
                                        borderColor: spinning ? t.colors.border : accent,
                                    },
                                ]}
                            >
                                <View pointerEvents='none'>
                                    <Text
                                        variant='subheading'
                                        weight='semibold'
                                        color={spinning ? t.colors.textMuted : onAccent}
                                    >
                                        {spinning
                                            ? tr('game.the-wheel.active.spinning')
                                            : charging
                                              ? tr('game.the-wheel.active.release')
                                              : tr('game.the-wheel.active.charge')}
                                    </Text>
                                </View>
                            </Pressable>
                        </Stack>
                    )
                ) : null}

                {phase === 'awaitGuess' && !solveMode ? (
                    <Animated.View
                        entering={reduceMotion ? undefined : FadeInDown.duration(250)}
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
                                        <Animated.View
                                            key={ch}
                                            entering={reduceMotion ? undefined : springEnter(i * 12)}
                                        >
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
                                                {vowel ? (
                                                    <View style={styles.vowelKey}>
                                                        <Text
                                                            variant='body'
                                                            weight='bold'
                                                            color={guessed ? t.colors.textMuted : keyColor}
                                                        >
                                                            {ch}
                                                        </Text>
                                                        <Text
                                                            variant='overline'
                                                            weight='bold'
                                                            color={guessed ? t.colors.textMuted : keyColor}
                                                        >
                                                            {VOWEL_COST}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text
                                                        variant='subheading'
                                                        weight='bold'
                                                        color={guessed ? t.colors.textMuted : keyColor}
                                                    >
                                                        {ch}
                                                    </Text>
                                                )}
                                            </Pressable>
                                        </Animated.View>
                                    );
                                })}
                            </View>
                        </Stack>
                    </Animated.View>
                ) : null}

                {solveMode ? (
                    <Animated.View
                        entering={reduceMotion ? undefined : FadeInDown.duration(250)}
                        exiting={FadeOutUp.duration(200)}
                    >
                        <Stack gap='sm'>
                            <Text variant='caption' weight='medium' color='textSecondary' align='center'>
                                {tr('game.the-wheel.active.fillBlanks')}
                            </Text>
                            <View style={styles.keyboard}>
                                {ALPHABET.map((ch) => (
                                    <Pressable
                                        key={ch}
                                        haptic='light'
                                        disabled={solveComplete}
                                        onPress={() => handleSolveKey(ch)}
                                        accessibilityLabel={ch}
                                        style={[
                                            styles.key,
                                            {
                                                borderColor: solveComplete ? t.colors.border : accent,
                                                backgroundColor: solveComplete
                                                    ? t.colors.surfaceVariant
                                                    : hexToRgba(accent, 0.14),
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant='subheading'
                                            weight='bold'
                                            color={solveComplete ? t.colors.textMuted : accent}
                                        >
                                            {ch}
                                        </Text>
                                    </Pressable>
                                ))}
                                <Pressable
                                    haptic='light'
                                    disabled={filled.length === 0}
                                    onPress={handleSolveClear}
                                    accessibilityLabel={tr('game.the-wheel.active.clear')}
                                    style={[
                                        styles.key,
                                        {
                                            borderColor: filled.length === 0 ? t.colors.border : t.colors.secondary,
                                            backgroundColor:
                                                filled.length === 0
                                                    ? t.colors.surfaceVariant
                                                    : hexToRgba(t.colors.secondary, 0.14),
                                        },
                                    ]}
                                >
                                    <Icon
                                        name={Delete}
                                        size={22}
                                        color={filled.length === 0 ? t.colors.textMuted : t.colors.secondary}
                                    />
                                </Pressable>
                            </View>
                            <Stack direction='horizontal' gap='sm'>
                                <View style={styles.flex}>
                                    <Button
                                        variant='primary'
                                        fullWidth
                                        onPress={handleSolve}
                                        disabled={!solveComplete}
                                        style={
                                            solveComplete ? { backgroundColor: accent, borderColor: accent } : undefined
                                        }
                                        textColor={solveComplete ? onAccent : undefined}
                                    >
                                        {tr('game.the-wheel.active.accept')}
                                    </Button>
                                </View>
                                <View style={styles.flex}>
                                    <Button variant='ghost' fullWidth onPress={cancelSolveMode}>
                                        {tr('common.cancel')}
                                    </Button>
                                </View>
                            </Stack>
                        </Stack>
                    </Animated.View>
                ) : phase === 'resolving' ? (
                    <Button
                        variant='primary'
                        size='lg'
                        fullWidth
                        onPress={handleContinue}
                        style={{ backgroundColor: accent, borderColor: accent }}
                        textColor={onAccent}
                    >
                        {tr('common.continue')}
                    </Button>
                ) : (
                    <Stack direction='horizontal' gap='sm'>
                        <View style={styles.flex}>
                            <Button
                                variant='secondary'
                                fullWidth
                                onPress={enterSolveMode}
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
                onConfirm={() => {
                    setShowLeaveConfirm(false);
                    onExit();
                }}
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
        letterSpacing: 4,
    },
    slotWords: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: 12,
    },
    slotWord: {
        flexDirection: 'row',
        marginHorizontal: 8,
    },
    slotBox: {
        minWidth: 24,
        height: 40,
        marginHorizontal: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotBlank: {
        borderBottomWidth: 2,
        borderRadius: 4,
    },
    slotPunct: {
        alignSelf: 'center',
        marginHorizontal: 1,
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
    vowelKey: {
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
    powerTrack: {
        height: 14,
        borderRadius: 7,
        width: '100%',
        overflow: 'hidden',
    },
    powerFill: {
        height: '100%',
        borderRadius: 7,
    },
    spinButton: {
        height: 56,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    powerChips: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    powerChip: {
        width: 44,
        borderRadius: 8,
        borderWidth: 1.5,
    },
});
