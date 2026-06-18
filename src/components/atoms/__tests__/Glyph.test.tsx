import React from 'react';
import { render } from '@testing-library/react-native';
import Glyph from '../Glyph';

// Glyph is the single emoji -> pixels seam for the planned emoji -> SVG migration.
// Today it renders the character as text; this guards that call sites keep working.
describe('Glyph component', () => {
    it('renders the given emoji character', () => {
        const { getByText } = render(<Glyph emoji='🔥' />);
        expect(getByText('🔥')).toBeTruthy();
    });

    it('passes through an accessibility label', () => {
        const { getByLabelText } = render(<Glyph emoji='👑' accessibilityLabel='crown' />);
        expect(getByLabelText('crown')).toBeTruthy();
    });
});
