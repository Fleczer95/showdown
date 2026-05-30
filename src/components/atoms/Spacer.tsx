import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useSpacing } from '../../theme';

export type SpacerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type SpacerProp = SpacerSize | number;

export interface SpacerProps {
    size?: SpacerProp;
    direction?: 'vertical' | 'horizontal';
    flex?: number;
    testID?: string;
}

function Spacer({ size = 'md', direction = 'vertical', flex, testID }: SpacerProps) {
    const spacing = useSpacing();
    const resolvedSize = typeof size === 'number' ? size : spacing[size];

    const style = useMemo(
        () => ({
            ...(flex != null
                ? { flex }
                : direction === 'vertical'
                  ? { height: resolvedSize }
                  : { width: resolvedSize }),
        }),
        [flex, direction, resolvedSize],
    );

    return <View style={style} testID={testID} importantForAccessibility='no-hide-descendants' />;
}

export default React.memo(Spacer);
