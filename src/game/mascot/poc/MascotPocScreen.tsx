import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import SafeContainer from '../../../responsive/SafeContainer';
import Text from '../../../components/atoms/Text';
import Stack from '../../../components/atoms/Stack';
import Button from '../../../components/molecules/Button';
import { useTheme } from '../../../theme';
import { MascotPoc } from './MascotPoc';
import { POC_PALETTE, DEFAULT_LOOK, type LookMap, type MascotPose, type MascotSlot } from './palette';

const POSES: MascotPose[] = ['intro', 'idle', 'cheer', 'dismay'];
const SLOTS: MascotSlot[] = ['fur', 'suit', 'accent', 'mic'];

/**
 * THROWAWAY PoC harness (plan §2 Sequencing Gate). Lets a tester on a real device
 * exercise the recolor seam (per-slot swatch override) and the four pose
 * transitions, then judge smoothness + read the path/node budget. Delete with the
 * rest of `src/game/mascot/poc/` once the gate is verified.
 */
export function MascotPocScreen() {
    const theme = useTheme();
    const [look, setLook] = useState<LookMap>(DEFAULT_LOOK);
    const [pose, setPose] = useState<MascotPose>('idle');

    const setSlot = (slot: MascotSlot, colorId: string) => setLook((prev) => ({ ...prev, [slot]: colorId }));

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
                <Text variant='heading' weight='bold'>
                    Mascot PoC — recolor + pose gate
                </Text>

                <View style={[styles.stage, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl }]}>
                    <MascotPoc look={look} pose={pose} size={220} />
                </View>

                {/* Pose switcher — re-tap to replay a one-shot pose. */}
                <Stack gap='sm'>
                    <Text variant='caption' color='textSecondary' weight='bold'>
                        POSE
                    </Text>
                    <View style={styles.row}>
                        {POSES.map((p) => (
                            <View key={p} style={styles.cell}>
                                <Button
                                    variant={pose === p ? 'primary' : 'secondary'}
                                    fullWidth
                                    onPress={() => {
                                        // Force re-fire even when re-selecting the active pose.
                                        setPose('idle');
                                        requestAnimationFrame(() => setPose(p));
                                    }}
                                >
                                    {p}
                                </Button>
                            </View>
                        ))}
                    </View>
                </Stack>

                {/* Per-slot recolor — the fill-override seam. */}
                {SLOTS.map((slot) => (
                    <Stack key={slot} gap='sm'>
                        <Text variant='caption' color='textSecondary' weight='bold'>
                            {slot.toUpperCase()}
                        </Text>
                        <View style={styles.row}>
                            {POC_PALETTE[slot].map((sw) => {
                                const selected = look[slot] === sw.id;
                                return (
                                    <Pressable
                                        key={sw.id}
                                        onPress={() => setSlot(slot, sw.id)}
                                        style={[
                                            styles.swatch,
                                            {
                                                backgroundColor: sw.hex,
                                                borderColor: selected ? theme.colors.text : 'transparent',
                                                borderRadius: theme.radii.md,
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </Stack>
                ))}
            </ScrollView>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    stage: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    cell: {
        flex: 1,
    },
    swatch: {
        width: 52,
        height: 52,
        borderWidth: 3,
    },
});
