import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Pressable from '../components/atoms/HapticPressable';
import { useColor } from '../theme';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS } from '../data/games';

/**
 * Home screen. Lists the ShowDown game modes; tapping a card opens that game's
 * setup screen via the root navigator.
 */
export function HomeScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
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
                    {t('screen.home.tagline')}
                </Text>
            </Stack>

            <Stack gap='md' style={styles.list}>
                {games.map((game) => {
                    const GameIcon = GAME_ICONS[game.iconName];
                    return (
                        <Pressable
                            key={game.id}
                            style={[styles.card, { backgroundColor: surface, borderColor: border }]}
                            onPress={() => navigation.navigate(game.setupRoute, { gameId: game.id })}
                            haptic='light'
                            accessibilityRole='button'
                            accessibilityLabel={t(`game.${game.id}.name`)}
                        >
                            <Stack direction='horizontal' gap='md' align='center'>
                                {GameIcon ? <Icon name={GameIcon} size={28} color={primary} /> : null}
                                <Stack gap='xs' flex={1}>
                                    <Text variant='subheading' weight='semibold'>
                                        {game.emoji} {t(`game.${game.id}.name`)}
                                    </Text>
                                    <Text variant='caption' color='textSecondary'>
                                        {t(`game.${game.id}.desc`)}
                                    </Text>
                                </Stack>
                            </Stack>
                        </Pressable>
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
