#!/usr/bin/env node

// On-demand cleanup for Async Challenge documents (ADR-0003).
//
// We deliberately run the project on the Firestore free (Spark) plan, which does
// not support TTL policies, so expired challenges are not auto-deleted. Expiry is
// still enforced for users at read time by `gateChallenge` — this script is pure
// storage hygiene: it permanently deletes challenge docs whose `expiresAt` has
// passed, along with their `attempts/{uuid}` subcollections (a plain doc delete
// does NOT cascade, hence `recursiveDelete`).
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const keyPath = resolveKeyPath(args.key);

    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
        projectId: args.project,
    });
    const db = admin.firestore();

    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection(CHALLENGES).where('expiresAt', '<', now).get();

    if (snapshot.empty) {
        console.log('No expired challenges. Nothing to clean up.');
        return;
    }

    console.log(`Found ${snapshot.size} expired challenge(s)${args.dryRun ? ' (dry run — not deleting):' : ':'}`);
    for (const doc of snapshot.docs) {
        const expiresAt = doc.get('expiresAt');
        const when = expiresAt?.toDate ? expiresAt.toDate().toISOString() : String(expiresAt);
        console.log(`  ${doc.id}  (expired ${when})`);
    }

    if (args.dryRun) return;

    // recursiveDelete removes each challenge plus its attempts/{uuid} subcollection.
    let deleted = 0;
    for (const doc of snapshot.docs) {
        await db.recursiveDelete(doc.ref);
        deleted++;
    }
    console.log(`Deleted ${deleted} expired challenge(s) and their attempts.`);
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    },
);
