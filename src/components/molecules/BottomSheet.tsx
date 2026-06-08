import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Text from '../atoms/Text';
import Spacer from '../atoms/Spacer';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface BottomSheetProps {
    visible: boolean;
    onClose?: () => void;
    title?: string;
    children?: React.ReactNode;
    scrollable?: boolean;
    /** Enable drag-to-dismiss gesture (default: true) */
    draggable?: boolean;
    /** Fixed height in px */
    height?: number;
    testID?: string;
}

const DISMISS_THRESHOLD = 150;

function BottomSheet({
    visible,
    onClose,
    title,
    children,
    scrollable = false,
    draggable = true,
    height,
    testID,
}: BottomSheetProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const { scale, contentMaxWidth } = useResponsive();

    // Fluid chrome so the handle / close affordance keep pace on tablet.
    const closeSize = scale(28);
    const handleSize = { width: scale(40), height: scale(5), borderRadius: scale(2.5) };

    const translateY = useSharedValue(500);
    const opacity = useSharedValue(0);
    const contextY = useSharedValue(0);

    const handleDismiss = useCallback(() => {
        translateY.value = withTiming(500, { duration: 250 });
        opacity.value = withTiming(0, { duration: 200 });
        if (onClose) setTimeout(onClose, 250);
    }, [onClose, translateY, opacity]);

    // Animate in
    useEffect(() => {
        if (visible) {
            // Using a nicer spring for the entry
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 120,
                mass: 0.8,
            });
            opacity.value = withTiming(1, { duration: 250 });
        } else {
            handleDismiss();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, handleDismiss]);

    // Android back button
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleDismiss();
            return true;
        });
        return () => sub.remove();
    }, [visible, handleDismiss]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const panGesture = Gesture.Pan()
        .enabled(draggable)
        // Only claim the gesture after a deliberate downward drag. This lets an
        // inner ScrollView handle upward scrolls (e.g. scrolling down to the buy
        // button on short devices) instead of the sheet hijacking every touch.
        .activeOffsetY(15)
        .onStart((e) => {
            contextY.value = e.translationY;
        })
        .onUpdate((e) => {
            // Only allow dragging down
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DISMISS_THRESHOLD) {
                runOnJS(handleDismiss)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    if (!visible) return null;

    return (
        <Animated.View
            style={[styles.overlay, overlayStyle, { backgroundColor: t.colors.overlay, zIndex: t.zIndex.sheet }]}
            testID={testID}
            accessibilityViewIsModal={true}
            onAccessibilityEscape={onClose}
        >
            <View style={styles.touchable} onStartShouldSetResponder={() => true} />
            {/* Tap overlay to dismiss */}
            <View style={styles.touchableDismiss} onStartShouldSetResponder={() => true} onTouchEnd={handleDismiss} />
            <GestureDetector gesture={panGesture}>
                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        {
                            backgroundColor: t.colors.surface,
                            borderTopLeftRadius: t.radii.xl,
                            borderTopRightRadius: t.radii.xl,
                            padding: t.spacing.xl,
                            paddingBottom: t.spacing.xxl + insets.bottom,
                            // Cap + centre on tablet so content keeps a readable measure
                            // instead of stretching edge-to-edge (no effect on phones).
                            width: '100%',
                            maxWidth: contentMaxWidth,
                            alignSelf: 'center',
                            ...(height ? { maxHeight: height, height } : {}),
                        },
                    ]}
                    accessibilityViewIsModal={true}
                >
                    {title ? (
                        <View style={styles.header}>
                            <View style={[styles.handle, handleSize, { backgroundColor: t.colors.borderLight }]} />
                            <Spacer size='xs' />
                            <Text variant='subheading' weight='bold' style={styles.title}>
                                {title}
                            </Text>
                            {onClose ? (
                                <View
                                    accessibilityRole='button'
                                    accessibilityLabel='Close'
                                    onStartShouldSetResponder={() => true}
                                    onTouchEnd={handleDismiss}
                                    style={styles.closeButton}
                                >
                                    <View
                                        style={[
                                            styles.closeIconBg,
                                            {
                                                width: closeSize,
                                                height: closeSize,
                                                borderRadius: closeSize / 2,
                                                backgroundColor: t.colors.borderLight + '40',
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant='body'
                                            weight='bold'
                                            color={t.colors.textSecondary}
                                            style={{ fontSize: scale(14) }}
                                        >
                                            ✕
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : (
                        <View style={[styles.handleCenter, handleSize, { backgroundColor: t.colors.borderLight }]} />
                    )}
                    {scrollable ? (
                        <ScrollView
                            style={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            keyboardShouldPersistTaps='handled'
                        >
                            {children}
                        </ScrollView>
                    ) : (
                        <>{children}</>
                    )}
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    touchable: {
        flex: 1,
    },
    touchableDismiss: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 200,
    },
    sheet: {
        minHeight: 200,
        maxHeight: '90%',
    },
    scrollContent: {
        flexGrow: 1,
        // Allow the ScrollView to shrink to the sheet's capped height so tall
        // content (e.g. the theme preview + buy button) scrolls instead of being
        // clipped off-screen on short devices like the Nexus 4.
        flexShrink: 1,
    },
    header: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        top: 4,
        padding: 8,
    },
    closeIconBg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        marginBottom: 8,
    },
    handleCenter: {
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        textAlign: 'center',
    },
});

export default React.memo(BottomSheet);
