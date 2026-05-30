# Agent Instructions

This file contains specific rules and workflows for AI agents working on ShowDown.

## Localization & I18n

When adding new features, game packs, or UI components that require translation:

1.  **Always update both locales**: Ensure `src/i18n/locales/en.json` and `src/i18n/locales/pl.json` are synchronized.
2.  **Naming Convention**: Use the `screen.store.item.*` pattern for items and `screen.store.feature.*` for features to maintain consistency.
3.  **Verification**: After adding or modifying any translation content, **MUST** run the translation analysis script:
    ```bash
    npm run i18n:check
    ```
4.  **Fix Discrepancies**: If the script reports missing keys in `pl.json` or extra keys, fix them immediately before finishing the task.

## Theme Effects

When working with Skia background effects:

- Use `SkRSXform` for `Atlas` transformations to avoid JSI HostObject crashes.
- Ensure all animations use `useSharedValue` from `react-native-reanimated` for 60FPS performance.

## Touch Event Propagation

When using icons or complex layouts inside a `Pressable`, `Button`, or any interactive container:

1.  **Always wrap icons/children in `pointerEvents="none"`**: If the child element (like a Lucide icon) is not intended to be independently clickable, ensure it does not intercept touch events. This prevents "dead zones" where clicking the icon doesn't trigger the button.
2.  **Use the `Icon` component**: Prefer using the project's standard `Icon` component (from `@/components`) which already has `pointerEvents="none"` pre-configured.
3.  **Atomic Interaction**: Atomic components like `Button` and `IconButton` must always have their internal layout containers set to `pointerEvents="none"` so the parent `Pressable` handles all interactions consistently.
