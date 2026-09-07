import React from 'react';
import { View } from 'react-native';
import BottomSheet from '../../components/molecules/BottomSheet';
import Card from '../../components/molecules/Card';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import { useTranslation } from '../../i18n';
import { getEntryForId } from '../../data/store/catalog';
import { PROGRESSION_THEMES } from '../progression/themes';
import { PROGRESSION_MASCOT_COLORS } from '../progression/mascotColors';
import { Mascot } from '../mascot/Mascot';
import { getEquippedLook } from '../mascot/equippedLook';
import { eventRewardTitleKey } from './access';

/** Preview uses the permanent definition/asset, never the edition's temporary theme. */
export function EventRewardPreview({ rewardId, onClose }: { rewardId: string | null; onClose: () => void }) {
    const { t } = useTranslation();
    const id = rewardId ?? '';
    const entry = getEntryForId(id);
    const tokens =
        PROGRESSION_THEMES.find((theme) => theme.id === id)?.tokens ??
        (entry?.kind === 'theme' ? entry.tokens : undefined);
    const colors = tokens?.colors;
    const color = PROGRESSION_MASCOT_COLORS.find((c) => c.id === id);
    const look = { ...getEquippedLook() };
    if (color) look[color.slot] = color.colorId;
    if (entry?.kind === 'mascotSkin') {
        for (const colorId of entry.unlocks) {
            const slot = colorId.split('.')[0];
            if (slot === 'fur' || slot === 'suit' || slot === 'accent' || slot === 'mic') look[slot] = colorId;
        }
    }
    return (
        <BottomSheet
            visible={rewardId !== null}
            onClose={onClose}
            title={t(eventRewardTitleKey(id) ?? 'events.preview')}
        >
            <Stack gap='md' align='center'>
                {colors ? (
                    <Card padding='lg' gap='md' style={{ backgroundColor: colors.background, width: '100%' }}>
                        <Text color={colors.text} variant='heading'>
                            {t(eventRewardTitleKey(id)!)}
                        </Text>
                        <View pointerEvents='none' style={{ flexDirection: 'row', gap: 12 }}>
                            {[colors.primary, colors.secondary, colors.surface].map((color, i) => (
                                <View
                                    key={i}
                                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color }}
                                />
                            ))}
                        </View>
                    </Card>
                ) : null}
                {color || entry?.kind === 'mascotSkin' ? <Mascot look={look} pose='cheer' size={160} /> : null}
                {entry ? <Text align='center'>{t(entry.presentation.descriptionKey)}</Text> : null}
                <Text align='center' color='textSecondary'>
                    {t('events.permanentPrize')}
                </Text>
            </Stack>
        </BottomSheet>
    );
}
