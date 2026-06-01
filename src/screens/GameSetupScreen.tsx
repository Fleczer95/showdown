import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMachine } from '@xstate/react';
import { ChevronLeft, Play } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import { useTheme } from '../theme';
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

    const primary = theme.colors.primary;

    const gameId = (route.params as { gameId: string }).gameId;
    const game = games.find((g) => g.id === gameId) ?? games[0];

    const [state, send] = useMachine(gameSessionMachine, {
        input: { gameId: game.id },
    });

    const GameIcon = GAME_ICONS[game.iconName];
    const isPlaying = state.matches('playing');
    const PlayScreen = playScreens[game.id];

    if (isPlaying && PlayScreen) {
        return (
            <SafeContainer edges={['top', 'bottom']}>
                <PlayScreen onExit={() => send({ type: 'EXIT' })} />
            </SafeContainer>
        );
    }

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Stack direction='horizontal' gap='sm' align='center' style={styles.navBar}>
                    <IconButton
                        icon={<ChevronLeft size={28} color={theme.colors.text} />}
                        onPress={() => navigation.goBack()}
                        accessibilityLabel={t('screen.gameSetup.back')}
                    />
                    <Text variant='subheading' weight='bold'>
                        {t('screen.gameSetup.title')}
                    </Text>
                </Stack>

                <Stack gap='md' align='center' style={styles.header}>
                    <View style={[styles.mainIconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                        {GameIcon ? <Icon name={GameIcon} size={48} color={primary} /> : null}
                    </View>
                    <Stack gap='xs' align='center'>
                        <Text variant='heading' weight='bold' align='center'>
                            {game.emoji} {t(`game.${game.id}.name`)}
                        </Text>
                        <Text variant='body' color='textSecondary' align='center' style={styles.desc}>
                            {t(`game.${game.id}.desc`)}
                        </Text>
                    </Stack>
                </Stack>

                <Card variant='outlined' padding='lg' gap='md' style={styles.rulesCard}>
                    <Stack direction='horizontal' gap='sm' align='center'>
                        <View style={[styles.dot, { backgroundColor: primary }]} />
                        <Text variant='overline' color='primary' weight='bold'>
                            {t('common.how_to_play')}
                        </Text>
                    </Stack>
                    <Text variant='body' color='textSecondary' style={styles.rulesText}>
                        {t(`game.${game.id}.rules`)}
                    </Text>
                </Card>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    fullWidth
                    size='lg'
                    onPress={() => send({ type: 'START' })}
                    icon={<Play size={20} color={theme.colors.onPrimary} fill={theme.colors.onPrimary} />}
                >
                    {t('common.start')}
                </Button>
            </View>
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
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 100,
        gap: 32,
    },
    navBar: {
        marginLeft: -8,
        paddingVertical: 12,
    },
    header: {
        marginTop: 16,
    },
    mainIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    desc: {
        paddingHorizontal: 20,
    },
    rulesCard: {
        marginTop: 8,
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
        bottom: 24,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        backgroundColor: 'transparent',
    },
});
