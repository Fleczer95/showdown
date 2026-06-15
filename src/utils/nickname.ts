// Best-effort client-side profanity gate for the PUBLIC async-challenge nickname
// (ADR-0004). That nickname is shown to opponents and on the global ranking, so
// obvious slurs/swears are blocked at entry. The local (private) leaderboard
// nickname is separate and does NOT pass through here. Bypassable by a modified
// client — the cleanup script's `--remove` is the backstop.

// Root forms (PL + EN), matched as substrings against a normalized nickname so
// inflections and basic leetspeak are caught. Deliberately short — a soft gate,
// not exhaustive moderation; over-blocking is preferred to leaking a slur.
const BLOCKLIST = [
    // English
    'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'whore',
    'slut', 'nigger', 'nigga', 'faggot', 'rape', 'nazi', 'retard',
    // Polish
    'kurwa', 'chuj', 'huj', 'pizd', 'jeb', 'pierdol', 'skurwy', 'kutas',
    'dziwk', 'cipa', 'spierdal', 'wypierdal', 'pedal', 'ciota', 'szmata',
];

/** Lowercase, strip diacritics, fold common leetspeak, drop non-letters. */
function normalize(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[4@]/g, 'a')
        .replace(/3/g, 'e')
        .replace(/1/g, 'i')
        .replace(/0/g, 'o')
        .replace(/[5$]/g, 's')
        .replace(/7/g, 't')
        .replace(/[^a-z]/g, '');
}

/** True when a nickname contains a blocklisted term (after normalization). */
export function containsProfanity(name: string): boolean {
    const normalized = normalize(name);
    return BLOCKLIST.some((term) => normalized.includes(term));
}
