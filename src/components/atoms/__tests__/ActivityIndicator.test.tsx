import React from 'react';
import { render } from '@testing-library/react-native';
import ActivityIndicator from '../ActivityIndicator';
import { ThemeProvider } from '../../../theme';

describe('ActivityIndicator component', () => {
    it('renders correctly', () => {
        const { getByTestId } = render(
            <ThemeProvider>
                <ActivityIndicator testID='loader' />
            </ThemeProvider>,
        );
        expect(getByTestId('loader')).toBeTruthy();
    });
});
