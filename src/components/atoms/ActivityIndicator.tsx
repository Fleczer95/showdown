import React from 'react';
import { ActivityIndicator as RNActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import type { ColorToken } from '../../theme';

export interface ActivityIndicatorProps {
    size?: 'sm' | 'md' | 'lg' | number;
    color?: ColorToken | string;
    /** Hide the indicator when not animating */
    hidesWhenStopped?: boolean;
    testID?: string;
    accessibilityLabel?: string;
}

const presetSizes = { sm: 'small' as const, md: 20 as const, lg: 'large' as const };

function ActivityIndicator({
    size = 'md',
    color,
    hidesWhenStopped,
    testID,
    accessibilityLabel,
}: ActivityIndicatorProps) {
    const t = useTheme();
    const resolvedSize = typeof size === 'number' ? size : presetSizes[size];
    const resolvedColor = color ? (color in t.colors ? t.colors[color as ColorToken] : color) : t.colors.primary;

    return (
        <RNActivityIndicator
            size={resolvedSize}
            color={resolvedColor}
            hidesWhenStopped={hidesWhenStopped}
            testID={testID}
            accessibilityLabel={accessibilityLabel ?? 'Loading'}
        />
    );
}

export default React.memo(ActivityIndicator);
