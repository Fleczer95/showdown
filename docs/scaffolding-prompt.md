# Scaffolding Prompt: ShowDown TV Quiz Party Games (Infra Step)

**Context:** We are initializing a new React Native (Expo) project inside this `showdown/` directory. Our goal is to surgically extract the "technical skeleton" from the sibling directory `../TinyParty`.

**1. Technical Infrastructure (The Engine):**
- **Match versions:** Match `package.json` with `../TinyParty` (Expo 54, React 19, Reanimated 4, Skia, MMKV, IAP).
- **Tooling:** Copy the entire `scripts/` folder and root configs: `.prettierrc`, `eslint.config.cjs`, `tsconfig.json`, and `.gitignore`.
- **System Logic:** Copy `src/responsive/` (scaling engine), `src/hooks/useHaptics.ts`, `src/hooks/useSound.ts`, and `src/hooks/useSettings.tsx`.
- **Localization:** Copy `src/i18n/` (configured for EN/PL).
- **Store:** Copy `src/services/store/` (IAP/Persistence logic).

**2. Theme & Design System:**
- **Copy Master Theme:** Copy `src/theme/`. We will use this contract to later define our 2.5D Isometric Studio style.

**3. UI Building Blocks (Atoms & Molecules):**
- **Copy Atoms:** `src/components/atoms/` (HapticPressable, Stack, Text, Badge, Icon).
- **Copy Molecules:** `src/components/molecules/` (Button, Card, CircularTimer, ProgressBar, SelectionList, ToggleGroup).
- **Copy Animations:** `src/animations/` (Confetti, Transition).
- **Strict Rule:** Skip all "Organisms" and game-specific screens/logic.

**4. Production Readiness:**
- **Observability:** Copy `src/utils/sentry/`, `src/utils/firebase/`, and `src/components/AppErrorBoundary.tsx`.

**Execution Goal:**
- Initialize the bare project first.
- Copy the listed folders/files.
- Nest all providers in `App.tsx` following the TinyParty pattern: 
  (Sentry -> Firebase -> ErrorBoundary -> GestureHandler -> SafeArea -> Settings -> Translation -> Theme -> Store -> Analytics).
