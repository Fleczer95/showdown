import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Settings, ChevronRight } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
import Card from '../components/molecules/Card';
import IconButton from '../components/molecules/IconButton';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { games, GAME_ICONS } from '../data/games';

/**
 * Home screen. Lists the ShowDown game modes; tapping a card opens that game's
 * setup screen via the root navigator.
 */
export function HomeScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const primary = theme.colors.primary;

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                style={styles.root}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Stack gap='md'>
                    <View style={styles.header}>
                        <Stack gap='xs' style={styles.titleContainer}>
                            <Text variant='display' weight='bold' color='primary' style={styles.title}>
                                ShowDown
                            </Text>
                            <Text variant='subheading' color='textSecondary' weight='medium'>
                                {t('screen.home.tagline')}
                            </Text>
                        </Stack>
                        <IconButton
                            icon={<Settings size={24} color={theme.colors.text} />}
                            onPress={() => navigation.navigate('Settings')}
                            size='md'
                            accessibilityLabel={t('screen.home.settings')}
                        />
                    </View>
                </Stack>

                <Stack gap='lg' style={styles.list}>
                    {games.map((game) => {
                        const GameIcon = GAME_ICONS[game.iconName];
                        return (
                            <Card
                                key={game.id}
                                variant='elevated'
                                padding='lg'
                                onPress={() => navigation.navigate(game.setupRoute, { gameId: game.id })}
                                haptic='light'
                                accessibilityLabel={t(`game.${game.id}.name`)}
                            >
                                <Stack direction='horizontal' gap='lg' align='center'>
                                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        {GameIcon ? <Icon name={GameIcon} size={32} color={primary} /> : null}
                                    </View>
                                    <Stack gap='xs' flex={1}>
                                        <Text variant='subheading' weight='bold'>
                                            {game.emoji} {t(`game.${game.id}.name`)}
                                        </Text>
                                        <Text variant='caption' color='textSecondary' numberOfLines={2}>
                                            {t(`game.${game.id}.desc`)}
                                        </Text>
                                    </Stack>
                                    <Icon name={ChevronRight} size={20} color={theme.colors.textMuted} />
                                </Stack>
                            </Card>
                        );
                    })}
                </Stack>
            </ScrollView>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 40,
        gap: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        letterSpacing: -1,
    },
    list: {
        marginTop: 8,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
