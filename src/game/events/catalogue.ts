import { eventEditions, eventLifecycle, validateEdition, type EventEdition } from '../../../shared/events/definitions';
import { eventContent } from '../../../shared/events/content';
import { eventRewardTitleKey } from './access';

export const DAY_MS = 86400000;
export const DEFAULT_DISCOVERY_WINDOW = { beforeDays: 7, afterDays: 7 } as const;

/** Promotion has its own window. Admission and saved-result retention are unchanged. */
export function eventDiscoveryPhase(edition: EventEdition, now: number) {
    const phase = eventLifecycle(edition, now);
    if (phase === 'draft') return null;
    const window = edition.discoveryWindow ?? DEFAULT_DISCOVERY_WINDOW;
    if (now < edition.startsAt! - window.beforeDays * DAY_MS || now >= edition.endsAt! + window.afterDays * DAY_MS)
        return null;
    return phase;
}

export function visibleEvents(now = Date.now()) {
    return eventEditions.filter(
        (edition) =>
            validateEdition(
                edition,
                (a) => a.game === 'the-ladder' && !!eventContent[a.contentRevision],
                (id) => !!eventRewardTitleKey(id),
            ).length === 0 && eventDiscoveryPhase(edition, now) !== null,
    );
}
