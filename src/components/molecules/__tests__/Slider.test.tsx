import React from 'react';
import { render } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import Slider from '../Slider';

jest.mock('react-native-gesture-handler', () => {
    const makeGesture = (methods: string[]) => {
        const gesture: Record<string, jest.Mock> = {};
        methods.forEach((method) => {
            gesture[method] = jest.fn(() => gesture);
        });
        return gesture;
    };

    return {
        Gesture: {
            Pan: jest.fn(() => makeGesture(['activeOffsetX', 'failOffsetY', 'onBegin', 'onUpdate', 'onFinalize'])),
            Tap: jest.fn(() => makeGesture(['onBegin', 'onEnd', 'onFinalize'])),
            Race: jest.fn((...gestures) => gestures),
        },
        GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    };
});

describe('Slider gesture arbitration', () => {
    it('configures the pan to yield vertical drags to a surrounding ScrollView', () => {
        render(<Slider value={0} min={0} max={100} onChange={jest.fn()} />);

        const pan = jest.mocked(Gesture.Pan).mock.results[0]?.value;

        expect(pan.activeOffsetX).toHaveBeenCalledWith([-10, 10]);
        expect(pan.failOffsetY).toHaveBeenCalledWith([-10, 10]);
    });
});
