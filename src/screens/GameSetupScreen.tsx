import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useMachine } from '@xstate/react';
import { ChevronLeft, Play, Trophy, Swords, Sparkles } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Glyph from '../components/atoms/Glyph';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import ProgressBar from '../components/molecules/ProgressBar';
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
import { createChallenge, getChallenge, newChallengeId, BlockedError } from '../game/challenge/store';
import { countCreatedToday } from '../game/challenge/log';
import { dailyCap, canUpsell } from '../game/challenge/limit';
import { canStartOfflineRun, remainingOfflineRuns, consumeOfflineRun } from '../game/offline/limit';
import { shareChallenge } from '../game/challenge/share';
import { getDeviceId } from '../game/challenge/deviceId';
import { SafeAnalytics } from '../utils/firebase/init';
import { getHistory } from '../game/history';
import { poolCoverage, type PoolCoverage } from '../game/poolCoverage';
import { hasBuyablePacks } from '../data/store/catalog';
import { MAX_NICKNAME_LENGTH } from '../game/leaderboard';
import { getChallengeNickname, setChallengeNickname } from '../game/challenge/nickname';
import type { RootStackParamList } from '../navigation/types';

// Fraction of a game's question pool the player must have seen before the pool
// meter escalates from a quiet tally into a repeats-ahead purchase nudge. Below
// this the deck still has unseen questions, so a "buy more" prompt would be
// premature noise (see `poolCoverage` / `deck.ts`).
const POOL_NUDGE_THRESHOLD = 0.8;

/** The dashed "How to play" rules card. */
function RulesCard({ accent, gameId }: { accent: string; gameId: string }) {
    const theme = useTheme();
    const { t } = useTranslation();
    return (
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
                {t(`game.${gameId}.rules`)}
            </Text>
        </Card>
    );
}

interface QuestionPoolCardProps {
    accent: string;
    coverage: PoolCoverage;
    /** Pool is near exhaustion / fully cycled: accent it and offer the CTA. */
    escalated: boolean;
    /** Whether this game still has a pack to buy — gates the CTA. */
    buyable: boolean;
    onGetMore: () => void;
}

/**
 * The question-pool meter. A quiet tally while the deck still has unseen
 * questions; past the escalation threshold it accents and offers a "get more
 * packs" CTA. Once every question has been seen (`floor >= 1`) the bar tracks
 * re-coverage of the *current* lap and the label counts laps, so it keeps moving
 * instead of freezing at 100%. Renders nothing for an empty pool.
 */
function QuestionPoolCard({ accent, coverage, escalated, buyable, onGetMore }: QuestionPoolCardProps) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { seen, total, floor, reseen } = coverage;
    if (total <= 0) return null;

    const fullyCycled = floor >= 1; // every question seen at least once
    const lap = floor + 1; // the pass the player is currently on
    const ratio = fullyCycled ? reseen / total : seen / total;
    const shown = fullyCycled ? reseen : seen;
    const showCta = escalated && buyable;

    return (
        <Card
            variant='outlined'
            padding='lg'
            gap='md'
            style={
                escalated
                    ? {
                          borderColor: hexToRgba(accent, 0.6),
                          shadowColor: accent,
                          shadowOpacity: 0.22,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 6 },
                          elevation: 6,
                      }
                    : undefined
            }
        >
            <Stack direction='horizontal' gap='sm' align='center' justify='between'>
                <Stack direction='horizontal' gap='sm' align='center'>
                    <View style={[styles.dot, { backgroundColor: escalated ? accent : theme.colors.textMuted }]} />
                    <Text variant='overline' color={escalated ? accent : 'textMuted'} weight='bold'>
                        {t('screen.gameSetup.pool.title')}
                    </Text>
                </Stack>
                <Text variant='caption' weight='bold' color={escalated ? accent : 'textSecondary'}>
                    {t('screen.gameSetup.pool.count', { seen: shown, total })}
                </Text>
            </Stack>
            <ProgressBar progress={ratio} color={escalated ? accent : theme.colors.textSecondary} />
            <Text variant='caption' color={escalated ? accent : 'textMuted'}>
                {fullyCycled
                    ? t(buyable ? 'screen.gameSetup.pool.allSeen' : 'screen.gameSetup.pool.allSeenOwned', { lap })
                    : escalated
                      ? t(buyable ? 'screen.gameSetup.pool.low' : 'screen.gameSetup.pool.seenLabel')
                      : t('screen.gameSetup.pool.seenLabel')}
            </Text>
            {showCta && (
                <Button
                    fullWidth
                    onPress={onGetMore}
                    style={{
                        backgroundColor: blend(accent, theme.colors.background, 0.22),
                        borderColor: accent,
                        borderWidth: 1.5,
                    }}
                    textColor={accent}
                    icon={<Sparkles size={18} color={accent} />}
                >
                    {t('screen.gameSetup.pool.getMore')}
                </Button>
            )}
        </Card>
    );
}

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
    const [nicknameError, setNicknameError] = useState<string | null>(null);
    const [limitSheet, setLimitSheet] = useState(false);
    const [nickname, setNickname] = useState(() => getChallengeNickname());

    // Daily challenge-creation limit (honour-based, client-side). The count is
    // global across all games; the cap grows with owned premium themes. Refresh
    // on focus so returning after a create reflects the new tally.
    const ownedIds = useMemo(() => new Set(purchasedItemIds), [purchasedItemIds]);
    const [createdToday, setCreatedToday] = useState(() => countCreatedToday());
    const [offlineLimitSheet, setOfflineLimitSheet] = useState(false);
    const [runsLeft, setRunsLeft] = useState(() => remainingOfflineRuns(ownedIds));
    // How much of this game's question pool the player has worked through. Refresh
    // on focus so returning after a session (which marks questions shown) reflects
    // the new tally and can surface the "running low → buy more" nudge.
    const [coverage, setCoverage] = useState(() => poolCoverage(gameId, ownedIds));
    useFocusEffect(
        useCallback(() => {
            setCreatedToday(countCreatedToday());
            setCoverage(poolCoverage(gameId, ownedIds));
            setRunsLeft(remainingOfflineRuns(ownedIds));
        }, [gameId, ownedIds]),
    );
    const cap = dailyCap(ownedIds);
    const limitReached = createdToday >= cap;

    // The id of an in-flight challenge, held across retries. A create whose
    // network confirmation timed out (device offline) is still committed by
    // Firestore on reconnect, so on retry we look the id up first: if that write
    // landed we reuse it rather than creating a duplicate.
    const pendingChallengeId = useRef<string | null>(null);

    // Freeze the current round into a shareable challenge, then open the share
    // sheet and drop the creator straight into it as the first attempt. Both the
    // create and play steps are online; a failed create surfaces an offline alert.
    const createAndShare = async (nick: string) => {
        try {
            setCreating(true);
            let id = pendingChallengeId.current;
            if (id) {
                // A prior attempt may have committed after its timeout — recover it.
                const existing = await getChallenge(id);
                if (!existing) id = null;
            }
            if (!id) {
                const record = buildChallenge({
                    gameId: game.id,
                    history: getHistory(game.id),
                    ownedIds: new Set(purchasedItemIds),
                    createdBy: { uuid: getDeviceId(), nickname: nick },
                    lang: locale === 'pl' ? 'pl' : 'en',
                });
                id = newChallengeId();
                pendingChallengeId.current = id;
                await createChallenge(record, id);
            }
            pendingChallengeId.current = null;
            SafeAnalytics.logEvent({ name: 'challenge_created', params: { game: game.id } });
            await shareChallenge(id);
            navigation.navigate('Challenge', { challengeId: id });
        } catch (err) {
            const blocked = err instanceof BlockedError;
            Alert.alert(
                t(blocked ? 'challenge.errorTitle' : 'challenge.offline'),
                t(blocked ? 'challenge.errorDesc' : 'challenge.offlineDesc'),
            );
        } finally {
            setCreating(false);
        }
    };

    // Solo play is daily-capped (offline limit). At zero, open the limit/upsell
    // sheet instead of starting; otherwise spend one run and begin the session.
    const onStart = () => {
        if (!canStartOfflineRun(ownedIds)) {
            SafeAnalytics.logEvent({ name: 'offline_limit_hit', params: { game: game.id } });
            setOfflineLimitSheet(true);
            return;
        }
        consumeOfflineRun(ownedIds);
        setRunsLeft(remainingOfflineRuns(ownedIds));
        send({ type: 'START' });
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
        setNickname(getChallengeNickname());
        setNicknameError(null);
        setNicknameSheet(true);
    };

    const confirmNickname = () => {
        const trimmed = nickname.trim();
        if (trimmed.length === 0) return;
        // The creator's nickname is public (createdBy + global ranking); the setter
        // gates profanity, so a rejected name surfaces an error here.
        if (!setChallengeNickname(trimmed)) {
            setNicknameError(t('challenge.nicknameRejected'));
            return;
        }
        setNicknameSheet(false);
        void createAndShare(trimmed);
    };

    // Per-game accent — mirrors the home card the player tapped to get here.
    const accent = resolveAccent(theme, game.accent);
    const onAccent = readableOn(accent);
    const medallionGradientId = `setup-medallion-${game.id}`;

    // Question-pool meter. The card owns its own presentation; the parent needs
    // only `escalated` (to float the nudge above the rules card when the pool is
    // nearly spent or fully cycled) and whether a pack is still buyable (CTA gate).
    const poolEscalated =
        coverage.floor >= 1 ||
        (coverage.total > 0 && coverage.seen / coverage.total >= POOL_NUDGE_THRESHOLD);
    const poolBuyable = hasBuyablePacks(gameId, ownedIds);

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
            // Clearance for the floating footer (two stacked buttons + its bottom
            // offset), so the last card — the question-pool widget — scrolls fully
            // clear of it instead of being overlapped.
            paddingBottom: theme.spacing.xxl * 5, // ~160
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

    const rulesCard = <RulesCard accent={accent} gameId={game.id} />;
    const poolCard = (
        <QuestionPoolCard
            accent={accent}
            coverage={coverage}
            escalated={poolEscalated}
            buyable={poolBuyable}
            onGetMore={() => navigation.navigate('Store', { gameId: game.id })}
        />
    );

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
                        <Stack direction='horizontal' gap='xs' align='center'>
                            <Glyph emoji={game.emoji} size={26} />
                            <Text variant='heading' weight='bold' align='center'>
                                {t(`game.${game.id}.name`)}
                            </Text>
                        </Stack>
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

                {/* When the pool is nearly exhausted the buy nudge outranks rules
                    the player has likely already read, so it floats above them. */}
                {poolEscalated ? (
                    <>
                        {poolCard}
                        {rulesCard}
                    </>
                ) : (
                    <>
                        {rulesCard}
                        {poolCard}
                    </>
                )}
            </ScrollView>

            <View style={[styles.footer, { bottom: theme.spacing.xl, paddingHorizontal: theme.spacing.xl }]}>
                <Stack gap='sm'>
                    <Button
                        fullWidth
                        size='lg'
                        onPress={onStart}
                        style={{
                            backgroundColor: accent,
                            borderColor: accent,
                            opacity: runsLeft <= 0 ? 0.55 : 1,
                        }}
                        textColor={onAccent}
                        icon={<Play size={20} color={onAccent} fill={onAccent} />}
                    >
                        {runsLeft <= 0 ? t('common.start') : t('offline.startWithCount', { count: runsLeft })}
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
                                navigation.navigate('Store');
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
                visible={offlineLimitSheet}
                onClose={() => setOfflineLimitSheet(false)}
                title={t('offline.limit.title')}
            >
                <Stack gap='md' align='stretch'>
                    <Text variant='body' color='textSecondary' align='center' style={styles.limitBody}>
                        {t('offline.limit.body')}
                    </Text>
                    {canUpsell(ownedIds) && (
                        <Button
                            variant='primary'
                            fullWidth
                            onPress={() => {
                                setOfflineLimitSheet(false);
                                navigation.navigate('Store');
                            }}
                        >
                            {t('offline.limit.cta')}
                        </Button>
                    )}
                    <Button
                        variant={canUpsell(ownedIds) ? 'ghost' : 'primary'}
                        fullWidth
                        onPress={() => setOfflineLimitSheet(false)}
                    >
                        {t('offline.limit.dismiss')}
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
                        onChangeText={(v) => {
                            setNickname(v);
                            setNicknameError(null);
                        }}
                        placeholder={t('leaderboard.nicknamePlaceholder')}
                        maxLength={MAX_NICKNAME_LENGTH}
                        autoCapitalize='words'
                        returnKeyType='done'
                        onSubmitEditing={confirmNickname}
                        textAlign='center'
                        wrapperStyle={styles.nicknameInput}
                    />
                    {nicknameError ? (
                        <Text variant='caption' color='error' align='center'>
                            {nicknameError}
                        </Text>
                    ) : null}
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
