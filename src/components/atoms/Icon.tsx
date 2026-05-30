import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';

export interface IconProps {
    /** The Lucide icon component to render */
    name: LucideIcon;
    /** Size of the icon */
    size?: number;
    /** Color of the icon */
    color?: string;
    /** Optional container style */
    containerStyle?: ViewStyle | ViewStyle[];
    /** Background color for the icon container */
    backgroundColor?: string;
    /** Border radius for the icon container */
    borderRadius?: number;
    /** Padding for the icon container */
    padding?: number;
}

/**
 * Standardized Icon component that handles touch event propagation safety.
 * Always sets pointerEvents="none" to ensure parent Pressables receive touches.
 */
const Icon = ({
    name: IconComponent,
    size = 24,
    color,
    containerStyle,
    backgroundColor,
    borderRadius,
    padding,
}: IconProps) => {
    const t = useTheme();
    const finalColor = color || t.colors.text;

    return (
        <View
            pointerEvents='none'
            style={[
                styles.container,
                backgroundColor ? { backgroundColor } : null,
                borderRadius !== undefined ? { borderRadius } : null,
                padding !== undefined ? { padding } : null,
                containerStyle,
            ]}
        >
            <IconComponent size={size} color={finalColor} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(Icon);
