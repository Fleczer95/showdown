import { deviceStore } from '../../../storage/appStores';
import {
    startSession,
    beginSessionPlay,
    checkpointSession,
    getSession,
    listSessions,
    setPendingEventStart,
    getPendingEventStart,
    eventUsage,
    abandonSession,
    participationId,
    updateSessionEffects,
} from './store';
import { settleCompletion, uploadCompletion, recoverCompletions } from './recovery';
import { initialCheckpoint } from './initial';
import {
    ladderResult,
    dropResult,
    wheelResult,
    type LadderCheckpoint,
    type DropCheckpoint,
    type WheelCheckpoint,
} from './checkpoints';
import { applyAnswer } from '../../ladder/logic';
import { applyRound } from '../../drop/logic';
import { solve } from '../../wheel/logic';
import { recordChallenge, listChallenges, challengeStatus, countCreatedToday } from '../log';
import { loadStats, saveStats, defaultStats, recordRun } from '../../progression/recordRun';
import { mergeStats, preservesProgress } from '../../progression/merge';
import { grantLevelBonus } from '../../offline/limit';
import { submitAttempt } from '../store';
import { testEventEdition as edition, testEventQuestions } from '../../../../shared/events/fixtures';
import type { ChallengeRecord } from '../types';
import { EVENT_UPLOAD_WINDOW_MS } from '../../../../shared/events/definitions';
import { buildChallenge } from '../build';
jest.mock('react-native-mmkv', () => {
    const stores = new Map<string, Map<string, string | boolean>>();
    return {
        createMMKV: ({ id }: { id: string }) => {
            if (!stores.has(id)) stores.set(id, new Map());
            const data = stores.get(id)!;
            return {
                getString: (k: string) => data.get(k),
                getBoolean: (k: string) => data.get(k),
                set: (k: string, v: string | boolean) => data.set(k, v),
                remove: (k: string) => data.delete(k),
            };
        },
    };
});
jest.mock('../../ranking/push', () => ({ pushRanking: jest.fn(async () => undefined) }));
jest.mock('../store', () => ({ submitAttempt: jest.fn(async () => undefined), BlockedError: class extends Error {} }));
jest.mock('../../offline/limit', () => ({ grantLevelBonus: jest.fn(() => 0) }));

const now = edition.startsAt! + 1000;
const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-ladder',
    questions: testEventQuestions,
    createdBy: { uuid: 'device', nickname: 'Player' },
    mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
    event: { editionId: edition.id, contentRevision: 'local-ladder-v1', mode: 'friend', endsAt: edition.endsAt! },
    expiresAt: edition.endsAt! + EVENT_UPLOAD_WINDOW_MS,
};
function start(id: string, date = '2026-01-01', cap = 3, awaitingStart = false) {
    setPendingEventStart({
        requestId: id,
        editionId: edition.id,
        game: record.game,
        mode: 'friend',
        record,
        nickname: 'Player',
    });
    return startSession(
        {
            challengeId: id,
            deviceId: 'device',
            record,
            nickname: 'Player',
            ...(awaitingStart ? { awaitingStart: true } : {}),
        },
        initialCheckpoint(record, 'en'),
        { requestId: id, date, cap },
        now,
    );
}
beforeEach(() => {
    deviceStore.remove('challenge-sessions-v1');
    saveStats(defaultStats());
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.mocked(grantLevelBonus).mockReset().mockReturnValue(0);
    jest.mocked(submitAttempt).mockClear();
});
afterEach(() => jest.restoreAllMocks());

test('start, charged date and pending request settle atomically; resume is free', () => {
    const s = start('one');
    expect(getPendingEventStart()).toBeUndefined();
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1);
    expect(startSession({ challengeId: 'one', deviceId: 'device', record, nickname: 'changed' }, {})).toEqual(s);
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1);
    start('two', '2026-01-02');
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1); // travel back does not erase old bucket
    expect(listSessions()).toHaveLength(2);
});

test('an unstarted invitation survives reload and starts later without a new charge or deck', () => {
    const s = start('later', '2026-01-01', 3, true);
    const saved = getSession(s.id)!;
    const stub = listChallenges().find((entry) => entry.id === 'later')!;
    expect(saved.awaitingStart).toBe(true);
    expect(challengeStatus(stub, now, saved)).toBe('yourTurn');
    expect(checkpointSession(s.id, {}, 100, undefined, now)).toBe(false);
    expect(beginSessionPlay(s.id, 'New name', now + 86400000)).toBe(true);
    const ready = getSession(s.id)!;
    expect(ready).toMatchObject({ awaitingStart: false, nickname: 'New name', elapsedMs: 0, chargeDate: '2026-01-01' });
    expect(ready.checkpoint).toEqual(saved.checkpoint);
    expect(ready.record).toEqual(saved.record);
    expect(challengeStatus(stub, now, ready)).toBe('resume');
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1);
    expect(eventUsage(edition.id, '2026-01-02')).toBe(0);
    expect(beginSessionPlay(s.id, 'Do not rename an active run', now + 86400001)).toBe(true);
    expect(getSession(s.id)).toEqual(ready);
});

test('a failed Start write leaves the invitation and its single charge intact', () => {
    const s = start('start-write-failed', '2026-01-01', 3, true);
    const write = jest.spyOn(deviceStore, 'set').mockImplementationOnce(() => {
        throw new Error('disk unavailable');
    });
    expect(() => beginSessionPlay(s.id, 'Player', now)).toThrow('disk unavailable');
    write.mockRestore();
    expect(getSession(s.id)).toEqual(s);
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1);
    expect(beginSessionPlay(s.id, 'Player', now)).toBe(true);
});

test('the start choice cannot reopen a closed or abandoned reservation', () => {
    const expired = start('expired-choice', '2026-01-01', 3, true);
    expect(beginSessionPlay(expired.id, 'Player', edition.endsAt!)).toBe(false);
    expect(getSession(expired.id)?.awaitingStart).toBe(true);
    const abandoned = start('abandoned-choice', '2026-01-01', 3, true);
    abandonSession(abandoned.id);
    expect(beginSessionPlay(abandoned.id, 'Player', now)).toBe(false);
    expect(beginSessionPlay('missing', 'Player', now)).toBe(false);
});

test('an old save without the new optional flag remains a resumable run', () => {
    const s = start('old-save');
    expect(s.awaitingStart).toBeUndefined();
    expect(beginSessionPlay(s.id, 'Player', now)).toBe(true);
    expect(getSession(s.id)).toEqual(s);
});

test('only one pending start; a failed session write neither charges nor reveals a run', () => {
    setPendingEventStart({
        requestId: 'one',
        editionId: edition.id,
        game: record.game,
        mode: 'friend',
        record,
        nickname: 'P',
    });
    expect(() => setPendingEventStart({ ...getPendingEventStart()!, requestId: 'two' })).toThrow();
    const write = jest.spyOn(deviceStore, 'set').mockImplementationOnce(() => {
        throw new Error('disk unavailable');
    });
    expect(() =>
        startSession(
            { challengeId: 'one', deviceId: 'device', record, nickname: 'P' },
            {},
            { date: '2026-01-01', cap: 3, requestId: 'one' },
            now,
        ),
    ).toThrow();
    write.mockRestore();
    expect(listSessions()).toHaveLength(0);
    expect(eventUsage(edition.id, '2026-01-01')).toBe(0);
    expect(getPendingEventStart()?.requestId).toBe('one');
});

test('first-question loss commits terminal result and timestamp before reveal; grants offline once', async () => {
    const s = start('loss');
    const checkpoint = s.checkpoint as LadderCheckpoint;
    checkpoint.run = applyAnswer(checkpoint.run, (checkpoint.run.rungs[0].current.correctIndex + 1) % 4);
    const result = ladderResult(checkpoint)!;
    expect(checkpointSession(s.id, checkpoint, 1200, result, edition.endsAt! - 1)).toBe(true);
    jest.spyOn(Date, 'now').mockReturnValue(edition.endsAt! + 100);
    settleCompletion(s.id);
    expect(loadStats().eventCompletedRuns?.[edition.id]).toBe(1);
    expect(loadStats().runsPlayed).toBe(1);
    settleCompletion(s.id);
    expect(loadStats().runsPlayed).toBe(1);
    await uploadCompletion(s.id);
    await uploadCompletion(s.id);
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(jest.mocked(submitAttempt).mock.calls[0][2]).toMatchObject({ timestamp: edition.endsAt! - 1, progress: 0 });
    expect(getSession(s.id)?.upload).toBe('sent');
});

test('crash after progression receipt but before level bonus recovers bonus without duplicate XP/prizes', () => {
    const s = start('bonus');
    const c = s.checkpoint as LadderCheckpoint;
    c.run = applyAnswer(c.run, (c.run.rungs[0].current.correctIndex + 1) % 4);
    checkpointSession(s.id, c, 0, ladderResult(c), now);
    saveStats({ ...defaultStats(), lifetimeXp: 149 });
    jest.mocked(grantLevelBonus).mockImplementationOnce(() => {
        throw new Error('kill');
    });
    expect(() => settleCompletion(s.id)).toThrow('kill');
    const xp = loadStats().lifetimeXp;
    expect(getSession(s.id)?.effectsSettled).not.toBe(true);
    settleCompletion(s.id);
    expect(loadStats().lifetimeXp).toBe(xp);
    expect(loadStats().eventCompletedRuns?.[edition.id]).toBe(1);
    expect(grantLevelBonus).toHaveBeenCalledTimes(2);
});

test('closure, abandonment and exhausted allowance cannot produce completion or refund', () => {
    const s = start('closed');
    expect(
        checkpointSession(
            s.id,
            {},
            1,
            { progress: 0, run: { gameId: 'the-ladder', score: 0, won: false } },
            edition.endsAt,
        ),
    ).toBe(false);
    abandonSession(s.id);
    expect(checkpointSession(s.id, {}, 1, undefined, now)).toBe(false);
    expect(eventUsage(edition.id, '2026-01-01')).toBe(1);
    expect(() => start('no-budget', '2026-01-01', 1)).toThrow('allowance');
    expect(loadStats().runsPlayed).toBe(0);
});

test('all game-specific checkpoints round-trip, including Drop allocations and Wheel Sets/outcomes', () => {
    for (const gameId of ['the-drop', 'the-wheel']) {
        const rec = buildChallenge({
            gameId,
            history: {},
            ownedIds: new Set(),
            createdBy: record.createdBy,
            lang: 'en',
            mascot: record.mascot,
            now: () => now,
        });
        const checkpoint = initialCheckpoint(rec, 'en');
        const s = startSession(
            { challengeId: gameId, deviceId: 'device', record: rec, nickname: 'P' },
            checkpoint,
            undefined,
            now,
        );
        if (gameId === 'the-drop') {
            const c = checkpoint as DropCheckpoint;
            c.allocation = [250000, 250000, 250000, 250000];
            c.next = applyRound(c.state, c.allocation);
            checkpointSession(s.id, c, 123, dropResult(c), now);
            expect(getSession(s.id)?.checkpoint).toEqual(c);
        } else {
            const c = checkpoint as WheelCheckpoint;
            c.game.revealed.add('A');
            c.spinValue = 500;
            c.phase = 'awaitGuess';
            checkpointSession(s.id, c, 100, undefined, now);
            expect((getSession(s.id)?.checkpoint as WheelCheckpoint).game.revealed).toEqual(new Set(['A']));
            c.pendingNext = solve(c.game, 'wrong');
            checkpointSession(s.id, c, 100, wheelResult(c), now);
            expect(getSession(s.id)?.status).toBe('completed');
        }
    }
});

test('unfinished sessions stay reachable beyond history cap and event creates do not use ordinary allowance', () => {
    const s = start('protected');
    for (let i = 0; i < 110; i++)
        recordChallenge({
            id: `prune-${i}`,
            game: 'the-ladder',
            role: 'received',
            opponent: '',
            played: true,
            expiresAt: now + 100000,
        });
    const stub = listChallenges().find((row) => row.id === 'protected')!;
    expect(stub).toBeDefined();
    expect(challengeStatus(stub, now)).toBe('resume');
    recordChallenge({ ...stub, role: 'created', eventId: edition.id });
    expect(countCreatedToday(now)).toBe(0);
    expect(getSession(participationId('protected', 'device'))).toEqual(s);
});

test('cloud max/union and old-save upgrade preserve receipts and unknown permanent grants', () => {
    const result = { gameId: 'the-ladder', score: 0, won: false, challenge: true };
    const completion = { id: 'cloud-receipt', completedAt: now, edition };
    recordRun(result, completion);
    const local = loadStats();
    const remote = {
        ...defaultStats(),
        eventCompletedRuns: { [edition.id]: 4 },
        earnedRewardIds: ['future-prize'],
        eventRewardGrants: ['future-edition/goal'],
    };
    const merged = mergeStats(local, remote);
    expect(merged.eventCompletedRuns?.[edition.id]).toBe(4);
    expect(preservesProgress(local, merged)).toBe(true);
    expect(preservesProgress(remote, merged)).toBe(true);
    saveStats(merged);
    recordRun(result, completion);
    expect(loadStats().runsPlayed).toBe(1);
    expect(loadStats().earnedRewardIds).toContain('future-prize');
    expect(mergeStats(merged, defaultStats())).toEqual(merged);
});

test('the journal is capped, but never drops a run the app still needs', () => {
    const settle = (challengeId: string, score: number) => {
        const id = participationId(challengeId, 'device');
        checkpointSession(id, {}, 0, { progress: 1, run: { gameId: 'the-ladder', score, won: true } }, now + score);
        updateSessionEffects(id, { effectsSettled: true, upload: 'sent' });
    };
    // Fill well past the cap with fully settled, uploaded runs.
    for (let i = 0; i < 60; i++) {
        start(`settled-${i}`, '2026-01-01', 1000);
        settle(`settled-${i}`, i);
    }
    expect(listSessions().length).toBeLessThanOrEqual(50);

    // An unfinished run and a completion whose upload is still pending must
    // survive even when they become the oldest entries in the journal.
    start('unfinished', '2026-01-01', 1000);
    start('awaiting-upload', '2026-01-01', 1000);
    checkpointSession(participationId('awaiting-upload', 'device'), {}, 0, {
        progress: 1,
        run: { gameId: 'the-ladder', score: 1, won: true },
    });
    for (let i = 60; i < 120; i++) {
        start(`filler-${i}`, '2026-01-01', 1000);
        settle(`filler-${i}`, i);
    }
    const ids = listSessions().map((s) => s.id);
    expect(listSessions().length).toBeLessThanOrEqual(52);
    expect(ids).toContain(participationId('unfinished', 'device'));
    expect(ids).toContain(participationId('awaiting-upload', 'device'));
});

test('a completed run whose edition is gone does not block the other uploads', async () => {
    // An ordinary completed run whose result is still waiting to upload.
    const ordinary: ChallengeRecord = { ...record, event: undefined, expiresAt: now + 100000 };
    const good = startSession(
        { challengeId: 'ordinary', deviceId: 'device', record: ordinary, nickname: 'P' },
        {},
        undefined,
        now,
    );
    checkpointSession(good.id, {}, 0, { progress: 1, run: { gameId: 'the-ladder', score: 5, won: true } }, now);

    // A completed event run whose edition this build no longer defines — for
    // example an edition retired in a later release.
    const retired: ChallengeRecord = { ...record, event: { ...record.event!, editionId: 'retired-edition' } };
    setPendingEventStart({
        requestId: 'retired',
        editionId: 'retired-edition',
        game: record.game,
        mode: 'friend',
        record: retired,
        nickname: 'P',
    });
    const bad = startSession(
        { challengeId: 'retired', deviceId: 'device', record: retired, nickname: 'P' },
        {},
        { date: '2026-01-01', cap: 3, requestId: 'retired' },
        now,
    );
    checkpointSession(bad.id, {}, 0, { progress: 1, run: { gameId: 'the-ladder', score: 1, won: true } }, now);

    await recoverCompletions();
    expect(submitAttempt).toHaveBeenCalledTimes(2);
    expect(getSession(good.id)?.upload).toBe('sent');
});
