#!/usr/bin/env node

// On-demand storage hygiene for the Firestore data behind Async Challenge
// (ADR-0003) and the Global Ranking (ADR-0004).
//
// We deliberately run on the Firestore free (Spark) plan, which has no TTL
// policies, so nothing auto-deletes — this script is the manual replacement.
// Run it MONTHLY (it covers both the 30-day challenge expiry and stale ranking
// months). It runs these sweeps:
//
//   1. Expired challenges — `c/{id}` docs past `expiresAt`, with their
//      `attempts/{uuid}` subcollection (recursiveDelete, since delete doesn't
//      cascade).
//   2. Orphan attempts — `attempts` left under a `c/{id}` whose parent doc is
//      gone.
//   3. Ranking rotation — trim each `rankings/{game}/periods/{period}` bucket to
//      the top STORE_CAP entries by score (clients never delete; this is the
//      eviction/rotation — ADR-0004).
//   4. Ranking retention — delete month buckets older than the current +
//      RETAINED_MONTHS_BACK. `alltime` is never deleted.
//
// Every real (non-dry-run) deletion is first written to a timestamped local
// JSON backup at the repo root, so a wrong sweep is reversible.
//
// Auth: a Firebase service-account key (Admin SDK bypasses security rules AND
// App Check, so neither the "no client delete" rule nor enforce blocks this).
// Generate one at Firebase console → Project settings → Service accounts →
// Generate new private key and save it as `firebase-admin-key.json` at the repo
// root (gitignored), or point GOOGLE_APPLICATION_CREDENTIALS / --key at it.
//
// Usage:
//   node scripts/cleanup-expired-challenges.mjs                       # run all sweeps
//   node scripts/cleanup-expired-challenges.mjs --dry-run             # list only, delete nothing
//   node scripts/cleanup-expired-challenges.mjs --key ./key.json --project my-project
//   node scripts/cleanup-expired-challenges.mjs --remove the-ladder <uuid>   # moderation: pull one device's entries

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
// firebase-admin v14 dropped the namespaced default export under ESM
// (`admin.credential`/`admin.firestore` are undefined); use the modular entry points.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_PROJECT = 'showdown-tv-quiz';
const CHALLENGES = 'c';
const ATTEMPTS = 'attempts';

// --- Ranking (ADR-0004) — keep in sync with src/game/ranking/config.ts ---
const RANKINGS = 'rankings';
const PERIODS = 'periods';
const ENTRIES = 'entries';
const ALLTIME_PERIOD = 'alltime';
const STORE_CAP = 60;
const RETAINED_MONTHS_BACK = 2;
const RANKED_GAMES = ['the-ladder', 'the-drop', 'the-wheel'];

function parseArgs(argv) {
    const args = { dryRun: false, project: DEFAULT_PROJECT, key: null, remove: null };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--dry-run' || token === '-n') args.dryRun = true;
        else if (token === '--project') args.project = argv[++i];
        else if (token === '--key') args.key = argv[++i];
        else if (token === '--remove') args.remove = { game: argv[++i], uuid: argv[++i] };
    }
    return args;
}

function resolveKeyPath(explicit) {
    const candidate =
        explicit ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? path.join(REPO_ROOT, 'firebase-admin-key.json');
    if (!fs.existsSync(candidate)) {
        console.error(
            `\nNo service-account key found at: ${candidate}\n` +
                `Generate one (Firebase console → Project settings → Service accounts → Generate new private key)\n` +
                `and save it as firebase-admin-key.json at the repo root, or pass --key <path>.\n`,
        );
        process.exit(1);
    }
    return candidate;
}

/** The UTC `YYYY-MM` bucket `n` months before now. */
function monthsAgoBucket(n) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - n);
    const year = d.getUTCFullYear();
    const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
}

/** Push a doc snapshot onto the backup buffer (path + data) before it's deleted. */
function backupSnap(backup, snap) {
    backup.push({ path: snap.ref.path, data: snap.data() });
}

/** Write the accumulated backup to a timestamped local JSON file, if any. */
function writeBackup(backup) {
    if (backup.length === 0) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(REPO_ROOT, `firestore-backup-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Backup of ${backup.length} deleted doc(s) → ${path.basename(file)}`);
}

/** Sweep 1: delete challenge docs past their `expiresAt`, plus their attempts. */
async function sweepExpired(db, dryRun, backup) {
    const now = Timestamp.now();
    const snapshot = await db.collection(CHALLENGES).where('expiresAt', '<', now).get();

    if (snapshot.empty) {
        console.log('No expired challenges.');
        return;
    }

    console.log(`Found ${snapshot.size} expired challenge(s)${dryRun ? ' (dry run — not deleting):' : ':'}`);
    for (const doc of snapshot.docs) {
        const expiresAt = doc.get('expiresAt');
        const when = expiresAt?.toDate ? expiresAt.toDate().toISOString() : String(expiresAt);
        console.log(`  ${doc.id}  (expired ${when})`);
    }

    if (dryRun) return;

    // recursiveDelete removes each challenge plus its attempts/{uuid} subcollection.
    let deleted = 0;
    for (const doc of snapshot.docs) {
        backupSnap(backup, doc);
        const attempts = await doc.ref.collection(ATTEMPTS).get();
        attempts.docs.forEach((a) => backupSnap(backup, a));
        await db.recursiveDelete(doc.ref);
        deleted++;
    }
    console.log(`Deleted ${deleted} expired challenge(s) and their attempts.`);
}

/** Sweep 2: delete `attempts` subcollections left under a `c/{id}` with no challenge doc. */
async function sweepOrphanAttempts(db, dryRun, backup) {
    // collectionGroup spans every `attempts` subcollection; the parent of each
    // attempt's parent collection is the `c/{id}` challenge doc it belongs to.
    const attempts = await db.collectionGroup(ATTEMPTS).get();
    const parents = new Map();
    for (const doc of attempts.docs) {
        const challengeRef = doc.ref.parent.parent;
        if (challengeRef) parents.set(challengeRef.path, challengeRef);
    }

    const orphans = [];
    for (const ref of parents.values()) {
        const snap = await ref.get();
        if (!snap.exists) orphans.push(ref);
    }

    if (orphans.length === 0) {
        console.log('No orphan attempts.');
        return;
    }

    console.log(`Found ${orphans.length} orphan attempt group(s)${dryRun ? ' (dry run — not deleting):' : ':'}`);
    for (const ref of orphans) console.log(`  ${ref.id}`);

    if (dryRun) return;

    let deleted = 0;
    for (const ref of orphans) {
        const att = await ref.collection(ATTEMPTS).get();
        att.docs.forEach((a) => backupSnap(backup, a));
        await db.recursiveDelete(ref);
        deleted++;
    }
    console.log(`Deleted attempts under ${deleted} missing challenge(s).`);
}

/**
 * The period doc refs under a game. Uses `listDocuments()` because a period doc
 * holds no fields of its own (only an `entries` subcollection), so a normal
 * collection query would not return these "phantom" docs.
 */
function periodRefs(db, game) {
    return db.collection(RANKINGS).doc(game).collection(PERIODS).listDocuments();
}

/** Sweep 3: trim each ranking bucket to the top STORE_CAP entries by score. */
async function sweepRankingRotation(db, dryRun, backup) {
    let trimmed = 0;
    for (const game of RANKED_GAMES) {
        for (const periodRef of await periodRefs(db, game)) {
            const entries = await periodRef.collection(ENTRIES).orderBy('score', 'desc').get();
            if (entries.size <= STORE_CAP) continue;
            const overflow = entries.docs.slice(STORE_CAP);
            console.log(
                `  ${game}/${periodRef.id}: ${entries.size} entries → trim ${overflow.length}${dryRun ? ' (dry run)' : ''}`,
            );
            if (dryRun) continue;
            for (const d of overflow) {
                backupSnap(backup, d);
                await d.ref.delete();
            }
            trimmed += overflow.length;
        }
    }
    if (trimmed === 0) console.log('No ranking entries to rotate.');
    else console.log(`Rotated ${trimmed} over-cap ranking entr(ies).`);
}

/** Sweep 4: delete month buckets older than current − RETAINED_MONTHS_BACK. */
async function sweepRankingRetention(db, dryRun, backup) {
    const cutoff = monthsAgoBucket(RETAINED_MONTHS_BACK);
    let deleted = 0;
    for (const game of RANKED_GAMES) {
        for (const periodRef of await periodRefs(db, game)) {
            const id = periodRef.id;
            // Keep `alltime` and any month >= cutoff; YYYY-MM sorts chronologically.
            if (id === ALLTIME_PERIOD || !/^\d{4}-\d{2}$/.test(id) || id >= cutoff) continue;
            console.log(`  ${game}/${id}: stale month (< ${cutoff}) → delete${dryRun ? ' (dry run)' : ''}`);
            if (dryRun) continue;
            const entries = await periodRef.collection(ENTRIES).get();
            entries.docs.forEach((d) => backupSnap(backup, d));
            await db.recursiveDelete(periodRef);
            deleted++;
        }
    }
    if (deleted === 0) console.log('No stale ranking months to delete.');
    else console.log(`Deleted ${deleted} stale ranking month bucket(s).`);
}

/** Moderation: remove one device's entries across every period of a game. */
async function removeEntry(db, game, uuid, dryRun, backup) {
    if (!RANKED_GAMES.includes(game)) {
        console.error(`Unknown game "${game}". Expected one of: ${RANKED_GAMES.join(', ')}`);
        process.exit(1);
    }
    let removed = 0;
    for (const periodRef of await periodRefs(db, game)) {
        const ref = periodRef.collection(ENTRIES).doc(uuid);
        const snap = await ref.get();
        if (!snap.exists) continue;
        console.log(`  remove ${game}/${periodRef.id}/${uuid} (nickname: ${snap.get('nickname')})${dryRun ? ' (dry run)' : ''}`);
        if (dryRun) continue;
        backupSnap(backup, snap);
        await ref.delete();
        removed++;
    }
    if (removed === 0) console.log(`No entries found for ${game}/${uuid}.`);
    else console.log(`Removed ${removed} entr(ies) for ${game}/${uuid}.`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const keyPath = resolveKeyPath(args.key);

    initializeApp({
        credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
        projectId: args.project,
    });
    const db = getFirestore();
    const backup = [];

    if (args.remove) {
        await removeEntry(db, args.remove.game, args.remove.uuid, args.dryRun, backup);
    } else {
        await sweepExpired(db, args.dryRun, backup);
        await sweepOrphanAttempts(db, args.dryRun, backup);
        await sweepRankingRotation(db, args.dryRun, backup);
        await sweepRankingRetention(db, args.dryRun, backup);
    }

    if (!args.dryRun) writeBackup(backup);
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    },
);
