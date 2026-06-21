import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Card from '../components/molecules/Card';
import Spacer from '../components/atoms/Spacer';
import IconButton from '../components/molecules/IconButton';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { useResponsive } from '../responsive/useResponsive';
import type { RootStackParamList } from '../navigation/types';

/**
 * Reusable screen for displaying legal documents (Privacy Policy, Terms of Use).
 * Content is fetched from translation files based on the route name.
 */
export function DocumentScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'privacyPolicy' | 'termsOfUse'>>();
    const { scale } = useResponsive();

    // Use route name as document key ('privacyPolicy' or 'termsOfUse')
    const documentKey = route.name;

    const contentOpacity = useSharedValue(0);
    const contentY = useSharedValue(16);

    useEffect(() => {
        contentOpacity.value = withTiming(1, { duration: 500 });
        contentY.value = withSpring(0, { damping: 22, stiffness: 100 });
    }, [contentOpacity, contentY]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateY: contentY.value }],
    }));

    const title = t(`screen.${documentKey}.title` as any);
    const subtitle = t(`screen.${documentKey}.subtitle` as any, { defaultValue: '' });
    const sections = t(`screen.${documentKey}.sections` as any, { returnObjects: true }) as any[];
    const lastUpdated = t(`screen.${documentKey}.lastUpdated` as any, { lastUpdated: '2026-05-31', defaultValue: '' });

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View
                style={[
                    styles.header,
                    { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
                ]}
            >
                <IconButton
                    icon={<ChevronLeft size={24} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.headerTitle} numberOfLines={1}>
                    {title}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingHorizontal: theme.spacing.xl, // approx 20
                        paddingBottom: theme.spacing.xxl + theme.spacing.sm, // approx 40
                    },
                ]}
            >
                <Animated.View style={animatedStyle}>
                    <Card
                        style={[
                            styles.contentCard,
                            { marginTop: theme.spacing.sm, padding: theme.spacing.xl },
                        ]}
                    >
                        {!!subtitle && (
                            <Text
                                variant='body'
                                color={theme.colors.textSecondary}
                                style={[styles.subtitle, { marginBottom: theme.spacing.lg }]}
                            >
                                {subtitle}
                            </Text>
                        )}

                        {Array.isArray(sections) &&
                            sections.map((section, index) => (
                                <View
                                    key={index}
                                    style={[styles.section, { marginTop: theme.spacing.lg, gap: theme.spacing.sm }]}
                                >
                                    <Text variant='body' weight='bold' color={theme.colors.text}>
                                        {section.title}
                                    </Text>
                                    <Text variant='body' color={theme.colors.textSecondary}>
                                        {section.content}
                                    </Text>
                                    {section.listItems && (
                                        <View
                                            style={[
                                                styles.list,
                                                { gap: theme.spacing.xs, marginLeft: theme.spacing.sm },
                                            ]}
                                        >
                                            {section.listItems.map((item: string, itemIndex: number) => (
                                                <Text
                                                    key={itemIndex}
                                                    variant='body'
                                                    color={theme.colors.textSecondary}
                                                >
                                                    • {item}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))}

                        {!!lastUpdated && (
                            <Text
                                variant='caption'
                                color={theme.colors.textMuted}
                                style={[styles.lastUpdated, { marginTop: theme.spacing.xxl }]}
                            >
                                {lastUpdated}
                            </Text>
                        )}
                    </Card>
                </Animated.View>
                <Spacer size='xxl' />
            </ScrollView>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        // dynamic spacing moved
    },
    contentCard: {
        // dynamic spacing moved
    },
    subtitle: {
        // dynamic spacing moved
    },
    section: {
        // dynamic spacing moved
    },
    list: {
        // dynamic spacing moved
    },
    lastUpdated: {
        textAlign: 'center',
    },
});
