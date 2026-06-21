import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Trophy, Medal, Star, CheckCircle, Lock, Award } from 'lucide-react-native';
import BottomSheet from './BottomSheet';
import ProgressBar from './ProgressBar';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Icon from '../atoms/Icon';
import Spacer from '../atoms/Spacer';
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
const TIER_ICONS = [Star, Medal, Trophy];

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
        <BottomSheet visible={selected !== null} onClose={onClose} title={title} scrollable={true}>
            {family ? (
                (() => {
                    const prog = familyProgress(family, stats);
                    const fmt = (n: number) => n.toLocaleString(locale);
                    return (
                        <Stack gap='md'>
                            <View style={{ marginBottom: scale(8) }}>
                                <Stack direction='horizontal' justify='between' align='end' style={{ marginBottom: scale(12) }}>
                                    <Text variant='subheading' weight='bold' color='text'>
                                        {t('progression.progress')}
                                    </Text>
                                    <Text variant='caption' color='textSecondary' weight='semibold'>
                                        {prog.nextTarget === null
                                            ? t('progression.unlocked')
                                            : t('progression.tierCount', {
                                                  n: fmt(prog.current),
                                                  m: fmt(prog.nextTarget),
                                              })}
                                    </Text>
                                </Stack>
                                <View style={{
                                    backgroundColor: hexToRgba(theme.colors.borderLight, 0.3),
                                    borderRadius: theme.radii.full,
                                    padding: scale(4),
                                }}>
                                    <ProgressBar progress={prog.fraction} color={accent} glowColor={accent} height={scale(12)} />
                                </View>
                            </View>
                            
                            <Stack gap='sm'>
                                {TIER_NAMES.map((tier, i) => {
                                    const earned = prog.earnedTiers > i;
                                    const TierIcon = TIER_ICONS[i];
                                    return (
                                        <View
                                            key={tier}
                                            style={[
                                                styles.tierCard,
                                                {
                                                    backgroundColor: theme.colors.surfaceVariant,
                                                    borderRadius: theme.radii.lg,
                                                    padding: scale(16),
                                                    borderWidth: 1,
                                                    borderColor: earned ? hexToRgba(accent, 0.4) : theme.colors.borderLight,
                                                }
                                            ]}
                                        >
                                            <Stack direction='horizontal' gap='md' align='center'>
                                                <View style={[
                                                    styles.iconBox,
                                                    {
                                                        backgroundColor: earned ? hexToRgba(accent, 0.15) : hexToRgba(theme.colors.text, 0.05),
                                                        borderRadius: theme.radii.md,
                                                        width: scale(44),
                                                        height: scale(44),
                                                    }
                                                ]}>
                                                    <Icon
                                                        name={earned ? TierIcon : Lock}
                                                        size={iconSize(22)}
                                                        color={earned ? accent : theme.colors.textMuted}
                                                    />
                                                </View>
                                                <Stack gap='xs' flex={1}>
                                                    <Text variant='body' weight='semibold' color={earned ? 'text' : 'textSecondary'}>
                                                        {t(`progression.tier.${tier}`)}
                                                    </Text>
                                                    <Text variant='caption' color='textMuted'>
                                                        {t(`progression.requirement.${family.family}`, {
                                                            n: fmt(family.thresholds[i]),
                                                        })}
                                                    </Text>
                                                </Stack>
                                                <Stack align='end' gap='xs'>
                                                    {earned ? (
                                                        <View style={[
                                                            styles.badge,
                                                            { backgroundColor: hexToRgba(accent, 0.15), borderRadius: theme.radii.sm, paddingHorizontal: scale(8), paddingVertical: scale(4) }
                                                        ]}>
                                                            <Text variant='overline' weight='bold' color={accent}>
                                                                {t('progression.unlocked').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <View style={[
                                                            styles.badge,
                                                            { backgroundColor: hexToRgba(theme.colors.text, 0.08), borderRadius: theme.radii.sm, paddingHorizontal: scale(8), paddingVertical: scale(4) }
                                                        ]}>
                                                            <Text variant='overline' weight='bold' color='textMuted'>
                                                                {t('progression.locked').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Spacer size='xs' />
                                                    <Text variant='caption' weight='bold' color={earned ? accent : 'textMuted'}>
                                                        {t('progression.xpGained', { n: fmt(TIER_XP[i]) })}
                                                    </Text>
                                                </Stack>
                                            </Stack>
                                        </View>
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
                        <Stack gap='xl'>
                            <View style={{ alignItems: 'center', marginTop: scale(16), marginBottom: scale(8) }}>
                                <View style={[
                                    styles.iconBox,
                                    {
                                        backgroundColor: earned ? hexToRgba(accent, 0.15) : hexToRgba(theme.colors.text, 0.05),
                                        borderRadius: theme.radii.full,
                                        width: scale(80),
                                        height: scale(80),
                                        marginBottom: scale(20),
                                        borderWidth: 1,
                                        borderColor: earned ? hexToRgba(accent, 0.3) : 'transparent',
                                    }
                                ]}>
                                    <Icon
                                        name={earned ? Award : Lock}
                                        size={iconSize(36)}
                                        color={earned ? accent : theme.colors.textMuted}
                                    />
                                </View>
                                <Text variant='body' color='textSecondary' align='center' style={{ lineHeight: 24, paddingHorizontal: scale(16) }}>
                                    {t(`progression.requirementOneoff.${selected.id}`)}
                                </Text>
                            </View>
                            <View style={[
                                styles.tierCard,
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderRadius: theme.radii.lg,
                                    padding: scale(16),
                                    borderWidth: 1,
                                    borderColor: earned ? hexToRgba(accent, 0.4) : theme.colors.borderLight,
                                }
                            ]}>
                                <Stack direction='horizontal' justify='between' align='center'>
                                    <Stack direction='horizontal' gap='sm' align='center'>
                                        <View style={[
                                            styles.iconBox,
                                            {
                                                backgroundColor: earned ? hexToRgba(accent, 0.15) : hexToRgba(theme.colors.text, 0.05),
                                                borderRadius: theme.radii.md,
                                                width: scale(36),
                                                height: scale(36),
                                            }
                                        ]}>
                                            <Icon
                                                name={earned ? CheckCircle : Lock}
                                                size={iconSize(18)}
                                                color={earned ? accent : theme.colors.textMuted}
                                            />
                                        </View>
                                        <Text variant='body' weight='semibold' color={earned ? 'text' : 'textSecondary'}>
                                            {earned ? t('progression.unlocked') : t('progression.locked')}
                                        </Text>
                                    </Stack>
                                    <View style={[
                                        styles.badge,
                                        { backgroundColor: earned ? hexToRgba(accent, 0.1) : hexToRgba(theme.colors.text, 0.05), borderRadius: theme.radii.sm, paddingHorizontal: scale(10), paddingVertical: scale(6) }
                                    ]}>
                                        <Text variant='body' weight='bold' color={earned ? accent : 'textMuted'}>
                                            {t('progression.xpGained', { n: ACHIEVEMENT_XP_ONE_OFF.toLocaleString(locale) })}
                                        </Text>
                                    </View>
                                </Stack>
                            </View>
                        </Stack>
                    );
                })()
            ) : null}
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    tierCard: {
        overflow: 'hidden',
    },
    iconBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(AchievementDetailSheet);
