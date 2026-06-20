import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated';
import { Sparkles, ArrowUpCircle, Award, Trophy, Crown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import Glyph from '../atoms/Glyph';
import XpRiseBar from './XpRiseBar';
import Confetti from '../../animations/Confetti';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import {
    recordRun,
    levelProgress,
    isApproachingMaxLevel,
    MAX_LEVEL,
    PROGRESSION_THEMES,
    SIGNATURES,
    type GameRunResult,
    type RecordRunDiff,
} from '../../game/progression';
import { SafeAnalytics } from '../../utils/firebase/init';

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

/** Animated +XP that counts up from 0, kept in its own component so the per-frame
 * state updates don't re-render the rest of the celebration. */
function CountUpStat({
    total,
    accent,
    format,
}: {
    total: number;
    accent: string;
    format: (n: number) => string;
}) {
    const [shown, setShown] = useState(0);

    useEffect(() => {
        if (total <= 0) {
            setShown(0);
            return;
        }
        const startAt = Date.now() + 150;
        let raf = 0;
        const tick = () => {
            const p = Math.max(0, Math.min(1, (Date.now() - startAt) / 700));
            setShown(Math.round(total * p));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [total]);

    return (
        <Text variant='caption' weight='bold' color={accent}>
            {format(shown)}
        </Text>
    );
}

/** Cycles the header stat slot through its slides (XP gained, bonus runs, …),
 * cross-fading every few seconds. With a single slide it just renders it. */
function CelebrationTicker({ slides }: { slides: React.ReactNode[] }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (slides.length <= 1) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 2800);
        return () => clearInterval(id);
    }, [slides.length]);

    const i = index % slides.length;
    return (
        <Animated.View key={i} entering={FadeIn.duration(300)}>
            {slides[i]}
        </Animated.View>
    );
}

/**
 * Inline game-over celebration: records the finished run (exactly once) and plays a
 * short sequence — the XP bar rises and the gain counts up; on a level-up the level
 * number flips, confetti bursts and a success haptic fires; any earned gift (theme
 * or signature) is revealed with a scale-in.
 */
function RunCelebration({ result, accent }: { result: GameRunResult; accent: string }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const haptics = useHaptics();

    const [diff, setDiff] = useState<RecordRunDiff | null>(null);
    const [displayLevel, setDisplayLevel] = useState<number | null>(null);
    const [burst, setBurst] = useState(false);
    const recorded = useRef(false);
    const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Persist the finished run as a real side effect (not in render) and exactly
    // once — the ref guards against a StrictMode setup/cleanup/setup double-call.
    // useLayoutEffect commits the diff before paint, so the card never flashes empty.
    useLayoutEffect(() => {
        if (recorded.current) return;
        recorded.current = true;
        setDiff(recordRun(result));
    }, [result]);

    // Seed the level label: show the *previous* level until the bar rolls over.
    useEffect(() => {
        if (!diff) return;
        setDisplayLevel(diff.leveledUp ? diff.previousLevel : diff.level);
    }, [diff]);

    useEffect(
        () => () => {
            if (burstTimer.current) clearTimeout(burstTimer.current);
        },
        [],
    );

    // Report a level-up exactly once, when this run crossed a threshold.
    useEffect(() => {
        if (!diff?.leveledUp) return;
        SafeAnalytics.logEvent({
            name: 'level_up',
            params: { from_level: diff.previousLevel, to_level: diff.level, lifetime_xp: diff.lifetimeXp },
        });
        // Fire once, on the run that first crosses INTO the near-max band. The band
        // is derived from the live level map, so it moves up if more levels ship.
        if (!isApproachingMaxLevel(diff.previousLevel) && isApproachingMaxLevel(diff.level)) {
            SafeAnalytics.logEvent({
                name: 'approaching_max_level',
                params: {
                    level: diff.level,
                    max_level: MAX_LEVEL,
                    levels_remaining: MAX_LEVEL - diff.level,
                    lifetime_xp: diff.lifetimeXp,
                },
            });
        }
    }, [diff]);

    // The instant the XP bar hits full: flip the level number, burst confetti and
    // fire a success haptic. Confetti self-stops; clear the host shortly after.
    const handleRollover = useCallback(() => {
        if (!diff) return;
        setDisplayLevel(diff.level);
        setBurst(true);
        haptics.notification();
        if (burstTimer.current) clearTimeout(burstTimer.current);
        burstTimer.current = setTimeout(() => setBurst(false), 3200);
    }, [diff, haptics]);

    if (!diff) return null;

    const prevFill = fillOf(diff.lifetimeXp - diff.xpGained);
    const newFill = fillOf(diff.lifetimeXp);
    // The level label gets the accent + up-arrow treatment once the bar has rolled
    // over to the new level (displayLevel flips in handleRollover).
    const leveledUpNow = diff.leveledUp && displayLevel === diff.level;
    const rewards = diff.newRewards.map(rewardReveal).filter((r): r is RewardReveal => r !== null);

    // The header stat slot cycles between the XP gained and any bonus runs granted;
    // each slide counts up from 0.
    const statSlides: React.ReactNode[] = [
        <CountUpStat
            key='xp'
            total={diff.xpGained}
            accent={accent}
            format={(n) => t('progression.xpGained', { n: n.toLocaleString(locale) })}
        />,
    ];
    if (diff.bonusRunsGranted > 0) {
        statSlides.push(
            <CountUpStat
                key='bonus'
                total={diff.bonusRunsGranted}
                accent={accent}
                format={(n) => t('progression.bonusRuns', { n: n.toLocaleString(locale) })}
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
            <Modal transparent visible={burst} animationType='none' onRequestClose={() => setBurst(false)}>
                <View pointerEvents='none' style={StyleSheet.absoluteFill}>
                    <Confetti active={burst} colors={[accent, theme.colors.secondary, theme.colors.success]} />
                </View>
            </Modal>

            <Stack gap='xs'>
                <Stack direction='horizontal' justify='between' align='center'>
                    <Animated.View key={displayLevel} entering={ZoomIn.duration(250)}>
                        {leveledUpNow ? (
                            <Stack direction='horizontal' gap='xs' align='center'>
                                <Icon name={ArrowUpCircle} size={16} color={accent} />
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
                        entering={ZoomIn.duration(280).delay(900 + i * 120)}
                        style={[
                            styles.rewardChip,
                            {
                                borderRadius: theme.radii.md,
                                backgroundColor: hexToRgba(accent, 0.12),
                                marginTop: i === 0 ? theme.spacing.sm : 0,
                            },
                        ]}
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
                                <Glyph emoji={r.emoji} size={32} />
                            ) : r.IconComp ? (
                                <Icon name={r.IconComp} size={30} color={r.iconColor ?? accent} />
                            ) : null}
                        </Stack>
                    </Animated.View>
                ))}

                {diff.newAchievements.length > 0 ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={Award} size={16} color={accent} />
                        <Text variant='caption' weight='semibold'>
                            {`${t('progression.newAchievement')} (${diff.newAchievements.length})`}
                        </Text>
                    </Stack>
                ) : null}
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    rewardChip: {
        padding: 12,
    },
});

export default React.memo(RunCelebration);
