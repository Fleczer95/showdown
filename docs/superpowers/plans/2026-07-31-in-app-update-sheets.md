# In-app update + what's-new sheets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two bottom sheets — "an update is available" and "here's what's new" — each shown at most once per version, on the Home screen, dismissible by backdrop tap, drag, Android back, or a button.

**Architecture:** A pure decision module (`seenVersions.ts`) reads two `deviceStore` keys and returns what, if anything, to show. A thin native wrapper (`updateCheck.ts`) asks `expo-in-app-updates` whether the store has a newer build. One presentational component (`AnnouncementSheet.tsx`) renders either sheet over the existing `BottomSheet`. A hook decides, a container mounts, Home renders one line.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript, `react-native-mmkv` (via `deviceStore`), `expo-in-app-updates` (new), `i18n-js`, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-07-31-in-app-update-sheets-design.md`

## Global Constraints

- **Never Expo Go.** `expo-in-app-updates` is a native module. Build with `npx expo run:ios` / `npx expo run:android` (per `CLAUDE.md`). After adding the dependency, clear Metro's cache: `npx expo start -c`.
- **All user-visible copy goes through i18n.** Add every string to both `src/i18n/locales/en.json` and `src/i18n/locales/pl.json`. Never inline English in a component. Dev-only debug affordances are the sole exception.
- **Storage is `deviceStore`**, imported from `src/storage/appStores`, never `profileStore` and never raw MMKV.
- **Every remote path fails silent.** No thrown errors, no Sentry reports, no visible error state. A failed check means "no sheet".
- **Never parse or order version identifiers.** Android returns a versionCode number, iOS a semver string. Store as a string, compare with `===` only.
- **App Store ID is `6774886649`.** Android package is `com.showdown.app`.
- **Code style:** 4-space indent, single quotes, semicolons, ~120 col. Run `npm run static` (type-check + lint + format check) before every commit.
- **Tests live next to their source** (`foo.ts` → `foo.test.ts`), except component tests, which go in `src/components/molecules/__tests__/`.

---

### Task 1: Version ledger and gating decision

The pure core. No UI, no native modules, no async. Every behaviour in the spec's decision table is decided here, so it can all be tested in milliseconds.

**Files:**

- Create: `src/services/appUpdate/seenVersions.ts`
- Test: `src/services/appUpdate/seenVersions.test.ts`

**Interfaces:**

- Consumes: `deviceStore` from `src/storage/appStores` (`getString(key)`, `set(key, value)`).
- Produces:
    - `type WhatsNewDecision = 'seed' | 'show' | 'bump' | 'none'`
    - `decideWhatsNew(seenVersion: string | undefined, appVersion: string, notesVersion: string): WhatsNewDecision`
    - `shouldPromptUpdate(seenVersion: string | undefined, storeVersion: string): boolean`
    - `readWhatsNewSeen(): string | undefined`
    - `markWhatsNewSeen(version: string): void`
    - `readUpdatePromptSeen(): string | undefined`
    - `markUpdatePromptSeen(storeVersion: string): void`

- [ ] **Step 1: Write the failing test**

Create `src/services/appUpdate/seenVersions.test.ts`:

```ts
import { decideWhatsNew, shouldPromptUpdate } from './seenVersions';

describe('decideWhatsNew', () => {
    it('seeds on a fresh install so a new player is never shown notes', () => {
        expect(decideWhatsNew(undefined, '1.4.0', '1.4.0')).toBe('seed');
    });

    it('shows notes after an update when an entry matches this build', () => {
        expect(decideWhatsNew('1.3.1', '1.4.0', '1.4.0')).toBe('show');
    });

    it('shows the newest notes even when versions were skipped', () => {
        expect(decideWhatsNew('1.2.0', '1.5.0', '1.5.0')).toBe('show');
    });

    it('bumps silently when this build has no notes entry', () => {
        expect(decideWhatsNew('1.4.0', '1.4.1', '1.4.0')).toBe('bump');
    });

    it('does nothing when the player has already seen this version', () => {
        expect(decideWhatsNew('1.4.0', '1.4.0', '1.4.0')).toBe('none');
    });
});

describe('shouldPromptUpdate', () => {
    it('prompts when this store version has never been prompted', () => {
        expect(shouldPromptUpdate(undefined, '1.5.0')).toBe(true);
    });

    it('does not prompt twice for the same store version', () => {
        expect(shouldPromptUpdate('1.5.0', '1.5.0')).toBe(false);
    });

    it('prompts again once the store moves on', () => {
        expect(shouldPromptUpdate('1.5.0', '1.6.0')).toBe(true);
    });

    it('treats an Android versionCode string the same as a semver string', () => {
        expect(shouldPromptUpdate('35', '36')).toBe(true);
        expect(shouldPromptUpdate('36', '36')).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/services/appUpdate/seenVersions.test.ts`
Expected: FAIL — `Cannot find module './seenVersions'`.

- [ ] **Step 3: Write the implementation**

Create `src/services/appUpdate/seenVersions.ts`:

```ts
import { deviceStore } from '../../storage/appStores';

/** Last APP_VERSION the player was caught up on. Absent means "never launched". */
export const WHATS_NEW_SEEN_KEY = 'whatsNewSeenVersion';

/** Last store version we nudged about. Holds an iOS semver or an Android versionCode. */
export const UPDATE_PROMPT_SEEN_KEY = 'updatePromptSeenVersion';

/**
 * `seed` — fresh install: record the version, show nothing. A brand-new player
 * has nothing to catch up on.
 * `show` — updated, and this build ships notes.
 * `bump` — updated, but this build has no notes entry (a silent patch). Advance
 * the key anyway so a later real release is not suppressed.
 * `none` — already caught up on this build.
 */
export type WhatsNewDecision = 'seed' | 'show' | 'bump' | 'none';

export function decideWhatsNew(
    seenVersion: string | undefined,
    appVersion: string,
    notesVersion: string,
): WhatsNewDecision {
    if (seenVersion === undefined) return 'seed';
    if (seenVersion === appVersion) return 'none';
    return notesVersion === appVersion ? 'show' : 'bump';
}

/**
 * Equality only — never ordering. iOS reports a semver string and Android a
 * versionCode number, so there is no comparison that is correct on both.
 */
export function shouldPromptUpdate(seenVersion: string | undefined, storeVersion: string): boolean {
    return seenVersion !== storeVersion;
}

export function readWhatsNewSeen(): string | undefined {
    return deviceStore.getString(WHATS_NEW_SEEN_KEY);
}

export function markWhatsNewSeen(version: string): void {
    deviceStore.set(WHATS_NEW_SEEN_KEY, version);
}

export function readUpdatePromptSeen(): string | undefined {
    return deviceStore.getString(UPDATE_PROMPT_SEEN_KEY);
}

export function markUpdatePromptSeen(storeVersion: string): void {
    deviceStore.set(UPDATE_PROMPT_SEEN_KEY, storeVersion);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/services/appUpdate/seenVersions.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
npm run static
git add src/services/appUpdate/seenVersions.ts src/services/appUpdate/seenVersions.test.ts
git commit -m "feat(update): decide once-per-version announcement gating"
```

---

### Task 2: What's-new content and its copy

**Files:**

- Create: `src/data/whatsNew.ts`
- Create: `src/data/whatsNew.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: nothing.
- Produces:
    - `interface WhatsNewHighlight { emoji: string; key: string }`
    - `interface WhatsNewEntry { version: string; highlights: WhatsNewHighlight[] }`
    - `const WHATS_NEW: WhatsNewEntry`
- i18n keys added: `appUpdate.title`, `appUpdate.body`, `appUpdate.cta`, `appUpdate.later`, `whatsNew.title`, `whatsNew.cta`, `whatsNew.1_4_0.gameCenter`, `whatsNew.1_4_0.fixes`.

- [ ] **Step 1: Write the failing test**

The test guards the one thing that silently rots: a highlight key with no translation behind it.

Create `src/data/whatsNew.test.ts`:

```ts
import en from '../i18n/locales/en.json';
import pl from '../i18n/locales/pl.json';
import { WHATS_NEW } from './whatsNew';

function lookup(locale: Record<string, unknown>, dottedKey: string): unknown {
    return dottedKey.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in node) {
            return (node as Record<string, unknown>)[part];
        }
        return undefined;
    }, locale);
}

describe('WHATS_NEW', () => {
    it('has at least one highlight', () => {
        expect(WHATS_NEW.highlights.length).toBeGreaterThan(0);
    });

    it('resolves every highlight key in both locales', () => {
        for (const highlight of WHATS_NEW.highlights) {
            expect(typeof lookup(en, highlight.key)).toBe('string');
            expect(typeof lookup(pl, highlight.key)).toBe('string');
        }
    });

    it('gives every highlight an emoji', () => {
        for (const highlight of WHATS_NEW.highlights) {
            expect(highlight.emoji.length).toBeGreaterThan(0);
        }
    });

    // The canary. Bumping the app version without writing notes makes the sheet
    // silently never appear; this turns that into a loud CI failure instead.
    it('matches the version in app.json', () => {
        const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'));
        expect(WHATS_NEW.version).toBe(appJson.expo.version);
    });
});
```

Note the canary reads `app.json` from disk rather than importing `APP_VERSION`. Under Jest, `Constants.expoConfig` is not populated, so `APP_VERSION` falls back to `'1.0.0'` — verified 2026-07-31. Comparing against it would fail permanently.

Add these imports at the top of the test file:

```ts
import fs from 'fs';
import path from 'path';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/whatsNew.test.ts`
Expected: FAIL — `Cannot find module './whatsNew'`.

- [ ] **Step 3: Create the content module**

Create `src/data/whatsNew.ts`:

```ts
/**
 * The current version's highlights, shown once after the player updates.
 *
 * Only ONE entry exists at a time — there is deliberately no changelog history
 * to maintain. `version` must match `APP_VERSION` (app.json) for the sheet to
 * appear; when it does not, the sheet stays quiet and the seen-version key is
 * advanced silently (see services/appUpdate/seenVersions).
 *
 * Updated as part of the release ritual — see the `release-notes` skill.
 */
export interface WhatsNewHighlight {
    emoji: string;
    /** i18n key resolving to one short sentence. */
    key: string;
}

export interface WhatsNewEntry {
    version: string;
    highlights: WhatsNewHighlight[];
}

export const WHATS_NEW: WhatsNewEntry = {
    version: '1.4.0',
    highlights: [
        { emoji: '🏆', key: 'whatsNew.1_4_0.gameCenter' },
        { emoji: '🐛', key: 'whatsNew.1_4_0.fixes' },
    ],
};
```

- [ ] **Step 4: Add the English copy**

In `src/i18n/locales/en.json`, add two new top-level blocks alongside the existing `review` block:

```json
    "appUpdate": {
        "title": "A new version is ready",
        "body": "We've been busy. Grab the latest ShowDown — it only takes a moment.",
        "cta": "Update now",
        "later": "Not now"
    },
    "whatsNew": {
        "title": "What's new in %{version}",
        "cta": "Let's play",
        "1_4_0": {
            "gameCenter": "Achievements and leaderboards — 34 badges and a best-score board for every game.",
            "fixes": "Fixed two bugs that could close the game unexpectedly."
        }
    },
```

Note `appUpdate.body` is deliberately store-neutral: the same string ships to both App Store and Play users.

- [ ] **Step 5: Add the Polish copy**

In `src/i18n/locales/pl.json`, add the matching blocks:

```json
    "appUpdate": {
        "title": "Nowa wersja jest gotowa",
        "body": "Nie próżnowaliśmy. Pobierz najnowszy ShowDown — to zajmie chwilę.",
        "cta": "Aktualizuj",
        "later": "Nie teraz"
    },
    "whatsNew": {
        "title": "Co nowego w %{version}",
        "cta": "Zagrajmy",
        "1_4_0": {
            "gameCenter": "Osiągnięcia i rankingi — 34 odznaki i tabela najlepszych wyników w każdej grze.",
            "fixes": "Naprawiliśmy dwa błędy, przez które gra potrafiła się zamknąć."
        }
    },
```

- [ ] **Step 6: Run the test and the translation check**

Run: `npx jest src/data/whatsNew.test.ts`
Expected: PASS, 4 tests.

Run: `npm run i18n:check`
Expected: no _missing_ keys. The `whatsNew.1_4_0.*` keys may be reported as **unused** — that is expected and correct, because they are referenced dynamically through `WHATS_NEW`, exactly like the existing `progression.family.*` keys. Do not delete them.

- [ ] **Step 7: Commit**

```bash
npm run static
git add src/data/whatsNew.ts src/data/whatsNew.test.ts src/i18n/locales/en.json src/i18n/locales/pl.json
git commit -m "feat(update): add what's-new content for 1.4.0 and announcement copy"
```

---

### Task 3: Store version check and store link

Wraps the native module. Two responsibilities, both trivial and both failure-tolerant: ask the store what version it has, and open the store listing.

**Files:**

- Create: `src/services/appUpdate/updateCheck.ts`
- Test: `src/services/appUpdate/updateCheck.test.ts`
- Modify: `package.json` (dependency)
- Modify: `app.json` (add `ios.infoPlist.AppStoreID`)
- Modify: `jest.setup.js` (mock the native module)

**Interfaces:**

- Consumes: `expo-in-app-updates` (`checkForUpdate(): Promise<{ updateAvailable: boolean; storeVersion?: string | number }>`).
- Produces:
    - `interface StoreVersionCheck { available: boolean; storeVersion: string }`
    - `checkStoreVersion(): Promise<StoreVersionCheck | null>`
    - `openStoreListing(): Promise<void>`

- [ ] **Step 1: Install the dependency and configure the App Store ID**

```bash
npx expo install expo-in-app-updates
```

In `app.json`, add `infoPlist` under the existing `ios` block (which currently holds `bundleIdentifier` and `buildNumber`). If an `infoPlist` key already exists, add `AppStoreID` inside it rather than creating a second one:

```json
"infoPlist": {
    "AppStoreID": "6774886649"
}
```

No `AppStoreCountry` is needed — the US storefront resolves `com.showdown.app` (verified 2026-07-31 against `itunes.apple.com/lookup`).

- [ ] **Step 2: Mock the native module for Jest**

In `jest.setup.js`, add alongside the other native mocks (e.g. after the `react-native-mmkv` block):

```js
jest.mock('expo-in-app-updates', () => ({
    checkForUpdate: jest.fn(),
}));
```

- [ ] **Step 3: Write the failing test**

Create `src/services/appUpdate/updateCheck.test.ts`:

```ts
import { checkForUpdate } from 'expo-in-app-updates';
import { checkStoreVersion } from './updateCheck';

const mockCheckForUpdate = checkForUpdate as jest.MockedFunction<typeof checkForUpdate>;

describe('checkStoreVersion', () => {
    beforeEach(() => {
        mockCheckForUpdate.mockReset();
    });

    it('reports the store version when an update is available', async () => {
        mockCheckForUpdate.mockResolvedValue({ updateAvailable: true, storeVersion: '1.5.0' } as never);
        await expect(checkStoreVersion()).resolves.toEqual({ available: true, storeVersion: '1.5.0' });
    });

    it('stringifies the Android versionCode so both platforms store one type', async () => {
        mockCheckForUpdate.mockResolvedValue({ updateAvailable: true, storeVersion: 36 } as never);
        await expect(checkStoreVersion()).resolves.toEqual({ available: true, storeVersion: '36' });
    });

    it('returns null when the app is already current', async () => {
        mockCheckForUpdate.mockResolvedValue({ updateAvailable: false, storeVersion: '1.4.0' } as never);
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('returns null when the store reports availability without a version', async () => {
        mockCheckForUpdate.mockResolvedValue({ updateAvailable: true } as never);
        await expect(checkStoreVersion()).resolves.toBeNull();
    });

    it('swallows failures — a version nudge is never worth an error', async () => {
        mockCheckForUpdate.mockRejectedValue(new Error('no play services'));
        await expect(checkStoreVersion()).resolves.toBeNull();
    });
});
```

Note: `__DEV__` is `true` under Jest, so `checkStoreVersion` must not short-circuit on `__DEV__` internally. The dev guard lives in the calling hook (Task 5) instead — that keeps this module honest and testable.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx jest src/services/appUpdate/updateCheck.test.ts`
Expected: FAIL — `Cannot find module './updateCheck'`.

- [ ] **Step 5: Write the implementation**

Create `src/services/appUpdate/updateCheck.ts`:

```ts
import { Linking, Platform } from 'react-native';
import { checkForUpdate } from 'expo-in-app-updates';

export const APP_STORE_ID = '6774886649';
export const ANDROID_PACKAGE = 'com.showdown.app';

export interface StoreVersionCheck {
    available: boolean;
    /** iOS: a semver string. Android: a versionCode, stringified. Compare by equality only. */
    storeVersion: string;
}

/**
 * Asks the store whether a newer build exists. Android goes through Play Core
 * (authoritative for this specific device); iOS through Apple's iTunes Search
 * API, which is CDN-cached and can lag a few hours behind a release.
 *
 * Returns null for every unhappy path — offline, throttled, no Play Services,
 * malformed response. Callers treat null as "show nothing".
 */
export async function checkStoreVersion(): Promise<StoreVersionCheck | null> {
    try {
        const result = await checkForUpdate();
        if (!result?.updateAvailable) return null;
        if (result.storeVersion === undefined || result.storeVersion === null) return null;
        return { available: true, storeVersion: String(result.storeVersion) };
    } catch {
        return null;
    }
}

const STORE_LINKS = Platform.select({
    ios: {
        native: `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`,
        web: `https://apps.apple.com/app/id${APP_STORE_ID}`,
    },
    default: {
        native: `market://details?id=${ANDROID_PACKAGE}`,
        web: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    },
});

/**
 * Opens the store listing. Tries the native scheme first (lands directly in the
 * store app), falling back to https when the scheme will not open — `canOpenURL`
 * is deliberately avoided because `itms-apps` requires an Info.plist allow-list
 * entry to be queryable, while opening it needs no such thing.
 */
export async function openStoreListing(): Promise<void> {
    try {
        await Linking.openURL(STORE_LINKS.native);
    } catch {
        try {
            await Linking.openURL(STORE_LINKS.web);
        } catch {
            // Nothing further to try — never surface an error for a nudge.
        }
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/services/appUpdate/updateCheck.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Rebuild the native app**

The new native module requires a rebuild — it will not appear in the existing dev client.

Run: `npx expo run:ios`
Expected: the app builds and launches. If Metro resolves stale paths, stop it and run `npx expo start -c`.

Android cannot be built on this Mac (no Android SDK) — see Task 7 for the deferred verification.

- [ ] **Step 8: Commit**

```bash
npm run static
git add package.json package-lock.json app.json jest.setup.js src/services/appUpdate/updateCheck.ts src/services/appUpdate/updateCheck.test.ts ios android
git commit -m "feat(update): check the store for a newer version"
```

---

### Task 4: The announcement sheet

One presentational component serving both flows. No storage, no native calls, no decisions — props in, sheet out.

**Files:**

- Create: `src/components/molecules/AnnouncementSheet.tsx`
- Test: `src/components/molecules/__tests__/AnnouncementSheet.test.tsx`

**Interfaces:**

- Consumes: `BottomSheet` (`./BottomSheet`), `Button` (`./Button`), `Stack`/`Text` atoms, `Mascot` + `getEquippedLook` from `src/game/mascot/`, `useResponsive`, `useTheme`.
- Produces:
    - `interface AnnouncementHighlight { emoji: string; label: string }`
    - `interface AnnouncementSheetProps { visible, title, body?, highlights?, ctaLabel, onPressCta, dismissLabel?, onClose, testID? }`
    - Default export `AnnouncementSheet`.

- [ ] **Step 1: Write the failing test**

Create `src/components/molecules/__tests__/AnnouncementSheet.test.tsx`:

```tsx
import React from 'react';
import { View as MockView } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AnnouncementSheet from '../AnnouncementSheet';

jest.mock('../../../game/mascot/Mascot', () => ({
    Mascot: () => <MockView testID='mascot' />,
}));

jest.mock('../../../game/mascot/equippedLook', () => ({
    getEquippedLook: () => ({ fur: 'default', suit: 'default', accent: 'default', mic: 'default' }),
}));

describe('AnnouncementSheet', () => {
    const baseProps = {
        visible: true,
        title: 'A new version is ready',
        ctaLabel: 'Update now',
        onPressCta: jest.fn(),
        onClose: jest.fn(),
    };

    it('renders the title and fires the primary action', () => {
        const onPressCta = jest.fn();
        const { getByText } = render(<AnnouncementSheet {...baseProps} onPressCta={onPressCta} />);

        expect(getByText('A new version is ready')).toBeTruthy();
        fireEvent.press(getByText('Update now'));
        expect(onPressCta).toHaveBeenCalledTimes(1);
    });

    it('renders each highlight with its emoji', () => {
        const { getByText } = render(
            <AnnouncementSheet
                {...baseProps}
                highlights={[
                    { emoji: '🏆', label: 'Achievements and leaderboards' },
                    { emoji: '🐛', label: 'Two crashes fixed' },
                ]}
            />,
        );

        expect(getByText('🏆')).toBeTruthy();
        expect(getByText('Achievements and leaderboards')).toBeTruthy();
        expect(getByText('🐛')).toBeTruthy();
        expect(getByText('Two crashes fixed')).toBeTruthy();
    });

    it('offers a dismiss button only when a label is supplied', () => {
        const onClose = jest.fn();
        const { queryByText, rerender, getByText } = render(<AnnouncementSheet {...baseProps} />);
        expect(queryByText('Not now')).toBeNull();

        rerender(<AnnouncementSheet {...baseProps} dismissLabel='Not now' onClose={onClose} />);
        fireEvent.press(getByText('Not now'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders the body only when supplied', () => {
        const { queryByText, rerender } = render(<AnnouncementSheet {...baseProps} />);
        expect(queryByText('Grab the latest build')).toBeNull();

        rerender(<AnnouncementSheet {...baseProps} body='Grab the latest build' />);
        expect(queryByText('Grab the latest build')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/molecules/__tests__/AnnouncementSheet.test.tsx`
Expected: FAIL — `Cannot find module '../AnnouncementSheet'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/molecules/AnnouncementSheet.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import { Mascot } from '../../game/mascot/Mascot';
import { getEquippedLook } from '../../game/mascot/equippedLook';
import { useResponsive } from '../../responsive/useResponsive';

export interface AnnouncementHighlight {
    emoji: string;
    label: string;
}

export interface AnnouncementSheetProps {
    visible: boolean;
    title: string;
    /** One short paragraph. Used by the update sheet; the what's-new sheet uses highlights instead. */
    body?: string;
    highlights?: AnnouncementHighlight[];
    ctaLabel: string;
    onPressCta: () => void;
    /** When set, renders an explicit dismiss button next to the CTA. */
    dismissLabel?: string;
    onClose: () => void;
    testID?: string;
}

/**
 * The shared sheet for both once-per-version announcements: "an update is
 * available" (body + Update / Not now) and "what's new" (highlights + Let's
 * play). Purely presentational — the caller owns every decision about whether,
 * when, and how often this appears.
 *
 * BottomSheet already provides backdrop-tap, drag-down, and Android-back
 * dismissal; `dismissLabel` adds an explicit button for players who look for one.
 */
function AnnouncementSheet({
    visible,
    title,
    body,
    highlights,
    ctaLabel,
    onPressCta,
    dismissLabel,
    onClose,
    testID,
}: AnnouncementSheetProps) {
    const { scale } = useResponsive();

    return (
        <BottomSheet visible={visible} onClose={onClose} testID={testID}>
            <Stack gap='lg' align='center'>
                <View pointerEvents='none'>
                    <Mascot look={getEquippedLook()} pose='cheer' size={scale(120)} expression='happy' />
                </View>

                <Stack gap='xs' align='center'>
                    <Text variant='subheading' weight='bold' align='center'>
                        {title}
                    </Text>
                    {body ? (
                        <Text variant='body' color='textSecondary' align='center'>
                            {body}
                        </Text>
                    ) : null}
                </Stack>

                {highlights?.length ? (
                    <Stack gap='md'>
                        {highlights.map((highlight) => (
                            <Stack key={highlight.label} direction='horizontal' gap='md' align='center'>
                                <Text variant='subheading'>{highlight.emoji}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text variant='body' color='textSecondary'>
                                        {highlight.label}
                                    </Text>
                                </View>
                            </Stack>
                        ))}
                    </Stack>
                ) : null}

                <Stack gap='sm' align='center' style={{ width: '100%' }}>
                    <Button variant='primary' fullWidth onPress={onPressCta}>
                        {ctaLabel}
                    </Button>
                    {dismissLabel ? (
                        <Button variant='ghost' fullWidth onPress={onClose}>
                            {dismissLabel}
                        </Button>
                    ) : null}
                </Stack>
            </Stack>
        </BottomSheet>
    );
}

export default React.memo(AnnouncementSheet);
```

If `Stack` does not accept a `style` prop, wrap the button group in a plain `<View style={{ width: '100%' }}>` instead — check `src/components/atoms/Stack.tsx` before assuming.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/molecules/__tests__/AnnouncementSheet.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
npm run static
git add src/components/molecules/AnnouncementSheet.tsx src/components/molecules/__tests__/AnnouncementSheet.test.tsx
git commit -m "feat(update): add the shared announcement bottom sheet"
```

---

### Task 5: Orchestration and Home mount

Ties it together: decide once per launch, mount at most one sheet, mark seen on show.

**Files:**

- Create: `src/hooks/useAppAnnouncement.ts`
- Create: `src/components/molecules/AppAnnouncement.tsx`
- Test: `src/hooks/useAppAnnouncement.test.ts`
- Modify: `src/screens/HomeScreen.tsx` (render the container inside `SafeContainer`, after the compete footer)

**Interfaces:**

- Consumes: everything produced by Tasks 1–4, plus `APP_VERSION` from `src/utils/version`.
- Produces:
    - `type Announcement = { kind: 'whatsNew' } | { kind: 'update' } | null`
    - `useAppAnnouncement(): { announcement: Announcement; dismiss: () => void }`
    - `resetAppAnnouncementForTests(): void` — clears the module-level once-per-launch latch.
    - Default export `AppAnnouncement` (no props).

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAppAnnouncement.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAppAnnouncement, resetAppAnnouncementForTests } from './useAppAnnouncement';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import {
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
} from '../services/appUpdate/seenVersions';
import { APP_VERSION } from '../utils/version';

jest.mock('../services/appUpdate/updateCheck', () => ({
    checkStoreVersion: jest.fn(),
    openStoreListing: jest.fn(),
}));

jest.mock('../services/appUpdate/seenVersions', () => ({
    ...jest.requireActual('../services/appUpdate/seenVersions'),
    readWhatsNewSeen: jest.fn(),
    markWhatsNewSeen: jest.fn(),
    readUpdatePromptSeen: jest.fn(),
    markUpdatePromptSeen: jest.fn(),
}));

const mockCheck = checkStoreVersion as jest.MockedFunction<typeof checkStoreVersion>;
const mockReadWhatsNew = readWhatsNewSeen as jest.MockedFunction<typeof readWhatsNewSeen>;
const mockReadUpdate = readUpdatePromptSeen as jest.MockedFunction<typeof readUpdatePromptSeen>;

describe('useAppAnnouncement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAppAnnouncementForTests();
        mockCheck.mockResolvedValue(null);
        mockReadWhatsNew.mockReturnValue(APP_VERSION);
        mockReadUpdate.mockReturnValue(undefined);
    });

    it('shows nothing on a fresh install and seeds the seen version', async () => {
        mockReadWhatsNew.mockReturnValue(undefined);

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION));
        expect(result.current.announcement).toBeNull();
        expect(mockCheck).not.toHaveBeenCalled();
    });

    it('shows what is new after an update and marks it seen immediately', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));
        expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION);
        expect(mockCheck).not.toHaveBeenCalled();
    });

    it('shows the update sheet when the store is ahead, and marks that store version seen', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'update' }));
        expect(markUpdatePromptSeen).toHaveBeenCalledWith('9.9.9');
    });

    it('does not re-prompt for a store version already seen', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });
        mockReadUpdate.mockReturnValue('9.9.9');

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(mockCheck).toHaveBeenCalled());
        expect(result.current.announcement).toBeNull();
        expect(markUpdatePromptSeen).not.toHaveBeenCalled();
    });

    it('shows nothing when the store check fails', async () => {
        mockCheck.mockResolvedValue(null);

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(mockCheck).toHaveBeenCalled());
        expect(result.current.announcement).toBeNull();
    });

    it('decides only once per launch', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

        const first = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(first.result.current.announcement).toEqual({ kind: 'update' }));

        const second = renderHook(() => useAppAnnouncement());
        expect(second.result.current.announcement).toBeNull();
        expect(mockCheck).toHaveBeenCalledTimes(1);
    });

    it('clears the announcement on dismiss', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));

        act(() => result.current.dismiss());
        expect(result.current.announcement).toBeNull();
    });
});
```

Note `APP_VERSION` is `'1.0.0'` under Jest (`Constants.expoConfig` is not populated) — that is fine here, because every assertion compares it against itself. The version-drift canary lives in `src/data/whatsNew.test.ts`, which reads `app.json` from disk instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/hooks/useAppAnnouncement.test.ts`
Expected: FAIL — `Cannot find module './useAppAnnouncement'`.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useAppAnnouncement.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { WHATS_NEW } from '../data/whatsNew';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import {
    decideWhatsNew,
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
    shouldPromptUpdate,
} from '../services/appUpdate/seenVersions';
import { APP_VERSION } from '../utils/version';

export type Announcement = { kind: 'whatsNew' } | { kind: 'update' } | null;

/**
 * One decision per launch, not per mount. Home can gain focus many times in a
 * session; the announcement must not return each time.
 */
let decidedThisLaunch = false;

/** Test-only: reset the once-per-launch latch between cases. */
export function resetAppAnnouncementForTests(): void {
    decidedThisLaunch = false;
}

/**
 * Decides which once-per-version announcement (if any) to show. What's-new wins
 * over the update prompt — right after updating there is no newer version
 * anyway, and the ordering makes that explicit rather than accidental.
 *
 * Both flows mark "seen" the moment the sheet is shown, not when it is
 * dismissed: there are five ways out (button, backdrop, drag, Android back, app
 * kill) and marking on show is the only way "exactly once" is actually true.
 */
export function useAppAnnouncement(): { announcement: Announcement; dismiss: () => void } {
    const [announcement, setAnnouncement] = useState<Announcement>(null);

    useEffect(() => {
        if (decidedThisLaunch) return;
        decidedThisLaunch = true;

        const decision = decideWhatsNew(readWhatsNewSeen(), APP_VERSION, WHATS_NEW.version);

        // 'seed' (fresh install) and 'bump' (a patch with no notes) both record
        // the version and stay quiet — and skip the store check, because a build
        // installed or updated just now is not behind the store.
        if (decision !== 'none') {
            markWhatsNewSeen(APP_VERSION);
            if (decision === 'show') setAnnouncement({ kind: 'whatsNew' });
            return;
        }

        let active = true;
        void checkStoreVersion().then((result) => {
            if (!active || !result) return;
            if (!shouldPromptUpdate(readUpdatePromptSeen(), result.storeVersion)) return;
            markUpdatePromptSeen(result.storeVersion);
            setAnnouncement({ kind: 'update' });
        });

        return () => {
            active = false;
        };
    }, []);

    const dismiss = useCallback(() => setAnnouncement(null), []);

    return { announcement, dismiss };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/hooks/useAppAnnouncement.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the container**

Create `src/components/molecules/AppAnnouncement.tsx`:

```tsx
import React, { useCallback } from 'react';
import AnnouncementSheet from './AnnouncementSheet';
import { useAppAnnouncement } from '../../hooks/useAppAnnouncement';
import { WHATS_NEW } from '../../data/whatsNew';
import { openStoreListing } from '../../services/appUpdate/updateCheck';
import { APP_VERSION } from '../../utils/version';
import { useTranslation } from '../../i18n';

/**
 * Mounts whichever once-per-version announcement the hook selected. Rendered by
 * Home only, so a sheet can never interrupt a run, a purchase, or a challenge
 * deep link.
 */
function AppAnnouncement() {
    const { t } = useTranslation();
    const { announcement, dismiss } = useAppAnnouncement();

    const handleUpdate = useCallback(() => {
        dismiss();
        void openStoreListing();
    }, [dismiss]);

    if (announcement?.kind === 'whatsNew') {
        return (
            <AnnouncementSheet
                visible
                testID='whats-new-sheet'
                title={t('whatsNew.title', { version: APP_VERSION })}
                highlights={WHATS_NEW.highlights.map((highlight) => ({
                    emoji: highlight.emoji,
                    label: t(highlight.key),
                }))}
                ctaLabel={t('whatsNew.cta')}
                onPressCta={dismiss}
                onClose={dismiss}
            />
        );
    }

    if (announcement?.kind === 'update') {
        return (
            <AnnouncementSheet
                visible
                testID='update-available-sheet'
                title={t('appUpdate.title')}
                body={t('appUpdate.body')}
                ctaLabel={t('appUpdate.cta')}
                onPressCta={handleUpdate}
                dismissLabel={t('appUpdate.later')}
                onClose={dismiss}
            />
        );
    }

    return null;
}

export default React.memo(AppAnnouncement);
```

- [ ] **Step 6: Mount it on Home**

In `src/screens/HomeScreen.tsx`, add the import alongside the other molecule imports:

```tsx
import AppAnnouncement from '../components/molecules/AppAnnouncement';
```

Then render it as the last child of `SafeContainer`, immediately after the compete footer's closing `</View>` and before `</SafeContainer>` (around line 438):

```tsx
            <AppAnnouncement />
        </SafeContainer>
```

- [ ] **Step 7: Keep the existing Home test green**

`src/screens/HomeScreen.test.tsx` renders the real component tree. Add a mock alongside the existing ones so the Home suite does not pull in the native update module:

```tsx
jest.mock('../components/molecules/AppAnnouncement', () => ({
    __esModule: true,
    default: () => null,
}));
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS — all suites, including the previously passing Home tests.

- [ ] **Step 9: Commit**

```bash
npm run static
git add src/hooks/useAppAnnouncement.ts src/hooks/useAppAnnouncement.test.ts src/components/molecules/AppAnnouncement.tsx src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "feat(update): show the update and what's-new sheets on Home"
```

---

### Task 6: Device visual pass

The sheets are now correct. This task makes them look right, on a real screen, with the real mascot and the real theme.

**Files:**

- Modify: `src/screens/SettingsScreen.tsx` (a `__DEV__`-only preview trigger)
- Modify: `src/components/molecules/AnnouncementSheet.tsx` (the chosen variant)

- [ ] **Step 1: Add a dev-only preview trigger**

In `src/screens/SettingsScreen.tsx`, first add the imports the preview needs (merge `useState` into the existing React import if one is already there):

```tsx
import { useState } from 'react';
import AnnouncementSheet from '../components/molecules/AnnouncementSheet';
import Button from '../components/molecules/Button';
import { WHATS_NEW } from '../data/whatsNew';
import { APP_VERSION } from '../utils/version';
```

Then, inside the "about" section next to the existing version row (around line 191), add a row that only exists in development builds. Dev-only affordances are exempt from the i18n rule, so English literals are fine here:

```tsx
{
    __DEV__ ? (
        <Button
            variant='ghost'
            onPress={() => setPreview(preview === null ? 'whatsNew' : preview === 'whatsNew' ? 'update' : null)}
        >
            {`Preview announcement: ${preview ?? 'off'}`}
        </Button>
    ) : null;
}
```

Back it with local state and render the sheet directly, bypassing the hook so the ledger is untouched:

```tsx
const [preview, setPreview] = useState<'whatsNew' | 'update' | null>(null);
```

```tsx
{
    __DEV__ && preview ? (
        <AnnouncementSheet
            visible
            title={preview === 'update' ? t('appUpdate.title') : t('whatsNew.title', { version: APP_VERSION })}
            body={preview === 'update' ? t('appUpdate.body') : undefined}
            highlights={
                preview === 'whatsNew'
                    ? WHATS_NEW.highlights.map((h) => ({ emoji: h.emoji, label: t(h.key) }))
                    : undefined
            }
            ctaLabel={preview === 'update' ? t('appUpdate.cta') : t('whatsNew.cta')}
            dismissLabel={preview === 'update' ? t('appUpdate.later') : undefined}
            onPressCta={() => setPreview(null)}
            onClose={() => setPreview(null)}
        />
    ) : null;
}
```

- [ ] **Step 2: Build and look at both sheets**

Run: `npx expo run:ios`

Open Settings, tap the preview row twice to see each sheet. Check on the smallest supported screen and at a large Dynamic Type setting: the mascot must not push the CTA off-screen, and highlight text must wrap rather than truncate. If content overflows, pass `scrollable` through to `BottomSheet`.

- [ ] **Step 3: Build 2–3 layout variants and choose one on device**

Temporarily parameterise `AnnouncementSheet` (or copy it to throwaway variants) and compare on the device:

- **A — mascot-led:** mascot at `scale(120)`, title, highlights, full-width CTA. The Task 4 baseline.
- **B — compact:** mascot at `scale(80)`, tighter gaps (`gap='md'`), title and body on one block. Less scrolling on small screens.
- **C — emoji-led:** no mascot; each highlight's emoji rendered large in a tinted row. Reads more like a changelog, less like a character moment.

Show the variants to the user and let them pick from the running app. **Then delete the unchosen variants and any variant switcher** — do not ship a configurable component for a decision that has been made.

- [ ] **Step 4: Confirm the tests still pass after the visual edits**

Run: `npx jest src/components/molecules/__tests__/AnnouncementSheet.test.tsx`
Expected: PASS, 4 tests. If a variant renamed props, update the test to match.

- [ ] **Step 5: Commit**

```bash
npm run static
git add src/components/molecules/AnnouncementSheet.tsx src/screens/SettingsScreen.tsx
git commit -m "feat(update): finalize the announcement sheet layout"
```

---

### Task 7: Release ritual and Android verification

Closes the two loops the spec flagged: notes that rot silently, and an Android half this Mac cannot build.

**Files:**

- Modify: `~/.agents/skills/release-notes/SKILL.md`
- Modify: `docs/superpowers/specs/2026-07-31-in-app-update-sheets-design.md` (status)

- [ ] **Step 1: Add a whatsNew step to the release-notes skill**

In `~/.agents/skills/release-notes/SKILL.md`, insert a new step between the existing "### 3. Write release notes" and "### 4. Review App Store text with Gemini and Qwen":

```markdown
### 3b. Update the in-app what's-new sheet

`src/data/whatsNew.ts` drives the bottom sheet shown once after a player
updates. Its `version` MUST match the new app.json version, or the sheet stays
silent (and `src/hooks/useAppAnnouncement.test.ts` fails).

1. Set `WHATS_NEW.version` to the version being released.
2. Replace `highlights` with 2–3 entries for this release — an emoji plus an
   i18n key, e.g. `{ emoji: '🏆', key: 'whatsNew.1_5_0.gameCenter' }`.
   Key segments use underscores: version `1.5.0` → `whatsNew.1_5_0.*`.
3. Add the matching strings to `src/i18n/locales/en.json` and `pl.json` under a
   `whatsNew.<underscored_version>` block. Delete the previous version's block —
   only one release's notes are ever shown.
4. Keep each highlight to one short sentence in the player's voice. These are
   shorter and warmer than the App Store copy written in step 3.

Verify: `npx jest src/data/whatsNew.test.ts`
```

- [ ] **Step 2: Verify the canary works**

Temporarily change `WHATS_NEW.version` to `'0.0.0'`.

Run: `npx jest src/data/whatsNew.test.ts`
Expected: FAIL on "matches the version in app.json".

Revert the change and re-run.
Expected: PASS.

- [ ] **Step 3: Record the Android verification as outstanding**

In the spec's §7, append to the Play Core bullet:

```markdown
Status: unverified as of the implementation commit — requires a Play-installed
build via internal app sharing on the machine with the Android SDK.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-31-in-app-update-sheets-design.md
git commit -m "docs: note the deferred Android verification for in-app updates"
```

The skill file lives outside the repo and is not committed here.

---

## Verification checklist

Before considering the feature done:

- [ ] `npm test` — full suite green.
- [ ] `npm run static` — type-check, lint, and format all clean.
- [ ] `npm run i18n:check` — no missing keys (dynamic `whatsNew.*` keys reported as unused is expected).
- [ ] iOS device/simulator: what's-new sheet appears after simulating an update (set `whatsNewSeenVersion` to an older value via the dev preview or a temporary override), and does **not** appear on the next launch.
- [ ] iOS: update sheet CTA opens the App Store listing for id `6774886649`.
- [ ] Both sheets dismiss via backdrop tap, drag-down, Android back, and their buttons.
- [ ] Android: deferred — requires the machine with the Android SDK and a Play-installed build.
