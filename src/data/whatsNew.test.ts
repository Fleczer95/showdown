import fs from 'fs';
import path from 'path';
import en from '../i18n/locales/en.json';
import pl from '../i18n/locales/pl.json';
import { WHATS_NEW } from './whatsNew';

function lookup(locale: Record<string, unknown>, dottedKey: string): unknown {
    return dottedKey.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in node) {
            return (node as Record<string, unknown>)[part];
        }
        return undefined;
    }, locale);
}

describe('WHATS_NEW', () => {
    it('has at least one highlight', () => {
        expect(WHATS_NEW.highlights.length).toBeGreaterThan(0);
    });

    it('resolves every highlight key in both locales', () => {
        for (const highlight of WHATS_NEW.highlights) {
            expect(typeof lookup(en, highlight.key)).toBe('string');
            expect(typeof lookup(pl, highlight.key)).toBe('string');
        }
    });

    it('gives every highlight an emoji', () => {
        for (const highlight of WHATS_NEW.highlights) {
            expect(highlight.emoji.length).toBeGreaterThan(0);
        }
    });

    // The canary. Bumping the app version without writing notes makes the sheet
    // silently never appear; this turns that into a loud CI failure instead.
    // Reads app.json from disk because Constants.expoConfig is not populated
    // under Jest, so APP_VERSION would always be its '1.0.0' fallback here.
    it('matches the version in app.json', () => {
        const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'));
        expect(WHATS_NEW.version).toBe(appJson.expo.version);
    });
});
