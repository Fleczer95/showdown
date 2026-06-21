import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Crown, Medal } from 'lucide-react-native';
import Text from './Text';
import Icon from './Icon';
import { useTheme } from '../../theme';
import { hexToRgba, RANK_MEDAL_COLORS } from '../../theme/colorUtils';
import { useResponsive } from '../../responsive/useResponsive';

/** Circular rank medallion: crown for 1st, medal for 2nd/3rd, the number otherwise. */
export default function RankBadge({ rank }: { rank: number }) {
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();
    const isTop3 = rank <= 3;
    const rankColor = isTop3 ? RANK_MEDAL_COLORS[rank as 1 | 2 | 3] : theme.colors.textMuted;

    return (
        <View
            style={[
                styles.badge,
                { width: scale(32), height: scale(32), borderRadius: scale(16) },
                isTop3 && { backgroundColor: hexToRgba(rankColor, 0.2) },
            ]}
        >
            {rank === 1 ? (
                <Icon name={Crown} size={iconSize(16)} color={rankColor} />
            ) : rank === 2 || rank === 3 ? (
                <Icon name={Medal} size={iconSize(16)} color={rankColor} />
            ) : (
                <Text variant="caption" weight="bold" color="textMuted">
                    {rank}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
