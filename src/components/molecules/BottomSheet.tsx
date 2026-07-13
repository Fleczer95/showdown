import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
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
    /** Fires after the native modal is fully gone, not when closing is requested. */
    onDismissComplete?: () => void;
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
const EXIT_ANIMATION_MS = 250;
/**
 * Reanimated normally unmounts from its completion callback. Keep an independent
 * JS deadline as well: interrupted worklets must never leave a native Modal in
 * the tree indefinitely and block the next UIKit presentation.
 */
export const BOTTOM_SHEET_FORCE_UNMOUNT_MS = EXIT_ANIMATION_MS + 150;

function BottomSheet({
    visible,
    onClose,
    onDismissComplete,
    title,
    children,
    scrollable = false,
    draggable = true,
    height,
    testID,
}: BottomSheetProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const { scale } = useResponsive();

    // Fluid chrome so the handle affordance keeps pace on tablet.
    const handleSize = { width: scale(48), height: scale(6), borderRadius: scale(3) };

    const translateY = useSharedValue(500);
    const opacity = useSharedValue(0);

    // Keep the Modal mounted through the exit animation: parent `visible` drives
    // the slide, and we only unmount once the slide-out finishes.
    const [mounted, setMounted] = useState(visible);
    const previouslyMounted = useRef(mounted);
    const finishDismiss = useCallback(() => setMounted(false), []);

    // React Native only emits Modal.onDismiss on iOS. On Android, notify after
    // the hidden render commits so callers get one cross-platform completion seam.
    useEffect(() => {
        const didUnmount = previouslyMounted.current && !mounted;
        previouslyMounted.current = mounted;
        if (didUnmount && Platform.OS !== 'ios') onDismissComplete?.();
    }, [mounted, onDismissComplete]);

    // All dismissals route through the parent's `visible` so there is a single
    // path: tap/drag/back → onClose() → visible=false → the effect animates out.
    const requestClose = useCallback(() => onClose?.(), [onClose]);

    useEffect(() => {
        let forceUnmount: ReturnType<typeof setTimeout> | undefined;
        if (visible) {
            setMounted(true);
            // A nicer spring for the entry.
            translateY.value = withSpring(0, { damping: 20, stiffness: 120, mass: 0.8 });
            opacity.value = withTiming(1, { duration: EXIT_ANIMATION_MS });
        } else if (mounted) {
            translateY.value = withTiming(500, { duration: EXIT_ANIMATION_MS });
            opacity.value = withTiming(0, { duration: 200 }, (finished) => {
                if (finished) runOnJS(finishDismiss)();
            });
            forceUnmount = setTimeout(finishDismiss, BOTTOM_SHEET_FORCE_UNMOUNT_MS);
        }

        return () => {
            if (forceUnmount) clearTimeout(forceUnmount);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, finishDismiss]);

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
        <Modal
            visible={mounted}
            transparent
            animationType='none'
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={requestClose}
            onDismiss={Platform.OS === 'ios' ? onDismissComplete : undefined}
        >
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
                    <KeyboardAvoidingView style={styles.keyboardAvoider} behavior='padding'>
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
                                        // Scrollable sheets let the ScrollView run to the bottom edge and
                                        // carry the safe-area clearance in its content, so content can use
                                        // the full bottom space instead of leaving a dead band below it.
                                        paddingBottom: scrollable ? 0 : t.spacing.xxl + insets.bottom,
                                        width: '100%',
                                        minHeight: scale(200),
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
                                    <View style={[styles.header, { paddingBottom: t.spacing.xl }]}>
                                        <View
                                            style={[
                                                handleSize,
                                                { backgroundColor: t.colors.borderLight, marginBottom: t.spacing.sm },
                                            ]}
                                        />
                                        <Spacer size='xs' />
                                        <Text variant='subheading' weight='bold' style={styles.title}>
                                            {title}
                                        </Text>
                                    </View>
                                ) : (
                                    <View
                                        style={[
                                            styles.handleCenter,
                                            handleSize,
                                            { backgroundColor: t.colors.borderLight, marginBottom: t.spacing.md },
                                        ]}
                                    />
                                )}
                                {scrollable ? (
                                    <ScrollView
                                        style={styles.scrollContent}
                                        contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
                                        showsVerticalScrollIndicator={false}
                                        bounces={true}
                                        keyboardShouldPersistTaps='handled'
                                        automaticallyAdjustKeyboardInsets
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
    },
    handleCenter: {
        alignSelf: 'center',
    },
    title: {
        textAlign: 'center',
    },
});

export default React.memo(BottomSheet);
