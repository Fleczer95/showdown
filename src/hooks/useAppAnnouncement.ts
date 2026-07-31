import { useCallback, useEffect, useState } from 'react';
import { WHATS_NEW } from '../data/whatsNew';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import {
    decideWhatsNew,
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
    shouldPromptUpdate,
} from '../services/appUpdate/seenVersions';
import { APP_VERSION } from '../utils/version';

export type Announcement = { kind: 'whatsNew' } | { kind: 'update' } | null;

/**
 * One decision per launch, not per mount. Home can gain focus many times in a
 * session; the announcement must not return each time.
 */
let decidedThisLaunch = false;

/** Test-only: reset the once-per-launch latch between cases. */
export function resetAppAnnouncementForTests(): void {
    decidedThisLaunch = false;
}

/**
 * Decides which once-per-version announcement (if any) to show. What's-new wins
 * over the update prompt — right after updating there is no newer version
 * anyway, and the ordering makes that explicit rather than accidental.
 *
 * Both flows mark "seen" the moment the sheet is shown, not when it is
 * dismissed: there are five ways out (button, backdrop, drag, Android back, app
 * kill) and marking on show is the only way "exactly once" is actually true.
 */
export function useAppAnnouncement(): { announcement: Announcement; dismiss: () => void } {
    const [announcement, setAnnouncement] = useState<Announcement>(null);

    useEffect(() => {
        if (decidedThisLaunch) return;
        decidedThisLaunch = true;

        const decision = decideWhatsNew(readWhatsNewSeen(), APP_VERSION, WHATS_NEW.version);

        // 'seed' (fresh install) and 'bump' (a patch with no notes) both record
        // the version and stay quiet — and skip the store check, because a build
        // installed or updated just now is not behind the store.
        if (decision !== 'none') {
            markWhatsNewSeen(APP_VERSION);
            if (decision === 'show') setAnnouncement({ kind: 'whatsNew' });
            return;
        }

        let active = true;
        void checkStoreVersion().then((result) => {
            if (!active || !result) return;
            if (!shouldPromptUpdate(readUpdatePromptSeen(), result.storeVersion)) return;
            markUpdatePromptSeen(result.storeVersion);
            setAnnouncement({ kind: 'update' });
        });

        return () => {
            active = false;
        };
    }, []);

    const dismiss = useCallback(() => setAnnouncement(null), []);

    return { announcement, dismiss };
}
