import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Text from '../atoms/Text';
import Stack from '../atoms/Stack';
import Button from './Button';
import Card from './Card';
import { useTranslation } from '../../i18n/TranslationContext';

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
    const base = `game.${gameKey}.active`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType='fade'
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <Pressable style={styles.backdrop} onPress={onCancel}>
                {/* Swallow taps on the card so they don't dismiss via the backdrop. */}
                <Pressable style={styles.cardWrap} onPress={() => {}}>
                    <Card variant='elevated' padding='lg'>
                        <Stack gap='lg'>
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
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    cardWrap: {
        width: '100%',
        maxWidth: 360,
    },
});

export default React.memo(LeaveConfirmModal);
