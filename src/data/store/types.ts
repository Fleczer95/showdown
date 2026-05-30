import type { Theme } from '../../theme/contract';

/** Built-but-held-back vs. shipped. Orthogonal to `EntryTier`. */
export type EntryStatus = 'live' | 'hidden';

/** Free vs. paid. Orthogonal to `EntryStatus`. */
export type EntryTier = 'free' | 'premium';

export interface StoreEntryPresentation {
    titleKey: string;
    descriptionKey: string;
    iconName: string;
    accentColor: string;
    featuresKey?: string[];
    /**
     * Display-only fallback price string, shown before the IAP product query
     * resolves or if it fails. NOT canonical — the real price comes from
     * react-native-iap `localizedPrice` keyed on `sku`.
     */
    fallbackPrice?: string;
}

/** The fields every purchasable item shares. The resolver only ever sees these. */
export interface StoreEntryBase {
    id: string;
    status: EntryStatus;
    tier: EntryTier;
    /** Canonical commerce id; present iff the item is sold through IAP. */
    sku?: string;
    presentation: StoreEntryPresentation;
}

export type PackContent<TCard> = { en: TCard[]; pl: TCard[] };

/** A pack = a store entry scoped to a game, carrying card content. */
export interface PackDefinition<TCard = unknown> extends StoreEntryBase {
    kind: 'pack';
    gameId: string;
    content: PackContent<TCard>;
}

/** A theme = a store entry carrying visual tokens, app-wide. */
export interface ThemeDefinition extends StoreEntryBase {
    kind: 'theme';
    tokens: Theme;
}

/**
 * The catalog is typed as this UNION, never as the base interface, so that
 * `if (e.kind === 'pack')` narrows access to `gameId`/`content`.
 */
export type CatalogEntry = PackDefinition | ThemeDefinition;
