# Local Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, per-game top-10 leaderboard: after each game a qualifying run can be saved under a nickname (pre-filled with the last name used, clearable), and boards are viewable read-only from each game's setup screen via a bottom sheet.

**Architecture:** A pure ranking module (`leaderboard.ts`) holds testable sort/qualify/insert logic plus thin MMKV persistence (mirroring the existing `history.ts` pattern). A single reusable `<Leaderboard>` component renders the top-10 and — when given a just-achieved `pendingScore` — the nickname-entry flow; it owns per-game score formatting. It is hosted inline in each game's game-over view and inside a `BottomSheet` (ported verbatim from the sibling TinyParty project) opened from the shared `GameSetupScreen`.

**Tech Stack:** React Native, TypeScript, `react-native-mmkv`, `react-native-reanimated`, `react-native-gesture-handler`, XState (existing), Jest (`jest-expo`), i18n-js (en/pl).

---

## File Structure

- **Create** `src/game/leaderboard.ts` — types, constants, pure ranking helpers (`rankEntries`, `qualifies`, `insertEntry`), and MMKV I/O (`getBoard`, `saveScore`, `getLastNickname`, `setLastNickname`). One responsibility: leaderboard data.
- **Create** `src/game/leaderboard.test.ts` — unit tests for the pure helpers (MMKV is mocked to a no-op in `jest.setup.js`, so only pure logic is tested — same split as `deck.ts`/`history.ts`).
- **Create** `src/components/molecules/BottomSheet.tsx` — bottom sheet (slide-up, drag-to-dismiss, tap-overlay close, Android back). Ported from `../../../TinyParty/src/components/organisms/BottomSheet.tsx`.
- **Create** `src/components/molecules/Leaderboard.tsx` — reusable board list + nickname-entry flow; owns per-game score formatting.
- **Modify** `src/i18n/locales/en.json` and `src/i18n/locales/pl.json` — add a top-level `leaderboard` block.
- **Modify** `src/game/ladder/LadderPlayScreen.tsx`, `src/game/wheel/WheelPlayScreen.tsx`, `src/game/drop/DropPlayScreen.tsx` — host `<Leaderboard>` inline in each game-over view.
- **Modify** `src/screens/GameSetupScreen.tsx` — add a "Leaderboard" button that opens the `BottomSheet` hosting `<Leaderboard>` read-only.

Conventions confirmed in the codebase: tests are `*.test.ts` colocated, run with `npx jest <path>`; the MMKV mock (`jest.setup.js`) returns `getString: jest.fn()` (→ `undefined`) so persistence is not exercised in tests; `Input` already exposes `clearable` (the × button) and `maxLength`; `useTranslation()` returns `{ t, locale }`.

---

### Task 1: Leaderboard data module (pure logic + persistence)

**Files:**
- Create: `src/game/leaderboard.ts`
- Test: `src/game/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/leaderboard.test.ts`:

```ts
import { rankEntries, qualifies, insertEntry, BOARD_SIZE, type LeaderboardEntry } from './leaderboard';

const entry = (score: number, timestamp: number, nickname = 'P'): LeaderboardEntry => ({
    nickname,
    score,
    timestamp,
});

// Build a full board of BOARD_SIZE entries with descending scores 100,90,...,10.
const fullBoard = (): LeaderboardEntry[] =>
    Array.from({ length: BOARD_SIZE }, (_, i) => entry((BOARD_SIZE - i) * 10, i + 1));

describe('rankEntries', () => {
    it('sorts by score descending', () => {
        const ranked = rankEntries([entry(10, 1), entry(30, 2), entry(20, 3)]);
        expect(ranked.map((e) => e.score)).toEqual([30, 20, 10]);
    });

    it('breaks ties oldest-first (smaller timestamp ranks higher)', () => {
        const ranked = rankEntries([entry(50, 200, 'new'), entry(50, 100, 'old')]);
        expect(ranked.map((e) => e.nickname)).toEqual(['old', 'new']);
    });

    it('does not mutate its input', () => {
        const input = [entry(10, 1), entry(20, 2)];
        rankEntries(input);
        expect(input.map((e) => e.score)).toEqual([10, 20]);
    });
});

describe('qualifies', () => {
    it('qualifies when the board has open slots', () => {
        expect(qualifies([entry(100, 1)], 1)).toBe(true);
    });

    it('qualifies when strictly greater than the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 11)).toBe(true); // lowest is 10
    });

    it('does not qualify when equal to the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 10)).toBe(false);
    });

    it('does not qualify when below the lowest on a full board', () => {
        expect(qualifies(fullBoard(), 5)).toBe(false);
    });
});

describe('insertEntry', () => {
    it('adds the entry and returns its rank index when it qualifies', () => {
        const e = entry(25, 999);
        const { board, index } = insertEntry([entry(30, 1), entry(20, 2)], e);
        expect(board.map((x) => x.score)).toEqual([30, 25, 20]);
        expect(index).toBe(1);
    });

    it('caps the board at BOARD_SIZE and reports -1 for a score that fell off', () => {
        const e = entry(5, 999);
        const { board, index } = insertEntry(fullBoard(), e);
        expect(board).toHaveLength(BOARD_SIZE);
        expect(index).toBe(-1);
    });

    it('places a new equal score after the existing one (older wins ties)', () => {
        const older = entry(50, 100, 'old');
        const e = entry(50, 200, 'new');
        const { board, index } = insertEntry([older], e);
        expect(board.map((x) => x.nickname)).toEqual(['old', 'new']);
        expect(index).toBe(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/game/leaderboard.test.ts`
Expected: FAIL — `Cannot find module './leaderboard'`.

- [ ] **Step 3: Write the implementation**

Create `src/game/leaderboard.ts`:

```ts
import { createMMKV } from 'react-native-mmkv';

// Local, per-game top-10 leaderboards. Mirrors `history.ts`: pure ranking
// logic is exported for testing, MMKV I/O is a thin wrapper. Scores are stored
// raw (rung / final bank / total banked); the UI formats per game.

export interface LeaderboardEntry {
    nickname: string;
    /** Raw game score; higher is always better. */
    score: number;
    /** Epoch ms when saved; used for tie-breaking and the row date. */
    timestamp: number;
}

export const BOARD_SIZE = 10;
export const MAX_NICKNAME_LENGTH = 12;

/** Sort by score descending; ties resolved oldest-first (smaller timestamp ranks higher). */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return [...entries].sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
}

/** A score qualifies when the board has room, or it strictly beats the current lowest. */
export function qualifies(entries: LeaderboardEntry[], score: number): boolean {
    if (entries.length < BOARD_SIZE) return true;
    const lowest = Math.min(...entries.map((e) => e.score));
    return score > lowest;
}

/**
 * Insert an entry, re-rank, and cap at BOARD_SIZE.
 * Returns the capped board and the inserted entry's rank index (-1 if it fell off).
 */
export function insertEntry(
    entries: LeaderboardEntry[],
    next: LeaderboardEntry,
): { board: LeaderboardEntry[]; index: number } {
    const board = rankEntries([...entries, next]).slice(0, BOARD_SIZE);
    return { board, index: board.indexOf(next) };
}

// --- Persistence -----------------------------------------------------------

const boardStore = createMMKV({ id: 'showdown-leaderboard' });
const prefsStore = createMMKV({ id: 'showdown' });
const LAST_NICKNAME_KEY = 'lastNickname';

/** Read a game's board, ranked. Empty when nothing has been saved. */
export function getBoard(gameId: string): LeaderboardEntry[] {
    const json = boardStore.getString(gameId);
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? rankEntries(parsed as LeaderboardEntry[]) : [];
    } catch {
        return [];
    }
}

/**
 * Save a score under a nickname. Persists the capped board and returns the
 * created entry (its `timestamp` identifies its row for highlighting).
 */
export function saveScore(gameId: string, nickname: string, score: number): LeaderboardEntry {
    const next: LeaderboardEntry = { nickname, score, timestamp: Date.now() };
    const { board } = insertEntry(getBoard(gameId), next);
    boardStore.set(gameId, JSON.stringify(board));
    return next;
}

/** The last nickname used to save a score, shared across all games (empty if none). */
export function getLastNickname(): string {
    return prefsStore.getString(LAST_NICKNAME_KEY) ?? '';
}

export function setLastNickname(nickname: string): void {
    prefsStore.set(LAST_NICKNAME_KEY, nickname);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/game/leaderboard.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/game/leaderboard.ts src/game/leaderboard.test.ts
git commit -m "feat(leaderboard): add per-game ranking logic and MMKV persistence"
```

---

### Task 2: i18n strings (en + pl)

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/pl.json`

- [ ] **Step 1: Add the `leaderboard` block to `en.json`**

Add this top-level key (sibling to `common`, `game`, `screen`):

```json
"leaderboard": {
    "title": "Leaderboard",
    "view": "Leaderboard",
    "empty": "No scores yet. Be the first!",
    "nicknamePlaceholder": "Enter a nickname",
    "save": "Save score",
    "saved": "Saved!",
    "rung": "Rung %{number}"
}
```

- [ ] **Step 2: Add the matching block to `pl.json`**

Add the same top-level key with Polish values:

```json
"leaderboard": {
    "title": "Tabela wyników",
    "view": "Tabela wyników",
    "empty": "Brak wyników. Bądź pierwszy!",
    "nicknamePlaceholder": "Wpisz pseudonim",
    "save": "Zapisz wynik",
    "saved": "Zapisano!",
    "rung": "Szczebel %{number}"
}
```

- [ ] **Step 3: Verify translation parity**

Run: `npm run i18n:check`
Expected: no missing/extra keys reported between en and pl (the `leaderboard.*` keys exist in both).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(leaderboard): add en/pl strings"
```

---

### Task 3: Port the BottomSheet component

**Files:**
- Create: `src/components/molecules/BottomSheet.tsx`
- Reference: `../../../TinyParty/src/components/organisms/BottomSheet.tsx`

All theme/responsive tokens this component needs already exist in showdown:
`useResponsive()` exposes `scale` and `contentMaxWidth`; the theme contract has `colors.overlay`, `colors.borderLight`, `colors.surface`, `colors.textSecondary`, `zIndex.sheet`, and `radii.xl`. The relative-import depth (`../atoms/...`, `../../theme`, `../../responsive/useResponsive`) is identical from `molecules/`, so this is a verbatim copy.

- [ ] **Step 1: Create the file**

Copy the full contents of `../../../TinyParty/src/components/organisms/BottomSheet.tsx` into `src/components/molecules/BottomSheet.tsx` unchanged. For reference, the file is:

```tsx
import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Text from '../atoms/Text';
import Spacer from '../atoms/Spacer';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface BottomSheetProps {
    visible: boolean;
    onClose?: () => void;
    title?: string;
    children?: React.ReactNode;
    scrollable?: boolean;
    /** Enable drag-to-dismiss gesture (default: true) */
    draggable?: boolean;
    /** Fixed height in px */
    height?: number;
    testID?: string;
}

const DISMISS_THRESHOLD = 150;

function BottomSheet({
    visible,
    onClose,
    title,
    children,
    scrollable = false,
    draggable = true,
    height,
    testID,
}: BottomSheetProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const { scale, contentMaxWidth } = useResponsive();

    const closeSize = scale(28);
    const handleSize = { width: scale(40), height: scale(5), borderRadius: scale(2.5) };

    const translateY = useSharedValue(500);
    const opacity = useSharedValue(0);
    const contextY = useSharedValue(0);

    const handleDismiss = useCallback(() => {
        translateY.value = withTiming(500, { duration: 250 });
        opacity.value = withTiming(0, { duration: 200 });
        if (onClose) setTimeout(onClose, 250);
    }, [onClose, translateY, opacity]);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, { damping: 20, stiffness: 120, mass: 0.8 });
            opacity.value = withTiming(1, { duration: 250 });
        } else {
            handleDismiss();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, handleDismiss]);

    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleDismiss();
            return true;
        });
        return () => sub.remove();
    }, [visible, handleDismiss]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const panGesture = Gesture.Pan()
        .enabled(draggable)
        .activeOffsetY(15)
        .onStart((e) => {
            contextY.value = e.translationY;
        })
        .onUpdate((e) => {
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DISMISS_THRESHOLD) {
                runOnJS(handleDismiss)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
            }
        });

    if (!visible) return null;

    return (
        <Animated.View
            style={[styles.overlay, overlayStyle, { backgroundColor: t.colors.overlay, zIndex: t.zIndex.sheet }]}
            testID={testID}
            accessibilityViewIsModal={true}
            onAccessibilityEscape={onClose}
        >
            <View style={styles.touchable} onStartShouldSetResponder={() => true} />
            <View style={styles.touchableDismiss} onStartShouldSetResponder={() => true} onTouchEnd={handleDismiss} />
            <GestureDetector gesture={panGesture}>
                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        {
                            backgroundColor: t.colors.surface,
                            borderTopLeftRadius: t.radii.xl,
                            borderTopRightRadius: t.radii.xl,
                            padding: t.spacing.xl,
                            paddingBottom: t.spacing.xxl + insets.bottom,
                            width: '100%',
                            maxWidth: contentMaxWidth,
                            alignSelf: 'center',
                            ...(height ? { maxHeight: height, height } : {}),
                        },
                    ]}
                    accessibilityViewIsModal={true}
                >
                    {title ? (
                        <View style={styles.header}>
                            <View style={[styles.handle, handleSize, { backgroundColor: t.colors.borderLight }]} />
                            <Spacer size='xs' />
                            <Text variant='subheading' weight='bold' style={styles.title}>
                                {title}
                            </Text>
                            {onClose ? (
                                <View
                                    accessibilityRole='button'
                                    accessibilityLabel='Close'
                                    onStartShouldSetResponder={() => true}
                                    onTouchEnd={handleDismiss}
                                    style={styles.closeButton}
                                >
                                    <View
                                        style={[
                                            styles.closeIconBg,
                                            {
                                                width: closeSize,
                                                height: closeSize,
                                                borderRadius: closeSize / 2,
                                                backgroundColor: t.colors.borderLight + '40',
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant='body'
                                            weight='bold'
                                            color={t.colors.textSecondary}
                                            style={{ fontSize: scale(14) }}
                                        >
                                            ✕
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : (
                        <View style={[styles.handleCenter, handleSize, { backgroundColor: t.colors.borderLight }]} />
                    )}
                    {scrollable ? (
                        <ScrollView
                            style={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            keyboardShouldPersistTaps='handled'
                        >
                            {children}
                        </ScrollView>
                    ) : (
                        <>{children}</>
                    )}
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    touchable: {
        flex: 1,
    },
    touchableDismiss: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 200,
    },
    sheet: {
        minHeight: 200,
        maxHeight: '90%',
    },
    scrollContent: {
        flexGrow: 1,
        flexShrink: 1,
    },
    header: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        top: 4,
        padding: 8,
    },
    closeIconBg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        marginBottom: 8,
    },
    handleCenter: {
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        textAlign: 'center',
    },
});

export default React.memo(BottomSheet);
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors. If `Spacer` does not accept a `size` prop in showdown, replace `<Spacer size='xs' />` with `<View style={{ height: 4 }} />` (add `View` is already imported) — verify by opening `src/components/atoms/Spacer.tsx` first.

- [ ] **Step 3: Commit**

```bash
git add src/components/molecules/BottomSheet.tsx
git commit -m "feat(leaderboard): add BottomSheet component (ported from TinyParty)"
```

---

### Task 4: Reusable Leaderboard component

**Files:**
- Create: `src/components/molecules/Leaderboard.tsx`

Behavior: on mount, read the board for `gameId`. If a `pendingScore` is supplied and it `qualifies`, render the nickname-entry flow (pre-filled with the last nickname, clearable, max 12 chars, Save disabled until the trimmed value is non-empty). On save, persist, remember the nickname, re-read the board, and highlight the new row. Otherwise render the board read-only. Empty board shows the empty-state string. The component owns per-game score formatting (ladder → "Rung N"; drop/wheel → locale-grouped number).

- [ ] **Step 1: Create the file**

Create `src/components/molecules/Leaderboard.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import Input from './Input';
import Button from './Button';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import {
    getBoard,
    saveScore,
    getLastNickname,
    setLastNickname,
    qualifies,
    MAX_NICKNAME_LENGTH,
    type LeaderboardEntry,
} from '../../game/leaderboard';

interface LeaderboardProps {
    gameId: string;
    /** When set, enables the post-game entry flow for this just-achieved score. */
    pendingScore?: number;
}

function Leaderboard({ gameId, pendingScore }: LeaderboardProps) {
    const theme = useTheme();
    const { t, locale } = useTranslation();

    const [board, setBoard] = useState<LeaderboardEntry[]>(() => getBoard(gameId));
    const [nickname, setNickname] = useState<string>(() => getLastNickname());
    const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);

    const canEnter = pendingScore !== undefined && savedTimestamp === null && qualifies(board, pendingScore);
    const trimmed = nickname.trim();

    const formatScore = (score: number): string =>
        gameId === 'the-ladder' ? t('leaderboard.rung', { number: score }) : score.toLocaleString(locale);

    const formatDate = (timestamp: number): string =>
        new Date(timestamp).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

    const handleSave = () => {
        if (pendingScore === undefined || trimmed.length === 0) return;
        const entry = saveScore(gameId, trimmed, pendingScore);
        setLastNickname(entry.nickname);
        setBoard(getBoard(gameId));
        setSavedTimestamp(entry.timestamp);
    };

    const rows = useMemo(
        () =>
            board.map((entry, i) => {
                const highlighted = entry.timestamp === savedTimestamp;
                return (
                    <View
                        key={`${entry.timestamp}-${i}`}
                        style={[
                            styles.row,
                            { borderBottomColor: theme.colors.border },
                            highlighted && { backgroundColor: theme.colors.primary + '22', borderRadius: theme.radii.sm },
                        ]}
                    >
                        <Text variant='body' weight='bold' color='textSecondary' style={styles.rank}>
                            {i + 1}
                        </Text>
                        <Text variant='body' weight={highlighted ? 'bold' : 'semibold'} style={styles.name} numberOfLines={1}>
                            {entry.nickname}
                        </Text>
                        <Text variant='caption' color='textMuted' style={styles.date}>
                            {formatDate(entry.timestamp)}
                        </Text>
                        <Text variant='body' weight='bold' style={styles.score}>
                            {formatScore(entry.score)}
                        </Text>
                    </View>
                );
            }),
        // formatScore/formatDate are stable per render; board + highlight drive updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [board, savedTimestamp, theme],
    );

    return (
        <Stack gap='md' align='stretch'>
            {canEnter ? (
                <Stack gap='sm' align='stretch'>
                    <Input
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder={t('leaderboard.nicknamePlaceholder')}
                        maxLength={MAX_NICKNAME_LENGTH}
                        clearable
                        autoFocus
                        autoCapitalize='words'
                        returnKeyType='done'
                        onSubmitEditing={handleSave}
                        accessibilityLabel={t('leaderboard.nicknamePlaceholder')}
                    />
                    <Button variant='primary' fullWidth disabled={trimmed.length === 0} onPress={handleSave}>
                        {t('leaderboard.save')}
                    </Button>
                </Stack>
            ) : null}

            {savedTimestamp !== null ? (
                <Text variant='caption' color='success' align='center'>
                    {t('leaderboard.saved')}
                </Text>
            ) : null}

            {board.length === 0 ? (
                <Text variant='body' color='textMuted' align='center'>
                    {t('leaderboard.empty')}
                </Text>
            ) : (
                <View>{rows}</View>
            )}
        </Stack>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    rank: {
        width: 24,
        textAlign: 'center',
    },
    name: {
        flex: 1,
    },
    date: {
        width: 56,
        textAlign: 'right',
    },
    score: {
        minWidth: 64,
        textAlign: 'right',
    },
});

export default React.memo(Leaderboard);
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors. (Confirms `Stack`/`Text`/`Input`/`Button` prop names and the `Text` `color` token values like `'success'`, `'textMuted'` are valid; if any color token name differs, open `src/theme/contract.ts` and use the correct one.)

- [ ] **Step 3: Commit**

```bash
git add src/components/molecules/Leaderboard.tsx
git commit -m "feat(leaderboard): add reusable Leaderboard component"
```

---

### Task 5: Host the leaderboard in the three game-over views

**Files:**
- Modify: `src/game/ladder/LadderPlayScreen.tsx`
- Modify: `src/game/wheel/WheelPlayScreen.tsx`
- Modify: `src/game/drop/DropPlayScreen.tsx`

- [ ] **Step 1: Ladder — import and host below the score**

In `src/game/ladder/LadderPlayScreen.tsx`, add the import near the other component imports:

```tsx
import Leaderboard from '../../components/molecules/Leaderboard';
```

In `GameOverView`, insert the leaderboard between the "reached" text and the actions `Stack` (the score passed in as `rung` is the saved score):

```tsx
                <Text variant='body' color='textSecondary' align='center'>
                    {t('game.the-ladder.score.reached', { number: rung })}
                </Text>
                <Leaderboard gameId='the-ladder' pendingScore={rung} />
                <Stack gap='sm' align='stretch' style={styles.actions}>
```

- [ ] **Step 2: Wheel — import and host below the banked score card**

In `src/game/wheel/WheelPlayScreen.tsx`, add:

```tsx
import Leaderboard from '../../components/molecules/Leaderboard';
```

In the `game.status === 'over'` block, insert the leaderboard between the banked-score `Card` and the actions `Stack` (score is `game.score`):

```tsx
                    </Card>
                    <Leaderboard gameId='the-wheel' pendingScore={game.score} />
                    <Stack gap='sm' style={styles.fullWidth}>
```

- [ ] **Step 3: Drop — import and host below the final-bank block**

In `src/game/drop/DropPlayScreen.tsx`, add:

```tsx
import Leaderboard from '../../components/molecules/Leaderboard';
```

In the game-over `ScrollView`, insert the leaderboard between the final-bank `Stack` (the one ending after `{formatMoney(state.bank)}`) and the actions `Stack` that holds the Play Again / Exit buttons (score is `state.bank`):

```tsx
                        </Stack>
                        <Leaderboard gameId='the-drop' pendingScore={state.bank} />
                        <Stack gap='sm' align='stretch' style={styles.fullWidth}>
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/ladder/LadderPlayScreen.tsx src/game/wheel/WheelPlayScreen.tsx src/game/drop/DropPlayScreen.tsx
git commit -m "feat(leaderboard): show save/board inline on each game-over screen"
```

---

### Task 6: Leaderboard button + bottom sheet on the setup screen

**Files:**
- Modify: `src/screens/GameSetupScreen.tsx`

- [ ] **Step 1: Add imports and visibility state**

In `src/screens/GameSetupScreen.tsx`, add to the imports:

```tsx
import { ChevronLeft, Play, Trophy } from 'lucide-react-native';
```

(replace the existing `import { ChevronLeft, Play } from 'lucide-react-native';` line), and add:

```tsx
import BottomSheet from '../components/molecules/BottomSheet';
import Leaderboard from '../components/molecules/Leaderboard';
```

Add `useState` to the React import if not present (`import React, { useState } from 'react';`) and declare state inside `GameSetupScreen`, next to the other hooks:

```tsx
    const [showLeaderboard, setShowLeaderboard] = useState(false);
```

- [ ] **Step 2: Add the Leaderboard button to the footer**

Replace the footer `View` block (the one containing the single Start `Button`) so it stacks a ghost "Leaderboard" button above Start:

```tsx
            <View
                style={[
                    styles.footer,
                    { bottom: theme.spacing.xl, paddingHorizontal: theme.spacing.xl },
                ]}
            >
                <Stack gap='sm' align='stretch'>
                    <Button
                        fullWidth
                        size='lg'
                        onPress={() => send({ type: 'START' })}
                        style={{ backgroundColor: accent, borderColor: accent }}
                        textColor={onAccent}
                        icon={<Play size={20} color={onAccent} fill={onAccent} />}
                    >
                        {t('common.start')}
                    </Button>
                    <Button
                        fullWidth
                        variant='ghost'
                        onPress={() => setShowLeaderboard(true)}
                        icon={<Trophy size={18} color={theme.colors.text} />}
                    >
                        {t('leaderboard.view')}
                    </Button>
                </Stack>
            </View>
```

- [ ] **Step 3: Render the bottom sheet**

Immediately after the closing `</View>` of the footer and before the closing `</SafeContainer>`, add:

```tsx
            <BottomSheet
                visible={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
                title={t('leaderboard.title')}
                scrollable
            >
                <Leaderboard gameId={game.id} />
            </BottomSheet>
```

- [ ] **Step 4: Static checks**

Run: `npm run type-check && npm run lint`
Expected: no errors. (`Stack` is already imported in this file; `Button` `variant='ghost'` is used elsewhere in the codebase.)

- [ ] **Step 5: Commit**

```bash
git add src/screens/GameSetupScreen.tsx
git commit -m "feat(leaderboard): add view button + bottom sheet on game setup"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run the whole static + test suite**

Run: `npm run static && npm test`
Expected: type-check, lint, format-check, and Jest all pass (including the new `leaderboard.test.ts`).

- [ ] **Step 2: Manual smoke test on a dev build**

Run: `npx expo run:ios` (per CLAUDE.md — never `expo start`/Expo Go). Then verify:
- Play The Ladder to game-over → nickname field is pre-filled with the last name (empty on first run), the × clears it, Save is disabled when empty, saving shows "Saved!" and highlights your row showing "Rung N".
- Play again and score lower than 10 existing entries → no field, board shown read-only.
- Open a game's setup screen → tap "Leaderboard" → sheet slides up from the bottom, drags down to dismiss, shows top-10 read-only.
- Confirm the remembered nickname carries across all three games (shared), and Drop/Wheel show comma-grouped money while Ladder shows "Rung N".

- [ ] **Step 3: Commit any fixes from verification (if needed)**

```bash
git add -A
git commit -m "fix(leaderboard): address verification findings"
```

---

## Self-Review

**Spec coverage**
- Local-only MMKV, per-game boards → Task 1 (`showdown-leaderboard`, keyed by gameId). ✓
- Nickname entry after each game, optional, only when qualifying → Task 4 (`canEnter = qualifies(...)`) + Task 5 (inline hosts). ✓
- Remember last nickname, reuse or clear → Task 1 (`get/setLastNickname` on shared `showdown` instance) + Task 4 (pre-filled `Input` with `clearable`). ✓
- Top 10, keep every entry, strictly-beat to qualify, ties oldest-first → Task 1 (`BOARD_SIZE`, `qualifies`, `rankEntries`) with tests. ✓
- Non-qualifying shows board read-only → Task 4 (board renders regardless of `canEnter`). ✓
- Inline at game-over + bottom sheet from setup → Task 5 + Task 6. ✓
- Row = rank + nickname + score + date; per-game formatting; empty state → Task 4. ✓
- en + pl strings → Task 2. ✓
- Bottom sheet from the bottom (TinyParty) → Task 3. ✓

**Placeholder scan:** No TODO/TBD/"handle edge cases"; every code step shows full code. Two conditional fallbacks (Spacer prop in Task 3 Step 2; color-token names in Task 4 Step 2) are explicit verify-then-adjust instructions, not vague directives.

**Type consistency:** `LeaderboardEntry`, `BOARD_SIZE`, `MAX_NICKNAME_LENGTH`, `getBoard`, `saveScore`, `qualifies`, `getLastNickname`, `setLastNickname` are defined in Task 1 and consumed with identical names/signatures in Task 4. `<Leaderboard gameId pendingScore?>` props match across Tasks 4/5/6. `<BottomSheet visible onClose title scrollable>` props match Task 3's definition.
