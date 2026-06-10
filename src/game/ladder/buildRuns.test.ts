import { ALL_PACK } from './content';
import { buildLocalizedRungs, type LadderPackCard } from './buildRuns';

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

    it('defaults to no owned-pack cards (behaviour unchanged when nothing is owned)', () => {
        expect(buildLocalizedRungs('en')).toEqual(buildLocalizedRungs('en', []));
    });

    it('slots an owned-pack card into the rung named by its difficulty', () => {
        const card: LadderPackCard = {
            id: 'ladder-premium-001',
            prompt: 'Premium question',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 2,
            hint: 'a hint',
            difficulty: 5, // rung 5 → pool 2 (rungs 4–6), which fills run-rungs 3,4,5
        };
        const pooled = buildLocalizedRungs('en', [card]);
        // Pool 2 is shared across the 4th–6th run-rungs (indices 3,4,5).
        for (const rungIndex of [3, 4, 5]) {
            expect(pooled[rungIndex].some((q) => q.id === card.id)).toBe(true);
        }
        // It must NOT leak into other pools (e.g. the first rung / pool 1).
        expect(pooled[0].some((q) => q.id === card.id)).toBe(false);
    });

    it('ignores owned cards whose difficulty is out of range', () => {
        const base = buildLocalizedRungs('en');
        const merged = buildLocalizedRungs('en', [
            { id: 'oob-0', prompt: 'x', options: ['a', 'b', 'c', 'd'], correctIndex: 0, difficulty: 0 },
            { id: 'oob-16', prompt: 'x', options: ['a', 'b', 'c', 'd'], correctIndex: 0, difficulty: 16 },
        ]);
        expect(merged).toEqual(base);
    });
});
