import React from 'react';
import { Modal, Platform } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import ReviewPromptModal from '../ReviewPromptModal';

const mockSetIsBlurry = jest.fn();

jest.mock('../../../theme', () => {
    const actual = jest.requireActual('../../../theme');
    return {
        ...actual,
        useBlur: () => ({ isBlurry: false, setIsBlurry: mockSetIsBlurry }),
    };
});

function modalTree(visible: boolean, onDismissComplete: jest.Mock = jest.fn()) {
    return (
        <ThemeProvider>
            <TranslationProvider>
                <ReviewPromptModal
                    visible={visible}
                    onRate={jest.fn()}
                    onDismiss={jest.fn()}
                    onDismissComplete={onDismissComplete}
                />
            </TranslationProvider>
        </ThemeProvider>
    );
}

function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

const originalPlatform = Platform.OS;

describe('ReviewPromptModal presentation', () => {
    beforeEach(() => mockSetIsBlurry.mockClear());

    afterEach(() => setPlatform(originalPlatform as 'ios' | 'android'));

    it('only blurs after native presentation succeeds and always clears on dismissal', () => {
        setPlatform('ios');
        const onDismissComplete = jest.fn();
        const view = render(modalTree(true, onDismissComplete));
        const modal = view.UNSAFE_getByType(Modal);

        expect(mockSetIsBlurry).not.toHaveBeenCalledWith(true);

        act(() => modal.props.onShow());
        expect(mockSetIsBlurry).toHaveBeenLastCalledWith(true);

        view.rerender(modalTree(false, onDismissComplete));
        expect(mockSetIsBlurry).toHaveBeenLastCalledWith(false);
        expect(onDismissComplete).not.toHaveBeenCalled();

        act(() => view.UNSAFE_getByType(Modal).props.onDismiss());
        expect(onDismissComplete).toHaveBeenCalledTimes(1);
    });

    it('never strands the blur when native presentation is rejected', () => {
        setPlatform('ios');
        const onDismissComplete = jest.fn();
        const view = render(modalTree(true, onDismissComplete));
        view.rerender(modalTree(false, onDismissComplete));

        expect(mockSetIsBlurry).not.toHaveBeenCalledWith(true);
        expect(mockSetIsBlurry).toHaveBeenLastCalledWith(false);
    });

    it('reports completed dismissal on Android after the hidden render commits', async () => {
        setPlatform('android');
        const onDismissComplete = jest.fn();
        const view = render(modalTree(true, onDismissComplete));

        view.rerender(modalTree(false, onDismissComplete));

        await waitFor(() => expect(onDismissComplete).toHaveBeenCalledTimes(1));
    });
});
