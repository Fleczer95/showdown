import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMachine } from '@xstate/react';
import { ChevronLeft, Play, Trophy } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import BottomSheet from '../components/molecules/BottomSheet';
import Leaderboard from '../components/molecules/Leaderboard';
import { useTheme } from '../theme';
import { hexToRgba, darken, readableOn, resolveAccent } from '../theme/colorUtils';
import { useTranslation } from '../i18n/TranslationContext';
import { games, GAME_ICONS } from '../data/games';
import { gameSessionMachine } from '../game/machines/gameSessionMachine';
import { playScreens } from '../game/playScreens';
import type { RootStackParamList } from '../navigation/types';

/**
 * Shared setup screen for every game mode. Reads its `gameId` from route params,
 * drives the shared `gameSessionMachine`, and lets the player start a session.
 * Per-game round UI replaces the `playing` placeholder in later phases.
 */
export function GameSetupScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, keyof RootStackParamList>>();
    const { t } = useTranslation();
    const theme = useTheme();

    const gameId = (route.params as { gameId: string }).gameId;
    const game = games.find((g) => g.id === gameId) ?? games[0];

    const [showLeaderboard, setShowLeaderboard] = useState(false);

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
        return (
            <SafeContainer edges={['top']}>
                <PlayScreen onExit={() => send({ type: 'EXIT' })} />
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

            <View
                style={[
                    styles.footer,
                    { bottom: theme.spacing.xl, paddingHorizontal: theme.spacing.xl },
                ]}
            >
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
            </View>

            <BottomSheet
                visible={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
                title={t('leaderboard.title')}
                scrollable
            >
                <Leaderboard gameId={game.id} />
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
