import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
    ChevronLeft,
    Check,
    Lock,
    Map,
    Sparkles,
    Trophy,
    Globe,
    Swords,
    Mountain,
    Shield,
    Landmark,
    Eraser,
    Brush,
    Zap,
    RotateCcw,
    type LucideIcon,
} from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/types';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import ProgressBar from '../components/molecules/ProgressBar';
import IconButton from '../components/molecules/IconButton';
import ToggleGroup from '../components/molecules/ToggleGroup';
import SegmentedProgress from '../components/molecules/SegmentedProgress';
import AchievementDetailSheet, { type SelectedAchievement } from '../components/molecules/AchievementDetailSheet';
import { useTheme } from '../theme';
import { hexToRgba } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { useProgression } from '../hooks/useProgression';
import { LEVEL_MAP, ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, ONE_OFF_IDS, familyProgress } from '../game/progression';

type ProgressTab = 'map' | 'achievements';

/** A distinctive sticker per one-off achievement (Sparkles is the locked-grid fallback). */
const ONEOFF_ICONS: Record<string, LucideIcon> = {
    'well-rounded': Globe,
    'triple-threat': Swords,
    'to-the-top': Mountain,
    spotless: Sparkles,
    survivor: Shield,
    'iron-bank': Landmark,
    'vowel-free': Eraser,
    'clean-sweep': Brush,
    'quick-wit': Zap,
    comeback: RotateCcw,
};

type ProgressScreenProps = NativeStackScreenProps<RootStackParamList, 'Progress'>;

/**
 * Wraps the level node a deep-link points at and plays a brief accent halo that
 * pulses a few times then fades, so it's obvious which level unlocks the theme.
 */
function FocusGlow({
    active,
    accent,
    radius,
    onLayout,
    children,
}: {
    active: boolean;
    accent: string;
    radius: number;
    onLayout?: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const glow = useSharedValue(0);

    useEffect(() => {
        if (!active) return;
        // Delay lets the auto-scroll settle before the halo draws attention.
        glow.value = withDelay(
            400,
            withSequence(withRepeat(withTiming(1, { duration: 450 }), 3, true), withTiming(0, { duration: 350 })),
        );
    }, [active, glow]);

    const animatedStyle = useAnimatedStyle(() => ({
        shadowColor: accent,
        shadowOpacity: glow.value * 0.6,
        shadowRadius: glow.value * 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: glow.value * 14,
    }));

    return (
        <Animated.View onLayout={onLayout} style={[{ borderRadius: radius }, animatedStyle]}>
            {children}
        </Animated.View>
    );
}

export function ProgressScreen() {
    const navigation = useNavigation();
    const route = useRoute<ProgressScreenProps['route']>();
    const theme = useTheme();
    const { t, locale } = useTranslation();
    const { level, progress, unlockedRewards, achievements, stats } = useProgression();
    const [tab, setTab] = useState<ProgressTab>('map');
    const [selected, setSelected] = useState<SelectedAchievement>(null);

    const accent = theme.colors.primary;
    const fill = progress.span > 0 ? progress.intoLevel / progress.span : 1;

    // Deep link from Settings: the level that unlocks the tapped earned theme.
    const focusRewardId = route.params?.focusRewardId;
    const focusLevel = focusRewardId
        ? (LEVEL_MAP.find((node) => node.rewardId === focusRewardId)?.level ?? null)
        : null;

    const scrollRef = useRef<ScrollView>(null);
    const didScrollRef = useRef(false);
    const focusTopInset = theme.spacing.xl;

    const handleFocusLayout = useCallback(
        (event: LayoutChangeEvent) => {
            if (didScrollRef.current) return;
            didScrollRef.current = true;
            const y = event.nativeEvent.layout.y;
            requestAnimationFrame(() =>
                scrollRef.current?.scrollTo({ y: Math.max(0, y - focusTopInset), animated: true }),
            );
        },
        [focusTopInset],
    );

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

            {/* Level summary + tabs (fixed above the scrollable section) */}
            <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md, gap: theme.spacing.lg }}>
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

                <ToggleGroup
                    value={tab}
                    onChange={(value) => setTab(value as ProgressTab)}
                    options={[
                        { value: 'map', label: t('progression.mapTitle'), icon: Map },
                        { value: 'achievements', label: t('progression.achievementsTitle'), icon: Trophy },
                    ]}
                />
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{
                    paddingHorizontal: theme.spacing.xl,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xxl,
                    gap: theme.spacing.sm,
                }}
                showsVerticalScrollIndicator={false}
            >
                {tab === 'map' &&
                    LEVEL_MAP.map((node) => {
                        const reached = level >= node.level;
                        const isReward = !!node.rewardId;
                        const rewardName = node.rewardId
                            ? t(`progression.themes.${node.rewardId.replace('theme-', '')}`)
                            : null;
                        const isFocus = node.level === focusLevel;
                        const card = (
                            <Card
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
                                            {t('progression.xp', { n: node.xp.toLocaleString(locale) })}
                                        </Text>
                                        {isReward ? (
                                            <Text variant='caption' color='textMuted'>
                                                {`${t('progression.rewardTheme')}: ${rewardName} ✦`}
                                            </Text>
                                        ) : node.reserved ? (
                                            <Text variant='caption' color='textMuted'>
                                                {t('progression.reserved')}
                                            </Text>
                                        ) : null}
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
                        return isFocus ? (
                            <FocusGlow
                                key={node.level}
                                active
                                accent={accent}
                                radius={theme.radii.lg}
                                onLayout={handleFocusLayout}
                            >
                                {card}
                            </FocusGlow>
                        ) : (
                            <React.Fragment key={node.level}>{card}</React.Fragment>
                        );
                    })}

                {tab === 'achievements' && (
                    <Stack gap='sm'>
                        <Stack direction='horizontal' justify='end' align='center'>
                            <Text variant='caption' color='textMuted'>
                                {t('progression.achievementsCount', { n: achievements.size, m: ACHIEVEMENTS.length })}
                            </Text>
                        </Stack>

                        <Text variant='caption' weight='bold' color='textMuted'>
                            {t('progression.challenges')}
                        </Text>
                        {ACHIEVEMENT_FAMILIES.map((fam) => {
                            const prog = familyProgress(fam, stats);
                            return (
                                <Pressable key={fam.family} onPress={() => setSelected({ kind: 'family', family: fam.family })}>
                                    <Card variant='outlined' padding='md'>
                                        <Stack gap='sm'>
                                            <Stack direction='horizontal' justify='between' align='center'>
                                                <Text variant='body' weight='semibold'>
                                                    {t(`progression.family.${fam.family}`)}
                                                </Text>
                                                <Stack direction='horizontal' gap='xs' align='center'>
                                                    {[0, 1, 2].map((i) => (
                                                        <View
                                                            key={i}
                                                            style={[
                                                                styles.tierPip,
                                                                {
                                                                    borderRadius: theme.radii.full,
                                                                    backgroundColor:
                                                                        prog.earnedTiers > i
                                                                            ? accent
                                                                            : hexToRgba(theme.colors.text, 0.1),
                                                                },
                                                            ]}
                                                        />
                                                    ))}
                                                </Stack>
                                            </Stack>
                                            <ProgressBar progress={prog.fraction} color={accent} />
                                            <Text variant='caption' color='textMuted'>
                                                {prog.nextTarget === null
                                                    ? t('progression.unlocked')
                                                    : t('progression.tierCount', {
                                                          n: prog.current.toLocaleString(locale),
                                                          m: prog.nextTarget.toLocaleString(locale),
                                                      })}
                                            </Text>
                                        </Stack>
                                    </Card>
                                </Pressable>
                            );
                        })}

                        <Text variant='caption' weight='bold' color='textMuted'>
                            {t('progression.feats')}
                        </Text>
                        <View style={styles.grid}>
                            {ONE_OFF_IDS.map((id) => {
                                const done = achievements.has(id);
                                return (
                                    <Pressable
                                        key={id}
                                        style={styles.badge}
                                        onPress={() => setSelected({ kind: 'oneoff', id })}
                                    >
                                        <Card
                                            variant='outlined'
                                            padding='md'
                                            style={[styles.badgeCard, done ? { borderColor: accent } : { opacity: 0.55 }]}
                                        >
                                            <Stack gap='xs' align='center'>
                                                <Icon
                                                    name={done ? (ONEOFF_ICONS[id] ?? Sparkles) : Lock}
                                                    size={22}
                                                    color={done ? accent : theme.colors.textMuted}
                                                />
                                                <Text variant='caption' weight='semibold' align='center' numberOfLines={2}>
                                                    {t(`progression.oneoff.${id}`)}
                                                </Text>
                                            </Stack>
                                        </Card>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </Stack>
                )}
            </ScrollView>

            <AchievementDetailSheet
                selected={selected}
                onClose={() => setSelected(null)}
                stats={stats}
                unlocked={achievements}
            />
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
    },
    badgeCard: {
        minHeight: 92,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tierPip: {
        width: 10,
        height: 10,
    },
});

export default ProgressScreen;
