// Real local workerd/D1 integration; no cloud credentials or deployment.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const temp = await mkdtemp(join(tmpdir(), 'showdown-event-d1-'));
const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    d1Databases: ['DB'],
    compatibilityDate: '2026-06-22',
});
const realNow = Date.now;
try {
    const bundle = await build({
        entryPoints: [
            'server/src/events/admission.ts',
            'server/src/index.ts',
            'shared/events/fixtures.ts',
            'shared/events/halloween.ts',
        ],
        metafile: true,
        outdir: temp,
        outbase: '.',
        bundle: true,
        platform: 'node',
        format: 'esm',
        outExtension: { '.js': '.mjs' },
        plugins: [
            {
                name: 'test-app-check',
                setup(build) {
                    build.onLoad({ filter: /server\/src\/appcheck\.ts$/ }, () => ({
                        contents: 'export async function verifyAppCheckToken() { return true; }',
                        loader: 'ts',
                    }));
                },
            },
        ],
    });
    assert.ok(
        !Object.keys(bundle.metafile.inputs).some((path) => path.includes('assets/events/')),
        'Worker bundle contains ID manifests, not the answer bank',
    );
    const { halloweenQuestions, HALLOWEEN_CONTENT_REVISION, HALLOWEEN_V1_CONTENT_REVISION } = await import(
        pathToFileURL(join(temp, 'shared/events/halloween.mjs'))
    );
    const { admitEvent, AdmissionError } = await import(pathToFileURL(join(temp, 'server/src/events/admission.mjs')));
    const { default: worker } = await import(pathToFileURL(join(temp, 'server/src/index.mjs')));
    const {
        testEventEdition: edition,
        testEventQuestions: questions,
        halloweenPreviewEdition,
        halloweenV1PreviewEdition,
    } = await import(pathToFileURL(join(temp, 'shared/events/fixtures.mjs')));
    const db = await mf.getD1Database('DB');
    // Upgrade an existing installation, including an ordinary record that must survive.
    await db
        .prepare(
            `CREATE TABLE challenges (id TEXT PRIMARY KEY, lang TEXT NOT NULL, game TEXT NOT NULL, questions TEXT NOT NULL, createdBy TEXT NOT NULL, expiresAt INTEGER NOT NULL, mascot TEXT NOT NULL, rematchOf TEXT, recipientUuid TEXT)`,
        )
        .run();
    await db
        .prepare(`INSERT INTO challenges VALUES ('legacy', 'en', 'the-ladder', '[]', '{}', ?, '{}', NULL, NULL)`)
        .bind(edition.endsAt)
        .run();
    async function sqlFile(path) {
        const sql = (await readFile(path, 'utf8')).replace(/--[^\n]*/g, '');
        for (const statement of sql
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean))
            await db.prepare(statement).run();
    }
    await sqlFile('server/migrations/20260906-add-timed-events.sql');
    await sqlFile('server/schema.sql');
    assert.ok(await db.prepare("SELECT id FROM challenges WHERE id = 'legacy'").first());
    const record = (uuid, mode = 'random') => ({
        lang: 'en',
        game: 'the-ladder',
        questions,
        createdBy: { uuid, nickname: uuid },
        mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
        expiresAt: edition.endsAt + 30 * 86400000,
        event: { editionId: edition.id, contentRevision: 'local-ladder-v1', mode, endsAt: edition.endsAt },
    });
    const request = (uuid, requestId, mode = 'random', challengeId) => ({
        uuid,
        requestId,
        record: record(uuid, mode),
        challengeId,
    });
    let now = edition.startsAt + 1000;
    Date.now = () => now;
    const admit = (r, at = now) => admitEvent(db, r, at, true);
    await assert.rejects(
        admitEvent(db, request('a', 'disabled'), now, false),
        (e) => e instanceof AdmissionError && e.status === 410,
    );
    const a = await admit(request('a', 'a1'));
    const own = await admit(request('a', 'a2'), now + 1);
    assert.notEqual(a.id, own.id, 'never self-match');
    const [b, c] = await Promise.all([admit(request('b', 'b1'), now + 2), admit(request('c', 'c1'), now + 2)]);
    assert.deepEqual(
        new Set([b.id, c.id]),
        new Set([a.id, own.id]),
        'concurrent entrants take oldest available rounds without stealing a seat',
    );
    const retry = await admit(request('a', 'a1'), edition.endsAt + 1000);
    assert.equal(retry.id, a.id, 'committed admission retries work after closure');
    await assert.rejects(admit({ ...request('a', 'a1'), record: record('a', 'friend') }), /changed/);
    const friend = await admit(request('f', 'f1', 'friend'));
    const friend2 = await admit(request('g', 'g1', 'friend'));
    assert.notEqual(friend.id, friend2.id, 'friend rounds never enter random queue');
    const claims = await Promise.allSettled([
        admit(request('h', 'h1', 'friend', friend.id)),
        admit(request('i', 'i1', 'friend', friend.id)),
    ]);
    assert.equal(claims.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(claims.filter((r) => r.status === 'rejected' && r.reason.status === 409).length, 1);
    assert.equal(
        (await db.prepare('SELECT COUNT(*) AS n FROM event_seats WHERE challengeId = ?').bind(friend.id).first()).n,
        2,
    );
    const old = await admit(request('waiting', 'waiting1'), now + 100);
    assert.equal(
        (await admit(request('late', 'late1'), edition.endsAt - 1)).id,
        old.id,
        'unmatched rounds remain eligible until closure',
    );
    await assert.rejects(admit(request('closed', 'closed1'), edition.endsAt), (e) => e.status === 410);

    const env = { DB: db, FIREBASE_PROJECT_NUMBER: 'local', ENABLE_EVENT_FIXTURE: 'true' };
    const tasks = [];
    const ctx = {
        waitUntil(p) {
            tasks.push(p);
        },
    };
    const call = (path, body) =>
        worker.fetch(
            new Request(`https://local/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }),
            env,
            ctx,
        );
    const halloweenStart = {
        uuid: 'halloween-player',
        requestId: 'halloween-first',
        record: {
            ...record('halloween-player'),
            questions: halloweenQuestions.map((q) => ({ id: q.id, alternates: q.alternates.slice(0, 5) })),
            event: {
                editionId: halloweenPreviewEdition.id,
                contentRevision: HALLOWEEN_CONTENT_REVISION,
                mode: 'random',
                endsAt: halloweenPreviewEdition.endsAt,
            },
        },
    };
    await assert.rejects(admitEvent(db, halloweenStart, now, false), (e) => e.status === 410, 'preview stays gated');
    const halloweenResponse = await call('events/start', halloweenStart);
    assert.equal(halloweenResponse.status, 200, 'current Halloween pool admits through real Worker parser and D1');
    const currentHalloween = await halloweenResponse.json();
    const legacyStart = {
        ...halloweenStart,
        uuid: 'halloween-v1-player',
        requestId: 'retained-v1',
        record: {
            ...halloweenStart.record,
            createdBy: { uuid: 'halloween-v1-player', nickname: 'Legacy' },
            event: {
                ...halloweenStart.record.event,
                editionId: halloweenV1PreviewEdition.id,
                contentRevision: HALLOWEEN_V1_CONTENT_REVISION,
            },
        },
    };
    const legacyResponse = await call('events/start', legacyStart);
    assert.equal(legacyResponse.status, 200, 'retained v1 fixture remains supported');
    const legacyHalloween = await legacyResponse.json();
    assert.notEqual(legacyHalloween.id, currentHalloween.id, 'v1 and v2 never share a random match');
    assert.equal(
        (
            await call('events/start', {
                ...legacyStart,
                requestId: 'v1-edition-wrong-revision',
                record: {
                    ...legacyStart.record,
                    event: { ...legacyStart.record.event, contentRevision: HALLOWEEN_CONTENT_REVISION },
                },
            })
        ).status,
        400,
        'an old edition cannot silently adopt the revised content',
    );
    assert.equal(
        (await (await call('events/start', legacyStart)).json()).id,
        legacyHalloween.id,
        'v1 retry stays idempotent',
    );
    assert.equal(
        (
            await call('events/start', {
                ...halloweenStart,
                requestId: 'too-many-alternates',
                record: { ...halloweenStart.record, questions: halloweenQuestions },
            })
        ).status,
        400,
    );
    assert.equal(
        (
            await call('events/start', {
                ...halloweenStart,
                requestId: 'wrong-rung',
                record: { ...halloweenStart.record, questions: [...halloweenStart.record.questions].reverse() },
            })
        ).status,
        400,
    );
    assert.equal(
        (
            await call('events/start', {
                ...halloweenStart,
                requestId: 'production-disabled',
                record: {
                    ...halloweenStart.record,
                    event: { ...halloweenStart.record.event, editionId: 'halloween-2026' },
                },
            })
        ).status,
        410,
    );
    const hundredIds = [a.id, ...Array.from({ length: 99 }, (_, i) => `unknown-${i}`)];
    const statuses = await call('challenges/statuses', { uuid: 'a', challengeIds: hundredIds });
    assert.equal(statuses.status, 200, '100-id API requests stay below the D1 bound-parameter limit');
    assert.deepEqual(await statuses.json(), [{ id: a.id, played: false, opponentPlayed: false, opponentJoined: true }]);
    assert.equal((await call('rematches/sync', { uuid: 'a', sourceChallengeIds: hundredIds })).status, 200);
    const attempt = { nickname: 'a', progress: 0, score: 0, timestamp: edition.endsAt - 1 };
    now = edition.endsAt + 29 * 86400000;
    assert.equal(
        (await call(`challenges/${a.id}/attempts/a`, attempt)).status,
        201,
        'pre-close completion uploads late',
    );
    assert.equal((await call(`challenges/${a.id}/attempts/a`, attempt)).status, 200, 'identical retry immutable');
    assert.equal((await call(`challenges/${a.id}/attempts/a`, { ...attempt, score: 1 })).status, 409);
    assert.equal((await call(`challenges/${a.id}/attempts/outsider`, attempt)).status, 403);
    assert.equal(
        (await call(`challenges/${own.id}/attempts/a`, { ...attempt, timestamp: edition.endsAt })).status,
        410,
    );
    // Successful ordinary creation invokes the actual cleanup batch.
    const ordinary = { ...record('ordinary') };
    delete ordinary.event;
    ordinary.expiresAt = now + 86400000;
    assert.equal((await call('challenges', { ...ordinary, id: 'cleanup-before' })).status, 201);
    await Promise.all(tasks.splice(0));
    assert.ok(
        await db.prepare('SELECT id FROM challenges WHERE id = ?').bind(a.id).first(),
        'event retained beyond ordinary 31-day limit',
    );
    now = edition.endsAt + 30 * 86400000;
    assert.equal(
        (await call(`challenges/${a.id}/attempts/a`, attempt)).status,
        200,
        'known identical retry precedes new-write deadline gates',
    );
    assert.equal(
        (await call(`challenges/${own.id}/attempts/a`, attempt)).status,
        410,
        'no new upload at retention boundary',
    );
    assert.equal(
        (await call('challenges', { ...ordinary, expiresAt: now + 86400000, id: 'cleanup-after' })).status,
        201,
    );
    await Promise.all(tasks.splice(0));
    assert.equal(await db.prepare('SELECT id FROM challenges WHERE id = ?').bind(a.id).first(), null);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM event_seats').first()).n, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM event_start_requests').first()).n, 0);
    console.log(
        'PASS: D1 migration, Halloween content admission/transport/production gates, concurrent allocation, idempotency, self/full/friend isolation, deadlines, late immutable uploads, retention and cleanup.',
    );
} finally {
    Date.now = realNow;
    await mf.dispose();
    await rm(temp, { recursive: true, force: true });
}
