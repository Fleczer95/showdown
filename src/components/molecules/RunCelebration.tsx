import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Sparkles, ArrowUpCircle, Award } from 'lucide-react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import ProgressBar from './ProgressBar';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n';
import {
    recordRun,
    levelProgress,
    isApproachingMaxLevel,
    MAX_LEVEL,
    type GameRunResult,
    type RecordRunDiff,
} from '../../game/progression';
import { SafeAnalytics } from '../../utils/firebase/init';

/**
 * Inline game-over celebration: records the finished run (exactly once) and shows
 * the XP gain. Escalated beats (level-up, a new earned theme, a new achievement)
 * appear as extra lines.
 */
function RunCelebration({ result, accent }: { result: GameRunResult; accent: string }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();

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

    if (!diff) return null;

    const band = levelProgress(diff.lifetimeXp);
    const fill = band.span > 0 ? band.intoLevel / band.span : 1;

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
            <Stack gap='xs'>
                <Stack direction='horizontal' justify='between' align='center'>
                    <Text variant='caption' weight='semibold' color='textSecondary'>
                        {t('progression.level', { n: diff.level })}
                    </Text>
                    <Text variant='caption' weight='bold' color={accent}>
                        {t('progression.xpGained', { n: diff.xpGained.toLocaleString(locale) })}
                    </Text>
                </Stack>

                <ProgressBar progress={fill} color={accent} glowColor={accent} />

                {diff.leveledUp ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={ArrowUpCircle} size={16} color={accent} />
                        <Text variant='caption' weight='bold' color={accent}>
                            {t('progression.levelUp', { n: diff.level })}
                        </Text>
                    </Stack>
                ) : null}

                {diff.newRewards.some((id) => id.startsWith('theme-')) ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={Sparkles} size={16} color={accent} />
                        <Text variant='caption' weight='semibold'>
                            {t('progression.newReward')}
                        </Text>
                    </Stack>
                ) : null}

                {diff.newRewards.some((id) => id.startsWith('signature-')) ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={Sparkles} size={16} color={accent} />
                        <Text variant='caption' weight='semibold'>
                            {t('progression.newSignature')}
                        </Text>
                    </Stack>
                ) : null}

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
});

export default React.memo(RunCelebration);
