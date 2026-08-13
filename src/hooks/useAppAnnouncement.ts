import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { WHATS_NEW } from '../data/whatsNew';
import { loadStats } from '../game/progression';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import { restoreOutcome } from '../services/gameServices/restoreSignal';
import {
    decideWhatsNew,
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
    shouldPromptUpdate,
} from '../services/appUpdate/seenVersions';
import { APP_VERSION } from '../utils/version';

export type Announcement =
    | { kind: 'whatsNew' }
    | { kind: 'update' }
    | { kind: 'cloudRestored' }
    | { kind: 'cloudBlocked' }
    | null;

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

    // The store lookup is async. Home stays mounted when another route is pushed
    // and a native Modal renders above whatever is on screen, so a late result
    // could drop the sheet on top of a run, a purchase, or a challenge. Read
    // focus through a ref so the callback sees the value at resolve time, not
    // the one captured when the effect ran.
    const isFocused = useIsFocused();
    const focusedRef = useRef(isFocused);
    focusedRef.current = isFocused;

    useEffect(() => {
        if (decidedThisLaunch) return;
        decidedThisLaunch = true;

        // An empty highlight list means this release ships no notes. That is a
        // supported state, not a failure: no sheet, no error, just a quiet bump.
        const notesVersion = WHATS_NEW.highlights.length > 0 ? WHATS_NEW.version : null;
        const decision = decideWhatsNew(readWhatsNewSeen(), APP_VERSION, notesVersion, loadStats().runsPlayed > 0);

        // 'seed' (fresh install) and 'bump' (a patch with no notes) both record
        // the version and stay quiet.
        if (decision !== 'none') markWhatsNewSeen(APP_VERSION);
        if (decision === 'show') {
            setAnnouncement({ kind: 'whatsNew' });
            return;
        }

        // Skip the store check for a build installed or updated just now — it
        // cannot be behind the store. The cloud outcome is still worth waiting
        // for: a fresh install is exactly when a restore has something to say,
        // and returning early here is why that sheet never appeared.
        const storeCheck = decision === 'none' ? checkStoreVersion() : Promise.resolve(null);

        let active = true;
        // Both lookups are already running by now — the restore started at launch,
        // the store check starts here — so awaiting them together costs nothing and
        // lets one ordering decide between them.
        void Promise.all([restoreOutcome(), storeCheck]).then(([restore, result]) => {
            if (!active) return;
            // Left Home while the lookups were in flight: show nothing and mark
            // nothing, so the prompt is still available on the next launch.
            if (!focusedRef.current) {
                decidedThisLaunch = false;
                return;
            }

            // A refused write means cloud save is not working for this player and
            // their devices are silently diverging — that outranks a version nudge.
            if (restore.status === 'blocked') {
                setAnnouncement({ kind: 'cloudBlocked' });
                return;
            }

            if (result && shouldPromptUpdate(readUpdatePromptSeen(), result.storeVersion)) {
                markUpdatePromptSeen(result.storeVersion);
                setAnnouncement({ kind: 'update' });
                return;
            }

            // Purely good news, so it yields to everything else and only appears on
            // the launch that actually pulled progress across.
            if (restore.status === 'restored') setAnnouncement({ kind: 'cloudRestored' });
        });

        return () => {
            active = false;
        };
    }, []);

    const dismiss = useCallback(() => setAnnouncement(null), []);

    return { announcement, dismiss };
}
