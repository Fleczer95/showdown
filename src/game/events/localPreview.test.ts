import { resolveLocalPreviewToken } from './localPreview';

const token = 'x'.repeat(64);
test('explicit local simulator fixture can use an ephemeral token', () => {
    expect(resolveLocalPreviewToken(true, 'true', 'http://127.0.0.1:8787', token)).toBe(token);
    expect(resolveLocalPreviewToken(true, 'true', 'http://localhost:8787/', token)).toBe(token);
});
test.each([
    'https://showdown-backend.arturjankowski95.workers.dev',
    'http://127.0.0.1.evil.example',
    'http://127.0.0.1@evil.example',
    'http://192.168.1.10:8787',
    'not a URL',
])('never bypasses hardware attestation for %s', (url) => {
    expect(resolveLocalPreviewToken(true, 'true', url, token)).toBeUndefined();
});
test('release build, disabled fixture, and missing token fail closed', () => {
    expect(resolveLocalPreviewToken(false, 'true', 'http://127.0.0.1:8787', token)).toBeUndefined();
    expect(resolveLocalPreviewToken(true, 'false', 'http://127.0.0.1:8787', token)).toBeUndefined();
    expect(resolveLocalPreviewToken(true, 'true', 'http://127.0.0.1:8787', undefined)).toBeUndefined();
});
