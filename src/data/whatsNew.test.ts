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
    // Deliberately NOT asserting that notes exist or that the version matches
    // app.json. A release with no notes is a supported state — the sheet simply
    // does not appear (see useAppAnnouncement / decideWhatsNew). What is checked
    // here is only that whatever notes ARE declared are complete, so a
    // half-written entry cannot reach players.
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

    // Not a failure — a diagnostic. Notes that do not match the shipping version
    // are inert, which is intended but easy to do by accident, so say so in the
    // log rather than breaking the build.
    it('reports whether this build actually ships notes', () => {
        const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'));
        const shipping = WHATS_NEW.version === appJson.expo.version && WHATS_NEW.highlights.length > 0;
        if (!shipping) {
            console.warn(
                `[whatsNew] No sheet for ${appJson.expo.version}: notes are for ${WHATS_NEW.version} ` +
                    `with ${WHATS_NEW.highlights.length} highlight(s). Intentional? See the release-notes skill.`,
            );
        }
        expect(typeof shipping).toBe('boolean');
    });
});
