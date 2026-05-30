import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, useAnimationPresets } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface SwitchProps {
    value: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    haptic?: 'light' | 'medium' | 'heavy';
    testID?: string;
    accessibilityLabel?: string;
}

// Phone baselines; scaled fluidly per device below.
const THUMB_SIZE = 24;
const TRACK_HEIGHT = 30;
const TRACK_PADDING = 3;

function Switch({ value, onValueChange, disabled = false, haptic = 'light', testID, accessibilityLabel }: SwitchProps) {
    const t = useTheme();
    const { spring } = useAnimationPresets();
    const { scale } = useResponsive();

    const thumbSize = scale(THUMB_SIZE);
    const trackHeight = scale(TRACK_HEIGHT);
    const trackPadding = scale(TRACK_PADDING);
    const slideDistance = thumbSize + trackPadding;

    const offset = useSharedValue(value ? slideDistance : 0);

    React.useEffect(() => {
        offset.value = withSpring(value ? slideDistance : 0, spring);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, slideDistance]);

    const hapticMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(hapticMap[haptic]);
        onValueChange?.(!value);
    };

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value }],
    }));

    const trackBg = disabled ? t.colors.surfaceVariant : value ? t.colors.primary : t.colors.border;

    const containerStyle = useMemo(
        () => [
            styles.track,
            {
                width: thumbSize * 2 + trackPadding,
                height: trackHeight,
                borderRadius: trackHeight / 2,
                paddingStart: trackPadding,
                backgroundColor: trackBg,
                opacity: disabled ? 0.5 : 1,
            },
        ],
        [trackBg, disabled, thumbSize, trackHeight, trackPadding],
    );

    return (
        <Animated.View
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole='switch'
            accessibilityState={{ checked: value, disabled }}
            accessible={true}
            style={containerStyle}
            onStartShouldSetResponder={() => !disabled}
            onResponderRelease={handlePress}
        >
            <Animated.View
                style={[
                    styles.thumb,
                    t.shadows.sm,
                    {
                        width: thumbSize,
                        height: thumbSize,
                        borderRadius: thumbSize / 2,
                        backgroundColor: t.colors.onPrimary,
                    },
                    thumbStyle,
                ]}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    track: {
        justifyContent: 'center',
    },
    thumb: {
        justifyContent: 'center',
    },
});

export default React.memo(Switch);
