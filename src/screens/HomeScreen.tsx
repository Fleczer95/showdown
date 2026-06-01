import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Settings, ChevronRight, ShoppingBag } from 'lucide-react-native';
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

    // Themed container style
    const contentContainerStyle = [
        styles.content,
        {
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xxl + theme.spacing.sm, // approx 40
            gap: theme.spacing.xxl,
        },
    ];

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView
                style={styles.root}
                contentContainerStyle={contentContainerStyle}
                showsVerticalScrollIndicator={false}
            >
                <Stack gap='md'>
                    <View style={styles.header}>
                        <Stack gap='xs' style={[styles.titleContainer, { paddingLeft: theme.spacing.xs }]}>
                            <Text variant='display' weight='bold' color='primary' style={styles.title}>
                                ShowDown
                            </Text>
                            <Text variant='subheading' color='textSecondary' weight='medium'>
                                {t('screen.home.tagline')}
                            </Text>
                        </Stack>
                        <View style={styles.headerActions}>
                            <IconButton
                                icon={<ShoppingBag size={24} color={theme.colors.text} />}
                                onPress={() => navigation.navigate('Store')}
                                size='md'
                                accessibilityLabel={t('screen.home.store')}
                            />
                            <IconButton
                                icon={<Settings size={24} color={theme.colors.text} />}
                                onPress={() => navigation.navigate('Settings')}
                                size='md'
                                accessibilityLabel={t('screen.home.settings')}
                            />
                        </View>
                    </View>
                </Stack>

                <Stack gap='lg' style={[styles.list, { marginTop: theme.spacing.sm }]}>
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
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            {
                                                backgroundColor: theme.colors.surfaceVariant,
                                                borderRadius: theme.radii.lg,
                                            },
                                        ]}
                                    >
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
        // padding/gap moved to themed style
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'column',
        gap: 8,
    },
    title: {
        letterSpacing: -1,
    },
    list: {
        // marginTop moved to themed style
    },
    iconContainer: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
