import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Button from '../Button';
import { ThemeProvider } from '../../../theme';

describe('Button component', () => {
    it('renders correctly', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <Button onPress={() => {}} testID='button'>
                    Click Me
                </Button>
            </ThemeProvider>,
        );
        expect(getByTestId('button')).toBeTruthy();
    });

    it('handles press', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <ThemeProvider>
                <Button onPress={onPress} testID='button'>
                    Click Me
                </Button>
            </ThemeProvider>,
        );
        fireEvent.press(getByTestId('button'));
        expect(onPress).toHaveBeenCalled();
    });
});
