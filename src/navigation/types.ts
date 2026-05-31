import type { SetupRoute } from '../data/games';

/**
 * Root stack param list. `Home` is the landing screen; each game's setup screen
 * is registered under the `setupRoute` name declared on its entry in
 * `src/data/games.ts` and receives that game's `id`.
 */
export type RootStackParamList = {
    Home: undefined;
    Settings: undefined;
    privacyPolicy: undefined;
    termsOfUse: undefined;
} & Record<SetupRoute, { gameId: string }>;

// Make `useNavigation()` / `Link` etc. globally aware of the param list.
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {}
    }
}
