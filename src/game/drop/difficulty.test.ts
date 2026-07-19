import { dropQuestions } from './content';
import { DROP_DIFFICULTIES, DROP_DIFFICULTY_ASSIGNMENTS, DROP_ROUND_DIFFICULTIES } from './difficulty';
import { en as changingPlanetEn, pl as changingPlanetPl } from './packs/our-changing-planet';
import { worldGeographyEn, worldGeographyPl } from './packs/world-geography';

const premiumPacks = [
    { name: 'world-geography', en: worldGeographyEn, pl: worldGeographyPl },
    { name: 'our-changing-planet', en: changingPlanetEn, pl: changingPlanetPl },
];

describe('The Drop difficulty classifications', () => {
    it('defines the nine-round easy → medium → hard curve', () => {
        expect(DROP_ROUND_DIFFICULTIES).toEqual([
            'easy',
            'easy',
            'easy',
            'medium',
            'medium',
            'medium',
            'hard',
            'hard',
            'hard',
        ]);
    });

    it('classifies every canonical question exactly once', () => {
        const contentIds = [
            ...dropQuestions.map((question) => question.id),
            ...premiumPacks.flatMap((pack) => pack.en.map((question) => question.id)),
        ];
        const classifiedIds = Object.values(DROP_DIFFICULTY_ASSIGNMENTS).flatMap((groups) =>
            DROP_DIFFICULTIES.flatMap((difficulty) => [...groups[difficulty]]),
        );

        expect(new Set(contentIds).size).toBe(contentIds.length);
        expect(new Set(classifiedIds).size).toBe(classifiedIds.length);
        expect([...classifiedIds].sort()).toEqual([...contentIds].sort());
    });

    it('matches the reviewed 20:17:10 inventory target', () => {
        const questions = [...dropQuestions, ...premiumPacks.flatMap((pack) => pack.en)];
        const counts = Object.fromEntries(
            DROP_DIFFICULTIES.map((difficulty) => [
                difficulty,
                questions.filter((question) => question.difficulty === difficulty).length,
            ]),
        );

        expect(counts).toEqual({ easy: 360, medium: 306, hard: 180 });
    });

    it('keeps every level playable without requiring balanced pool sizes', () => {
        for (const difficulty of DROP_DIFFICULTIES) {
            expect(
                dropQuestions.filter((question) => question.difficulty === difficulty).length,
            ).toBeGreaterThanOrEqual(3);
        }
    });

    it.each(premiumPacks)('keeps $name difficulty and answer metadata aligned across EN/PL', ({ en, pl }) => {
        expect(pl).toHaveLength(en.length);
        en.forEach((question, index) => {
            expect(pl[index]).toMatchObject({
                id: question.id,
                correctIndex: question.correctIndex,
                difficulty: question.difficulty,
            });
            expect(pl[index].options).toHaveLength(question.options.length);
        });
    });
});
