import * as StoreReview from 'expo-store-review';
import { deviceStore } from '../../storage/appStores';

const MILESTONE_STEP = 5;

const ACCEPTED_KEY = 'reviewAccepted';

/** True when a level-up crossed a milestone level (a multiple of 5). Pure. */
export function crossedReviewMilestone(previousLevel: number, level: number): boolean {
    return Math.floor(level / MILESTONE_STEP) > Math.floor(previousLevel / MILESTONE_STEP);
}

/** Whether the player has already accepted the rate prompt (asked once they say yes). */
export function hasAcceptedReview(): boolean {
    return deviceStore.getBoolean(ACCEPTED_KEY) ?? false;
}

/** Remember that the player accepted, so the pre-prompt never shows again. */
export function markReviewAccepted(): void {
    deviceStore.set(ACCEPTED_KEY, true);
}

/** Show the rate pre-prompt on every 5th-level milestone until the player accepts. */
export function shouldPromptReview(previousLevel: number, level: number): boolean {
    return !hasAcceptedReview() && crossedReviewMilestone(previousLevel, level);
}

/** Player tapped "Rate": stop future pre-prompts and hand off to the native sheet.
 *  Best-effort — any failure is swallowed so the flow is never disrupted. */
export async function acceptReview(): Promise<void> {
    markReviewAccepted();
    try {
        if (await StoreReview.hasAction()) {
            await StoreReview.requestReview();
        }
    } catch {
        // ignore — review prompting is best-effort
    }
}
