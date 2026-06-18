import { containsProfanity, stripNonText } from './nickname';

describe('containsProfanity', () => {
    it('flags obvious EN and PL slurs/swears', () => {
        ['fuck', 'Shit', 'BITCH', 'kurwa', 'chuj'].forEach((n) => expect(containsProfanity(n)).toBe(true));
    });

    it('catches diacritics, spacing, and basic leetspeak', () => {
        expect(containsProfanity('kurwą')).toBe(true); // diacritic
        expect(containsProfanity('k u r w a')).toBe(true); // spacing
        expect(containsProfanity('sh1t')).toBe(true); // leet 1->i
        expect(containsProfanity('f4ggot')).toBe(true); // leet 4->a
    });

    it('allows clean nicknames', () => {
        ['Ada', 'Player1', 'Classic', 'Bob', 'Łukasz'].forEach((n) => expect(containsProfanity(n)).toBe(false));
    });
});

describe('stripNonText', () => {
    it('removes emoji and pictographic symbols', () => {
        expect(stripNonText('Ada🔥')).toBe('Ada');
        expect(stripNonText('👑King👑')).toBe('King');
        expect(stripNonText('🌟⚡💎')).toBe('');
    });

    it('preserves letters (incl. diacritics), digits, spaces, and basic punctuation', () => {
        expect(stripNonText('Łukasz')).toBe('Łukasz');
        expect(stripNonText('Player1')).toBe('Player1');
        expect(stripNonText("O'Brien")).toBe("O'Brien");
        expect(stripNonText('Bob Jr.')).toBe('Bob Jr.');
    });

    it('collapses whitespace runs and trims', () => {
        expect(stripNonText('  Ada   B  ')).toBe('Ada B');
    });
});
