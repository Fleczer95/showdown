import { eventDiscoveryPhase, visibleEvents } from './catalogue';
import { eventEditions, validateEdition, type EventEdition } from '../../../shared/events/definitions';
import { halloweenPreviewEdition, halloweenV1PreviewEdition, testEventEdition } from '../../../shared/events/fixtures';

const day = 86400000;
const edition: EventEdition = { ...testEventEdition, id: 'seasonal-test', startsAt: 20 * day, endsAt: 30 * day };

test.each([
    [13 * day - 1, null],
    [13 * day, 'upcoming'],
    [20 * day - 1, 'upcoming'],
    [20 * day, 'active'],
    [30 * day - 1, 'active'],
    [30 * day, 'closed'],
    [37 * day - 1, 'closed'],
    [37 * day, null],
])('discovery phase at %s is %s', (now, phase) => {
    expect(eventDiscoveryPhase(edition, now as number)).toBe(phase);
});

test('drafts and missing schedules never get promoted', () => {
    expect(eventDiscoveryPhase({ ...edition, enabled: false }, 20 * day)).toBeNull();
    expect(eventDiscoveryPhase({ ...edition, startsAt: undefined }, 20 * day)).toBeNull();
    expect(eventDiscoveryPhase({ ...edition, endsAt: undefined }, 20 * day)).toBeNull();
});

test('discovery windows can be configured without changing play dates', () => {
    const custom = { ...edition, discoveryWindow: { beforeDays: 2, afterDays: 1 } };
    expect(eventDiscoveryPhase(custom, 18 * day - 1)).toBeNull();
    expect(eventDiscoveryPhase(custom, 18 * day)).toBe('upcoming');
    expect(eventDiscoveryPhase(custom, 30 * day)).toBe('closed');
    expect(eventDiscoveryPhase(custom, 31 * day)).toBeNull();
});

test.each([-1, 0.5, Infinity, NaN])('invalid discovery window %s is rejected', (days) => {
    expect(
        validateEdition(
            { ...edition, discoveryWindow: { beforeDays: days, afterDays: 7 } },
            () => true,
            () => true,
        ),
    ).toContain('discovery window');
});

test('catalogue includes upcoming/results editions, but hides drafts and invalid editions', () => {
    const original = [...eventEditions];
    const mutable = eventEditions as EventEdition[];
    try {
        mutable.splice(
            0,
            mutable.length,
            edition,
            { ...edition, id: 'draft', enabled: false },
            { ...edition, id: 'invalid', prizePool: [] },
        );
        expect(visibleEvents(13 * day).map((e) => e.id)).toEqual(['seasonal-test']);
        expect(visibleEvents(30 * day).map((e) => e.id)).toEqual(['seasonal-test']);
        expect(visibleEvents(37 * day)).toEqual([]);
    } finally {
        mutable.splice(0, mutable.length, ...original);
    }
});

test('no fixture edition can reach the catalogue', () => {
    // Fixtures are test data. There is no environment switch that shows them, so
    // a second Halloween card can never appear on Home.
    const ids = visibleEvents(Date.UTC(2026, 9, 1)).map((e) => e.id);
    for (const fixture of [testEventEdition, halloweenPreviewEdition, halloweenV1PreviewEdition]) {
        expect(ids).not.toContain(fixture.id);
    }
});
