import React from 'react';
import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import Glyph from '../Glyph';

// Glyph is the single emoji -> pixels seam. Mapped emoji render as bundled Fluent
// (3D) art; unmapped emoji fall back to the OS text glyph. These guard both paths.
describe('Glyph component', () => {
    it('renders bundled art for a mapped emoji', () => {
        const { UNSAFE_queryByType, queryByText } = render(<Glyph emoji='🔥' />);
        expect(UNSAFE_queryByType(Image)).toBeTruthy();
        expect(queryByText('🔥')).toBeNull();
    });

    it('falls back to the text glyph for an unmapped emoji', () => {
        const { getByText, UNSAFE_queryByType } = render(<Glyph emoji='🦄' />);
        expect(getByText('🦄')).toBeTruthy();
        expect(UNSAFE_queryByType(Image)).toBeNull();
    });

    it('passes through an accessibility label (mapped)', () => {
        const { getByLabelText } = render(<Glyph emoji='👑' accessibilityLabel='crown' />);
        expect(getByLabelText('crown')).toBeTruthy();
    });

    it('passes through an accessibility label (text fallback)', () => {
        const { getByLabelText } = render(<Glyph emoji='🦄' accessibilityLabel='unicorn' />);
        expect(getByLabelText('unicorn')).toBeTruthy();
    });
});
