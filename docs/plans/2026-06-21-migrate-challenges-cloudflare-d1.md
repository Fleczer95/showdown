# Migrate Challenges and Rankings to Cloudflare D1 with App Check

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ShowDown's asynchronous challenge and ranking data storage from Firebase Firestore to Cloudflare Workers + D1 database to bypass Firestore's daily free tier quotas, while retaining the client-side Firebase App Check security layer for request attestation.

**Architecture:** 
1. Build a lightweight Cloudflare Worker API backed by a Cloudflare D1 (SQLite) relational database with table structures for `challenges`, `attempts`, and `rankings`.
2. Keep the existing client-side Firebase App Check configuration. On every network write (or read), request the cached App Check token and attach it as an `X-Firebase-AppCheck` header.
3. The Cloudflare Worker verifies the JWT App Check signature using the Web Crypto API against Google's public JWKS certificates, rejecting unauthorized requests before executing database queries.

**Tech Stack:**
* **Backend:** Cloudflare Workers (TypeScript), Wrangler CLI, Cloudflare D1 (SQLite), Web Crypto API (native JWT verification).
* **Frontend:** React Native (TypeScript), React Native Firebase App Check client, Fetch API.

---

## Migration Steps

### Task 1: Setup Worker Project and Database Schema

Configure the Wrangler project structure and define the SQLite tables for storing challenges, attempts, and monthly/alltime rankings.

**Files:**
* Create: `server/wrangler.toml`
* Create: `server/schema.sql`
* Create: `server/package.json`

**Step 1: Create Wrangler configurations and SQL Schema**

Define the schema in `server/schema.sql`:
```sql
-- Challenges Table
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    lang TEXT NOT NULL,
    game TEXT NOT NULL,
    questions TEXT NOT NULL, -- JSON stringified questions array
    createdBy TEXT NOT NULL, -- JSON stringified { uuid, nickname }
    expiresAt INTEGER NOT NULL -- Epoch timestamp in ms
);

-- Index for checking expiration
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expiresAt);

-- Attempts Table (tied to challenges)
CREATE TABLE IF NOT EXISTS attempts (
    challengeId TEXT NOT NULL,
    uuid TEXT NOT NULL,
    nickname TEXT NOT NULL,
    progress INTEGER NOT NULL,
    score INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (challengeId, uuid),
    FOREIGN KEY (challengeId) REFERENCES challenges(id) ON DELETE CASCADE
);

-- Rankings Table (monthly/all-time leaderboards)
CREATE TABLE IF NOT EXISTS rankings (
    game TEXT NOT NULL,
    period TEXT NOT NULL,
    uuid TEXT NOT NULL,
    nickname TEXT NOT NULL,
    score INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (game, period, uuid)
);

-- Index for pulling top scoreboard entries quickly
CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings(game, period, score DESC);
```

Define the configuration in `server/wrangler.toml`:
```toml
name = "showdown-backend"
main = "src/index.ts"
compatibility_date = "2026-06-21"

[vars]
FIREBASE_PROJECT_NUMBER = "YOUR_FIREBASE_PROJECT_NUMBER" # Replace with real Google Cloud project number
FIREBASE_PROJECT_ID = "YOUR_FIREBASE_PROJECT_ID" # Replace with real Firebase project ID

[[d1_databases]]
binding = "DB"
database_name = "showdown_db"
database_id = "YOUR_D1_DATABASE_ID_HERE"
```

Define dependencies in `server/package.json`:
```json
{
  "name": "showdown-backend",
  "version": "1.0.0",
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240405.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.50.0"
  }
}
```

**Step 2: Commit initial backend structures**
```bash
git add server/wrangler.toml server/schema.sql server/package.json
git commit -m "chore: add cloudflare worker configuration and D1 schema"
```

---

### Task 2: Implement Cryptographic App Check Verification in Worker

Verify standard App Check JSON Web Tokens (JWT) inside Cloudflare Workers without using the heavy Firebase Admin SDK.

**Files:**
* Create: `server/src/appcheck.ts`

**Step 1: Write Web Crypto token verification logic**

Implement validation in `server/src/appcheck.ts`:
```typescript
interface JWK {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
}

interface JWKS {
  keys: JWK[];
}

interface JWTHeader {
  alg: string;
  kid: string;
}

interface JWTPayload {
  iss: string;
  sub: string;
  aud: string[];
  exp: number;
  [key: string]: any;
}

// Convert base64url to ArrayBuffer for Web Crypto
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

// Fetch Google's public JWK set for App Check, caching it using Cloudflare's Cache API
async function getFirebasePublicKeys(projectNumber: string): Promise<JWKS> {
  const url = `https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/keys`;
  const response = await fetch(url, {
    cf: {
      cacheTtl: 86400, // Cache for 24 hours
      cacheEverything: true,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch App Check public keys');
  }
  return response.json();
}

/**
 * Validates a Firebase App Check JWT.
 * Returns true if valid, false or throws if invalid.
 */
export async function verifyAppCheckToken(
  token: string | null,
  projectNumber: string,
  projectId: string
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [rawHeader, rawPayload, rawSignature] = parts;

  // 1. Decode Header and Payload
  let header: JWTHeader;
  let payload: JWTPayload;
  try {
    header = JSON.parse(atob(rawHeader.replace(/-/g, '+').replace(/_/g, '/')));
    payload = JSON.parse(atob(rawPayload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return false;
  }

  // 2. Validate Standard Claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return false; // Expired

  const expectedIssuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`;
  if (payload.iss !== expectedIssuer) return false;

  const expectedAudience = `projects/${projectId}`;
  if (!payload.aud || !payload.aud.includes(expectedAudience)) return false;

  // 3. Verify Signature using Web Crypto
  try {
    const jwks = await getFirebasePublicKeys(projectNumber);
    const keyInfo = jwks.keys.find((k) => k.kid === header.kid);
    if (!keyInfo) return false;

    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'RSA',
        alg: 'RS256',
        n: keyInfo.n,
        e: keyInfo.e,
        ext: true,
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBuffer = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
    const signatureBuffer = base64UrlToBuffer(rawSignature);

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBuffer,
      dataBuffer
    );
  } catch (err) {
    console.error('App Check validation error:', err);
    return false;
  }
}
```

**Step 2: Commit validation module**
```bash
git add server/src/appcheck.ts
git commit -m "feat: implement App Check JWT Web Crypto validation for Cloudflare Worker"
```

---

### Task 3: Build Worker API Router & Handlers

Implement the endpoints in the Cloudflare Worker to read/write challenges and submit ranking leaderboard scores.

**Files:**
* Create: `server/src/index.ts`

**Step 1: Write handler logic for HTTP endpoints**

Implement code in `server/src/index.ts`:
```typescript
import { verifyAppCheckToken } from './appcheck';

interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_NUMBER: string;
  FIREBASE_PROJECT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Firebase-AppCheck',
        },
      });
    }

    const appCheckToken = request.headers.get('X-Firebase-AppCheck');
    const isWrite = method === 'POST';

    // Enforcement: Reject write requests immediately if App Check token is missing or invalid.
    if (isWrite) {
      const isValid = await verifyAppCheckToken(
        appCheckToken,
        env.FIREBASE_PROJECT_NUMBER,
        env.FIREBASE_PROJECT_ID
      );
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Unauthorized: App Check failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    try {
      // Lazy cleanup of expired challenges on writes
      if (isWrite) {
        await env.DB.prepare('DELETE FROM challenges WHERE expiresAt < ?').bind(Date.now()).run();
      }

      // --- Challenges Endpoints ---
      
      // POST /challenges
      if (method === 'POST' && url.pathname === '/challenges') {
        const body: any = await request.json();
        const { id, lang, game, questions, createdBy, expiresAt } = body;
        
        await env.DB.prepare(
          'INSERT INTO challenges (id, lang, game, questions, createdBy, expiresAt) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(id, lang, game, JSON.stringify(questions), JSON.stringify(createdBy), expiresAt)
        .run();

        return new Response(JSON.stringify({ id }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /challenges/:id
      if (method === 'GET' && url.pathname.startsWith('/challenges/')) {
        const id = url.pathname.split('/')[2];
        const record = await env.DB.prepare('SELECT * FROM challenges WHERE id = ? AND expiresAt > ?')
          .bind(id, Date.now())
          .first<any>();

        if (!record) {
          return new Response(JSON.stringify({ error: 'Challenge not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        return new Response(
          JSON.stringify({
            id: record.id,
            lang: record.lang,
            game: record.game,
            questions: JSON.parse(record.questions),
            createdBy: JSON.parse(record.createdBy),
            expiresAt: record.expiresAt,
          }),
          {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      // POST /challenges/:id/attempts/:uuid
      if (method === 'POST' && url.pathname.match(/^\/challenges\/[^/]+\/attempts\/[^/]+$/)) {
        const parts = url.pathname.split('/');
        const challengeId = parts[2];
        const uuid = parts[4];
        const body: any = await request.json();
        const { nickname, progress, score, timestamp } = body;

        await env.DB.prepare(
          'INSERT INTO attempts (challengeId, uuid, nickname, progress, score, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(challengeId, uuid, nickname, progress, score, timestamp)
        .run();

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /challenges/:id/attempts
      if (method === 'GET' && url.pathname.match(/^\/challenges\/[^/]+\/attempts$/)) {
        const challengeId = url.pathname.split('/')[2];
        const { results } = await env.DB.prepare(
          'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? ORDER BY progress DESC LIMIT 100'
        )
        .bind(challengeId)
        .all();

        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /challenges/:id/attempts/:uuid
      if (method === 'GET' && url.pathname.match(/^\/challenges\/[^/]+\/attempts\/[^/]+$/)) {
        const parts = url.pathname.split('/');
        const challengeId = parts[2];
        const uuid = parts[4];

        const attempt = await env.DB.prepare(
          'SELECT nickname, progress, score, timestamp FROM attempts WHERE challengeId = ? AND uuid = ?'
        )
        .bind(challengeId, uuid)
        .first();

        if (!attempt) {
          return new Response(JSON.stringify({ error: 'Attempt not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        return new Response(JSON.stringify(attempt), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // --- Rankings Endpoints ---

      // POST /rankings/:game/:period/entries/:uuid
      if (method === 'POST' && url.pathname.match(/^\/rankings\/[^/]+\/[^/]+\/entries\/[^/]+$/)) {
        const parts = url.pathname.split('/');
        const game = parts[2];
        const period = parts[3];
        const uuid = parts[5];
        const body: any = await request.json();
        const { nickname, score, timestamp } = body;

        await env.DB.prepare(
          'INSERT INTO rankings (game, period, uuid, nickname, score, timestamp) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(game, period, uuid) DO UPDATE SET score = excluded.score, timestamp = excluded.timestamp WHERE excluded.score > rankings.score'
        )
        .bind(game, period, uuid, nickname, score, timestamp)
        .run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /rankings/:game/:period
      if (method === 'GET' && url.pathname.match(/^\/rankings\/[^/]+\/[^/]+$/)) {
        const parts = url.pathname.split('/');
        const game = parts[2];
        const period = parts[3];
        
        const limit = Number(url.searchParams.get('limit') || '50');

        const { results } = await env.DB.prepare(
          'SELECT uuid, nickname, score, timestamp FROM rankings WHERE game = ? AND period = ? ORDER BY score DESC, timestamp ASC LIMIT ?'
        )
        .bind(game, period, limit)
        .all();

        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /rankings/:game/:period/count
      if (method === 'GET' && url.pathname.match(/^\/rankings\/[^/]+\/[^/]+\/count$/)) {
        const parts = url.pathname.split('/');
        const game = parts[2];
        const period = parts[3];

        const row = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM rankings WHERE game = ? AND period = ?'
        )
        .bind(game, period)
        .first<any>();

        return new Response(JSON.stringify({ count: row.count }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET /rankings/:game/:period/lowest
      if (method === 'GET' && url.pathname.match(/^\/rankings\/[^/]+\/[^/]+\/lowest$/)) {
        const parts = url.pathname.split('/');
        const game = parts[2];
        const period = parts[3];

        const row = await env.DB.prepare(
          'SELECT score FROM rankings WHERE game = ? AND period = ? ORDER BY score ASC LIMIT 1'
        )
        .bind(game, period)
        .first<any>();

        return new Response(JSON.stringify({ score: row ? row.score : null }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
```

**Step 2: Commit API controller**
```bash
git add server/src/index.ts
git commit -m "feat: complete HTTP handler endpoints in Cloudflare Worker"
```

---

### Task 4: Refactor Client Store Services to Use Custom API

Refactor the client challenge and ranking stores to run raw `fetch` calls carrying App Check header tokens instead of directly calling Firestore SDK packages.

**Files:**
* Modify: `src/game/challenge/store.ts`
* Modify: `src/game/ranking/store.ts`

**Step 1: Rewrite `src/game/challenge/store.ts`**

Update challenge store to fetch API endpoints:
```typescript
import appCheck from '@react-native-firebase/app-check';
import type { Attempt, ChallengeRecord } from './types';
import { SafeSentry } from '../../utils/sentry/init';

const BASE_API_URL = 'https://api.showdown.lebene.pl'; // Replace with deployment URL

export class OfflineError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request failed — device appears offline.');
        this.name = 'OfflineError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

export class BlockedError extends Error {
    constructor(cause?: unknown) {
        super('Challenge request was rejected by the server.');
        this.name = 'BlockedError';
        if (cause instanceof Error) this.stack = cause.stack;
    }
}

const REQUEST_TIMEOUT_MS = 10_000;

// Fetch auth/verification headers containing the App Check token
async function getHeaders(requireAppCheck = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    try {
        const tokenResult = await appCheck().getToken(false);
        if (tokenResult.token) {
            headers['X-Firebase-AppCheck'] = tokenResult.token;
        } else if (requireAppCheck) {
            throw new Error('App Check token not available');
        }
    } catch (e) {
        if (requireAppCheck) throw e;
    }
    return headers;
}

export function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new OfflineError()), REQUEST_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                if (err instanceof BlockedError || err instanceof OfflineError) {
                    reject(err);
                } else if (err instanceof Response && err.status === 403) {
                    SafeSentry.captureException(err, { tags: { area: 'challenge-store' } });
                    reject(new BlockedError(err));
                } else {
                    reject(new OfflineError(err));
                }
            },
        );
    });
}

// Generate client ID (using simple crypto or UUID)
export function newChallengeId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createChallenge(record: ChallengeRecord, id?: string): Promise<string> {
    const docId = id || newChallengeId();
    const payload = { ...record, id: docId };

    const sendRequest = async () => {
        const headers = await getHeaders(true);
        const res = await fetch(`${BASE_API_URL}/challenges`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw res;
        return docId;
    };

    return withTimeout(sendRequest());
}

export async function getChallenge(id: string): Promise<ChallengeRecord | null> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/challenges/${id}`, {
            headers,
        });
        if (res.status === 404) return null;
        if (!res.ok) throw res;
        return res.json() as Promise<ChallengeRecord>;
    };

    return withTimeout(sendRequest());
}

export async function submitAttempt(id: string, uuid: string, attempt: Attempt): Promise<void> {
    const sendRequest = async () => {
        const headers = await getHeaders(true);
        const res = await fetch(`${BASE_API_URL}/challenges/${id}/attempts/${uuid}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(attempt),
        });
        if (!res.ok) throw res;
    };

    return withTimeout(sendRequest());
}

export async function getAttempts(id: string): Promise<Attempt[]> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/challenges/${id}/attempts`, {
            headers,
        });
        if (!res.ok) throw res;
        return res.json() as Promise<Attempt[]>;
    };

    return withTimeout(sendRequest());
}

export async function getAttempt(id: string, uuid: string): Promise<Attempt | null> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/challenges/${id}/attempts/${uuid}`, {
            headers,
        });
        if (res.status === 404) return null;
        if (!res.ok) throw res;
        return res.json() as Promise<Attempt>;
    };

    return withTimeout(sendRequest());
}
```

**Step 2: Rewrite `src/game/ranking/store.ts`**

Update ranking store to fetch API endpoints:
```typescript
import appCheck from '@react-native-firebase/app-check';
import { withTimeout } from '../challenge/store';
import { DISPLAY_SIZE } from './config';
import type { RankingEntry } from './types';

const BASE_API_URL = 'https://api.showdown.lebene.pl'; // Replace with deployment URL

async function getHeaders(requireAppCheck = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    try {
        const tokenResult = await appCheck().getToken(false);
        if (tokenResult.token) {
            headers['X-Firebase-AppCheck'] = tokenResult.token;
        } else if (requireAppCheck) {
            throw new Error('App Check token not available');
        }
    } catch (e) {
        if (requireAppCheck) throw e;
    }
    return headers;
}

export async function getBoard(game: string, period: string): Promise<RankingEntry[]> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/rankings/${game}/${period}?limit=${DISPLAY_SIZE}`, {
            headers,
        });
        if (!res.ok) throw res;
        return res.json() as Promise<RankingEntry[]>;
    };

    return withTimeout(sendRequest());
}

export async function countEntries(game: string, period: string): Promise<number> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/rankings/${game}/${period}/count`, {
            headers,
        });
        if (!res.ok) throw res;
        const data = await res.json() as { count: number };
        return data.count;
    };

    return withTimeout(sendRequest());
}

export async function lowestScore(game: string, period: string): Promise<number | null> {
    const sendRequest = async () => {
        const headers = await getHeaders(false);
        const res = await fetch(`${BASE_API_URL}/rankings/${game}/${period}/lowest`, {
            headers,
        });
        if (!res.ok) throw res;
        const data = await res.json() as { score: number | null };
        return data.score;
    };

    return withTimeout(sendRequest());
}

export async function submitEntry(game: string, period: string, uuid: string, entry: RankingEntry): Promise<void> {
    const sendRequest = async () => {
        const headers = await getHeaders(true);
        const res = await fetch(`${BASE_API_URL}/rankings/${game}/${period}/entries/${uuid}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(entry),
        });
        if (!res.ok) throw res;
    };

    return withTimeout(sendRequest());
}
```

**Step 3: Commit client changes**
```bash
git add src/game/challenge/store.ts src/game/ranking/store.ts
git commit -m "refactor: replace client-side Firestore storage with custom Worker fetch API"
```

---

### Task 5: Refactor Mock Tests and Verify Compatibility

Adjust unit tests to mock `fetch` instead of `@react-native-firebase/firestore` and verify that the app behaves identically.

**Files:**
* Modify: `src/game/challenge/store.test.ts`
* Modify: `src/game/ranking/push.test.ts`

**Step 1: Update Mock Tests**

Implement the global fetch mocks in `src/game/challenge/store.test.ts` and verify that timeouts and offline states are caught properly.

**Step 2: Run Tests**
Run CLI tests:
```bash
npm run test
```
Verify tests pass cleanly.

**Step 3: Commit and Finish**
```bash
git add src/game/challenge/store.test.ts src/game/ranking/push.test.ts
git commit -m "test: update unit tests to mock API fetch requests"
```
