import React from 'react';
import { View, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import { Mascot } from '../../game/mascot/Mascot';
import { getEquippedLook } from '../../game/mascot/equippedLook';
import { useResponsive } from '../../responsive/useResponsive';

export interface AnnouncementHighlight {
    emoji: string;
    label: string;
}

export interface AnnouncementSheetProps {
    visible: boolean;
    title: string;
    /** One short paragraph. Used by the update sheet; the what's-new sheet uses highlights instead. */
    body?: string;
    highlights?: AnnouncementHighlight[];
    ctaLabel: string;
    onPressCta: () => void;
    /** When set, renders an explicit dismiss button below the CTA. */
    dismissLabel?: string;
    onClose: () => void;
    testID?: string;
}

/**
 * The shared sheet for both once-per-version announcements: "an update is
 * available" (body + Update / Not now) and "what's new" (highlights + Let's
 * play). Purely presentational — the caller owns every decision about whether,
 * when, and how often this appears.
 *
 * BottomSheet already provides backdrop-tap, drag-down and Android-back
 * dismissal; `dismissLabel` adds the explicit button players look for.
 */
function AnnouncementSheet({
    visible,
    title,
    body,
    highlights,
    ctaLabel,
    onPressCta,
    dismissLabel,
    onClose,
    testID,
}: AnnouncementSheetProps) {
    const { scale } = useResponsive();

    return (
        <BottomSheet visible={visible} onClose={onClose} testID={testID} scrollable>
            <Stack gap='lg' align='center'>
                <View pointerEvents='none'>
                    <Mascot look={getEquippedLook()} pose='cheer' size={scale(120)} expression='happy' />
                </View>

                <Stack gap='xs' align='center'>
                    <Text variant='subheading' weight='bold' align='center'>
                        {title}
                    </Text>
                    {body ? (
                        <Text variant='body' color='textSecondary' align='center'>
                            {body}
                        </Text>
                    ) : null}
                </Stack>

                {highlights?.length ? (
                    <Stack gap='md' style={styles.fullWidth}>
                        {highlights.map((highlight) => (
                            <Stack key={highlight.label} direction='horizontal' gap='md' align='center'>
                                <Text variant='subheading'>{highlight.emoji}</Text>
                                <View style={styles.highlightLabel}>
                                    <Text variant='body' color='textSecondary'>
                                        {highlight.label}
                                    </Text>
                                </View>
                            </Stack>
                        ))}
                    </Stack>
                ) : null}

                <Stack gap='sm' align='center' style={styles.fullWidth}>
                    <Button variant='primary' fullWidth onPress={onPressCta}>
                        {ctaLabel}
                    </Button>
                    {dismissLabel ? (
                        <Button variant='ghost' fullWidth onPress={onClose}>
                            {dismissLabel}
                        </Button>
                    ) : null}
                </Stack>
            </Stack>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    fullWidth: {
        width: '100%',
    },
    // Let long highlight copy wrap instead of pushing the emoji off the row.
    highlightLabel: {
        flex: 1,
    },
});

export default React.memo(AnnouncementSheet);
