import React from 'react';
import { Modal, Pressable } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CONFETTI_OVERLAY_MS, ConfettiOverlayProvider, useConfettiOverlay } from '../ConfettiOverlay';

jest.mock('../Confetti', () => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return {
        __esModule: true,
        default: ({ active }: { active: boolean }) => (active ? <View testID='confetti-canvas' /> : null),
    };
});

function Trigger() {
    const { burstConfetti } = useConfettiOverlay();
    return <Pressable testID='burst-confetti' onPress={() => burstConfetti(['#ff0000'])} />;
}

afterEach(() => jest.useRealTimers());

describe('ConfettiOverlayProvider', () => {
    it('renders a temporary, touch-transparent overlay without a native modal', () => {
        jest.useFakeTimers();
        const hidden = { includeHiddenElements: true };
        const view = render(
            <ConfettiOverlayProvider>
                <Trigger />
            </ConfettiOverlayProvider>,
        );

        fireEvent.press(view.getByTestId('burst-confetti'));

        const overlay = view.getByTestId('confetti-overlay', hidden);
        expect(overlay.props.pointerEvents).toBe('none');
        expect(view.getByTestId('confetti-canvas', hidden)).toBeTruthy();
        expect(view.UNSAFE_queryAllByType(Modal)).toHaveLength(0);

        act(() => jest.advanceTimersByTime(CONFETTI_OVERLAY_MS));
        expect(view.queryByTestId('confetti-overlay', hidden)).toBeNull();
    });

    it('restarts the lifetime when another burst arrives', () => {
        jest.useFakeTimers();
        const hidden = { includeHiddenElements: true };
        const view = render(
            <ConfettiOverlayProvider>
                <Trigger />
            </ConfettiOverlayProvider>,
        );

        fireEvent.press(view.getByTestId('burst-confetti'));
        act(() => jest.advanceTimersByTime(CONFETTI_OVERLAY_MS - 100));
        fireEvent.press(view.getByTestId('burst-confetti'));
        act(() => jest.advanceTimersByTime(100));

        expect(view.getByTestId('confetti-overlay', hidden)).toBeTruthy();
        act(() => jest.advanceTimersByTime(CONFETTI_OVERLAY_MS - 100));
        expect(view.queryByTestId('confetti-overlay', hidden)).toBeNull();
    });
});
