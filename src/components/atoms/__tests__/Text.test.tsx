import React from 'react';
import { render } from '@testing-library/react-native';
import Text from '../Text';
import { ThemeProvider } from '../../../theme';

describe('Text component', () => {
    it('renders correctly with default props', () => {
        const { getByText } = render(
            <ThemeProvider>
                <Text>Hello World</Text>
            </ThemeProvider>,
        );
        expect(getByText('Hello World')).toBeTruthy();
    });

    it('renders with correct variant', () => {
        const { getByText } = render(
            <ThemeProvider>
                <Text variant='heading'>Heading Text</Text>
            </ThemeProvider>,
        );
        expect(getByText('Heading Text')).toBeTruthy();
    });
});
