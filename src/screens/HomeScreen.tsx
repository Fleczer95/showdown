import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import { useColor } from '../theme';
import { games, GAME_ICONS } from '../data/games';

/**
 * Skeleton home screen. Renders the registered ShowDown game modes to prove the
 * provider stack (theme, settings, store, analytics) is wired. The real
 * navigator and per-game screens land in the game-logic phase.
 */
export function HomeScreen() {
    const insets = useSafeAreaInsets();
    const background = useColor('background');
    const surface = useColor('surface');
    const border = useColor('border');
    const primary = useColor('primary');

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: background }]}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        >
            <Stack gap='xs'>
                <Text variant='display' weight='bold'>
                    ShowDown
                </Text>
                <Text variant='subheading' color='textSecondary'>
                    TV Quiz Party Games
                </Text>
            </Stack>

            <Stack gap='md' style={styles.list}>
                {games.map((game) => {
                    const GameIcon = GAME_ICONS[game.iconName];
                    return (
                        <View key={game.id} style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                            <Stack direction='horizontal' gap='md' align='center'>
                                {GameIcon ? <Icon name={GameIcon} size={28} color={primary} /> : null}
                                <Stack gap='xs' flex={1}>
                                    <Text variant='subheading' weight='semibold'>
                                        {game.emoji} {game.name}
                                    </Text>
                                    <Text variant='caption' color='textSecondary'>
                                        {game.description}
                                    </Text>
                                    <Text variant='overline' color='textMuted'>
                                        {game.players} players
                                    </Text>
                                </Stack>
                            </Stack>
                        </View>
                    );
                })}
            </Stack>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        gap: 24,
    },
    list: {
        marginTop: 8,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
    },
});
