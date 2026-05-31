import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMachine } from '@xstate/react';
import { ChevronLeft } from 'lucide-react-native';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import IconButton from '../components/molecules/IconButton';
import Button from '../components/molecules/Button';
import Card from '../components/molecules/Card';
import { useColor } from '../theme';
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
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const background = useColor('background');
    const primary = useColor('primary');

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
            <View style={[styles.root, { backgroundColor: background, paddingTop: insets.top }]}>
                <PlayScreen onExit={() => send({ type: 'EXIT' })} />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: background }]}
            contentContainerStyle={[
                styles.content,
                { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
            ]}
        >
            <Stack direction='horizontal' gap='sm' align='center'>
                <IconButton
                    icon={<Icon name={ChevronLeft} size={24} color={primary} />}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel={t('screen.gameSetup.back')}
                />
                <Text variant='subheading' weight='semibold'>
                    {t(`game.${game.id}.name`)}
                </Text>
            </Stack>

            <Stack gap='xs' style={styles.header}>
                {GameIcon ? <Icon name={GameIcon} size={40} color={primary} /> : null}
                <Text variant='heading' weight='bold'>
                    {game.emoji} {t(`game.${game.id}.name`)}
                </Text>
                <Text variant='body' color='textSecondary'>
                    {t(`game.${game.id}.desc`)}
                </Text>
            </Stack>

            <Card gap='sm'>
                <Text variant='overline' color='textMuted'>
                    {t('common.how_to_play')}
                </Text>
                <Text variant='body' color='textSecondary'>
                    {t(`game.${game.id}.rules`)}
                </Text>
            </Card>

            <View style={styles.footer}>
                <Button fullWidth size='lg' onPress={() => send({ type: 'START' })}>
                    {t('common.start')}
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        gap: 20,
    },
    header: {
        marginTop: 8,
    },
    footer: {
        marginTop: 8,
    },
});
