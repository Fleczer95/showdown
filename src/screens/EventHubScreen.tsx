import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native';
import SafeContainer from '../responsive/SafeContainer';
import Pressable from '../components/atoms/HapticPressable';
import Icon from '../components/atoms/Icon';
import Stack from '../components/atoms/Stack';
import Text from '../components/atoms/Text';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import Input from '../components/molecules/Input';
import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
import { hexToRgba } from '../theme/colorUtils';
import { useResponsive } from '../responsive/useResponsive';
import { useStore } from '../hooks/store/useStore';
import { useProgression } from '../hooks/useProgression';
import { EventRewardPreview } from '../game/events/EventRewardPreview';
import { visibleEvents } from '../game/events/catalogue';
import { useEventNow } from '../game/events/useEventNow';
import type { RootStackParamList } from '../navigation/types';
import { eventRewardTitleKey } from '../game/events/access';
import { remainingEventPlays, startEvent } from '../game/events/participation';
import { getPendingEventStart } from '../game/challenge/session/store';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import { MAX_NICKNAME_LENGTH } from '../game/leaderboard';
import { BlockedError } from '../game/challenge/store';
import { eventLifecycle, findEdition, type EventEdition } from '../../shared/events/definitions';

export function EventHubScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'EventHub'>>();
    const { t, locale } = useTranslation();
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();
    const { purchasedItemIds, isPremium } = useStore();
    const { stats } = useProgression();
    const access = useMemo(
        () => ({ purchasedIds: new Set(purchasedItemIds), premium: isPremium }),
        [purchasedItemIds, isPremium],
    );
    const [nickname, setNickname] = useState(getChallengeNickname);
    const [busy, setBusy] = useState(false);
    const [previewReward, setPreviewReward] = useState<string | null>(null);
    // Seven prizes push the friend/random actions below the fold, so the list
    // starts hidden. Tracked by the ids that are OPEN, so the default is closed.
    const [openPrizes, setOpenPrizes] = useState<ReadonlySet<string>>(new Set());
    const now = useEventNow();
    const pending = getPendingEventStart();
    const editions = visibleEvents(now).filter(
        (edition) => !route.params?.editionId || edition.id === route.params.editionId,
    );
    usePreventRemove(busy, () => undefined);
    /** Save the edit, or put the stored nickname back so the field never lies. */
    function commitNickname() {
        const trimmed = nickname.trim();
        const stored = getChallengeNickname();
        if (trimmed === stored) return;
        if (setChallengeNickname(trimmed)) {
            setNickname(getChallengeNickname());
            return;
        }
        setNickname(stored);
        if (trimmed.length > 0) Alert.alert(t('challenge.nicknameRejected'));
    }

    async function begin(edition: EventEdition, mode: 'friend' | 'random') {
        if (!pending && !setChallengeNickname(nickname.trim())) {
            Alert.alert(t('challenge.nicknameRejected'));
            return;
        }
        setBusy(true);
        try {
            const result = await startEvent({
                edition,
                mode,
                nickname: nickname.trim(),
                locale,
                entitlements: access,
            });
            navigation.navigate('Challenge', { challengeId: result.id, autoShare: result.share });
        } catch (error) {
            Alert.alert(
                t('events.errorTitle'),
                t(
                    error instanceof BlockedError && error.status === 410
                        ? 'events.closed'
                        : error instanceof BlockedError && error.status === 409
                          ? 'events.full'
                          : 'events.retryBody',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <SafeContainer edges={['top', 'bottom']}>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.headerTitle} numberOfLines={1}>
                    {editions.length === 1 ? editions[0].name[locale] : t('events.title')}
                </Text>
                {/* Balances the back button so the title stays optically centred. */}
                <View style={{ width: scale(44) }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }} keyboardShouldPersistTaps='handled'>
                <Stack gap='lg'>
                    <Text variant='body' color='textSecondary'>
                        {t('events.description')}
                    </Text>
                    {/* Always editable, not just while a round can be started, and
                        saved on blur/submit — typing here used to be discarded unless
                        the player went on to start a round. */}
                    <Input
                        testID='event-nickname'
                        label={t('challenge.nicknamePrompt')}
                        accessibilityLabel={t('challenge.nicknamePrompt')}
                        returnKeyType='done'
                        value={nickname}
                        onChangeText={setNickname}
                        onBlur={commitNickname}
                        onSubmitEditing={commitNickname}
                        placeholder={t('leaderboard.nicknamePlaceholder')}
                        maxLength={MAX_NICKNAME_LENGTH}
                        autoCapitalize='words'
                    />
                    {pending ? (
                        <Card padding='lg' gap='md'>
                            <Text>{t('events.pendingStart')}</Text>
                            <Button
                                loading={busy}
                                onPress={() => {
                                    const edition = findEdition(pending.editionId, true);
                                    if (edition) void begin(edition, pending.mode);
                                }}
                            >
                                {t('challenge.retry')}
                            </Button>
                        </Card>
                    ) : null}
                    {editions.length === 0 ? <Text>{t('events.none')}</Text> : null}
                    {editions.map((edition) => {
                        const phase = eventLifecycle(edition, now);
                        const remaining = remainingEventPlays(edition, access);
                        const wins = stats.eventWinIds?.[edition.id]?.length ?? 0;
                        const toNextPrize = edition.winsPerPrize - (wins % edition.winsPerPrize);
                        const earned = new Set(stats.earnedRewardIds ?? []);
                        const poolComplete = edition.prizePool.every((id) => earned.has(id));
                        const prizesOpen = openPrizes.has(edition.id);
                        const accent = edition.accent ?? theme.colors.primary;
                        return (
                            <Card
                                key={edition.id}
                                padding='lg'
                                gap='md'
                                style={{ borderColor: edition.accent ?? theme.colors.primary }}
                            >
                                {editions.length > 1 ? (
                                    <Text variant='heading' weight='bold'>
                                        {edition.name[locale]}
                                    </Text>
                                ) : null}
                                <Text>
                                    {phase === 'active'
                                        ? t('events.remaining', { count: remaining })
                                        : t(phase === 'upcoming' ? 'events.upcoming' : 'events.finished')}
                                </Text>
                                <Text variant='caption'>
                                    {t(phase === 'upcoming' ? 'events.startsAt' : 'events.deadline', {
                                        date: new Date(
                                            phase === 'upcoming' ? edition.startsAt! : edition.endsAt!,
                                        ).toLocaleString(locale),
                                    })}
                                </Text>
                                {phase === 'closed' ? (
                                    <Text>
                                        {t('events.completed', { count: stats.eventCompletedRuns?.[edition.id] ?? 0 })}
                                    </Text>
                                ) : null}
                                <Text>{t('events.winsGoal', { count: wins })}</Text>
                                <Text variant='caption'>
                                    {poolComplete
                                        ? t('events.poolComplete')
                                        : t('events.nextPrize', { count: toNextPrize })}
                                </Text>
                                <Text variant='caption'>{t('events.randomPrize')}</Text>
                                {/* Reads as a control, not a heading: tinted surface, an
                                    explicit show/hide verb, and the same circled chevron
                                    affordance Home uses on its game cards. */}
                                <Pressable
                                    testID={`event-prizes-toggle-${edition.id}`}
                                    accessibilityRole='button'
                                    accessibilityState={{ expanded: prizesOpen }}
                                    accessibilityLabel={t('events.prizesTitle')}
                                    accessibilityHint={t(prizesOpen ? 'events.hidePrizes' : 'events.showPrizes')}
                                    haptic='light'
                                    style={{
                                        backgroundColor: hexToRgba(accent, 0.1),
                                        borderRadius: theme.radii.lg,
                                        paddingHorizontal: theme.spacing.md,
                                        paddingVertical: theme.spacing.xs,
                                        minHeight: scale(48),
                                        justifyContent: 'center',
                                    }}
                                    onPress={() =>
                                        setOpenPrizes((prev) => {
                                            const next = new Set(prev);
                                            if (!next.delete(edition.id)) next.add(edition.id);
                                            return next;
                                        })
                                    }
                                >
                                    <View
                                        pointerEvents='none'
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: theme.spacing.sm,
                                        }}
                                    >
                                        <Text weight='bold' style={{ flex: 1 }}>
                                            {`${t('events.prizesTitle')} · ${
                                                edition.prizePool.filter((id) => earned.has(id)).length
                                            }/${edition.prizePool.length}`}
                                        </Text>
                                        <Text variant='caption' weight='bold' color={accent}>
                                            {t(prizesOpen ? 'events.hidePrizes' : 'events.showPrizes')}
                                        </Text>
                                        <View
                                            style={{
                                                width: scale(32),
                                                height: scale(32),
                                                borderRadius: theme.radii.full,
                                                backgroundColor: hexToRgba(accent, 0.16),
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Icon
                                                name={prizesOpen ? ChevronUp : ChevronDown}
                                                size={iconSize(18)}
                                                color={accent}
                                            />
                                        </View>
                                    </View>
                                </Pressable>
                                {prizesOpen
                                    ? edition.prizePool.map((rewardId) => (
                                          <Stack key={rewardId} gap='xs'>
                                              <Text weight='bold'>
                                                  {t(eventRewardTitleKey(rewardId) ?? 'progression.newReward')}
                                              </Text>
                                              <Text>
                                                  {earned.has(rewardId) ? t('events.earned') : t('events.locked')}
                                              </Text>
                                              <Button variant='ghost' onPress={() => setPreviewReward(rewardId)}>
                                                  {t('events.preview')}
                                              </Button>
                                          </Stack>
                                      ))
                                    : null}
                                {phase === 'active' ? (
                                    <>
                                        {(['friend', 'random'] as const).map((mode) => (
                                            <Button
                                                key={mode}
                                                disabled={busy || !!pending || remaining === 0}
                                                onPress={() => void begin(edition, mode)}
                                            >
                                                {t(`events.${mode}`)}
                                            </Button>
                                        ))}
                                    </>
                                ) : phase === 'closed' ? (
                                    <Button onPress={() => navigation.navigate('ChallengeHistory')}>
                                        {t('events.viewResults')}
                                    </Button>
                                ) : null}
                            </Card>
                        );
                    })}
                    <Button variant='secondary' onPress={() => navigation.navigate('ChallengeHistory')}>
                        {t('challenge.history.title')}
                    </Button>
                    <Button variant='ghost' onPress={() => navigation.navigate('Home')}>
                        {t('common.home')}
                    </Button>
                </Stack>
            </ScrollView>
            <EventRewardPreview rewardId={previewReward} onClose={() => setPreviewReward(null)} />
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
});
