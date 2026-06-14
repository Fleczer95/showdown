import React, { useState, useMemo, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useMachine } from '@xstate/react';
import { ChevronLeft, Play, Trophy, Swords } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import BottomSheet from '../components/molecules/BottomSheet';
import Input from '../components/molecules/Input';
import Leaderboard from '../components/molecules/Leaderboard';
import { useTheme } from '../theme';
import { hexToRgba, blend, darken, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n/TranslationContext';
import { games, GAME_ICONS } from '../data/games';
import { gameSessionMachine } from '../game/machines/gameSessionMachine';
import { playScreens } from '../game/playScreens';
import { useStore } from '../hooks/store/useStore';
import { buildChallenge } from '../game/challenge/build';
import { createChallenge } from '../game/challenge/store';
import { countCreatedToday } from '../game/challenge/log';
import { dailyCap, canUpsell } from '../game/challenge/limit';
import { shareChallenge } from '../game/challenge/share';
import { getDeviceId } from '../game/challenge/deviceId';
import { SafeAnalytics } from '../utils/firebase/init';
import { getHistory } from '../game/history';
import { getLastNickname, setLastNickname, MAX_NICKNAME_LENGTH } from '../game/leaderboard';
import { APP_VERSION } from '../utils/version';
import type { RootStackParamList } from '../navigation/types';

/**
 * Shared setup screen for every game mode. Reads its `gameId` from route params,
 * drives the shared `gameSessionMachine`, and lets the player start a session.
 * Per-game round UI replaces the `playing` placeholder in later phases.
 */
export function GameSetupScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, keyof RootStackParamList>>();
    const { t, locale } = useTranslation();
    const theme = useTheme();
    const { purchasedItemIds } = useStore();

    const gameId = (route.params as { gameId: string }).gameId;
    const game = games.find((g) => g.id === gameId) ?? games[0];

    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [creating, setCreating] = useState(false);
    const [nicknameSheet, setNicknameSheet] = useState(false);
    const [limitSheet, setLimitSheet] = useState(false);
    const [nickname, setNickname] = useState(() => getLastNickname());

    // Daily challenge-creation limit (honour-based, client-side). The count is
    // global across all games; the cap grows with owned premium themes. Refresh
    // on focus so returning after a create reflects the new tally.
    const ownedIds = useMemo(() => new Set(purchasedItemIds), [purchasedItemIds]);
    const [createdToday, setCreatedToday] = useState(() => countCreatedToday());
    useFocusEffect(
        useCallback(() => {
            setCreatedToday(countCreatedToday());
        }, []),
    );
    const cap = dailyCap(ownedIds);
    const limitReached = createdToday >= cap;

    // Freeze the current round into a shareable challenge, then open the share
    // sheet and drop the creator straight into it as the first attempt. Both the
    // create and play steps are online; a failed create surfaces an offline alert.
    const createAndShare = async (nick: string) => {
        try {
            setCreating(true);
            const record = buildChallenge({
                gameId: game.id,
                history: getHistory(game.id),
                ownedIds: new Set(purchasedItemIds),
                createdBy: { uuid: getDeviceId(), nickname: nick },
                appVersion: APP_VERSION,
                lang: locale === 'pl' ? 'pl' : 'en',
            });
            const id = await createChallenge(record);
            SafeAnalytics.logEvent({ name: 'challenge_created', params: { game: game.id } });
            await shareChallenge(id);
            navigation.navigate('Challenge', { challengeId: id });
        } catch {
            Alert.alert(t('challenge.offline'), t('challenge.offlineDesc'));
        } finally {
            setCreating(false);
        }
    };

    // Always confirm the name before inviting a friend — prefilled with the saved
    // default but editable per challenge (the edit also becomes the new default).
    // Past the daily cap, open the limit/upsell sheet instead of creating.
    const onCreateChallenge = () => {
        if (limitReached) {
            SafeAnalytics.logEvent({ name: 'challenge_limit_hit', params: { game: game.id } });
            setLimitSheet(true);
            return;
        }
        setNickname(getLastNickname());
        setNicknameSheet(true);
    };

    const confirmNickname = () => {
        const trimmed = nickname.trim();
        if (trimmed.length === 0) return;
        setLastNickname(trimmed);
        setNicknameSheet(false);
        void createAndShare(trimmed);
    };

    // Per-game accent — mirrors the home card the player tapped to get here.
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);
    const medallionGradientId = `setup-medallion-${game.id}`;

    const [state, send] = useMachine(gameSessionMachine, {
        input: { gameId: game.id },
    });

    const GameIcon = GAME_ICONS[game.iconName];
    const isPlaying = state.matches('playing');
    const PlayScreen = playScreens[game.id];

    // Themed container style
    const contentContainerStyle = [
        styles.content,
        {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl * 3, // approx 100 (32*3) for footer clearance
            gap: theme.spacing.xxl,
        },
    ];

    if (isPlaying && PlayScreen) {
        // Exiting a session (end-game "Main Menu" or mid-game Leave) returns to the
        // Home screen, not this game's config view. Home is the stack root, so
        // navigating to it pops the setup screen and resets its machine on remount.
        return (
            <SafeContainer edges={['top']}>
                <PlayScreen onExit={() => navigation.navigate('Home')} />
            </SafeContainer>
        );
    }

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={contentContainerStyle}
                showsVerticalScrollIndicator={false}
            >
                <Stack
                    direction='horizontal'
                    gap='sm'
                    align='center'
                    style={[styles.navBar, { paddingVertical: theme.spacing.md }]}
                >
                    <IconButton
                        icon={<ChevronLeft size={28} color={theme.colors.text} />}
                        onPress={() => navigation.goBack()}
                        accessibilityLabel={t('screen.gameSetup.back')}
                    />
                    <Text variant='subheading' weight='bold' style={styles.navTitle}>
                        {t('screen.gameSetup.title')}
                    </Text>
                    <IconButton
                        icon={<Trophy size={28} color={theme.colors.text} />}
                        onPress={() => setShowLeaderboard(true)}
                        accessibilityLabel={t('leaderboard.view')}
                    />
                </Stack>

                <Stack gap='md' align='center' style={[styles.header, { marginTop: theme.spacing.lg }]}>
                    <View
                        style={[
                            styles.mainIconContainer,
                            {
                                borderRadius: theme.radii.xl,
                                marginBottom: theme.spacing.sm,
                                borderWidth: 1,
                                borderColor: hexToRgba(accent, 0.5),
                                shadowColor: accent,
                                shadowOpacity: 0.45,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 6 },
                                elevation: 8,
                            },
                        ]}
                    >
                        <View
                            style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.xl, overflow: 'hidden' }]}
                            pointerEvents='none'
                        >
                            <Svg width='100%' height='100%'>
                                <Defs>
                                    <SvgGradient id={medallionGradientId} x1='0' y1='0' x2='1' y2='1'>
                                        <Stop offset='0' stopColor={accent} />
                                        <Stop offset='1' stopColor={darken(accent, 0.4)} />
                                    </SvgGradient>
                                </Defs>
                                <Rect x='0' y='0' width='100%' height='100%' fill={`url(#${medallionGradientId})`} />
                            </Svg>
                        </View>
                        {GameIcon ? <Icon name={GameIcon} size={48} color={onAccent} /> : null}
                    </View>
                    <Stack gap='xs' align='center'>
                        <Text variant='heading' weight='bold' align='center'>
                            {game.emoji} {t(`game.${game.id}.name`)}
                        </Text>
                        <Text
                            variant='body'
                            color='textSecondary'
                            align='center'
                            style={[styles.desc, { paddingHorizontal: theme.spacing.lg }]}
                        >
                            {t(`game.${game.id}.desc`)}
                        </Text>
                    </Stack>
                </Stack>

                <Card
                    variant='outlined'
                    padding='lg'
                    gap='md'
                    style={[
                        styles.rulesCard,
                        {
                            marginTop: theme.spacing.sm,
                            borderColor: hexToRgba(accent, 0.5),
                            shadowColor: accent,
                            shadowOpacity: 0.25,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 6 },
                            elevation: 6,
                        },
                    ]}
                >
                    <Stack direction='horizontal' gap='sm' align='center'>
                        <View style={[styles.dot, { backgroundColor: accent }]} />
                        <Text variant='overline' color={accent} weight='bold'>
                            {t('common.how_to_play')}
                        </Text>
                    </Stack>
                    <Text variant='body' color='textSecondary' style={styles.rulesText}>
                        {t(`game.${game.id}.rules`)}
                    </Text>
                </Card>
            </ScrollView>

            <View style={[styles.footer, { bottom: theme.spacing.xl, paddingHorizontal: theme.spacing.xl }]}>
                <Stack gap='sm'>
                    <Button
                        fullWidth
                        size='lg'
                        onPress={() => send({ type: 'START' })}
                        style={{ backgroundColor: accent, borderColor: accent }}
                        textColor={onAccent}
                        icon={<Play size={20} color={onAccent} fill={onAccent} />}
                    >
                        {t('common.start')}
                    </Button>
                    <Button
                        fullWidth
                        onPress={onCreateChallenge}
                        disabled={creating}
                        style={{
                            backgroundColor: blend(accent, theme.colors.background, 0.22),
                            borderColor: accent,
                            borderWidth: 1.5,
                            shadowColor: accent,
                            shadowOpacity: 0.3,
                            shadowRadius: 14,
                            shadowOffset: { width: 0, height: 6 },
                            elevation: 8,
                            // Looks disabled at the cap but stays tappable to open
                            // the limit/upsell sheet.
                            opacity: limitReached ? 0.55 : 1,
                        }}
                        textColor={accent}
                        icon={<Swords size={22} color={accent} />}
                    >
                        {creating
                            ? t('challenge.creating')
                            : t('challenge.createWithCount', { count: createdToday, cap })}
                    </Button>
                </Stack>
            </View>

            <BottomSheet
                visible={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
                title={t('leaderboard.title')}
                scrollable
            >
                <Leaderboard gameId={game.id} />
            </BottomSheet>

            <BottomSheet
                visible={limitSheet}
                onClose={() => setLimitSheet(false)}
                title={t('challenge.limit.title')}
            >
                <Stack gap='md' align='stretch'>
                    <Text variant='body' color='textSecondary' align='center' style={styles.limitBody}>
                        {t('challenge.limit.body')}
                    </Text>
                    {canUpsell(ownedIds) && (
                        <Button
                            variant='primary'
                            fullWidth
                            onPress={() => {
                                setLimitSheet(false);
                                navigation.navigate('Store' as any);
                            }}
                        >
                            {t('challenge.limit.cta')}
                        </Button>
                    )}
                    <Button
                        variant={canUpsell(ownedIds) ? 'ghost' : 'primary'}
                        fullWidth
                        onPress={() => setLimitSheet(false)}
                    >
                        {t('challenge.limit.dismiss')}
                    </Button>
                </Stack>
            </BottomSheet>

            <BottomSheet
                visible={nicknameSheet}
                onClose={() => setNicknameSheet(false)}
                title={t('challenge.nicknamePrompt')}
            >
                <Stack gap='sm' align='stretch'>
                    <Input
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder={t('leaderboard.nicknamePlaceholder')}
                        maxLength={MAX_NICKNAME_LENGTH}
                        autoCapitalize='words'
                        returnKeyType='done'
                        onSubmitEditing={confirmNickname}
                        textAlign='center'
                        wrapperStyle={styles.nicknameInput}
                    />
                    <Button
                        variant='primary'
                        fullWidth
                        disabled={nickname.trim().length === 0}
                        onPress={confirmNickname}
                    >
                        {t('challenge.create')}
                    </Button>
                </Stack>
            </BottomSheet>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        // dynamic spacing moved
    },
    navBar: {
        marginLeft: -8,
    },
    navTitle: {
        flex: 1,
    },
    header: {
        // dynamic spacing moved
    },
    mainIconContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    desc: {
        // dynamic spacing moved
    },
    rulesCard: {
        borderStyle: 'dashed',
    },
    nicknameInput: {
        paddingHorizontal: 0,
    },
    limitBody: {
        marginBottom: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    rulesText: {
        lineHeight: 24,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
});
