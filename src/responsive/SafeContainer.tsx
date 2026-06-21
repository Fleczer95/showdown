import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useBlur } from '../theme';
import { ThemeEffects } from '../theme/ThemeEffects';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import SwipeBackWrapper from '../components/atoms/SwipeBackWrapper';

interface SafeContainerProps {
    children: React.ReactNode;
    style?: View['props']['style'];
    testID?: string;
    edges?: ('top' | 'right' | 'bottom' | 'left')[];
    disableEffects?: boolean;
    /**
     * Enables swipe gestures to go back.
     * Default: true. Disable if it interferes with swipable child components.
     */
    enableSwipeBack?: boolean;
    /**
     * Also allow swiping left (right-to-left) to go back. Default: false.
     * Enable on screens that already show a back button.
     */
    enableLeftSwipe?: boolean;
}

function SafeContainer({
    children,
    style,
    testID,
    edges = ['top', 'right', 'bottom', 'left'],
    disableEffects = false,
    enableSwipeBack = true,
    enableLeftSwipe = false,
}: SafeContainerProps) {
    const insets = useSafeAreaInsets();
    const t = useTheme();
    const { isBlurry } = useBlur();

    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isBlurry ? 0.3 : 1, { duration: 600 }),
        transform: [{ scale: withTiming(isBlurry ? 0.95 : 1, { duration: 600 }) }],
    }));

    const content = (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: t.colors.background,
                    paddingTop: edges.includes('top') ? insets.top : 0,
                    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
                    paddingLeft: edges.includes('left') ? insets.left : 0,
                    paddingRight: edges.includes('right') ? insets.right : 0,
                },
                style,
            ]}
            testID={testID}
        >
            {!disableEffects && <ThemeEffects />}
            <Animated.View style={[styles.content, animatedContentStyle]}>
                {children}
            </Animated.View>
        </View>
    );

    if (!enableSwipeBack) {
        return content;
    }

    return (
        <SwipeBackWrapper enableLeftSwipe={enableLeftSwipe}>
            {content}
        </SwipeBackWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});

export default React.memo(SafeContainer);
