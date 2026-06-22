import { verifyAppCheckToken } from './appcheck';
import {
    validateChallenge,
    validateAttempt,
    validateRankingEntry,
    isRankedGame,
    isWritablePeriod,
    isValidId,
} from './validation';

// Showdown backend. One Worker fronting a D1 database; replaces the direct
// Firestore reads/writes (ADR-0003 / ADR-0004). Every request — read and write —
// must carry a valid Firebase App Check token. Payloads are validated to the same
// shape the old `firestore.rules` enforced, so behaviour is unchanged.

interface Env {
    DB: D1Database;
    FIREBASE_PROJECT_NUMBER: string;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Prune challenges past their TTL plus their attempts. Two explicit statements so
 *  we never depend on D1 enforcing the FK CASCADE. Kicked off (via `waitUntil`) when
 *  a challenge is added; it only touches already-expired rows, never the new one. */
async function cleanupExpired(env: Env): Promise<void> {
    const now = Date.now();
    await env.DB.batch([
        env.DB
            .prepare('DELETE FROM attempts WHERE challengeId IN (SELECT id FROM challenges WHERE expiresAt < ?)')
            .bind(now),
        env.DB.prepare('DELETE FROM challenges WHERE expiresAt < ?').bind(now),
    ]);
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;
        const seg = url.pathname.split('/').filter(Boolean);

        // App Check on every request — blocks scraping and write spam alike.
        const token = request.headers.get('X-Firebase-AppCheck');
        if (!(await verifyAppCheckToken(token, env.FIREBASE_PROJECT_NUMBER))) {
            return json({ error: 'App Check verification failed' }, 403);
        }

        try {
            // --- Challenges ------------------------------------------------------

            // POST /challenges
            if (method === 'POST' && seg.length === 1 && seg[0] === 'challenges') {
                const body = (await request.json()) as Record<string, unknown>;
                const { id } = body;
                const record = {
                    lang: body.lang,
                    game: body.game,
                    questions: body.questions,
                    createdBy: body.createdBy,
                    expiresAt: body.expiresAt,
                };
                if (!isValidId(id) || !validateChallenge(record)) return json({ error: 'Invalid challenge' }, 400);
                ctx.waitUntil(cleanupExpired(env));
                try {
                    await env.DB
                        .prepare(
                            'INSERT INTO challenges (id, lang, game, questions, createdBy, expiresAt) VALUES (?, ?, ?, ?, ?, ?)',
                        )
                        .bind(
                            id,
                            record.lang,
                            record.game,
                            JSON.stringify(record.questions),
                            JSON.stringify(record.createdBy),
                            record.expiresAt,
                        )
                        .run();
                } catch {
                    // Immutable after create: a duplicate id is a conflict, never an overwrite.
                    return json({ error: 'Challenge already exists' }, 409);
                }
                return json({ id }, 201);
            }

            // GET /challenges/:id
            if (method === 'GET' && seg.length === 2 && seg[0] === 'challenges') {
                const row = await env.DB
                    .prepare('SELECT lang, game, questions, createdBy, expiresAt FROM challenges WHERE id = ? AND expiresAt > ?')
                    .bind(seg[1], Date.now())
                    .first<{ lang: string; game: string; questions: string; createdBy: string; expiresAt: number }>();
                if (!row) return json({ error: 'Not found' }, 404);
                return json({
                    lang: row.lang,
                    game: row.game,
                    questions: JSON.parse(row.questions),
                    createdBy: JSON.parse(row.createdBy),
                    expiresAt: row.expiresAt,
                });
            }

            // POST /challenges/:id/attempts/:uuid
            if (method === 'POST' && seg.length === 4 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const challengeId = seg[1];
                const uuid = seg[3];
                const body = (await request.json()) as Record<string, unknown>;
                if (!validateAttempt(body)) return json({ error: 'Invalid attempt' }, 400);
                // No orphan attempts: the (unexpired) parent must exist.
                const parent = await env.DB
                    .prepare('SELECT 1 AS ok FROM challenges WHERE id = ? AND expiresAt > ?')
                    .bind(challengeId, Date.now())
                    .first();
                if (!parent) return json({ error: 'Challenge not found' }, 404);
                try {
                    await env.DB
                        .prepare(
                            'INSERT INTO attempts (challengeId, uuid, nickname, progress, score, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                        )
                        .bind(challengeId, uuid, body.nickname, body.progress, body.score, body.timestamp)
                        .run();
                } catch {
                    // One attempt per device — a second is rejected, never overwritten.
                    return json({ error: 'Attempt already exists' }, 409);
                }
                return json({ ok: true }, 201);
            }

            // GET /challenges/:id/attempts
            if (method === 'GET' && seg.length === 3 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const { results } = await env.DB
                    .prepare(
                        'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? ORDER BY progress DESC LIMIT 100',
                    )
                    .bind(seg[1])
                    .all();
                return json(results);
            }

            // GET /challenges/:id/attempts/:uuid
            if (method === 'GET' && seg.length === 4 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const attempt = await env.DB
                    .prepare('SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? AND uuid = ?')
                    .bind(seg[1], seg[3])
                    .first();
                if (!attempt) return json({ error: 'Not found' }, 404);
                return json(attempt);
            }

            // --- Rankings --------------------------------------------------------

            // POST /rankings/:game/:period/entries/:uuid
            if (method === 'POST' && seg.length === 5 && seg[0] === 'rankings' && seg[3] === 'entries') {
                const game = seg[1];
                const period = seg[2];
                const uuid = seg[4];
                const body = (await request.json()) as Record<string, unknown>;
                if (!isRankedGame(game) || !isWritablePeriod(period) || !validateRankingEntry(body)) {
                    return json({ error: 'Invalid ranking entry' }, 400);
                }
                const signature = typeof body.signature === 'string' ? body.signature : null;
                // Create, or update only when the new score is strictly higher
                // (best-only). An equal re-push is a no-op — idempotent, no error.
                await env.DB
                    .prepare(
                        `INSERT INTO rankings (game, period, uuid, nickname, score, signature) VALUES (?, ?, ?, ?, ?, ?)
                         ON CONFLICT(game, period, uuid) DO UPDATE SET
                           score = excluded.score, nickname = excluded.nickname, signature = excluded.signature
                         WHERE excluded.score > rankings.score`,
                    )
                    .bind(game, period, uuid, body.nickname, body.score, signature)
                    .run();
                return json({ ok: true });
            }

            // GET /rankings/:game/:period?limit=
            if (method === 'GET' && seg.length === 3 && seg[0] === 'rankings') {
                const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
                const { results } = await env.DB
                    .prepare(
                        'SELECT nickname, score, signature FROM rankings WHERE game = ? AND period = ? ORDER BY score DESC, uuid ASC LIMIT ?',
                    )
                    .bind(seg[1], seg[2], limit)
                    .all<{ nickname: string; score: number; signature: string | null }>();
                // Drop null signatures so the wire shape matches RankingEntry (signature?: string).
                return json(results.map((r) => (r.signature ? r : { nickname: r.nickname, score: r.score })));
            }

            // GET /rankings/:game/:period/count
            if (method === 'GET' && seg.length === 4 && seg[0] === 'rankings' && seg[3] === 'count') {
                const row = await env.DB
                    .prepare('SELECT COUNT(*) AS count FROM rankings WHERE game = ? AND period = ?')
                    .bind(seg[1], seg[2])
                    .first<{ count: number }>();
                return json({ count: row?.count ?? 0 });
            }

            // GET /rankings/:game/:period/lowest
            if (method === 'GET' && seg.length === 4 && seg[0] === 'rankings' && seg[3] === 'lowest') {
                const row = await env.DB
                    .prepare('SELECT score FROM rankings WHERE game = ? AND period = ? ORDER BY score ASC LIMIT 1')
                    .bind(seg[1], seg[2])
                    .first<{ score: number }>();
                return json({ score: row ? row.score : null });
            }

            return json({ error: 'Not found' }, 404);
        } catch (err) {
            console.error('Unhandled error', err);
            return json({ error: 'Internal error' }, 500);
        }
    },
} satisfies ExportedHandler<Env>;
