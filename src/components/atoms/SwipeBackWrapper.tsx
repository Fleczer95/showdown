import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { runOnJS } from 'react-native-reanimated';
import { useResponsive } from '../../responsive/useResponsive';

// How close to a screen edge a swipe must *start* to count as a back gesture.
// Gating on the origin keeps mid-screen horizontal scrolls (category strips,
// sliders, carousels) from ever qualifying as "back". A density-independent dp
// zone (not a % of width) so the catch area stays a thumb-width everywhere;
// scaled up modestly on tablets where the device is held more loosely.
const EDGE_PHONE = 48;
const EDGE_TABLET = 72;

interface SwipeBackWrapperProps {
    children: React.ReactNode;
    /**
     * Enables swiping left (right-to-left) to go back, in addition to the
     * standard right swipe. Off by default — opt in only on screens that
     * already show a back button, so the extra direction doesn't collide
     * with horizontal content on screens where "back" is ambiguous.
     */
    enableLeftSwipe?: boolean;
}

export default function SwipeBackWrapper({ children, enableLeftSwipe = false }: SwipeBackWrapperProps) {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const { scale } = useResponsive();
    const edgeWidth = scale(EDGE_PHONE, EDGE_TABLET);

    const handleGoBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    }, [navigation]);

    // Rebuilt only when the inputs the worklet reads change — this wrapper sits on
    // every screen (via SafeContainer), so a fresh gesture per render would force
    // gesture-handler to reconcile a new object on every screen re-render.
    const panGesture = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-20, 20])
                .onEnd((e) => {
                    // Where the gesture began (absolute current pos minus how far it travelled).
                    const startX = e.absoluteX - e.translationX;
                    // Right swipe (standard): must start from the left edge.
                    if (startX <= edgeWidth && e.translationX > 50 && e.velocityX > 300) {
                        runOnJS(handleGoBack)();
                    }
                    // Left swipe (opt-in): must start from the right edge.
                    else if (
                        enableLeftSwipe &&
                        startX >= width - edgeWidth &&
                        e.translationX < -50 &&
                        e.velocityX < -300
                    ) {
                        runOnJS(handleGoBack)();
                    }
                }),
        [edgeWidth, width, enableLeftSwipe, handleGoBack],
    );

    return (
        <GestureDetector gesture={panGesture}>
            {children}
        </GestureDetector>
    );
}
