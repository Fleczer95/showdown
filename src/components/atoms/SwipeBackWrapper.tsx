import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { runOnJS } from 'react-native-reanimated';

interface SwipeBackWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    /** 
     * If true, enables swiping left to go back (in addition to right). 
     * Included since the request mentioned "swiping screen left".
     */
    enableLeftSwipe?: boolean;
}

export default function SwipeBackWrapper({ children, style, enableLeftSwipe = true }: SwipeBackWrapperProps) {
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
            // Left swipe (based on prompt request)
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
