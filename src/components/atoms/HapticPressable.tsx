import React from 'react';
import { Pressable as RNPressable, View, PressableAndroidRippleConfig } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useAnimationPresets } from '../../theme';
import { useHaptics } from '../../hooks/useHaptics';

type HapticLevel = 'light' | 'medium' | 'heavy' | 'none';

export interface PressableProps {
    children: React.ReactNode;
    style?: View['props']['style'];
    onPress?: () => void;
    onLongPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    haptic?: HapticLevel;
    disabled?: boolean;
    testID?: string;
    accessibilityLabel?: string;
    accessibilityRole?: typeof RNPressable.prototype.props.accessibilityRole;
    accessibilityHint?: string;
    accessibilityState?: {
        disabled?: boolean;
        busy?: boolean;
        checked?: boolean;
        expanded?: boolean;
        selected?: boolean;
    };
    hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
    android_ripple?: PressableAndroidRippleConfig;
    delayLongPress?: number;
}

function Pressable({
    children,
    style,
    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    haptic = 'none',
    disabled,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityHint,
    accessibilityState,
    hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
    android_ripple,
    delayLongPress,
}: PressableProps) {
    const { press, spring } = useAnimationPresets();
    const pressed = useSharedValue(false);
    const haptics = useHaptics();

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: withSpring(pressed.value ? press.scale : 1, spring as never),
            },
        ],
        opacity: withTiming(disabled ? 0.5 : pressed.value ? 0.8 : 1, { duration: press.duration }),
    }));

    const handlePressIn = () => {
        pressed.value = true;
        if (haptic !== 'none') haptics[haptic]();
        onPressIn?.();
    };

    const handlePressOut = () => {
        pressed.value = false;
        onPressOut?.();
    };

    return (
        <RNPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={disabled ? undefined : onPress}
            onLongPress={disabled ? undefined : onLongPress}
            disabled={disabled}
            delayLongPress={delayLongPress}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole ?? 'button'}
            accessibilityHint={accessibilityHint}
            accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
            hitSlop={hitSlop}
            {...(android_ripple ? { android_ripple } : {})}
        >
            <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
        </RNPressable>
    );
}

export default React.memo(Pressable);

/** @deprecated Use Pressable with haptic='light'|'medium'|'heavy' instead */
export { Pressable as HapticPressable };
