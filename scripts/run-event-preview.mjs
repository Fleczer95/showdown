// Local simulator harness only. The production Worker/App Check code is never changed.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const token = process.env.EXPO_PUBLIC_LOCAL_PREVIEW_TOKEN;
if (!token || token.length < 32)
    throw new Error('Provide an ephemeral EXPO_PUBLIC_LOCAL_PREVIEW_TOKEN (32+ characters).');
const bundle = await build({
    absWorkingDir: root,
    entryPoints: ['server/src/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    plugins: [
        {
            name: 'loopback-simulator-attestation',
            setup(build) {
                build.onLoad({ filter: /server\/src\/appcheck\.ts$/ }, () => ({
                    // Only this in-memory bundle substitutes hardware attestation.
                    contents: `export async function verifyAppCheckToken(token) { return token === ${JSON.stringify(token)}; }`,
                    loader: 'js',
                }));
            },
        },
    ],
});
const mf = new Miniflare({
    host: '127.0.0.1',
    port: 8787,
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-06-22',
    d1Databases: ['DB'],
    d1Persist: process.env.EVENT_PREVIEW_DATA_DIR ?? '/tmp/showdown-halloween-preview-db',
    bindings: { FIREBASE_PROJECT_NUMBER: 'local-simulator', ENABLE_EVENT_FIXTURE: 'true' },
});
try {
    const db = await mf.getD1Database('DB');
    const sql = (await readFile(resolve(root, 'server/schema.sql'), 'utf8')).replace(/--[^\n]*/g, '');
    for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    console.log(`Halloween fixture backend ready at ${await mf.ready} (loopback only; no deployment).`);
} catch (error) {
    await mf.dispose();
    throw error;
}
for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
        await mf.dispose();
        process.exit(0);
    });
