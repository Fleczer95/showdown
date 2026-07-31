import React, { useCallback, useEffect, useState } from 'react';
import AnnouncementSheet from './AnnouncementSheet';
import { useAppAnnouncement, type Announcement } from '../../hooks/useAppAnnouncement';
import { WHATS_NEW } from '../../data/whatsNew';
import { openStoreListing } from '../../services/appUpdate/updateCheck';
import { APP_VERSION } from '../../utils/version';
import { useTranslation } from '../../i18n';

/**
 * Mounts whichever once-per-version announcement the hook selected. Rendered by
 * Home only, so a sheet can never interrupt a run, a purchase, or a challenge
 * deep link.
 */
function AppAnnouncement() {
    const { t } = useTranslation();
    const { announcement, dismiss } = useAppAnnouncement();

    // BottomSheet animates itself out over ~250ms, but only while it is still in
    // the tree. Dropping to null the instant the hook clears would tear it out
    // mid-animation and the sheet would blink away. Hold the last announcement
    // so it can render with visible={false}, and let it go once it reports it
    // has finished leaving.
    const [leaving, setLeaving] = useState<Announcement>(null);
    useEffect(() => {
        if (announcement) setLeaving(announcement);
    }, [announcement]);

    const shown = announcement ?? leaving;
    const visible = announcement !== null;
    const handleDismissComplete = useCallback(() => setLeaving(null), []);

    const handleUpdate = useCallback(() => {
        dismiss();
        void openStoreListing();
    }, [dismiss]);

    if (shown?.kind === 'whatsNew') {
        return (
            <AnnouncementSheet
                visible={visible}
                testID='whats-new-sheet'
                title={t('whatsNew.title', { version: APP_VERSION })}
                highlights={WHATS_NEW.highlights.map((highlight) => ({
                    emoji: highlight.emoji,
                    label: t(highlight.key),
                }))}
                ctaLabel={t('whatsNew.cta')}
                onPressCta={dismiss}
                onClose={dismiss}
                onDismissComplete={handleDismissComplete}
            />
        );
    }

    if (shown?.kind === 'update') {
        return (
            <AnnouncementSheet
                visible={visible}
                testID='update-available-sheet'
                title={t('appUpdate.title')}
                body={t('appUpdate.body')}
                ctaLabel={t('appUpdate.cta')}
                onPressCta={handleUpdate}
                dismissLabel={t('appUpdate.later')}
                onClose={dismiss}
                onDismissComplete={handleDismissComplete}
            />
        );
    }

    return null;
}

export default React.memo(AppAnnouncement);
