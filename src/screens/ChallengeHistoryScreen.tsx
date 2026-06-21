import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Swords, Trophy, Hourglass, ChevronRight, type LucideIcon } from 'lucide-react-native';
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

/** Status → icon + i18n label key. Color is the game accent (muted for expired). */
const STATUS_META: Record<ChallengeStatus, { icon: LucideIcon; labelKey: string }> = {
    yourTurn: { icon: Swords, labelKey: 'challenge.history.yourTurn' },
    played: { icon: Trophy, labelKey: 'challenge.history.viewResults' },
    expired: { icon: Hourglass, labelKey: 'challenge.history.expiredStatus' },
};

function ChallengeRow({ stub, onPress }: { stub: ChallengeStub; onPress: () => void }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const game = games.find((g) => g.id === stub.game);
    const status = challengeStatus(stub);
    const meta = STATUS_META[status];
    const accent = game ? resolveAccent(theme, game.accent) : theme.colors.primary;
    const tint = status === 'expired' ? theme.colors.textMuted : accent;

    const title =
        stub.role === 'received' && stub.opponent
            ? t('challenge.history.vs', { name: stub.opponent })
            : t('challenge.history.yours');

    return (
        <Card
            variant='elevated'
            padding='md'
            onPress={onPress}
            haptic='light'
            accessibilityLabel={title}
            style={{
                borderRadius: theme.radii.lg,
                borderColor: hexToRgba(tint, 0.4),
                opacity: status === 'expired' ? 0.7 : 1,
            }}
        >
            <Stack direction='horizontal' gap='md' align='center'>
                <View
                    style={[
                        styles.badge,
                        { borderRadius: theme.radii.lg, backgroundColor: hexToRgba(tint, 0.16) },
                    ]}
                >
                    <Icon name={meta.icon} size={22} color={tint} />
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
                {status !== 'expired' ? <Icon name={ChevronRight} size={20} color={theme.colors.textMuted} /> : null}
            </Stack>
        </Card>
    );
}

function EmptyState() {
    const theme = useTheme();
    const { t } = useTranslation();
    return (
        <View style={styles.empty}>
            <View
                style={[styles.badge, styles.emptyBadge, { borderRadius: theme.radii.xl, backgroundColor: hexToRgba(theme.colors.primary, 0.12) }]}
            >
                <Icon name={Swords} size={32} color={theme.colors.primary} />
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
    const { tabletColumn } = useResponsive();
    const [stubs, setStubs] = useState<ChallengeStub[]>(() => listChallenges());

    // Refresh on focus so a just-played challenge reflects its new status.
    useFocusEffect(
        useCallback(() => {
            setStubs(listChallenges());
        }, []),
    );

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={24} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('common.home')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('challenge.history.title')}
                </Text>
                <IconButton
                    icon={<Trophy size={24} color={theme.colors.text} />}
                    onPress={() => navigation.navigate('Ranking')}
                    size='md'
                    accessibilityLabel={t('ranking.title')}
                />
            </View>

            <FlatList
                data={stubs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ChallengeRow stub={item} onPress={() => navigation.navigate('Challenge', { challengeId: item.id })} />
                )}
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
    badge: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 24,
    },
    emptyBadge: {
        width: 64,
        height: 64,
    },
    emptyContent: {
        flexGrow: 1,
    },
});
