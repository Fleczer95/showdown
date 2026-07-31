import { decideWhatsNew, shouldPromptUpdate } from './seenVersions';

describe('decideWhatsNew', () => {
    it('seeds on a fresh install so a new player is never shown notes', () => {
        expect(decideWhatsNew(undefined, '1.4.0', '1.4.0')).toBe('seed');
        expect(decideWhatsNew(undefined, '1.4.0', '1.4.0', false)).toBe('seed');
    });

    // The key cannot exist in any release before this feature shipped, so on the
    // debut build every existing player reads `undefined` too. Without the
    // prior-use signal they would all be seeded and nobody would ever see the
    // notes for the very release that introduces them.
    it('shows notes to an existing player upgrading into the first build with this feature', () => {
        expect(decideWhatsNew(undefined, '1.4.0', '1.4.0', true)).toBe('show');
    });

    it('bumps silently for an upgrading player when the debut build ships no notes', () => {
        expect(decideWhatsNew(undefined, '1.4.1', '1.4.0', true)).toBe('bump');
    });

    it('shows notes after an update when an entry matches this build', () => {
        expect(decideWhatsNew('1.3.1', '1.4.0', '1.4.0')).toBe('show');
    });

    it('shows the newest notes even when versions were skipped', () => {
        expect(decideWhatsNew('1.2.0', '1.5.0', '1.5.0')).toBe('show');
    });

    it('bumps silently when this build has no notes entry', () => {
        expect(decideWhatsNew('1.4.0', '1.4.1', '1.4.0')).toBe('bump');
    });

    it('does nothing when the player has already seen this version', () => {
        expect(decideWhatsNew('1.4.0', '1.4.0', '1.4.0')).toBe('none');
    });
});

describe('shouldPromptUpdate', () => {
    it('prompts when this store version has never been prompted', () => {
        expect(shouldPromptUpdate(undefined, '1.5.0')).toBe(true);
    });

    it('does not prompt twice for the same store version', () => {
        expect(shouldPromptUpdate('1.5.0', '1.5.0')).toBe(false);
    });

    it('prompts again once the store moves on', () => {
        expect(shouldPromptUpdate('1.5.0', '1.6.0')).toBe(true);
    });

    it('treats an Android versionCode string the same as a semver string', () => {
        expect(shouldPromptUpdate('35', '36')).toBe(true);
        expect(shouldPromptUpdate('36', '36')).toBe(false);
    });
});
