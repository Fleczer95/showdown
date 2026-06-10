import { zipDropCard, type DropPackCard } from './content';

describe('zipDropCard', () => {
    it('zips parallel en/pl single-locale cards into a bilingual DropQuestion', () => {
        const en: DropPackCard = {
            id: 'drop-premium-001',
            prompt: 'How tall is the Eiffel Tower?',
            options: ['100 m', '330 m', '500 m', '1 km'],
            correctIndex: 1,
        };
        const pl: DropPackCard = {
            id: 'drop-premium-001',
            prompt: 'Jak wysoka jest wieża Eiffla?',
            options: ['100 m', '330 m', '500 m', '1 km'],
            correctIndex: 1,
        };

        expect(zipDropCard(en, pl)).toEqual({
            id: 'drop-premium-001',
            prompt: { en: en.prompt, pl: pl.prompt },
            options: [
                { en: '100 m', pl: '100 m' },
                { en: '330 m', pl: '330 m' },
                { en: '500 m', pl: '500 m' },
                { en: '1 km', pl: '1 km' },
            ],
            correctIndex: 1,
        });
    });
});
