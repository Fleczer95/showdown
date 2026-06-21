import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable as RNPressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, Easing, useReducedMotion } from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import Text from '../atoms/Text';
import Stack from '../atoms/Stack';
import Pressable from '../atoms/HapticPressable';
import Button from './Button';
import Card from './Card';
import { useTranslation } from '../../i18n/TranslationContext';
import { useTheme, useBlur } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

interface ReviewPromptModalProps {
    visible: boolean;
    /** Player gave 5 stars — hand off to the native review sheet. */
    onRate: () => void;
    /** Player gave 1–4 stars, tapped "Maybe later", or dismissed via the backdrop. */
    onDismiss: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Soft pre-prompt shown before the native store-review sheet. Appearing at level
 * milestones (see services/review/reviewPrompt), it asks for sentiment first so we
 * only spend the OS-throttled native sheet on players who tap 5 stars — and gives us
 * a real "later" signal (1–4 stars / dismiss) the native API never exposes.
 */
function ReviewPromptModal({ visible, onRate, onDismiss }: ReviewPromptModalProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const { setIsBlurry } = useBlur();
    const { scale, iconSize } = useResponsive();
    const reduceMotion = useReducedMotion();
    const [rating, setRating] = useState(0);
    const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            setIsBlurry(true);
            setRating(0);
        }
        return () => {
            setIsBlurry(false);
        };
    }, [visible, setIsBlurry]);

    useEffect(() => () => clearActionTimer(), []);

    const clearActionTimer = () => {
        if (actionTimer.current) clearTimeout(actionTimer.current);
        actionTimer.current = null;
    };

    // Fill the stars up to the tap, let the choice register for a beat, then route:
    // 5 stars → native sheet; anything lower is treated as "maybe later".
    const handleRate = (value: number) => {
        setRating(value);
        clearActionTimer();
        actionTimer.current = setTimeout(() => (value >= 5 ? onRate() : onDismiss()), 280);
    };

    const starSize = iconSize(36);

    return (
        <Modal
            visible={visible}
            transparent
            animationType='none'
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
                <RNPressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

                {/* Swallow taps on the card so they don't dismiss via the backdrop. */}
                <Animated.View
                    entering={ZoomIn.duration(600).easing(Easing.bezier(0.33, 1, 0.68, 1))}
                    exiting={ZoomOut.duration(300)}
                    style={[styles.cardWrap, { maxWidth: scale(360) }]}
                >
                    <Card variant='glass' padding='xl' gap='xl'>
                        <Stack gap='lg' align='center'>
                            {/* Tappable five-star rating — pops in left→right, fills on tap. */}
                            <Stack direction='horizontal' gap='xs' align='center' justify='center'>
                                {STARS.map((value, i) => {
                                    const filled = value <= rating;
                                    return (
                                        <Animated.View
                                            key={value}
                                            entering={
                                                reduceMotion
                                                    ? undefined
                                                    : ZoomIn.delay(120 + i * 90)
                                                          .duration(320)
                                                          .easing(Easing.bezier(0.34, 1.56, 0.64, 1))
                                            }
                                        >
                                            <Pressable
                                                haptic='light'
                                                onPress={() => handleRate(value)}
                                                accessibilityRole='button'
                                                accessibilityLabel={t('review.starLabel', { n: value })}
                                                style={styles.star}
                                            >
                                                <Star
                                                    size={starSize}
                                                    color={filled ? theme.colors.primary : theme.colors.textMuted}
                                                    fill={filled ? theme.colors.primary : 'transparent'}
                                                    strokeWidth={1.5}
                                                />
                                            </Pressable>
                                        </Animated.View>
                                    );
                                })}
                            </Stack>

                            <Stack gap='xs' align='center'>
                                <Text variant='subheading' weight='bold' align='center'>
                                    {t('review.title')}
                                </Text>
                                <Text variant='body' color='textSecondary' align='center'>
                                    {t('review.body')}
                                </Text>
                                <Text variant='caption' color='textMuted' align='center'>
                                    {t('review.hint')}
                                </Text>
                            </Stack>

                            <Button variant='ghost' fullWidth onPress={onDismiss}>
                                {t('review.later')}
                            </Button>
                        </Stack>
                    </Card>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    cardWrap: {
        width: '100%',
        maxWidth: 360,
    },
    star: {
        padding: 4,
    },
});

export default React.memo(ReviewPromptModal);
