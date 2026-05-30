import React from 'react';
import { render } from '@testing-library/react-native';
import Badge from '../Badge';
import { ThemeProvider } from '../../../theme';

describe('Badge component', () => {
    it('renders correctly', () => {
        const { UNSAFE_getByProps } = render(
            <ThemeProvider>
                <Badge>New</Badge>
            </ThemeProvider>,
        );
        expect(UNSAFE_getByProps({ testID: 'badge-text' })).toBeTruthy();
    });
});
