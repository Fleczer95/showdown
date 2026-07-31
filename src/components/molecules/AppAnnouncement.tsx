import React, { useCallback } from 'react';
import AnnouncementSheet from './AnnouncementSheet';
import { useAppAnnouncement } from '../../hooks/useAppAnnouncement';
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

    const handleUpdate = useCallback(() => {
        dismiss();
        void openStoreListing();
    }, [dismiss]);

    if (announcement?.kind === 'whatsNew') {
        return (
            <AnnouncementSheet
                visible
                testID='whats-new-sheet'
                title={t('whatsNew.title', { version: APP_VERSION })}
                highlights={WHATS_NEW.highlights.map((highlight) => ({
                    emoji: highlight.emoji,
                    label: t(highlight.key),
                }))}
                ctaLabel={t('whatsNew.cta')}
                onPressCta={dismiss}
                onClose={dismiss}
            />
        );
    }

    if (announcement?.kind === 'update') {
        return (
            <AnnouncementSheet
                visible
                testID='update-available-sheet'
                title={t('appUpdate.title')}
                body={t('appUpdate.body')}
                ctaLabel={t('appUpdate.cta')}
                onPressCta={handleUpdate}
                dismissLabel={t('appUpdate.later')}
                onClose={dismiss}
            />
        );
    }

    return null;
}

export default React.memo(AppAnnouncement);
