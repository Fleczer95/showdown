import React from 'react';
import { render } from '@testing-library/react-native';
import Spacer from '../Spacer';
import { ThemeProvider } from '../../../theme';

describe('Spacer component', () => {
    it('renders correctly', () => {
        const { UNSAFE_getByProps } = render(
            <ThemeProvider>
                <Spacer size='md' testID='spacer' />
            </ThemeProvider>,
        );
        // If getByTestId fails due to accessibility hiding, try finding by props
        expect(UNSAFE_getByProps({ testID: 'spacer' })).toBeTruthy();
    });
});
