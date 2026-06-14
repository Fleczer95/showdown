#!/usr/bin/env node

// On-demand cleanup for Async Challenge documents (ADR-0003).
//
// We deliberately run the project on the Firestore free (Spark) plan, which does
// not support TTL policies, so expired challenges are not auto-deleted. Expiry is
// still enforced for users at read time by `gateChallenge` — this script is pure
// storage hygiene. It runs two sweeps:
//
//   1. Expired challenges — challenge docs whose `expiresAt` has passed, deleted
//      along with their `attempts/{uuid}` subcollections (a plain doc delete does
//      NOT cascade, hence `recursiveDelete`).
//   2. Orphan attempts — `attempts` subcollections that survive under a `c/{id}`
//      whose parent challenge doc no longer exists. The security rules now block
//      creating these, but pre-guard data (or any future stray) is swept here so
//      no attempt outlives its challenge.
//
// Auth: a Firebase service-account key (Admin SDK bypasses security rules, so the
// "no client delete" rule does not block this). Generate one at
//   Firebase console → Project settings → Service accounts → Generate new private key
// and save it as `firebase-admin-key.json` at the repo root (gitignored), or point
// GOOGLE_APPLICATION_CREDENTIALS / --key at it.
//
// Usage:
//   node scripts/cleanup-expired-challenges.mjs            # delete expired challenges
//   node scripts/cleanup-expired-challenges.mjs --dry-run  # list only, delete nothing
//   node scripts/cleanup-expired-challenges.mjs --key ./path/to/key.json --project my-project

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_PROJECT = 'showdown-tv-quiz';
const CHALLENGES = 'c';
const ATTEMPTS = 'attempts';

function parseArgs(argv) {
    const args = { dryRun: false, project: DEFAULT_PROJECT, key: null };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--dry-run' || token === '-n') args.dryRun = true;
        else if (token === '--project') args.project = argv[++i];
        else if (token === '--key') args.key = argv[++i];
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

/** Sweep 1: delete challenge docs past their `expiresAt`, plus their attempts. */
async function sweepExpired(db, dryRun) {
    const now = admin.firestore.Timestamp.now();
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
        await db.recursiveDelete(doc.ref);
        deleted++;
    }
    console.log(`Deleted ${deleted} expired challenge(s) and their attempts.`);
}

/** Sweep 2: delete `attempts` subcollections left under a `c/{id}` with no challenge doc. */
async function sweepOrphanAttempts(db, dryRun) {
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
        await db.recursiveDelete(ref);
        deleted++;
    }
    console.log(`Deleted attempts under ${deleted} missing challenge(s).`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const keyPath = resolveKeyPath(args.key);

    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
        projectId: args.project,
    });
    const db = admin.firestore();

    await sweepExpired(db, args.dryRun);
    await sweepOrphanAttempts(db, args.dryRun);
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    },
);
