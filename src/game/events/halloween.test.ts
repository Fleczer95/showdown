import { createHash } from 'node:crypto';
import bank from '../../../assets/events/halloween-2026/ladder-v2.json';
import legacyBank from '../../../assets/events/halloween-2026/ladder.json';
import {
    halloweenQuestions,
    HALLOWEEN_CONTENT_REVISION,
    HALLOWEEN_V1_CONTENT_REVISION,
} from '../../../shared/events/halloween';
import { eventContent, validEventQuestions } from '../../../shared/events/content';
import { eventEditions, findEdition, EVENT_UPLOAD_WINDOW_MS } from '../../../shared/events/definitions';
import { halloweenPreviewEdition, halloweenV1PreviewEdition, testEventEdition } from '../../../shared/events/fixtures';
import { isChallengeRecord } from '../../../shared/challenge/contract';
import { eventLadderIndex, eventQuestions } from './content';
import { RUNGS } from '../ladder/content';

const locales = ['en', 'pl'] as const;
const normalize = (s: string) =>
    s
        .normalize('NFC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');

test('Halloween contains exactly 300 distinct bilingual questions, 20 at each rung', () => {
    expect(bank.revision).toBe(HALLOWEEN_CONTENT_REVISION);
    expect(bank.type).toBe('ladder');
    expect(bank.questions).toHaveLength(300);
    expect(new Set(bank.questions.map((q) => q.id)).size).toBe(300);
    expect(new Set(bank.questions.map((q) => q.theme)).size).toBe(5);
    for (let rung = 1; rung <= 15; rung++) {
        const questions = bank.questions.filter((q) => q.difficulty === rung);
        expect(questions).toHaveLength(20);
        expect([0, 1, 2, 3].map((i) => questions.filter((q) => q.correctIndex === i).length)).toEqual([5, 5, 5, 5]);
        for (const theme of new Set(bank.questions.map((q) => q.theme)))
            expect(questions.filter((q) => q.theme === theme)).toHaveLength(4);
    }
    for (const locale of locales) {
        const existing = new Set(RUNGS.flat().map((q) => normalize(q.question[locale])));
        expect(new Set(bank.questions.map((q) => normalize(q.prompt[locale]))).size).toBe(300);
        for (const q of bank.questions) {
            expect(existing.has(normalize(q.prompt[locale]))).toBe(false);
            expect(q.options).toHaveLength(4);
            expect(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3).toBe(true);
            expect(new Set(q.options.map((o) => normalize(o[locale]))).size).toBe(4);
            for (const s of [q.prompt[locale], q.hint[locale], ...q.options.map((o) => o[locale])]) {
                expect(s.trim()).toBe(s);
                expect(s.length).toBeGreaterThan(0);
                expect(s).toBe(s.normalize('NFC'));
                expect(s).not.toMatch(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/);
            }
            expect(q.prompt[locale].length).toBeLessThanOrEqual(240);
            expect(q.hint[locale].length).toBeLessThanOrEqual(180);
            q.options.forEach((o) => expect(o[locale].length).toBeLessThanOrEqual(65));
        }
    }
});

test('the immutable manifest resolves all 300 IDs and both locales with their correct keys and hints', () => {
    expect(eventContent[HALLOWEEN_CONTENT_REVISION]).toEqual(halloweenQuestions);
    const ids = halloweenQuestions.flatMap((q) => [q.id, ...(q.alternates ?? [])]);
    expect(ids).toHaveLength(300);
    expect(new Set(ids).size).toBe(300);
    for (const locale of locales) {
        const index = eventLadderIndex(HALLOWEEN_CONTENT_REVISION, locale);
        expect(index.size).toBe(300);
        halloweenQuestions.forEach((rung, i) => {
            for (const id of [rung.id, ...(rung.alternates ?? [])]) {
                const question = bank.questions.find((q) => q.id === id)!;
                expect(question?.difficulty).toBe(i + 1);
                expect(index.get(id)).toEqual({
                    id,
                    prompt: question.prompt[locale],
                    options: question.options.map((o) => o[locale]),
                    correctIndex: question.correctIndex,
                    hint: question.hint[locale],
                });
            }
        });
    }
});

test('v2 changes only five reviewed wording/hint records, never their answers or difficulty', () => {
    expect(bank.revision).toBe('halloween-2026-v2');
    expect(legacyBank.revision).toBe(HALLOWEEN_V1_CONTENT_REVISION);
    const changed = bank.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(legacyBank.questions[i]));
    expect(changed.map((q) => q.id)).toEqual(
        [19, 49, 82, 162, 257].map((n) => `halloween-2026-${String(n).padStart(3, '0')}`),
    );
    bank.questions.forEach((q, i) => {
        const old = legacyBank.questions[i];
        expect([q.id, q.difficulty, q.theme, q.options, q.correctIndex]).toEqual([
            old.id,
            old.difficulty,
            old.theme,
            old.options,
            old.correctIndex,
        ]);
    });
    expect(bank.questions[18].hint).toEqual({
        en: 'Think of a celebration around the summer solstice.',
        pl: 'Pomyśl o święcie obchodzonym w okolicach przesilenia letniego.',
    });
    expect(bank.questions[81].prompt.pl).toMatch(/^W jaki sposób wiele/);
    expect(bank.questions[256].hint.en).not.toContain('museum');
});

test('every retained v1 question still resolves to its original wording in both locales', () => {
    expect(createHash('sha256').update(JSON.stringify(legacyBank)).digest('hex')).toBe(
        '7ab9da6960da3af6e55e954c05da8f5ec9bfb9ff559bebb162c464d66ce8feba',
    );
    expect(eventContent[HALLOWEEN_V1_CONTENT_REVISION]).toEqual(halloweenQuestions);
    eventContent[HALLOWEEN_V1_CONTENT_REVISION].forEach((rung, i) => {
        expect([rung.id, ...(rung.alternates ?? [])].sort()).toEqual(
            legacyBank.questions
                .filter((q) => q.difficulty === i + 1)
                .map((q) => q.id)
                .sort(),
        );
    });
    for (const locale of locales) {
        const index = eventLadderIndex(HALLOWEEN_V1_CONTENT_REVISION, locale);
        expect(index.size).toBe(300);
        for (const q of legacyBank.questions) {
            expect(index.get(q.id)).toEqual({
                id: q.id,
                prompt: q.prompt[locale],
                options: q.options.map((o) => o[locale]),
                correctIndex: q.correctIndex,
                hint: q.hint[locale],
            });
        }
    }
    expect(halloweenV1PreviewEdition.id).toBe('local-halloween-preview');
    expect(halloweenV1PreviewEdition.activities[0].contentRevision).toBe('halloween-2026-v1');
    expect(halloweenPreviewEdition.id).not.toBe(halloweenV1PreviewEdition.id);
    expect(findEdition(halloweenV1PreviewEdition.id)).toBeUndefined();
    expect(findEdition(halloweenV1PreviewEdition.id, true)).toBe(halloweenV1PreviewEdition);
});

test('a 20-question rung samples within the six-ID transport limit and preserves Skip alternatives', () => {
    const record = {
        lang: 'pl' as const,
        game: 'the-ladder' as const,
        questions: eventQuestions(HALLOWEEN_CONTENT_REVISION),
        createdBy: { uuid: 'halloween-tester', nickname: 'Tester' },
        mascot: { fur: 'a', suit: 'b', accent: 'c', mic: 'd' },
        expiresAt: halloweenPreviewEdition.endsAt! + EVENT_UPLOAD_WINDOW_MS,
        event: {
            editionId: halloweenPreviewEdition.id,
            contentRevision: HALLOWEEN_CONTENT_REVISION,
            mode: 'friend' as const,
            endsAt: halloweenPreviewEdition.endsAt!,
        },
    };
    expect(record.questions).toHaveLength(15);
    record.questions.forEach((q) => {
        expect(q.alternates).toHaveLength(5);
        expect(new Set([q.id, ...q.alternates!]).size).toBe(6);
    });
    expect(isChallengeRecord(record, { nowMs: halloweenPreviewEdition.startsAt })).toBe(true);
    expect(validEventQuestions(record)).toBe(true);
    const crossed = { ...record, questions: [...record.questions] };
    [crossed.questions[0], crossed.questions[1]] = [crossed.questions[1], crossed.questions[0]];
    expect(validEventQuestions(crossed)).toBe(false);
    expect(validEventQuestions({ ...record, questions: record.questions.map((q) => ({ id: q.id })) })).toBe(false);
});

test('sampling can select IDs beyond the first six entries in each rung', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.999999).mockReturnValueOnce(0);
    try {
        // Move the LAST candidate to the front, then leave the rest in place.
        const questions = eventQuestions(HALLOWEEN_CONTENT_REVISION);
        expect(questions[0].id).toBe(halloweenQuestions[0].alternates!.at(-1));
    } finally {
        random.mockRestore();
    }
    const nearlyOne = jest.spyOn(Math, 'random').mockReturnValue(0.999999);
    try {
        const questions = eventQuestions(HALLOWEEN_CONTENT_REVISION);
        expect(questions[0].id).toBe(halloweenQuestions[0].id);
    } finally {
        nearlyOne.mockRestore();
    }
});

test('production Halloween ships live and preview does not reinterpret existing fixture saves', () => {
    const production = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(production.enabled).toBe(true);
    expect(Number.isSafeInteger(production.startsAt)).toBe(true);
    expect(Number.isSafeInteger(production.endsAt)).toBe(true);
    expect(production.winsPerPrize).toBe(13);
    expect(production.prizePool).toHaveLength(7);
    expect(production.activities[0].contentRevision).toBe(HALLOWEEN_CONTENT_REVISION);
    expect(halloweenPreviewEdition.id).not.toBe(testEventEdition.id);
    expect(findEdition(halloweenPreviewEdition.id)).toBeUndefined();
    expect(findEdition(halloweenPreviewEdition.id, true)).toBe(halloweenPreviewEdition);
    expect(findEdition(testEventEdition.id, true)).toBe(testEventEdition);
    expect(eventLadderIndex('local-ladder-v1', 'pl').size).toBe(30);
});
