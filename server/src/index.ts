import { verifyAppCheckToken } from './appcheck';
import {
    validateChallenge,
    validateAttempt,
    validateRankingEntry,
    isRankedGame,
    isWritablePeriod,
    isValidId,
    parseBoundedSyncIds,
} from './validation';
import { findActiveRematch, resolveRematchRecipient, type RematchParticipant } from './rematch';
import { canSubmitDirectedAttempt, isSameAttempt, type AttemptPayload } from './attempt';

// Showdown backend. One Worker fronting a D1 database; replaces the direct
// Firestore reads/writes (ADR-0003 / ADR-0004). Every request — read and write —
// must carry a valid Firebase App Check token. Payloads are validated to the same
// shape the old `firestore.rules` enforced, so behaviour is unchanged.

interface Env {
    DB: D1Database;
    FIREBASE_PROJECT_NUMBER: string;
}

interface RematchRow {
    id: string;
    game: string;
    createdBy: string;
    expiresAt: number;
    rematchOf: string;
}

interface ChallengeStatusRow {
    id: string;
    played: number;
    opponentPlayed: number;
}

function rematchSummary(row: RematchRow) {
    const creator = JSON.parse(row.createdBy) as { nickname: string };
    return {
        id: row.id,
        sourceChallengeId: row.rematchOf,
        game: row.game,
        senderNickname: creator.nickname,
        expiresAt: row.expiresAt,
    };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Parse a JSON request body, or null when it isn't valid JSON — a malformed body
 *  is a 400 (client error), not a 500. */
async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        return (await request.json()) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Prune challenges past their TTL plus their attempts. Two explicit statements so
 *  we never depend on D1 enforcing the FK CASCADE. Kicked off (via `waitUntil`) after
 *  a challenge is added so the originating create does not wait behind cleanup. */
async function cleanupExpired(env: Env): Promise<void> {
    const now = Date.now();
    await env.DB.batch([
        env.DB.prepare(
            'DELETE FROM attempts WHERE challengeId IN (SELECT id FROM challenges WHERE expiresAt < ?)',
        ).bind(now),
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
                const body = await parseJsonBody(request);
                if (!body) return json({ error: 'Invalid JSON' }, 400);
                const { id } = body;
                const record = {
                    lang: body.lang,
                    game: body.game,
                    questions: body.questions,
                    createdBy: body.createdBy,
                    expiresAt: body.expiresAt,
                    mascot: body.mascot,
                };
                if (!isValidId(id) || !validateChallenge(record)) return json({ error: 'Invalid challenge' }, 400);
                try {
                    await env.DB.prepare(
                        'INSERT INTO challenges (id, lang, game, questions, createdBy, expiresAt, mascot) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    )
                        .bind(
                            id,
                            record.lang,
                            record.game,
                            JSON.stringify(record.questions),
                            JSON.stringify(record.createdBy),
                            record.expiresAt,
                            JSON.stringify(record.mascot),
                        )
                        .run();
                } catch (err: any) {
                    // Immutable after create: a duplicate id is a conflict, never an overwrite.
                    if (err.message && err.message.includes('UNIQUE constraint failed')) {
                        return json({ error: 'Challenge already exists' }, 409);
                    }
                    throw err;
                }
                ctx.waitUntil(cleanupExpired(env));
                return json({ id }, 201);
            }

            // POST /challenges/:sourceId/rematch
            // Build a new immutable round while deriving its sole recipient from
            // the two completed source attempts. The client can never address an
            // arbitrary UUID. A unique rematchOf index makes retries and two
            // simultaneous "Rematch" taps converge on the same successor.
            if (method === 'POST' && seg.length === 3 && seg[0] === 'challenges' && seg[2] === 'rematch') {
                const sourceId = seg[1];
                const body = await parseJsonBody(request);
                if (!body || !isValidId(body.id) || !isValidId(body.senderUuid) || !validateChallenge(body.challenge)) {
                    return json({ error: 'Invalid rematch' }, 400);
                }
                const senderUuid = body.senderUuid;
                const record = body.challenge;
                if (record.createdBy.uuid !== senderUuid) return json({ error: 'Invalid rematch creator' }, 400);

                const source = await env.DB.prepare('SELECT game FROM challenges WHERE id = ? AND expiresAt > ?')
                    .bind(sourceId, Date.now())
                    .first<{ game: string }>();
                if (!source) return json({ error: 'Challenge not found' }, 404);
                if (record.game !== source.game) return json({ error: 'Rematch game must match source' }, 400);

                const { results: participants } = await env.DB.prepare(
                    'SELECT uuid, nickname FROM attempts WHERE challengeId = ? ORDER BY timestamp ASC LIMIT 3',
                )
                    .bind(sourceId)
                    .all<RematchParticipant>();
                const recipient = resolveRematchRecipient(participants, senderUuid);
                if (!recipient) {
                    return json({ error: 'Rematch requires exactly two completed participants' }, 409);
                }

                const existing = await findActiveRematch(env.DB, sourceId);
                if (existing) {
                    return json({ id: existing.id, created: false, recipientNickname: recipient.nickname });
                }

                try {
                    await env.DB.prepare(
                        `INSERT INTO challenges
                         (id, lang, game, questions, createdBy, expiresAt, mascot, rematchOf, recipientUuid)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                        .bind(
                            body.id,
                            record.lang,
                            record.game,
                            JSON.stringify(record.questions),
                            JSON.stringify(record.createdBy),
                            record.expiresAt,
                            JSON.stringify(record.mascot),
                            sourceId,
                            recipient.uuid,
                        )
                        .run();
                } catch (err: unknown) {
                    // A concurrent participant may have won the one-rematch race.
                    // Resolve that successor instead of surfacing a duplicate error.
                    const winner = await findActiveRematch(env.DB, sourceId);
                    if (winner) {
                        return json({ id: winner.id, created: false, recipientNickname: recipient.nickname });
                    }
                    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
                        return json({ error: 'Challenge already exists' }, 409);
                    }
                    throw err;
                }
                ctx.waitUntil(cleanupExpired(env));
                return json({ id: body.id, created: true, recipientNickname: recipient.nickname }, 201);
            }

            // GET /challenges/:sourceId/rematch/:uuid
            // Used by the result CTA before consuming a daily create allowance:
            // opening an already-created successor is free and idempotent.
            if (
                method === 'GET' &&
                seg.length === 4 &&
                seg[0] === 'challenges' &&
                seg[2] === 'rematch' &&
                isValidId(seg[3])
            ) {
                const member = await env.DB.prepare('SELECT 1 AS ok FROM attempts WHERE challengeId = ? AND uuid = ?')
                    .bind(seg[1], seg[3])
                    .first();
                if (!member) return json({ error: 'Not found' }, 404);
                const existing = await findActiveRematch(env.DB, seg[1]);
                if (!existing) return json({ error: 'Not found' }, 404);
                return json(existing);
            }

            // POST /rematches/sync
            // Discovery is scoped to source ids already indexed on this device,
            // rather than exposing a device-wide inbox by a public creator UUID.
            if (method === 'POST' && seg.length === 2 && seg[0] === 'rematches' && seg[1] === 'sync') {
                const sync = parseBoundedSyncIds(await parseJsonBody(request), 'sourceChallengeIds');
                if (!sync) return json({ error: 'Invalid rematch sync' }, 400);
                if (sync.ids.length === 0) return json([]);

                const placeholders = sync.ids.map(() => '?').join(', ');
                const { results } = await env.DB.prepare(
                    `SELECT c.id, c.game, c.createdBy, c.expiresAt, c.rematchOf
                         FROM challenges c
                         LEFT JOIN attempts mine
                           ON mine.challengeId = c.id AND mine.uuid = ?
                         WHERE c.recipientUuid = ?
                           AND c.rematchOf IN (${placeholders})
                           AND c.expiresAt > ?
                           AND mine.uuid IS NULL
                         ORDER BY c.expiresAt DESC`,
                )
                    .bind(sync.uuid, sync.uuid, ...sync.ids, Date.now())
                    .all<RematchRow>();
                return json(results.map(rematchSummary));
            }

            // POST /challenges/statuses
            // One bounded query refreshes History without issuing one request per
            // row. It reports this device's attempt and whether anyone else played.
            if (method === 'POST' && seg.length === 2 && seg[0] === 'challenges' && seg[1] === 'statuses') {
                const sync = parseBoundedSyncIds(await parseJsonBody(request), 'challengeIds');
                if (!sync) return json({ error: 'Invalid challenge status sync' }, 400);
                if (sync.ids.length === 0) return json([]);

                const placeholders = sync.ids.map(() => '?').join(', ');
                const { results } = await env.DB.prepare(
                    `SELECT c.id,
                            MAX(CASE WHEN a.uuid = ? THEN 1 ELSE 0 END) AS played,
                            MAX(CASE WHEN a.uuid <> ? THEN 1 ELSE 0 END) AS opponentPlayed
                       FROM challenges c
                       LEFT JOIN attempts a ON a.challengeId = c.id
                      WHERE c.id IN (${placeholders})
                        AND c.expiresAt > ?
                      GROUP BY c.id`,
                )
                    .bind(sync.uuid, sync.uuid, ...sync.ids, Date.now())
                    .all<ChallengeStatusRow>();
                return json(
                    results.map((row) => ({
                        id: row.id,
                        played: row.played === 1,
                        opponentPlayed: row.opponentPlayed === 1,
                    })),
                );
            }

            // GET /challenges/:id
            if (method === 'GET' && seg.length === 2 && seg[0] === 'challenges') {
                const row = await env.DB.prepare(
                    'SELECT lang, game, questions, createdBy, expiresAt, mascot FROM challenges WHERE id = ? AND expiresAt > ?',
                )
                    .bind(seg[1], Date.now())
                    .first<{
                        lang: string;
                        game: string;
                        questions: string;
                        createdBy: string;
                        expiresAt: number;
                        mascot: string;
                    }>();
                if (!row) return json({ error: 'Not found' }, 404);
                return json({
                    lang: row.lang,
                    game: row.game,
                    questions: JSON.parse(row.questions),
                    createdBy: JSON.parse(row.createdBy),
                    expiresAt: row.expiresAt,
                    mascot: JSON.parse(row.mascot),
                });
            }

            // POST /challenges/:id/attempts/:uuid
            if (method === 'POST' && seg.length === 4 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const challengeId = seg[1];
                const uuid = seg[3];
                const body = await parseJsonBody(request);
                if (!isValidId(uuid) || !body || !validateAttempt(body)) {
                    return json({ error: 'Invalid attempt' }, 400);
                }
                const attempt = body as unknown as AttemptPayload;

                // No orphan attempts: the unexpired parent must exist. Legacy and
                // group rounds stay open, while directed rematches admit only the
                // creator and their server-derived recipient.
                const parent = await env.DB.prepare(
                    'SELECT createdBy, recipientUuid FROM challenges WHERE id = ? AND expiresAt > ?',
                )
                    .bind(challengeId, Date.now())
                    .first<{ createdBy: string; recipientUuid: string | null }>();
                if (!parent) return json({ error: 'Challenge not found' }, 404);
                if (!canSubmitDirectedAttempt(parent.createdBy, parent.recipientUuid, uuid)) {
                    return json({ error: 'Challenge is limited to its two participants' }, 403);
                }

                try {
                    await env.DB.prepare(
                        'INSERT INTO attempts (challengeId, uuid, nickname, progress, score, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                    )
                        .bind(challengeId, uuid, attempt.nickname, attempt.progress, attempt.score, attempt.timestamp)
                        .run();
                } catch (err: unknown) {
                    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
                        const existing = await env.DB.prepare(
                            'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? AND uuid = ?',
                        )
                            .bind(challengeId, uuid)
                            .first<AttemptPayload>();
                        // A retry after an uncertain committed timeout is a normal,
                        // idempotent success. A changed result remains immutable.
                        if (existing && isSameAttempt(existing, attempt)) {
                            return json({ ok: true, existing: true });
                        }
                        return json({ error: 'AttemptConflict' }, 409);
                    }
                    throw err;
                }
                return json({ ok: true }, 201);
            }

            // GET /challenges/:id/attempts
            if (method === 'GET' && seg.length === 3 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const { results } = await env.DB.prepare(
                    'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? ORDER BY progress DESC LIMIT 100',
                )
                    .bind(seg[1])
                    .all();
                return json(results);
            }

            // GET /challenges/:id/attempts/:uuid
            if (method === 'GET' && seg.length === 4 && seg[0] === 'challenges' && seg[2] === 'attempts') {
                const attempt = await env.DB.prepare(
                    'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? AND uuid = ?',
                )
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
                const body = await parseJsonBody(request);
                if (!body || !isRankedGame(game) || !isWritablePeriod(period) || !validateRankingEntry(body)) {
                    return json({ error: 'Invalid ranking entry' }, 400);
                }
                const signature = typeof body.signature === 'string' ? body.signature : null;
                // Create, or update only when the new score is strictly higher
                // (best-only). An equal re-push is a no-op — idempotent, no error.
                await env.DB.prepare(
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
                const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 50, 100));
                const { results } = await env.DB.prepare(
                    'SELECT nickname, score, signature FROM rankings WHERE game = ? AND period = ? ORDER BY score DESC, uuid ASC LIMIT ?',
                )
                    .bind(seg[1], seg[2], limit)
                    .all<{ nickname: string; score: number; signature: string | null }>();
                // Drop null signatures so the wire shape matches RankingEntry (signature?: string).
                return json(results.map((r) => (r.signature ? r : { nickname: r.nickname, score: r.score })));
            }

            // GET /rankings/:game/:period/count
            if (method === 'GET' && seg.length === 4 && seg[0] === 'rankings' && seg[3] === 'count') {
                const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM rankings WHERE game = ? AND period = ?')
                    .bind(seg[1], seg[2])
                    .first<{ count: number }>();
                return json({ count: row?.count ?? 0 });
            }

            // GET /rankings/:game/:period/lowest
            if (method === 'GET' && seg.length === 4 && seg[0] === 'rankings' && seg[3] === 'lowest') {
                const row = await env.DB.prepare(
                    'SELECT score FROM rankings WHERE game = ? AND period = ? ORDER BY score ASC LIMIT 1',
                )
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
