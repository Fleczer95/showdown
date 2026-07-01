import React from 'react';
import { render } from '@testing-library/react-native';
import { Mascot } from './Mascot';
import { DEFAULT_LOOK } from './look';

function faceJSON(expression: 'neutral' | 'happy' | 'worried' | 'smug' | 'surprised') {
    const { toJSON } = render(<Mascot look={DEFAULT_LOOK} pose='idle' expression={expression} />);
    return JSON.stringify(toJSON());
}

describe('Mascot expression', () => {
    it('renders happy distinctly from neutral', () => {
        const neutral = faceJSON('neutral');
        expect(neutral).toBeTruthy();
        expect(faceJSON('happy')).not.toEqual(neutral);
    });

    it.each(['smug', 'surprised', 'worried'] as const)('renders %s distinctly', (expr) => {
        expect(faceJSON(expr)).not.toEqual(faceJSON('neutral'));
    });
});
