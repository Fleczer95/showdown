import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check, Lock, Sparkles, Star } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import SegmentedProgress from '../components/molecules/SegmentedProgress';
import { useTheme } from '../theme';
import { hexToRgba } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { useProgression } from '../hooks/useProgression';
import { LEVEL_MAP, ACHIEVEMENTS } from '../game/progression';

/** Human label for an achievement id (tiered families compose family + tier). */
function achievementLabel(t: (key: string, o?: any) => string, id: string): string {
    const tierMatch = id.match(/-(bronze|silver|gold)$/);
    if (tierMatch) {
        const family = id.slice(0, id.length - tierMatch[0].length);
        return `${t(`progression.family.${family}`)} · ${t(`progression.tier.${tierMatch[1]}`)}`;
    }
    return t(`progression.oneoff.${id}`);
}

export function ProgressScreen() {
    const navigation = useNavigation();
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { level, progress, unlockedRewards, achievements, stats } = useProgression();

    const accent = theme.colors.primary;
    const fill = progress.span > 0 ? progress.intoLevel / progress.span : 1;

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={24} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('common.back')}
                />
                <Text variant='subheading' weight='bold'>
                    {t('progression.title')}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: theme.spacing.xl,
                    paddingBottom: theme.spacing.xxl,
                    gap: theme.spacing.xl,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Level summary */}
                <Card variant='elevated' padding='lg'>
                    <Stack gap='sm'>
                        <Stack direction='horizontal' justify='between' align='center'>
                            <Text variant='heading' weight='bold' color={accent}>
                                {t('progression.level', { n: level })}
                            </Text>
                            <Text variant='caption' color='textSecondary'>
                                {t('progression.xp', { n: stats.lifetimeXp.toLocaleString(locale) })}
                            </Text>
                        </Stack>
                        <SegmentedProgress progress={fill} color={accent} />
                        <Text variant='caption' color='textMuted'>
                            {progress.nextLevelXp === null
                                ? t('progression.maxLevel')
                                : t('progression.toNextLevel', {
                                      n: (progress.span - progress.intoLevel).toLocaleString(locale),
                                      m: level + 1,
                                  })}
                        </Text>
                    </Stack>
                </Card>

                {/* Level Map */}
                <Stack gap='sm'>
                    <Text variant='overline' weight='semibold' color='textSecondary'>
                        {t('progression.mapTitle')}
                    </Text>
                    {LEVEL_MAP.map((node) => {
                        const reached = level >= node.level;
                        const isReward = !!node.rewardId;
                        const rewardName = node.rewardId
                            ? t(`progression.themes.${node.rewardId.replace('theme-', '')}`)
                            : null;
                        return (
                            <Card
                                key={node.level}
                                variant={node.level === level ? 'elevated' : 'outlined'}
                                padding='md'
                                style={node.level === level ? { borderColor: accent } : undefined}
                            >
                                <Stack direction='horizontal' gap='md' align='center'>
                                    <View
                                        style={[
                                            styles.levelPip,
                                            {
                                                borderRadius: theme.radii.full,
                                                backgroundColor: reached ? accent : hexToRgba(theme.colors.text, 0.08),
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant='body'
                                            weight='bold'
                                            color={reached ? theme.colors.onPrimary : 'textMuted'}
                                        >
                                            {node.level}
                                        </Text>
                                    </View>
                                    <Stack gap='xs' flex={1}>
                                        <Text variant='body' weight='semibold'>
                                            {t('progression.level', { n: node.level })}
                                        </Text>
                                        <Text variant='caption' color='textMuted'>
                                            {isReward
                                                ? `${t('progression.rewardTheme')}: ${rewardName} ✦`
                                                : node.reserved
                                                  ? t('progression.reserved')
                                                  : t('progression.xp', { n: node.xp.toLocaleString(locale) })}
                                        </Text>
                                    </Stack>
                                    {isReward ? (
                                        <Icon
                                            name={reached && unlockedRewards.has(node.rewardId!) ? Sparkles : Lock}
                                            size={18}
                                            color={reached ? accent : theme.colors.textMuted}
                                        />
                                    ) : reached ? (
                                        <Icon name={Check} size={18} color={accent} />
                                    ) : null}
                                </Stack>
                            </Card>
                        );
                    })}
                </Stack>

                {/* Achievements */}
                <Stack gap='sm'>
                    <Stack direction='horizontal' justify='between' align='center'>
                        <Text variant='overline' weight='semibold' color='textSecondary'>
                            {t('progression.achievementsTitle')}
                        </Text>
                        <Text variant='caption' color='textMuted'>
                            {t('progression.achievementsCount', { n: achievements.size, m: ACHIEVEMENTS.length })}
                        </Text>
                    </Stack>
                    <View style={styles.grid}>
                        {ACHIEVEMENTS.map((a) => {
                            const done = achievements.has(a.id);
                            return (
                                <Card
                                    key={a.id}
                                    variant='outlined'
                                    padding='md'
                                    style={[styles.badge, done ? { borderColor: accent } : { opacity: 0.55 }]}
                                >
                                    <Stack gap='xs' align='center'>
                                        <Icon
                                            name={done ? Star : Lock}
                                            size={22}
                                            color={done ? accent : theme.colors.textMuted}
                                        />
                                        <Text variant='caption' weight='semibold' align='center' numberOfLines={2}>
                                            {achievementLabel(t, a.id)}
                                        </Text>
                                    </Stack>
                                </Card>
                            );
                        })}
                    </View>
                </Stack>
            </ScrollView>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerSpacer: {
        width: 44,
    },
    levelPip: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    badge: {
        width: '31%',
        minHeight: 92,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ProgressScreen;
