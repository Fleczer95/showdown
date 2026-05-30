# Master Scaffolding Prompt: ShowDown TV Quiz Party Games (Ultimate Edition)

**Goal:** Initialize a production-grade React Native (Expo) project in `showdown/` by extracting the technical skeleton, growth infrastructure, dev-ops automation, and developer-level agent skills from `../TinyParty`.

**1. Technical Skeleton (The Engine):**
- **Versions:** Sync `package.json` (Expo 54, React 19, Reanimated 4, Skia, MMKV, IAP, Sentry, Firebase).
- **Configs:** Copy `.prettierrc`, `eslint.config.cjs`, `tsconfig.json`, `.gitignore`, `metro.config.cjs`, and `app.json`.
- **CRITICAL (app.json):** Immediately update `expo.name` to "ShowDown", `expo.slug` to "showdown", `expo.ios.bundleIdentifier` to "com.showdown.app", and `expo.android.package` to "com.showdown.app".
- **Tooling:** Copy entire `scripts/` directory for versioning, building, and translation analysis.
- **Rules:** Copy `CLAUDE.md` and `AGENTS.md` (Crucial for maintaining high-quality AI development standards).

**2. Developer & AI Ecosystem (The Automation):**
- **Agent Skills:** Copy the `.agents/` directory (Includes `app-store-connect-api` and `google-play-iap` skills for bulk IAP creation).
- **Agent Configs:** Copy the `.claude/` directory (Includes workspace settings and skill overrides).
- **Store Credentials:** Note the location of `google-play-key.json`, `api_key_play_store.txt`, and `AuthKey_*.p8` in the repo root. These are required for automated store updates and IAP management (copy if using the same developer account).

**3. User Experience & UI (The Foundation):**
- **Atomic UI Kit:** Copy `src/components/atoms` and `molecules` (Theme-aware building blocks).
- **Theming:** Copy `src/theme/` (Full contract-based responsive system).
- **Responsive:** Copy `src/responsive/` (Scaling engine).
- **Feedback:** Copy `src/hooks/useHaptics.ts`, `useSound.ts`, and `src/animations/Confetti.tsx`.
- **i18n:** Copy `src/i18n/` (Ready for EN/PL).

**4. Growth & Production (The Intelligence):**
- **Analytics Schema:** Copy `src/utils/firebase/` (Crucial: adapt `events.ts` for ShowDown).
- **Observability:** Copy `src/utils/sentry/` and `src/components/AppErrorBoundary.tsx`.
- **IAP Engine:** Copy `src/services/store/` (IAP abstraction logic).

**5. Operations & ASO (The Launchpad):**
- **ASO Tooling:** Copy `aso/screenshot-generator/` (The Next.js app for programmatic screenshots). *Skip app-specific metadata files.*
- **DevOps:** Copy `.github/workflows/` for automated CI and PR management.

**Execution Goal:**
- Nest all providers in `App.tsx`: (Sentry -> Firebase -> ErrorBoundary -> GestureHandler -> SafeArea -> Settings -> Translation -> Theme -> Store -> Analytics).
- Register the 4 game modes in `src/data/games.ts` following the TinyParty pattern.
- Game logic implementation (XState) to follow in the next phase.

