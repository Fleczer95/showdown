import { eventEditions, eventLifecycle, validateEdition, type EventEdition } from '../../../shared/events/definitions';
import { halloweenPreviewEdition } from '../../../shared/events/fixtures';
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
    const withFixture =
        __DEV__ && process.env.EXPO_PUBLIC_EVENT_FIXTURE === 'true'
            ? [...eventEditions, halloweenPreviewEdition]
            : eventEditions;
    // The internal-track rehearsal edition stays enabled in every build (the Worker
    // has no way to tell internal and public apps apart — see definitions.ts), so it
    // is filtered here instead: only a build with EXPO_PUBLIC_EVENT_REHEARSAL set
    // lists it. No __DEV__ term — the internal track is a release build.
    const editions =
        process.env.EXPO_PUBLIC_EVENT_REHEARSAL === 'true'
            ? withFixture
            : withFixture.filter((edition) => !edition.id.endsWith('-rehearsal'));
    return editions.filter(
        (edition) =>
            validateEdition(
                edition,
                (a) => a.game === 'the-ladder' && !!eventContent[a.contentRevision],
                (id) => !!eventRewardTitleKey(id),
            ).length === 0 && eventDiscoveryPhase(edition, now) !== null,
    );
}
