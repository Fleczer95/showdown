/** Simulator-only transport: never skips attestation for a remote or release backend. */
export function localPreviewToken(): string | undefined {
    return resolveLocalPreviewToken(
        __DEV__,
        process.env.EXPO_PUBLIC_EVENT_FIXTURE,
        process.env.EXPO_PUBLIC_CHALLENGE_API_URL,
        process.env.EXPO_PUBLIC_LOCAL_PREVIEW_TOKEN,
    );
}

export function resolveLocalPreviewToken(
    development: boolean,
    fixture: string | undefined,
    endpoint: string | undefined,
    token: string | undefined,
): string | undefined {
    if (!development || fixture !== 'true' || !token || token.length < 32 || !endpoint) return;
    // Match the whole origin, not a prefix (127.0.0.1.evil.example must fail).
    // Avoid React Native's partial URL polyfill on older supported runtimes.
    if (/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{1,5})?\/?$/.test(endpoint)) return token;
}
