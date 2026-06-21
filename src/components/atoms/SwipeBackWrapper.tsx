import React from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { runOnJS } from 'react-native-reanimated';

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

    const handleGoBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((e) => {
            // Right swipe (standard)
            if (e.translationX > 50 && e.velocityX > 300) {
                runOnJS(handleGoBack)();
            }
            // Left swipe (opt-in)
            else if (enableLeftSwipe && e.translationX < -50 && e.velocityX < -300) {
                runOnJS(handleGoBack)();
            }
        });

    return (
        <GestureDetector gesture={panGesture}>
            {children}
        </GestureDetector>
    );
}
