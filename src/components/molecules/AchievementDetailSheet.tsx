import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import BottomSheet from './BottomSheet';
import ProgressBar from './ProgressBar';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n';
import { useResponsive } from '../../responsive/useResponsive';
import {
    ACHIEVEMENT_FAMILIES,
    ACHIEVEMENT_XP_ONE_OFF,
    ACHIEVEMENT_XP_TIERS,
    familyProgress,
    type ProgressionStats,
} from '../../game/progression';

/** Which achievement the sheet is describing. `null` keeps the sheet closed. */
export type SelectedAchievement = { kind: 'family'; family: string } | { kind: 'oneoff'; id: string } | null;

const TIER_NAMES = ['bronze', 'silver', 'gold'] as const;
const TIER_XP = [ACHIEVEMENT_XP_TIERS.bronze, ACHIEVEMENT_XP_TIERS.silver, ACHIEVEMENT_XP_TIERS.gold];

/**
 * Bottom sheet describing one achievement. Tiered families show their axis
 * progress and all three tiers (threshold + XP + earned state); one-offs show
 * the requirement, XP and locked/unlocked status. All requirements are visible.
 */
function AchievementDetailSheet({
    selected,
    onClose,
    stats,
    unlocked,
}: {
    selected: SelectedAchievement;
    onClose: () => void;
    stats: ProgressionStats;
    unlocked: Set<string>;
}) {
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { iconSize, scale } = useResponsive();
    const accent = theme.colors.primary;

    const family = selected?.kind === 'family' ? ACHIEVEMENT_FAMILIES.find((f) => f.family === selected.family) : null;

    const title =
        selected?.kind === 'family'
            ? t(`progression.family.${selected.family}`)
            : selected?.kind === 'oneoff'
              ? t(`progression.oneoff.${selected.id}`)
              : '';

    return (
        <BottomSheet visible={selected !== null} onClose={onClose} title={title}>
            {family ? (
                (() => {
                    const prog = familyProgress(family, stats);
                    const fmt = (n: number) => n.toLocaleString(locale);
                    return (
                        <Stack gap='md'>
                            <Stack gap='xs'>
                                <ProgressBar progress={prog.fraction} color={accent} glowColor={accent} />
                                <Text variant='caption' color='textMuted' align='center'>
                                    {prog.nextTarget === null
                                        ? t('progression.unlocked')
                                        : t('progression.tierCount', {
                                              n: fmt(prog.current),
                                              m: fmt(prog.nextTarget),
                                          })}
                                </Text>
                            </Stack>
                            <Stack gap='sm'>
                                {TIER_NAMES.map((tier, i) => {
                                    const earned = prog.earnedTiers > i;
                                    return (
                                        <Stack key={tier} direction='horizontal' gap='md' align='center'>
                                            <Icon
                                                name={earned ? Check : Lock}
                                                size={iconSize(18)}
                                                color={earned ? accent : theme.colors.textMuted}
                                            />
                                            <Stack gap='xs' flex={1}>
                                                <Text variant='body' weight='semibold'>
                                                    {t(`progression.tier.${tier}`)}
                                                </Text>
                                                <Text variant='caption' color='textMuted'>
                                                    {t(`progression.requirement.${family.family}`, {
                                                        n: fmt(family.thresholds[i]),
                                                    })}
                                                </Text>
                                            </Stack>
                                            <Text variant='caption' weight='bold' color={accent}>
                                                {t('progression.xpGained', { n: fmt(TIER_XP[i]) })}
                                            </Text>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                })()
            ) : selected?.kind === 'oneoff' ? (
                (() => {
                    const earned = unlocked.has(selected.id);
                    return (
                        <Stack gap='md'>
                            <Text variant='body' color='textSecondary'>
                                {t(`progression.requirementOneoff.${selected.id}`)}
                            </Text>
                            <Stack direction='horizontal' justify='between' align='center'>
                                <View
                                    style={[
                                        styles.statusPill,
                                        {
                                            borderRadius: theme.radii.full,
                                            backgroundColor: earned
                                                ? hexToRgba(accent, 0.12)
                                                : hexToRgba(theme.colors.text, 0.06),
                                            paddingHorizontal: scale(12),
                                            paddingVertical: scale(6),
                                            gap: scale(6),
                                        },
                                    ]}
                                >
                                    <Icon
                                        name={earned ? Check : Lock}
                                        size={iconSize(14)}
                                        color={earned ? accent : theme.colors.textMuted}
                                    />
                                    <Text variant='caption' weight='semibold' color={earned ? accent : 'textMuted'}>
                                        {earned ? t('progression.unlocked') : t('progression.locked')}
                                    </Text>
                                </View>
                                <Text variant='body' weight='bold' color={accent}>
                                    {t('progression.xpGained', { n: ACHIEVEMENT_XP_ONE_OFF.toLocaleString(locale) })}
                                </Text>
                            </Stack>
                        </Stack>
                    );
                })()
            ) : null}
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default React.memo(AchievementDetailSheet);
