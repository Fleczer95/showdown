import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Sparkles, ArrowUpCircle, Award } from 'lucide-react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import ProgressBar from './ProgressBar';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n';
import { recordRun, levelProgress, type GameRunResult, type RecordRunDiff } from '../../game/progression';
import { SafeAnalytics } from '../../utils/firebase/init';

/**
 * Inline game-over celebration: records the finished run (exactly once on mount,
 * via the lazy state initializer) and animates the XP gain. Escalated beats
 * (level-up, a new earned theme, a new achievement) appear as extra lines.
 */
function RunCelebration({ result, accent }: { result: GameRunResult; accent: string }) {
    const theme = useTheme();
    const { t, locale } = useTranslation();

    // Lazy initializer → recordRun runs once per finished run, never on re-render.
    const [diff] = useState<RecordRunDiff>(() => recordRun(result));

    // Report a level-up exactly once, when this run crossed a threshold.
    useEffect(() => {
        if (diff.leveledUp) {
            SafeAnalytics.logEvent({
                name: 'level_up',
                params: { from_level: diff.previousLevel, to_level: diff.level, lifetime_xp: diff.lifetimeXp },
            });
        }
    }, [diff]);

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

                {diff.newRewards.length > 0 ? (
                    <Stack direction='horizontal' gap='xs' align='center'>
                        <Icon name={Sparkles} size={16} color={accent} />
                        <Text variant='caption' weight='semibold'>
                            {t('progression.newReward')}
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
