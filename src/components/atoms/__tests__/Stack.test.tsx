import React from 'react';
import { render } from '@testing-library/react-native';
import Stack from '../Stack';
import Text from '../Text';
import { ThemeProvider } from '../../../theme';

describe('Stack component', () => {
    it('renders correctly with children', () => {
        const { UNSAFE_getByProps } = render(
            <ThemeProvider>
                <Stack testID='stack'>
                    <Text testID='item1'>Item 1</Text>
                    <Text testID='item2'>Item 2</Text>
                </Stack>
            </ThemeProvider>,
        );
        expect(UNSAFE_getByProps({ testID: 'stack' })).toBeTruthy();
        expect(UNSAFE_getByProps({ testID: 'item1' })).toBeTruthy();
        expect(UNSAFE_getByProps({ testID: 'item2' })).toBeTruthy();
    });
});
