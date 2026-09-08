import React, { useMemo, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native';
import SafeContainer from '../responsive/SafeContainer';
import Stack from '../components/atoms/Stack';
import Text from '../components/atoms/Text';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import Input from '../components/molecules/Input';
import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
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
import { eventLifecycle, findEdition, grantIdentity, type EventEdition } from '../../shared/events/definitions';

export function EventHubScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'EventHub'>>();
    const { t, locale } = useTranslation();
    const theme = useTheme();
    const { purchasedItemIds, isPremium } = useStore();
    const { stats } = useProgression();
    const access = useMemo(
        () => ({ purchasedIds: new Set(purchasedItemIds), premium: isPremium }),
        [purchasedItemIds, isPremium],
    );
    const [nickname, setNickname] = useState(getChallengeNickname);
    const [busy, setBusy] = useState(false);
    const [previewReward, setPreviewReward] = useState<string | null>(null);
    const now = useEventNow();
    const pending = getPendingEventStart();
    const editions = visibleEvents(now).filter(
        (edition) => !route.params?.editionId || edition.id === route.params.editionId,
    );
    const canStart = editions.some((edition) => eventLifecycle(edition, now) === 'active');
    usePreventRemove(busy, () => undefined);
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
            <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }} keyboardShouldPersistTaps='handled'>
                <Stack gap='lg'>
                    <Text variant='heading' weight='bold'>
                        {editions.length === 1 ? editions[0].name[locale] : t('events.title')}
                    </Text>
                    <Text variant='body' color='textSecondary'>
                        {t('events.description')}
                    </Text>
                    {canStart ? (
                        <Input
                            testID='event-nickname'
                            accessibilityLabel={t('leaderboard.nicknamePlaceholder')}
                            returnKeyType='done'
                            value={nickname}
                            onChangeText={setNickname}
                            placeholder={t('leaderboard.nicknamePlaceholder')}
                            maxLength={MAX_NICKNAME_LENGTH}
                        />
                    ) : null}
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
                                {edition.milestones.map((milestone) => (
                                    <Stack key={milestone.id} gap='xs'>
                                        <Text weight='bold'>
                                            {t(eventRewardTitleKey(milestone.rewardId) ?? 'progression.newReward')}
                                        </Text>
                                        <Text>
                                            {stats.eventRewardGrants?.includes(grantIdentity(edition.id, milestone.id))
                                                ? t('events.earned')
                                                : t('events.goal', {
                                                      count: stats.eventCompletedRuns?.[edition.id] ?? 0,
                                                      total: milestone.completedRuns,
                                                  })}
                                        </Text>
                                        <Button variant='ghost' onPress={() => setPreviewReward(milestone.rewardId)}>
                                            {t('events.preview')}
                                        </Button>
                                    </Stack>
                                ))}
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
