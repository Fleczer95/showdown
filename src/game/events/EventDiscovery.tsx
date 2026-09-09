import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import Pressable from '../../components/atoms/HapticPressable';
import Icon from '../../components/atoms/Icon';
import Text from '../../components/atoms/Text';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useResponsive } from '../../responsive/useResponsive';
import { visibleEvents, eventDiscoveryPhase, DAY_MS } from './catalogue';
import { EventArtwork } from './EventArtwork';
import { useEventNow } from './useEventNow';

const HALLOWEEN_CARD = { surface: '#191C32', text: '#FFF4DF', secondary: '#FFCE9B' };

/** Lives inside Home's inset content column, not edge-to-edge outside it. */
export function EventDiscovery() {
    const navigation = useNavigation();
    const { t, locale } = useTranslation();
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();
    const now = useEventNow();
    const editions = visibleEvents(now);
    if (!editions.length) return null;
    return (
        <View testID='event-discovery' style={{ gap: theme.spacing.md }}>
            {editions.map((edition) => {
                const phase = eventDiscoveryPhase(edition, now);
                const days = Math.ceil((edition.startsAt! - now) / DAY_MS);
                const subtitle =
                    phase === 'upcoming'
                        ? days > 1
                            ? t('events.startsInDays', { count: days })
                            : t('events.startsSoon')
                        : phase === 'closed'
                          ? t('events.viewResults')
                          : t('events.play');
                const accent = edition.accent ?? theme.colors.primary;
                const pumpkin = edition.artwork === 'pumpkin';
                const colors = pumpkin
                    ? HALLOWEEN_CARD
                    : { surface: theme.colors.surface, text: theme.colors.text, secondary: theme.colors.textSecondary };
                return (
                    <Pressable
                        key={edition.id}
                        testID={`event-discovery-${edition.id}`}
                        accessibilityLabel={`${edition.name[locale]}. ${subtitle}`}
                        haptic='light'
                        onPress={() => navigation.navigate('EventHub', { editionId: edition.id })}
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.surface,
                                borderColor: hexToRgba(accent, 0.7),
                                borderRadius: theme.radii.xl,
                                paddingHorizontal: theme.spacing.lg,
                                paddingVertical: theme.spacing.md,
                                minHeight: scale(80),
                            },
                        ]}
                    >
                        <View pointerEvents='none' style={[styles.row, { gap: theme.spacing.md }]}>
                            <EventArtwork artwork={edition.artwork} accent={accent} size={iconSize(56)} />
                            <View style={styles.copy}>
                                <Text variant='subheading' weight='bold' color={colors.text}>
                                    {edition.name[locale]}
                                </Text>
                                <Text variant='caption' color={colors.secondary}>
                                    {subtitle}
                                </Text>
                            </View>
                            <Icon name={ChevronRight} size={iconSize(22)} color={accent} />
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { width: '100%', borderWidth: 1 },
    row: { flexDirection: 'row', alignItems: 'center' },
    copy: { flex: 1, minWidth: 0 },
});
