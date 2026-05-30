import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import IconButton from '../IconButton';
import { ThemeProvider } from '../../../theme';
import { View } from 'react-native';

describe('IconButton component', () => {
    it('renders correctly', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <IconButton
                    icon={<View testID='icon' />}
                    onPress={() => {}}
                    accessibilityLabel='Back'
                    testID='icon-button'
                />
            </ThemeProvider>,
        );
        expect(getByTestId('icon-button')).toBeTruthy();
        expect(getByTestId('icon')).toBeTruthy();
    });

    it('handles press', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <ThemeProvider>
                <IconButton icon={<View />} onPress={onPress} accessibilityLabel='Back' testID='icon-button' />
            </ThemeProvider>,
        );
        fireEvent.press(getByTestId('icon-button'));
        expect(onPress).toHaveBeenCalled();
    });
});
