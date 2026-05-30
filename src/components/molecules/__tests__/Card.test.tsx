import React from 'react';
import { render } from '@testing-library/react-native';
import Card from '../Card';
import Text from '../../atoms/Text';
import { ThemeProvider } from '../../../theme';

describe('Card component', () => {
    it('renders correctly with children', () => {
        const { getByText } = render(
            <ThemeProvider>
                <Card>
                    <Text>Inside Card</Text>
                </Card>
            </ThemeProvider>,
        );
        expect(getByText('Inside Card')).toBeTruthy();
    });
});
