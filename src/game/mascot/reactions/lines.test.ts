import { poolFor, LINES } from './lines';

describe('lines', () => {
    it('every bucket has at least one key', () => {
        for (const id of Object.keys(LINES) as (keyof typeof LINES)[]) {
            expect(LINES[id].keys.length).toBeGreaterThan(0);
        }
    });

    it('streak bucket carries an escalation ladder', () => {
        const pool = poolFor('streak');
        expect(pool.escalation).toBeDefined();
        expect(pool.escalation!.thresholds.length).toBe(pool.escalation!.keys.length);
    });
});
