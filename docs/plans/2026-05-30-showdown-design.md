# ShowDown: TV Quiz Party Games - Design Document

**Goal:** A premium, legally-distinct React Native game show app focused on local multiplayer and asynchronous social challenges.

## 1. Core Game Modes (Homages)
- **The Ladder:** 15-question trivia curve with "Lifelines" (Millionaire-style).
- **The Grid:** High-stakes category board where players bet points (Jeopardy-style).
- **The Opinion Poll:** Guessing weighted answers from an AI-simulated survey of 100 people (Family Feud-style).
- **The Wheel:** Solving word puzzles with a spinning multiplier (Wheel of Fortune-style).

## 2. Technical Architecture
- **State Management:** XState handles all game transitions to ensure predictable, error-free gameplay.
- **UI/UX:** 2.5D Isometric "Studio Interface" utilizing broadcast motion graphics and dynamic lighting.
- **Libraries:**
  - `react-native-reanimated`: Fluid UI transitions and graphics motion.
  - `react-native-skia`: Professional-grade VFX, shadows, and lighting.
  - `expo-router`: Type-safe navigation between game modes and the Trophy Room.
  - `i18n-js`: Localization framework for EN and PL support (Standard implementation).
- **Content:** An offline-first monolithic bundle of AI-curated question packs, categorized by game mode and complexity. Supports English and Polish.

## 3. Progression & Monetization
- **XP System:** Every round played earns XP, unlocking "Trophy Room" achievements.
- **Trophy Room:** A 2.5D showcase of the user's progress and high scores.
- **Premium Model:** No ads. Revenue generated via IAP for "Extra Packs" and "Studio Themes" (Cosmetic skins).

## 4. Multiplayer
- **Local:** Pass-and-play for 2-4 people on a single device.
- **Async:** Shared deep links that allow friends to "challenge" a specific score or result.
