import {
    PartyPopper,
    Flower2,
    Square,
    Trees,
    Moon,
    Sun,
    Zap,
    Sparkles,
    Palette,
    Heart,
    Atom,
    History,
    MapPin,
    Film,
    Dumbbell,
    Tag,
    MessageCircle,
    BookOpen,
    Trophy,
    Crown,
} from 'lucide-react-native';
import { STORE_CATALOG } from '../data/store/catalog';
import type { ThemeDefinition } from '../data/store/types';
import { PROGRESSION_THEMES } from '../game/progression/themes';
import { auroraTheme } from './themes';

export interface ThemeOption {
    value: string;
    labelKey: string;
    icon: any;
    theme: any;
    isPremium?: boolean;
    /** Earned via the Level Map — its lock resolves against unlockedRewards, not purchases. */
    isEarned?: boolean;
    /** The reward id used to resolve an earned theme's lock. Set iff `isEarned`. */
    rewardId?: string;
    /** Subscriber-exclusive — its lock resolves against the Premium subscription (`isPremium`). */
    isSubscriber?: boolean;
}

const ICON_MAP: Record<string, any> = {
    party: PartyPopper,
    flower: Flower2,
    square: Square,
    trees: Trees,
    moon: Moon,
    sun: Sun,
    zap: Zap,
    sparkles: Sparkles,
    themes: Palette,
    heart: Heart,
    atom: Atom,
    history: History,
    mapPin: MapPin,
    film: Film,
    dumbbell: Dumbbell,
    tag: Tag,
    message: MessageCircle,
    book: BookOpen,
    trophy: Trophy,
    crown: Crown,
};

const getIcon = (name: string) => ICON_MAP[name] ?? Palette;

/**
 * Themes shown in the picker. Visibility is owned by the `status` axis — the
 * same rule the Store Catalog resolver uses (`status: 'hidden'` is never
 * visible) — so the picker and `useResolvedThemes` cannot drift apart.
 */
const storeThemes: ThemeOption[] = STORE_CATALOG.filter(
    (entry): entry is ThemeDefinition => entry.kind === 'theme' && entry.status === 'live',
).map((entry) => ({
    value: entry.id.replace('theme-', ''),
    labelKey: entry.presentation.titleKey,
    icon: getIcon(entry.presentation.iconName),
    theme: entry.tokens,
    isPremium: entry.tier === 'premium',
}));

/**
 * Earned themes union into the same picker as store themes; their lock is resolved
 * against `unlockedRewards(lifetimeXp)` instead of purchases (see SettingsScreen).
 * Store and earned theme tokens are otherwise identical, so the theme
 * provider/persistence need no changes.
 */
const progressionThemes: ThemeOption[] = PROGRESSION_THEMES.map((earned) => ({
    value: earned.value,
    labelKey: earned.titleKey,
    icon: getIcon(earned.iconName),
    theme: earned.tokens,
    isEarned: true,
    rewardId: earned.id,
}));

/**
 * Subscriber-exclusive themes. They live OUTSIDE `STORE_CATALOG` (never sold
 * individually) and are gated by the Premium subscription (`isPremium`), not by
 * purchases or progression. Today just Aurora.
 */
const subscriberThemes: ThemeOption[] = [
    {
        value: 'aurora',
        labelKey: 'screen.themePicker.themes.aurora',
        icon: getIcon('sparkles'),
        theme: auroraTheme,
        isSubscriber: true,
    },
];

/** Picker values that are subscriber-exclusive — used by the lapse revert gate. */
const SUBSCRIBER_THEME_VALUES: ReadonlySet<string> = new Set(subscriberThemes.map((t) => t.value));

/** Whether a theme value is subscriber-exclusive (reverts to default when Premium lapses). */
export function isSubscriberTheme(value: string): boolean {
    return SUBSCRIBER_THEME_VALUES.has(value);
}

export const themeRegistry: ThemeOption[] = [...storeThemes, ...subscriberThemes, ...progressionThemes];

export default themeRegistry;
