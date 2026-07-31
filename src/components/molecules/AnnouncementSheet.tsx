import React from 'react';
import { View, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import { Mascot } from '../../game/mascot/Mascot';
import { getEquippedLook } from '../../game/mascot/equippedLook';
import { useResponsive } from '../../responsive/useResponsive';
import { useTheme } from '../../theme';

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
    /** Fires once the sheet has finished animating away and is gone. */
    onDismissComplete?: () => void;
    testID?: string;
}

/**
 * The mascot's speech bubble, tail pointing down at the fox below it — the same
 * shape the host uses on Home, so the sheet reads as the mascot talking rather
 * than the app announcing. Sits on `surfaceVariant` because the sheet itself is
 * already `surface`.
 *
 * The tail must meet a straight run of the bubble's edge. Stacked above the fox
 * the bubble is wide, so its bottom edge has plenty of straight run between the
 * `radii.xl` corners. Beside the fox it does not: a single-line bubble is only
 * ~55px tall, so a 24px radius rounds the whole left edge away and the tail's
 * rotated square strands itself outside the outline.
 */
function SpeechBubble({ text }: { text: string }) {
    const theme = useTheme();

    return (
        <View
            style={[
                styles.bubble,
                {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.borderLight,
                    borderRadius: theme.radii.xl,
                    shadowColor: theme.colors.shadow,
                },
            ]}
        >
            <Text variant='subheading' weight='bold' align='center'>
                {text}
            </Text>
            <View
                style={[
                    styles.bubbleTail,
                    {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.borderLight,
                    },
                ]}
            />
        </View>
    );
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
    onDismissComplete,
    testID,
}: AnnouncementSheetProps) {
    const { scale } = useResponsive();

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            onDismissComplete={onDismissComplete}
            testID={testID}
            scrollable
        >
            <Stack gap='lg' align='center'>
                {/* The fox asks; the sheet answers below. */}
                <Stack gap='md' align='center'>
                    <SpeechBubble text={title} />
                    <View pointerEvents='none'>
                        <Mascot look={getEquippedLook()} pose='cheer' size={scale(110)} expression='happy' />
                    </View>
                </Stack>

                {body ? (
                    <Text variant='body' color='textSecondary' align='center'>
                        {body}
                    </Text>
                ) : null}

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

                <Stack gap='sm' align='stretch' style={styles.fullWidth}>
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
    bubble: {
        borderWidth: 1,
        maxWidth: 300,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    // A rotated square peeking out of the bubble's bottom edge. At 45° the
    // bottom-right corner points down, so only those two borders are drawn and
    // the inner half is hidden by the bubble's own fill — it reads as a tail.
    bubbleTail: {
        position: 'absolute',
        alignSelf: 'center',
        width: 14,
        height: 14,
        bottom: -8,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        transform: [{ rotate: '45deg' }],
    },
    // Let long highlight copy wrap instead of pushing the emoji off the row.
    highlightLabel: {
        flex: 1,
    },
});

export default React.memo(AnnouncementSheet);
