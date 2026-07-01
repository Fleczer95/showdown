import React from 'react';
import { render, act } from '@testing-library/react-native';
import { MascotOverlay } from './MascotOverlay';

// The overlay reads the equipped look on focus; outside a navigator, treat
// focus as a plain mount effect.
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (cb: () => void | (() => void)) => {
        const React = require('react');
        React.useEffect(() => cb(), []);
    },
}));

jest.useFakeTimers();

describe('MascotOverlay auto-hide', () => {
    it('calls onAutoHide after autoHideMs when a message is shown', () => {
        const onAutoHide = jest.fn();
        render(<MascotOverlay pose='idle' message='hi' autoHideMs={3000} onAutoHide={onAutoHide} />);
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(onAutoHide).toHaveBeenCalledTimes(1);
    });

    it('does not auto-hide when there is no message', () => {
        const onAutoHide = jest.fn();
        render(<MascotOverlay pose='idle' message={null} autoHideMs={3000} onAutoHide={onAutoHide} />);
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(onAutoHide).not.toHaveBeenCalled();
    });
});
