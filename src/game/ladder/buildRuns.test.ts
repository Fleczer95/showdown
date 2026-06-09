import { ALL_PACK } from './content';
import { buildLocalizedRungs } from './buildRuns';

// Source questions keyed by id, for cross-checking what the loader produced.
const sourceById = new Map(ALL_PACK.rungs.flat().map((q) => [q.id, q]));

describe('buildLocalizedRungs', () => {
    it.each(['en', 'pl'] as const)(
        'keeps each question\'s correct answer aligned with the content bank (%s)',
        (lang) => {
            for (const question of buildLocalizedRungs(lang).flat()) {
                const source = sourceById.get(question.id);
                expect(source).toBeDefined();
                // The option the loader marks correct must be the bank's real
                // correct option, localized — not whatever sits at index 0.
                expect(question.options[question.correctIndex]).toBe(
                    source!.options[source!.correctIndex][lang],
                );
            }
        },
    );

    it('preserves the real index instead of hardcoding 0 (the hummus regression)', () => {
        // The bank places correct answers across positions 0–3. If the loader
        // collapsed every correctIndex to 0 (the original bug), this set would
        // be {0}.
        const indices = new Set(buildLocalizedRungs('en').flat().map((q) => q.correctIndex));
        expect(indices.size).toBeGreaterThan(1);
    });

    it('marks chickpeas / ciecierzyca correct for the hummus question', () => {
        const expected = { en: 'Chickpeas', pl: 'Ciecierzyca' } as const;
        for (const lang of ['en', 'pl'] as const) {
            const hummus = buildLocalizedRungs(lang)
                .flat()
                .find((q) => q.id === 'ladder-055');
            expect(hummus).toBeDefined();
            expect(hummus!.options[hummus!.correctIndex]).toBe(expected[lang]);
        }
    });
});
