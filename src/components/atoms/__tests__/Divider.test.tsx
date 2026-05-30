import React from 'react';
import { render } from '@testing-library/react-native';
import Divider from '../Divider';
import { ThemeProvider } from '../../../theme';

describe('Divider component', () => {
    it('renders correctly', () => {
        const { UNSAFE_getByProps } = render(
            <ThemeProvider>
                <Divider testID='divider' />
            </ThemeProvider>,
        );
        expect(UNSAFE_getByProps({ testID: 'divider' })).toBeTruthy();
    });
});
