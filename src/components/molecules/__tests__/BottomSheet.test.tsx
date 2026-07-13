import React from 'react';
import { Modal, Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import BottomSheet, { BOTTOM_SHEET_FORCE_UNMOUNT_MS } from '../BottomSheet';

// Exercise the independent JS deadline by suppressing Reanimated's completion
// callback. The standard Jest mock invokes it synchronously, which cannot model
// the interrupted-worklet failure this fallback protects against.
jest.mock('react-native-reanimated', () => {
    const mock = jest.requireActual<typeof import('react-native-reanimated')>('react-native-reanimated/mock');
    return { ...mock, withTiming: jest.fn((toValue) => toValue) };
});

jest.mock('react-native-gesture-handler', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    let pan: Record<'enabled' | 'activeOffsetY' | 'onUpdate' | 'onEnd', jest.Mock>;
    pan = {
        enabled: jest.fn(() => pan),
        activeOffsetY: jest.fn(() => pan),
        onUpdate: jest.fn(() => pan),
        onEnd: jest.fn(() => pan),
    };
    return {
        Gesture: { Pan: jest.fn(() => pan) },
        GestureDetector: ({ children }: { children: React.ReactNode }) => children,
        GestureHandlerRootView: ({ children, ...props }: { children: React.ReactNode }) => (
            <View {...props}>{children}</View>
        ),
    };
});

function sheetTree(visible: boolean, onClose: jest.Mock, onDismissComplete: jest.Mock) {
    return (
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
        >
            <ThemeProvider>
                <BottomSheet visible={visible} onClose={onClose} onDismissComplete={onDismissComplete}>
                    {null}
                </BottomSheet>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

const originalPlatform = Platform.OS;
afterEach(() => {
    setPlatform(originalPlatform as 'ios' | 'android');
    jest.useRealTimers();
});

describe('BottomSheet dismissal contract', () => {
    it('separates a close request from confirmed native dismissal', () => {
        setPlatform('ios');
        const onClose = jest.fn();
        const onDismissComplete = jest.fn();
        const view = render(sheetTree(true, onClose, onDismissComplete));
        const modal = view.UNSAFE_getByType(Modal);

        act(() => modal.props.onRequestClose());
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDismissComplete).not.toHaveBeenCalled();

        act(() => modal.props.onDismiss());
        expect(onDismissComplete).toHaveBeenCalledTimes(1);
    });

    it('forces the native modal out of the tree if the animation callback is missed', () => {
        jest.useFakeTimers();
        setPlatform('ios');
        const onClose = jest.fn();
        const onDismissComplete = jest.fn();
        const view = render(sheetTree(true, onClose, onDismissComplete));

        view.rerender(sheetTree(false, onClose, onDismissComplete));
        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);

        act(() => jest.advanceTimersByTime(BOTTOM_SHEET_FORCE_UNMOUNT_MS));
        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
        // iOS owns the final completion signal; this test intentionally does not
        // fake native Modal.onDismiss.
        expect(onDismissComplete).not.toHaveBeenCalled();
    });

    it('reports forced dismissal after the hidden render commits on Android', () => {
        jest.useFakeTimers();
        setPlatform('android');
        const onClose = jest.fn();
        const onDismissComplete = jest.fn();
        const view = render(sheetTree(true, onClose, onDismissComplete));

        view.rerender(sheetTree(false, onClose, onDismissComplete));
        act(() => jest.advanceTimersByTime(BOTTOM_SHEET_FORCE_UNMOUNT_MS));

        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
        expect(onDismissComplete).toHaveBeenCalledTimes(1);
    });
});
