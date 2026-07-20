import worker from './index';
import type { AttemptPayload } from './attempt';

jest.mock('./appcheck', () => ({ verifyAppCheckToken: jest.fn(() => Promise.resolve(true)) }));

const attempt: AttemptPayload = {
    nickname: 'Ada',
    progress: 7,
    score: 120,
    timestamp: 1234,
};

function request(uuid = 'ada'): Request {
    return new Request(`https://worker.test/challenges/round-1/attempts/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': 'valid' },
        body: JSON.stringify(attempt),
    });
}

function harness(options?: { recipientUuid?: string | null; existing?: AttemptPayload; duplicate?: boolean }) {
    const sql: string[] = [];
    const prepare = jest.fn((statement: string) => {
        sql.push(statement);
        return {
            bind: () => ({
                first: async () => {
                    if (statement.includes('SELECT createdBy, recipientUuid')) {
                        return {
                            createdBy: JSON.stringify({ uuid: 'ada', nickname: 'Ada' }),
                            recipientUuid: options?.recipientUuid ?? 'bob',
                        };
                    }
                    if (statement.includes('SELECT nickname, progress, score, timestamp')) {
                        return options?.existing ?? null;
                    }
                    return null;
                },
                run: async () => {
                    if (options?.duplicate)
                        throw new Error('UNIQUE constraint failed: attempts.challengeId, attempts.uuid');
                    return {};
                },
            }),
        };
    });
    const env = {
        DB: { prepare },
        FIREBASE_PROJECT_NUMBER: 'project',
    } as unknown as Parameters<typeof worker.fetch>[1];
    const ctx = { waitUntil: jest.fn() } as unknown as Parameters<typeof worker.fetch>[2];
    return { env, ctx, sql };
}

it('rejects a third participant before writing a directed rematch attempt', async () => {
    const { env, ctx, sql } = harness();

    const response = await worker.fetch(request('cara'), env, ctx);

    expect(response.status).toBe(403);
    expect(sql.some((statement) => statement.includes('INSERT INTO attempts'))).toBe(false);
});

it('returns success for an identical retry after the first write committed', async () => {
    const { env, ctx } = harness({ duplicate: true, existing: attempt });

    const response = await worker.fetch(request(), env, ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, existing: true });
});

it('keeps a conflicting retry immutable', async () => {
    const { env, ctx } = harness({ duplicate: true, existing: { ...attempt, score: attempt.score + 1 } });

    const response = await worker.fetch(request(), env, ctx);

    expect(response.status).toBe(409);
});
