import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import Animated, {
    ZoomIn,
    FadeIn,
    useSharedValue,
    useAnimatedProps,
    withTiming,
    withDelay,
    useReducedMotion,
} from 'react-native-reanimated';
import { Sparkles, ArrowUpCircle, Award, Trophy, Crown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import Glyph from '../atoms/Glyph';
import XpRiseBar from './XpRiseBar';
import { useConfettiOverlay } from '../../animations/ConfettiOverlay';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n';
import { useResponsive } from '../../responsive/useResponsive';
import { useHaptics } from '../../hooks/useHaptics';
import { useSound } from '../../hooks/useSound';
import {
    recordRun,
    levelProgress,
    PROGRESSION_THEMES,
    SIGNATURES,
    type GameRunResult,
    type RecordRunDiff,
} from '../../game/progression';
import { shouldPromptReview, acceptReview } from '../../services/review/reviewPrompt';
import ReviewPromptModal from './ReviewPromptModal';

const fillOf = (lifetimeXp: number) => {
    const band = levelProgress(lifetimeXp);
    return band.span > 0 ? band.intoLevel / band.span : 1;
};

const THEME_ICONS: Record<string, LucideIcon> = { trophy: Trophy, crown: Crown };

interface RewardReveal {
    id: string;
    titleKey: string;
    labelKey: string;
    emoji?: string;
    iconColor?: string;
    IconComp?: LucideIcon;
}

/** Resolve an earned reward id to its inline-reveal presentation (gifts only). */
function rewardReveal(id: string): RewardReveal | null {
    const sig = SIGNATURES.find((s) => s.id === id);
    if (sig) return { id, titleKey: sig.titleKey, labelKey: 'progression.newSignature', emoji: sig.emoji };
    const th = PROGRESSION_THEMES.find((p) => p.id === id);
    if (th)
        return {
            id,
            titleKey: th.titleKey,
            labelKey: 'progression.newReward',
            iconColor: th.accentColor,
            IconComp: THEME_ICONS[th.iconName] ?? Sparkles,
        };
    return null;
}

/** Localized name for a freshly unlocked achievement id ("Contestant Bronze", "Quick Wit"). */
function achievementName(id: string, t: (key: string) => string): string {
    const tierMatch = id.match(/-(bronze|silver|gold)$/);
    if (tierMatch) {
        const family = id.slice(0, id.length - tierMatch[0].length);
        return `${t(`progression.family.${family}`)} ${t(`progression.tier.${tierMatch[1]}`)}`;
    }
    return t(`progression.oneoff.${id}`);
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Animated +XP that counts up from 0, kept in its own component so the per-frame
 * state updates don't re-render the rest of the celebration. */
function CountUpStat({
    total,
    accent,
    prefix,
    suffix,
    separator,
}: {
    total: number;
    accent: string;
    prefix: string;
    suffix: string;
    separator: string;
}) {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const progress = useSharedValue(0);

    useEffect(() => {
        if (total <= 0) {
            progress.value = 0;
            return;
        }
        if (reduceMotion) {
            progress.value = 1;
            return;
        }
        progress.value = withDelay(150, withTiming(1, { duration: 700 }));
    }, [total, progress, reduceMotion]);

    const animatedProps = useAnimatedProps(() => {
        const val = Math.round(total * progress.value);
        const str = val.toString();
        let formatted = '';
        for (let i = 0; i < str.length; i++) {
            if (i > 0 && (str.length - i) % 3 === 0) {
                formatted += separator;
            }
            formatted += str[i];
        }
        return {
            text: prefix + formatted + suffix,
        } as any;
    });

    const fontSize = theme.typography.sm;
    const lineHeight = theme.typography.lineHeight.sm;
    const fontFamily = theme.typography.fontFamily?.bold;

    return (
        <AnimatedTextInput
            animatedProps={animatedProps}
            defaultValue={prefix + '0' + suffix}
            editable={false}
            style={[
                {
                    fontSize,
                    lineHeight,
                    color: accent,
                    fontWeight: '700',
                    fontFamily,
                    padding: 0,
                    margin: 0,
                    paddingVertical: 0,
                    paddingHorizontal: 0,
                    textAlign: 'center',
                },
            ]}
        />
    );
}

/** Cycles the header stat slot through its slides (XP gained, bonus runs, …),
 * cross-fading every few seconds. With a single slide it just renders it. */
function CelebrationTicker({ slides }: { slides: React.ReactNode[] }) {
    const reduceMotion = useReducedMotion();
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (slides.length <= 1) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 2800);
        return () => clearInterval(id);
    }, [slides.length]);

    const i = index % slides.length;
    return (
        <Animated.View key={i} entering={reduceMotion ? undefined : FadeIn.duration(300)}>
            {slides[i]}
        </Animated.View>
    );
}

/**
 * Presentational celebration for an already-recorded run diff: the XP bar rises
 * and the gain counts up; on a level-up the level number flips, confetti bursts
 * and a success haptic fires; any earned gift (theme or signature) is revealed
 * with a scale-in. Rendered by RunCelebration (offline, records itself) and by
 * the Challenge results board (which records at run end and passes the diff in).
 */
export function CelebrationCard({ diff, accent }: { diff: RecordRunDiff; accent: string }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const haptics = useHaptics();
    const { play } = useSound();
    const { iconSize } = useResponsive();
    const reduceMotion = useReducedMotion();
    const { burstConfetti } = useConfettiOverlay();

    const [displayLevel, setDisplayLevel] = useState<number | null>(null);
    const [reviewVisible, setReviewVisible] = useState(false);
    const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingNativeReview = useRef(false);

    // Seed the level label: show the *previous* level until the bar rolls over.
    useEffect(() => {
        if (!diff) return;
        setDisplayLevel(diff.leveledUp ? diff.previousLevel : diff.level);
    }, [diff]);

    useEffect(
        () => () => {
            if (reviewTimer.current) clearTimeout(reviewTimer.current);
        },
        [],
    );

    // On a level-up run: after the animation settles, surface the rate pre-prompt
    // on every 5th-level milestone until the player accepts (see services/review).
    // The level_up analytics fire in recordRun, at the recording seam.
    useEffect(() => {
        if (!diff?.leveledUp) return;
        if (shouldPromptReview(diff.previousLevel, diff.level)) {
            reviewTimer.current = setTimeout(() => setReviewVisible(true), 3000);
        }
    }, [diff]);

    const handleReviewRate = useCallback(() => {
        pendingNativeReview.current = true;
        setReviewVisible(false);
    }, []);

    const handleReviewDismiss = useCallback(() => {
        pendingNativeReview.current = false;
        setReviewVisible(false);
    }, []);

    const handleReviewDismissComplete = useCallback(() => {
        if (!pendingNativeReview.current) return;
        pendingNativeReview.current = false;
        void acceptReview();
    }, []);

    // The instant the XP bar hits full: flip the level number, burst app-root
    // confetti and fire a success haptic + fanfare. Keeping the visual effect out
    // of a native Modal leaves the platform presenter free for the review prompt.
    const handleRollover = useCallback(() => {
        if (!diff) return;
        setDisplayLevel(diff.level);
        haptics.notification();
        play('levelUp');
        // Reduced motion: flip the level + fire the haptic, but skip the confetti.
        if (reduceMotion) return;
        burstConfetti([accent, theme.colors.secondary, theme.colors.success]);
    }, [diff, haptics, play, reduceMotion, burstConfetti, accent, theme.colors.secondary, theme.colors.success]);

    const prevFill = fillOf(diff.lifetimeXp - diff.xpGained);
    const newFill = fillOf(diff.lifetimeXp);
    // The level label gets the accent + up-arrow treatment once the bar has rolled
    // over to the new level (displayLevel flips in handleRollover).
    const leveledUpNow = diff.leveledUp && displayLevel === diff.level;
    const rewards = diff.newRewards.map(rewardReveal).filter((r): r is RewardReveal => r !== null);

    const thousandSep = (10000).toLocaleString(locale).replace(/[0-9]/g, '')[0] || '';
    const xpTemplate = t('progression.xpGained', { n: '$$$' }).split('$$$');

    // The header stat slot cycles between the XP gained and any bonus runs granted;
    // each slide counts up from 0.
    const statSlides: React.ReactNode[] = [
        <CountUpStat
            key='xp'
            total={diff.xpGained}
            accent={accent}
            prefix={xpTemplate[0] || ''}
            suffix={xpTemplate[1] || ''}
            separator={thousandSep}
        />,
    ];
    if (diff.bonusRunsGranted > 0) {
        const bonusTemplate = t('progression.bonusRuns', { count: diff.bonusRunsGranted, n: '$$$' }).split('$$$');
        statSlides.push(
            <CountUpStat
                key='bonus'
                total={diff.bonusRunsGranted}
                accent={accent}
                prefix={bonusTemplate[0] || ''}
                suffix={bonusTemplate[1] || ''}
                separator={thousandSep}
            />,
        );
    }

    return (
        <View
            style={[
                styles.container,
                {
                    borderRadius: theme.radii.lg,
                    backgroundColor: hexToRgba(accent, 0.1),
                    padding: theme.spacing.md,
                },
            ]}
        >
            <ReviewPromptModal
                visible={reviewVisible}
                onRate={handleReviewRate}
                onDismiss={handleReviewDismiss}
                onDismissComplete={handleReviewDismissComplete}
            />

            <Stack gap='xs'>
                <Stack direction='horizontal' justify='between' align='center'>
                    <Animated.View key={displayLevel} entering={reduceMotion ? undefined : ZoomIn.duration(250)}>
                        {leveledUpNow ? (
                            <Stack direction='horizontal' gap='xs' align='center'>
                                <Icon name={ArrowUpCircle} size={iconSize(16)} color={accent} />
                                <Text variant='caption' weight='bold' color={accent}>
                                    {t('progression.levelUp', { n: diff.level })}
                                </Text>
                            </Stack>
                        ) : (
                            <Text variant='caption' weight='semibold' color='textSecondary'>
                                {t('progression.level', { n: displayLevel ?? diff.level })}
                            </Text>
                        )}
                    </Animated.View>
                    <CelebrationTicker slides={statSlides} />
                </Stack>

                <XpRiseBar
                    prevFill={prevFill}
                    newFill={newFill}
                    leveledUp={diff.leveledUp}
                    color={accent}
                    glowColor={accent}
                    onRollover={handleRollover}
                />

                {rewards.map((r, i) => (
                    <Animated.View
                        key={r.id}
                        entering={reduceMotion ? undefined : ZoomIn.duration(280).delay(900 + i * 120)}
                        style={{
                            borderRadius: theme.radii.md,
                            backgroundColor: hexToRgba(accent, 0.12),
                            marginTop: i === 0 ? theme.spacing.sm : 0,
                            padding: theme.spacing.md,
                        }}
                    >
                        <Stack direction='horizontal' gap='sm' align='center'>
                            <Stack gap='xs' flex={1}>
                                <Text variant='caption' weight='bold' color={accent}>
                                    {t(r.labelKey)}
                                </Text>
                                <Text variant='body' weight='semibold'>
                                    {t(r.titleKey)}
                                </Text>
                            </Stack>
                            {r.emoji ? (
                                <Glyph emoji={r.emoji} size={iconSize(32)} />
                            ) : r.IconComp ? (
                                <Icon name={r.IconComp} size={iconSize(30)} color={r.iconColor ?? accent} />
                            ) : null}
                        </Stack>
                    </Animated.View>
                ))}

                {diff.newAchievements.map((id, i) => (
                    <Animated.View
                        key={id}
                        entering={
                            reduceMotion ? undefined : ZoomIn.duration(280).delay(900 + (rewards.length + i) * 120)
                        }
                        style={{
                            borderRadius: theme.radii.md,
                            backgroundColor: hexToRgba(accent, 0.12),
                            marginTop: rewards.length === 0 && i === 0 ? theme.spacing.sm : 0,
                            padding: theme.spacing.md,
                        }}
                    >
                        <Stack direction='horizontal' gap='sm' align='center'>
                            <Stack gap='xs' flex={1}>
                                <Text variant='caption' weight='bold' color={accent}>
                                    {t('progression.newAchievement')}
                                </Text>
                                <Text variant='body' weight='semibold'>
                                    {achievementName(id, t)}
                                </Text>
                            </Stack>
                            <Icon name={Award} size={iconSize(30)} color={accent} />
                        </Stack>
                    </Animated.View>
                ))}
            </Stack>
        </View>
    );
}

/**
 * Inline game-over celebration for offline runs: records the finished run
 * (exactly once) and renders the celebration card with the resulting diff.
 */
function RunCelebration({ result, accent }: { result: GameRunResult; accent: string }) {
    const [diff, setDiff] = useState<RecordRunDiff | null>(null);
    const recorded = useRef(false);

    // Persist the finished run as a real side effect (not in render) and exactly
    // once — the ref guards against a StrictMode setup/cleanup/setup double-call.
    // useLayoutEffect commits the diff before paint, so the card never flashes empty.
    useLayoutEffect(() => {
        if (recorded.current) return;
        recorded.current = true;
        setDiff(recordRun(result));
    }, [result]);

    if (!diff) return null;
    return <CelebrationCard diff={diff} accent={accent} />;
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
});

export default React.memo(RunCelebration);
