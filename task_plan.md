# ShowDown: Project Plan

**Goal:** Build a React Native "Game Show" app — **solo** TV-quiz games with post-MVP async challenges. See `docs/decisions/0001-solo-mvp-over-pass-and-play.md` and `CONTEXT.md`.

**MVP games (all solo):** The Ladder, The Drop, The Wheel. The Grid is deferred (hidden); The Opinion Poll was cut.

## Phase 1: Research & Design [COMPLETE]
- [x] Research ASO keywords for "Party Games" and "TV Quiz"
- [x] Define "Legally Distinct" UI styles for the 4 core games
- [x] Draft Technical Architecture (React Native + XState)

## Phase 2: Core Engine Development
- [x] Initialize React Native project with Expo and necessary libs (Skia, Reanimated, XState, i18next)
- [x] Set up i18n infrastructure (EN/PL translation files)
- [x] Implement Game State Machine (XState) for core transitions
- [x] Build initial four game modules (team/pass-and-play) — superseded by solo pivot below
- [x] Implement AI Content Pipeline script (Bilingual Pack generator)

## Phase 2b: Solo Reconciliation (post-grill MVP)
- [x] **The Ladder** → solo: dropped turn rotation/players; Skip now swaps for a same-rung question (content carries spare questions per rung)
- [x] **The Wheel** → solo press-your-luck: round cash + banking, Bankrupt wipes round cash, wrong consonant = wasted spin, wrong solve ends puzzle (0 banked), 3 puzzles, score = total banked
- [x] **The Drop** (NEW, replaces Opinion Poll) → Money-Drop-style: 1,000,000 bank as 40×25k bundles, cover 1-3 options (never all 4), preserve-only, 9 rounds or bust; per-option slider allocation; real-statistics bilingual content
- [x] **The Opinion Poll** → removed entirely (logic/content/screen/registry/i18n)
- [x] **The Grid** → hidden from game list (code kept); ABCD conversion deferred post-MVP
- [x] `games.ts` + registry → all solo; integrated The Drop; gates green (tsc, jest 122, i18n 188/188)

## Phase 2c: Content & Replay Quality
- [x] **Fact-check The Drop's statistics** (EN + PL) — replaced the original common-knowledge bank (bones=206, piano keys, soccer players, alphabet) with 14 *surprising-but-verifiable* statistics. Common-knowledge trivia broke the game: if everyone knows the answer there is no reason to spread the bank across options. New bank uses figures the player is genuinely uncertain about (heartbeats/day ≈100k, languages ≈7,000, ocean O₂ ≈50%, people ever born ≈117bn, Great Wall ≈21,000km, body cells ≈37 trillion, fresh water ≈3%, Indonesia islands ≈17,000, neurons ≈86bn, France time zones =12, etc.), all real and rounded for legibility
- [x] **Question history (no-repeat) across all games** — count-based selection (`src/game/deck.ts` `createDeck` + `src/game/history.ts` MMKV), explicit per-question ids, display-time counting, threaded through all three games. Gates green (tsc, jest 129, i18n 188/188).
- [ ] *(Phase 3 sub-decision, parked)* When an IAP pack unlocks, seed its questions' counts to the current pool minimum so new content blends rather than starving the base pool

## Phase 3: Multiplayer & Social
- [x] ~~Local Pass-and-Play (2-4 players)~~ — DROPPED (solo pivot, ADR 0001)
- [ ] Implement Asynchronous Challenge sharing (Deep links) — solo score by URL
- [ ] Implement In-App Purchases (IAP) for "Extra Packs" and "Cosmetic Themes"
- [ ] Implement XP and Trophy Room persistence

## Phase 4: ASO & Polishing
- [ ] Finalize App Store metadata (Refine for character limits)
- [ ] Implement Studio Theme switching logic
- [ ] UI/UX Polish (Sound effects, Animations)

## Async Challenge Rematch
- [x] Add directed 1:1 rematch metadata and indexes to D1
- [x] Add idempotent create, lookup, and inbox-sync Worker routes
- [x] Add typed client store wrappers and local rematch indexing/sync
- [x] Add result-screen rematch creation with limits, retry, and fresh questions
- [x] Add incoming-rematch discovery on Home and Challenge History
- [x] Add synchronized EN/PL copy and analytics
- [x] Add tests and run server/client static checks plus i18n analysis
