import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Swords, Trophy, Hourglass, ChevronRight, Share2, type LucideIcon } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import { useTheme } from '../theme';
import { hexToRgba, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n';
import { useResponsive } from '../responsive/useResponsive';
import { games } from '../data/games';
import { listChallenges, challengeStatus, type ChallengeStub, type ChallengeStatus } from '../game/challenge/log';
import { shareChallenge } from '../game/challenge/share';

/** Status → icon + i18n label key. Color is the game accent (muted for expired). */
const STATUS_META: Record<ChallengeStatus, { icon: LucideIcon; labelKey: string }> = {
    yourTurn: { icon: Swords, labelKey: 'challenge.history.yourTurn' },
    played: { icon: Trophy, labelKey: 'challenge.history.viewResults' },
    expired: { icon: Hourglass, labelKey: 'challenge.history.expiredStatus' },
};

interface ChallengeRowProps {
    id: string;
    gameId: string;
    role: ChallengeStub['role'];
    opponent: string;
    status: ChallengeStatus;
    onOpen: (id: string) => void;
    onShare: (id: string) => Promise<void>;
}

const ChallengeRow = React.memo(function ChallengeRow({
    id,
    gameId,
    role,
    opponent,
    status,
    onOpen,
    onShare,
}: ChallengeRowProps) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { scale, iconSize } = useResponsive();
    const game = games.find((g) => g.id === gameId);
    const meta = STATUS_META[status];
    const accent = game ? resolveAccent(theme, game.accent) : theme.colors.primary;
    const tint = status === 'expired' ? theme.colors.textMuted : accent;

    const title =
        role === 'received' && opponent ? t('challenge.history.vs', { name: opponent }) : t('challenge.history.yours');
    const handleOpen = useCallback(() => onOpen(id), [id, onOpen]);
    const handleShare = useCallback(() => {
        void onShare(id).catch(() => undefined);
    }, [id, onShare]);
    const hasShareAction = status !== 'expired';

    return (
        <View style={styles.row}>
            <Card
                variant='elevated'
                padding='md'
                onPress={handleOpen}
                haptic='light'
                accessibilityLabel={title}
                style={{
                    borderRadius: theme.radii.lg,
                    borderCurve: 'continuous',
                    borderColor: hexToRgba(tint, 0.4),
                    opacity: status === 'expired' ? 0.7 : 1,
                    paddingRight: hasShareAction ? scale(64) : theme.spacing.md,
                }}
            >
                <View pointerEvents='none'>
                    <Stack direction='horizontal' gap='md' align='center'>
                        <View
                            style={[
                                styles.badge,
                                {
                                    width: scale(44),
                                    height: scale(44),
                                    borderRadius: theme.radii.lg,
                                    borderCurve: 'continuous',
                                    backgroundColor: hexToRgba(tint, 0.16),
                                },
                            ]}
                        >
                            <Icon name={meta.icon} size={iconSize(22)} color={tint} />
                        </View>
                        <Stack gap='xs' flex={1}>
                            <Text variant='body' weight='bold' numberOfLines={1}>
                                {title}
                            </Text>
                            <Text variant='caption' color='textSecondary' numberOfLines={1}>
                                {game ? `${t(`game.${game.id}.name`)} · ` : ''}
                                {t(meta.labelKey)}
                            </Text>
                        </Stack>
                        {hasShareAction ? (
                            <Icon name={ChevronRight} size={iconSize(20)} color={theme.colors.textMuted} />
                        ) : null}
                    </Stack>
                </View>
            </Card>
            {hasShareAction ? (
                <View pointerEvents='box-none' style={[styles.shareAction, { width: scale(64) }]}>
                    <IconButton
                        icon={<Icon name={Share2} size={iconSize(18)} color={tint} />}
                        onPress={handleShare}
                        size='sm'
                        bgColor={hexToRgba(tint, 0.14)}
                        accessibilityLabel={t('challenge.history.share')}
                    />
                </View>
            ) : null}
        </View>
    );
});

function EmptyState() {
    const theme = useTheme();
    const { t } = useTranslation();
    const { scale, iconSize } = useResponsive();
    return (
        <View style={[styles.empty, { gap: theme.spacing.lg, paddingHorizontal: theme.spacing.xl }]}>
            <View
                style={[
                    styles.badge,
                    styles.emptyBadge,
                    {
                        width: scale(64),
                        height: scale(64),
                        borderRadius: theme.radii.xl,
                        backgroundColor: hexToRgba(theme.colors.primary, 0.12),
                    },
                ]}
            >
                <Icon name={Swords} size={iconSize(32)} color={theme.colors.primary} />
            </View>
            <Stack gap='xs' align='center'>
                <Text variant='heading' weight='bold' align='center'>
                    {t('challenge.history.empty')}
                </Text>
                <Text variant='body' color='textSecondary' align='center'>
                    {t('challenge.history.emptyDesc')}
                </Text>
            </Stack>
        </View>
    );
}

/**
 * Challenge History — every challenge this device created or opened (ADR-0003).
 * Sourced from the local index (`game/challenge/log`); tapping a row reopens the
 * full Challenge screen, which resumes an unplayed run or reveals its results.
 */
export function ChallengeHistoryScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const { tabletColumn, iconSize } = useResponsive();
    const [stubs, setStubs] = useState<ChallengeStub[]>(() => listChallenges());

    // Refresh on focus so a just-played challenge reflects its new status.
    useFocusEffect(
        useCallback(() => {
            setStubs(listChallenges());
        }, []),
    );

    const openChallenge = useCallback(
        (id: string) => navigation.navigate('Challenge', { challengeId: id }),
        [navigation],
    );

    const renderChallenge = useCallback(
        ({ item }: ListRenderItemInfo<ChallengeStub>) => (
            <ChallengeRow
                id={item.id}
                gameId={item.game}
                role={item.role}
                opponent={item.opponent}
                status={challengeStatus(item)}
                onOpen={openChallenge}
                onShare={shareChallenge}
            />
        ),
        [openChallenge],
    );

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('common.home')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('challenge.history.title')}
                </Text>
                <IconButton
                    icon={<Trophy size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.navigate('Ranking')}
                    size='md'
                    accessibilityLabel={t('ranking.title')}
                />
            </View>

            <FlatList
                data={stubs}
                keyExtractor={(item) => item.id}
                renderItem={renderChallenge}
                ListEmptyComponent={EmptyState}
                contentContainerStyle={[
                    stubs.length === 0 ? styles.emptyContent : undefined,
                    {
                        paddingHorizontal: theme.spacing.xl,
                        paddingBottom: theme.spacing.xxl,
                        gap: theme.spacing.md,
                    },
                    tabletColumn,
                ]}
                showsVerticalScrollIndicator={false}
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
    title: {
        flex: 1,
        textAlign: 'center',
    },
    row: {
        position: 'relative',
    },
    shareAction: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBadge: {},
    emptyContent: {
        flexGrow: 1,
    },
});
