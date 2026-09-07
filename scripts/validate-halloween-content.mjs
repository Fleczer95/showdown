// Dedicated event-content release gate. Does not mutate banks, manifests or review evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const load = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const normalize = (s) =>
    s
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
function validate(bank, evidence, revision) {
    assert.equal(bank.type, 'ladder');
    assert.equal(bank.revision, revision);
    assert.equal(evidence.revision, bank.revision);
    assert.equal(evidence.status, 'reviewed', 'independent content review is still in progress');
    assert.equal(bank.questions.length, 300);
    assert.equal(evidence.items.length, 300);
    const ids = new Set();
    const prompts = { en: new Set(), pl: new Set() };
    const keys = [0, 0, 0, 0];
    const themes = new Map();
    const reviews = new Map(evidence.items.map((q) => [q.id, q]));
    assert.equal(reviews.size, 300, 'duplicate evidence IDs');
    for (const q of bank.questions) {
        assert.match(q.id, /^halloween-2026-\d{3}$/);
        assert(!ids.has(q.id), `duplicate ID ${q.id}`);
        ids.add(q.id);
        assert(Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 15, q.id);
        assert(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4, q.id);
        assert.equal(q.options.length, 4, q.id);
        keys[q.correctIndex]++;
        themes.set(q.theme, (themes.get(q.theme) ?? 0) + 1);
        for (const locale of ['en', 'pl']) {
            const prompt = normalize(q.prompt[locale]);
            assert(!prompts[locale].has(prompt), `duplicate ${locale} prompt: ${q.id}`);
            prompts[locale].add(prompt);
            assert.equal(new Set(q.options.map((o) => normalize(o[locale]))).size, 4, `duplicate option: ${q.id}`);
            for (const [text, max] of [
                [q.prompt[locale], 240],
                [q.hint[locale], 180],
                ...q.options.map((o) => [o[locale], 65]),
            ]) {
                assert(
                    typeof text === 'string' && text.length > 0 && text.length <= max,
                    `text length: ${q.id}/${locale}`,
                );
                assert.equal(text, text.trim(), `whitespace: ${q.id}`);
                assert.equal(text, text.normalize('NFC'), `Unicode normalization: ${q.id}`);
                assert(!/[\p{Cc}\p{Cf}]/u.test(text), `control or formatting character: ${q.id}`);
            }
        }
        const review = reviews.get(q.id);
        assert(review, `missing evidence: ${q.id}`);
        assert.deepEqual(review.answer, q.options[q.correctIndex], `reviewed answer changed: ${q.id}`);
        const contentHash = createHash('sha256')
            .update(JSON.stringify([q.id, q.difficulty, q.theme, q.prompt, q.options, q.correctIndex, q.hint]))
            .digest('hex');
        assert.equal(review.contentHash, contentHash, `content changed since review: ${q.id}`);
        assert(
            ['PASS', 'PASS_WITH_NOTE'].includes(review.verdict),
            `unresolved factual review: ${q.id} (${review.verdict})`,
        );
        assert(review.halloweenConnection?.trim(), `missing thematic connection: ${q.id}`);
        assert(review.sources.length > 0, `missing sources: ${q.id}`);
        for (const source of review.sources) {
            assert.equal(new URL(source.url).protocol, 'https:', `source protocol: ${q.id}`);
            assert(source.title?.trim() && source.supports?.trim(), `incomplete evidence: ${q.id}`);
        }
    }
    for (const id of reviews.keys()) assert(ids.has(id), `orphan review: ${id}`);
    for (let rung = 1; rung <= 15; rung++) {
        const group = bank.questions.filter((q) => q.difficulty === rung);
        assert.equal(group.length, 20, `rung ${rung}`);
        assert.deepEqual(
            [0, 1, 2, 3].map((i) => group.filter((q) => q.correctIndex === i).length),
            [5, 5, 5, 5],
            `rung ${rung} key balance`,
        );
        for (const theme of themes.keys())
            assert.equal(group.filter((q) => q.theme === theme).length, 4, `rung ${rung}/${theme}`);
    }
    assert.deepEqual([...themes.keys()].sort(), ['creatures', 'customs', 'places-harvest', 'science', 'stories']);
    assert.deepEqual(keys, [75, 75, 75, 75]);
    console.log(
        `PASS ${revision}: ${ids.size} EN/PL questions; 20 per rung; five themes; keys ${keys.join('/')}; ${reviews.size} evidence records.`,
    );
}

for (const [bankFile, evidenceFile, revision] of [
    ['ladder.json', 'halloween-2026-evidence.json', 'halloween-2026-v1'],
    ['ladder-v2.json', 'halloween-2026-v2-evidence.json', 'halloween-2026-v2'],
]) {
    validate(
        await load(`assets/events/halloween-2026/${bankFile}`),
        await load(`docs/content/${evidenceFile}`),
        revision,
    );
}
console.log(
    'This deterministic gate checks review coverage, not the truth of source claims. See docs/content/halloween-2026-review.md and docs/content/halloween-2026-v2-fixes.md for review scope.',
);
