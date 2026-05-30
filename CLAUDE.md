# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Concept

A solo game-show collection for a single phone: four "legally distinct" TV-quiz formats (The Ladder, The Grid, The Opinion Poll, The Wheel) played one player at a time. No controllers, no Wi-Fi, no setup. Competing with friends happens asynchronously — share a result by URL and challenge them to beat it (post-MVP). See `docs/decisions/0001-solo-mvp-over-pass-and-play.md`.

## Development Instructions & Build Rules

1. **Native Modules Required:** This project uses `react-native-mmkv` and `expo-localization` which have native bindings. **DO NOT use standard `expo start`** or attempt to run the app in the standard Expo Go client, as it will crash with `NitroModules are not supported in Expo Go!` or similar errors.
2. **Development Build:** You must build and run a custom development client using:
    - `npx expo run:ios`
    - `npx expo run:android`
3. **Metro Cache:** If dependencies are changed or added, the Metro bundler often caches stale resolution paths. Force restart and clear the cache using `npx expo start -c`.

## App Store Connect API

Credentials, endpoints, and IAP bulk-creation script are in the `app-store-connect-api` skill.
Key file: `AuthKey_4T9DC2QVQF.p8` (repo root, gitignored).

## Google Play Developer API

Credentials and mass IAP creation script (using the new v3 Monetization API) are in the `google-play-iap` skill.
Key file: `google-play-key.json` (repo root, gitignored).

## AI Assistant Guidelines

Refer to [AGENTS.md](./AGENTS.md) for specific workflows regarding localization verification and theme effect implementation.
