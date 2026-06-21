import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Text from '../atoms/Text';
import Stack from '../atoms/Stack';
import Button from './Button';
import Card from './Card';
import { useTranslation } from '../../i18n/TranslationContext';
import { useBlur } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, Easing } from 'react-native-reanimated';

export type LeaveConfirmGameKey = 'the-ladder' | 'the-grid' | 'the-drop' | 'the-wheel';

interface LeaveConfirmModalProps {
    visible: boolean;
    gameKey: LeaveConfirmGameKey;
    /** Run the real exit. */
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Confirmation shown before leaving an in-progress game, so a stray tap on the
 * leave control doesn't abandon the run. Copy comes from each game's
 * `active.leave{Confirm,Cancel,Ok}` strings.
 */
function LeaveConfirmModal({ visible, gameKey, onConfirm, onCancel }: LeaveConfirmModalProps) {
    const { t } = useTranslation();
    const { setIsBlurry } = useBlur();
    const { scale } = useResponsive();
    const base = `game.${gameKey}.active`;

    useEffect(() => {
        if (visible) {
            setIsBlurry(true);
        }
        return () => {
            setIsBlurry(false);
        };
    }, [visible, setIsBlurry]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType='none'
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

                {/* Swallow taps on the card so they don't dismiss via the backdrop. */}
                <Animated.View
                    entering={ZoomIn.duration(600).easing(Easing.bezier(0.33, 1, 0.68, 1))}
                    exiting={ZoomOut.duration(300)}
                    style={[styles.cardWrap, { maxWidth: scale(360) }]}
                >
                    <Card variant='glass' padding='xl' gap='xl'>
                        <Stack gap='xl'>
                            <Text variant='subheading' weight='bold' align='center'>
                                {t(`${base}.leaveConfirm`)}
                            </Text>
                            <Stack gap='sm' align='stretch'>
                                <Button variant='primary' fullWidth onPress={onCancel}>
                                    {t(`${base}.leaveCancel`)}
                                </Button>
                                <Button variant='ghost' fullWidth onPress={onConfirm}>
                                    {t(`${base}.leaveOk`)}
                                </Button>
                            </Stack>
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
});

export default React.memo(LeaveConfirmModal);
