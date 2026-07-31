import { decideWhatsNew, shouldPromptUpdate } from './seenVersions';

describe('decideWhatsNew', () => {
    it('seeds on a fresh install so a new player is never shown notes', () => {
        expect(decideWhatsNew(undefined, '1.4.0', '1.4.0')).toBe('seed');
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
