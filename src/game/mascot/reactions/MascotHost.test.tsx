import React from 'react';
import { act, render } from '@testing-library/react-native';
import { MascotHost } from './MascotHost';

jest.useFakeTimers();

const mockOnAutoHide = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 0 }),
}));

jest.mock('../../../i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../MascotOverlay', () => ({
    MascotOverlay: () => null,
}));

jest.mock('./useMascotDirector', () => ({
    useMascotState: () => ({
        state: {
            utterance: { bucketId: 'run-won', expression: 'happy', textKey: 'mascot.runWon.1', ctx: {} },
            expression: 'happy',
        },
        surface: 'game',
        chatter: true,
        reduced: false,
        onAutoHide: mockOnAutoHide,
        openCustomizer: jest.fn(),
    }),
}));

describe('MascotHost', () => {
    beforeEach(() => {
        mockOnAutoHide.mockClear();
    });

    it('does not auto-hide shared run-end utterances while hidden on the game surface', () => {
        render(<MascotHost />);

        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(mockOnAutoHide).not.toHaveBeenCalled();
    });
});
