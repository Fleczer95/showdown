import { readFileSync } from 'fs';
import { join } from 'path';
import { SIGNATURES, SIGNATURE_SLUGS, signatureSlug, signatureEmoji } from './signatures';

// Cumulative XP thresholds of the bound levels (see LEVEL_MAP):
// L5=1200, L10=6500, L20=61000, L25=143000, L40=1176000, L50=3803000.
describe('signatureSlug', () => {
    it('is undefined below the first tier (level 5)', () => {
        expect(signatureSlug(0)).toBeUndefined();
        expect(signatureSlug(1199)).toBeUndefined();
    });

    it('grants each tier at its threshold', () => {
        expect(signatureSlug(1200)).toBe('sprout');
        expect(signatureSlug(6500)).toBe('spark');
        expect(signatureSlug(61000)).toBe('fire');
        expect(signatureSlug(143000)).toBe('gem');
        expect(signatureSlug(1176000)).toBe('star');
        expect(signatureSlug(3803000)).toBe('crown');
    });

    it('always returns the highest tier reached', () => {
        expect(signatureSlug(60999)).toBe('spark'); // past L10, not yet L20
        expect(signatureSlug(9_999_999)).toBe('crown'); // past the cap
    });
});

describe('signatureEmoji', () => {
    it('resolves every known slug to its emoji', () => {
        for (const s of SIGNATURES) {
            expect(signatureEmoji(s.slug)).toBe(s.emoji);
        }
    });

    it('returns undefined for an unknown or absent slug', () => {
        expect(signatureEmoji(undefined)).toBeUndefined();
        expect(signatureEmoji('')).toBeUndefined();
        expect(signatureEmoji('nope')).toBeUndefined();
    });
});

describe('SIGNATURE_SLUGS', () => {
    it('lists the slug of every signature', () => {
        expect(SIGNATURE_SLUGS).toEqual(SIGNATURES.map((s) => s.slug));
    });

    // firestore.rules can't import TS, so it hardcodes the slug allowlist. This
    // guards the two from drifting: extract the literal list from the rule and
    // assert it matches SIGNATURE_SLUGS exactly.
    it('matches the allowlist hardcoded in firestore.rules', () => {
        const rules = readFileSync(join(__dirname, '../../../firestore.rules'), 'utf8');
        const match = rules.match(/d\.signature in \[([^\]]*)\]/);
        expect(match).not.toBeNull();
        const ruleSlugs = match![1].split(',').map((s) => s.trim().replace(/'/g, ''));
        expect(ruleSlugs).toEqual([...SIGNATURE_SLUGS]);
    });
});
