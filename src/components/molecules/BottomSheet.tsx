import React, { useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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

    // Fluid chrome so the handle affordance keeps pace on tablet.
    const handleSize = { width: scale(48), height: scale(6), borderRadius: scale(3) };

    const translateY = useSharedValue(500);
    const opacity = useSharedValue(0);

    // Keep the Modal mounted through the exit animation: parent `visible` drives
    // the slide, and we only unmount once the slide-out finishes.
    const [mounted, setMounted] = useState(visible);

    // All dismissals route through the parent's `visible` so there is a single
    // path: tap/drag/back → onClose() → visible=false → the effect animates out.
    const requestClose = useCallback(() => onClose?.(), [onClose]);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            // A nicer spring for the entry.
            translateY.value = withSpring(0, { damping: 20, stiffness: 120, mass: 0.8 });
            opacity.value = withTiming(1, { duration: 250 });
        } else if (mounted) {
            translateY.value = withTiming(500, { duration: 250 });
            opacity.value = withTiming(0, { duration: 200 }, (finished) => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

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
        .onUpdate((e) => {
            // Only allow dragging down
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DISMISS_THRESHOLD) {
                runOnJS(requestClose)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    return (
        <Modal visible={mounted} transparent animationType='none' statusBarTranslucent onRequestClose={requestClose}>
            <GestureHandlerRootView style={styles.root}>
                <Animated.View
                    style={[
                        styles.overlay,
                        overlayStyle,
                        { backgroundColor: t.colors.overlay, zIndex: t.zIndex.sheet },
                    ]}
                    testID={testID}
                    accessibilityViewIsModal={true}
                    onAccessibilityEscape={requestClose}
                >
                    {/* Tap the backdrop to dismiss. The sheet renders above this and
                        captures its own touches, so only taps outside it land here. */}
                    <View
                        style={StyleSheet.absoluteFill}
                        onStartShouldSetResponder={() => true}
                        onTouchEnd={requestClose}
                    />
                    <KeyboardAvoidingView
                        style={styles.keyboardAvoider}
                        behavior='padding'
                    >
                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            style={[
                                styles.sheet,
                                sheetStyle,
                                {
                                    backgroundColor: t.colors.surface,
                                    borderTopLeftRadius: 32,
                                    borderTopRightRadius: 32,
                                    padding: t.spacing.xl,
                                    paddingBottom: t.spacing.xxl + insets.bottom,
                                    // Cap + centre on tablet so content keeps a readable measure
                                    // instead of stretching edge-to-edge (no effect on phones).
                                    width: '100%',
                                    maxWidth: contentMaxWidth,
                                    alignSelf: 'center',
                                    shadowColor: t.colors.shadow,
                                    shadowOffset: { width: 0, height: -8 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 24,
                                    elevation: 24,
                                    ...(height ? { maxHeight: height, height } : {}),
                                },
                            ]}
                            accessibilityViewIsModal={true}
                        >
                            {title ? (
                                <View style={styles.header}>
                                    <View
                                        style={[styles.handle, handleSize, { backgroundColor: t.colors.borderLight }]}
                                    />
                                    <Spacer size='xs' />
                                    <Text variant='subheading' weight='bold' style={styles.title}>
                                        {title}
                                    </Text>
                                </View>
                            ) : (
                                <View
                                    style={[styles.handleCenter, handleSize, { backgroundColor: t.colors.borderLight }]}
                                />
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
                    </KeyboardAvoidingView>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    keyboardAvoider: {
        flex: 1,
        justifyContent: 'flex-end',
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
