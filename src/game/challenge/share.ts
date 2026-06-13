import { Share } from 'react-native';

// The shareable link for a challenge. Uses the static Universal/App Link domain
// (ADR-0003) so a tap opens the app straight to the Challenge screen on iOS and
// Android, and falls back to a store-redirect page when the app isn't installed.

/** Universal/App Link origin (also the custom-scheme sibling lives in app.json). */
export const CHALLENGE_LINK_ORIGIN = 'https://showdown.lebene.pl';
export const CHALLENGE_BASE_URL = `${CHALLENGE_LINK_ORIGIN}/c`;

/** The public link for a challenge id. */
export function challengeUrl(id: string): string {
    return `${CHALLENGE_BASE_URL}/${id}`;
}

/** Open the native share sheet with a challenge link (optionally prefixed by a message). */
export async function shareChallenge(id: string, message?: string): Promise<void> {
    const url = challengeUrl(id);
    await Share.share({ message: message ? `${message} ${url}` : url, url });
}
