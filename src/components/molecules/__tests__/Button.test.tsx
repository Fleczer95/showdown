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

    it('supports an opt-in icon-to-label gap', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <Button icon={<MockIcon />} contentGap={8} testID='button'>
                    Click Me
                </Button>
            </ThemeProvider>,
        );

        expect(getByTestId('button-content', { includeHiddenElements: true })).toHaveStyle({ gap: 8 });
    });
});

function MockIcon() {
    return null;
}
