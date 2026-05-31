// Bilingual puzzle content for "The Wheel".
//
// Polish-letter simplification (v1): Polish phrases are written WITHOUT diacritics
// (ASCII only, e.g. "ZIMNA WODA" rather than "ZIMNA WODA" with accents). This keeps
// the letter matcher and the on-screen keyboard simple — players type plain a-z and
// every occurrence is matched case-insensitively. Standard A/E/I/O/U remain vowels;
// all other letters are treated as consonants.

export interface LocalizedString {
    en: string;
    pl: string;
}

export interface PuzzleContent {
    id: string;
    phrase: LocalizedString;
    category: LocalizedString;
}

export interface PuzzlePack {
    id: string;
    puzzles: PuzzleContent[];
}

const all: PuzzlePack = {
    id: 'all',
    puzzles: [
        {
            id: 'wheel-001',
            phrase: { en: 'BETTER LATE THAN NEVER', pl: 'LEPIEJ POZNO NIZ WCALE' },
            category: { en: 'Proverb', pl: 'Przyslowie' },
        },
        {
            id: 'wheel-002',
            phrase: { en: 'THE EARLY BIRD', pl: 'PTAK RANNY PTASZEK' },
            category: { en: 'Phrase', pl: 'Powiedzenie' },
        },
        {
            id: 'wheel-003',
            phrase: { en: 'PIECE OF CAKE', pl: 'BULKA Z MASLEM' },
            category: { en: 'Idiom', pl: 'Idiom' },
        },
        {
            id: 'wheel-004',
            phrase: { en: 'BREAK A LEG', pl: 'POWODZENIA' },
            category: { en: 'Saying', pl: 'Powiedzenie' },
        },
        {
            id: 'wheel-005',
            phrase: { en: 'HOME SWEET HOME', pl: 'WSZEDZIE DOBRZE W DOMU' },
            category: { en: 'Phrase', pl: 'Powiedzenie' },
        },
        {
            id: 'wheel-006',
            phrase: { en: 'TIME IS MONEY', pl: 'CZAS TO PIENIADZ' },
            category: { en: 'Proverb', pl: 'Przyslowie' },
        },
    ],
};

export const PACKS: Record<string, PuzzlePack> = { all };

export function getPack(id: string = 'all'): PuzzlePack {
    return PACKS[id] ?? all;
}
