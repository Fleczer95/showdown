// Firebase App Check token verification at the edge — no Admin SDK, just the
// public JWKS + Web Crypto. Mirrors the steps in
// https://firebase.google.com/docs/app-check/custom-resource-backend
//
// The token is a Google-signed RS256 JWT. We pin the algorithm, check the
// standard claims (exp / iss / aud), then verify the signature against Google's
// published keys. Any failure returns false (fail-closed).

const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';

interface JWK {
    kid: string;
    kty: string;
    alg: string;
    n: string;
    e: string;
}

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

function base64UrlToBytes(b64url: string): Uint8Array {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function decodeJsonSegment(b64url: string): Record<string, unknown> {
    return JSON.parse(DECODER.decode(base64UrlToBytes(b64url)));
}

// Two layers keep the cost off the hot path: a per-isolate parsed cache (so a warm
// isolate doesn't re-parse the JWKS body every request), backed by the Cloudflare
// edge cache for the origin fetch. Both honour the JWKS endpoint's own
// `Cache-Control` rather than a forced TTL — a hardcoded long TTL would mask a key
// rotation and 403 valid tokens until it expired.
let jwksCache: { keys: JWK[]; expiresAt: number } | null = null;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;

/** `max-age` (ms) from a `Cache-Control` header, or null when absent/uncacheable. */
function maxAgeMs(res: Response): number | null {
    const cc = res.headers.get('Cache-Control');
    if (!cc || /no-store|no-cache/.test(cc)) return null;
    const m = /max-age=(\d+)/.exec(cc);
    return m ? Number(m[1]) * 1000 : null;
}

async function fetchJwks(): Promise<JWK[]> {
    if (jwksCache && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
    // No `cf.cacheTtl` override — let Cloudflare's edge cache respect the endpoint's
    // own freshness, so a rotated key isn't hidden behind a stale forced TTL.
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const data = (await res.json()) as { keys: JWK[] };
    jwksCache = { keys: data.keys, expiresAt: Date.now() + (maxAgeMs(res) ?? DEFAULT_JWKS_TTL_MS) };
    return data.keys;
}

/** True only for a genuine, unexpired App Check token issued for this project. */
export async function verifyAppCheckToken(token: string | null, projectNumber: string): Promise<boolean> {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [rawHeader, rawPayload, rawSignature] = parts;

    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
        header = decodeJsonSegment(rawHeader);
        payload = decodeJsonSegment(rawPayload);
    } catch {
        return false;
    }

    // Pin the algorithm — never accept 'none' or a symmetric alg (alg-confusion).
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return false;
    if (payload.iss !== `https://firebaseappcheck.googleapis.com/${projectNumber}`) return false;
    // `aud` is an array; per the docs it contains `projects/<project_number>`.
    if (!Array.isArray(payload.aud) || !payload.aud.includes(`projects/${projectNumber}`)) return false;

    try {
        const keys = await fetchJwks();
        const jwk = keys.find((k) => k.kid === header.kid);
        if (!jwk) return false;
        const key = await crypto.subtle.importKey(
            'jwk',
            { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify'],
        );
        const signed = ENCODER.encode(`${rawHeader}.${rawPayload}`);
        const signature = base64UrlToBytes(rawSignature);
        return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    } catch (err) {
        console.error('App Check verification error', err);
        return false;
    }
}
