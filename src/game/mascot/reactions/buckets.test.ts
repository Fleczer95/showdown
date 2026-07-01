import { resolveBucket } from './buckets';

describe('buckets', () => {
    it('maps run-won to a spoken happy game bucket', () => {
        const b = resolveBucket('run-won');
        expect(b.id).toBe('run-won');
        expect(b.spoken).toBe(true);
        expect(b.expression).toBe('happy');
        expect(b.surfaces).toContain('game');
    });

    it('mid-run streak is expression-only and escalates', () => {
        const b = resolveBucket('streak-milestone');
        expect(b.spoken).toBe(false);
        expect(b.escalates).toBe(true);
    });

    it('level-up outranks a greeting', () => {
        expect(resolveBucket('level-up').priority).toBeGreaterThan(resolveBucket('home-focus').priority);
    });
});
