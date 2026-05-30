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
} from 'lucide-react-native';
import { STORE_CATALOG } from '../data/store/catalog';
import type { ThemeDefinition } from '../data/store/types';

export interface ThemeOption {
    value: string;
    labelKey: string;
    icon: any;
    theme: any;
    isPremium?: boolean;
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
};

const getIcon = (name: string) => ICON_MAP[name] ?? Palette;

/**
 * Themes shown in the picker. Visibility is owned by the `status` axis — the
 * same rule the Store Catalog resolver uses (`status: 'hidden'` is never
 * visible) — so the picker and `useResolvedThemes` cannot drift apart.
 */
export const themeRegistry: ThemeOption[] = STORE_CATALOG.filter(
    (entry): entry is ThemeDefinition => entry.kind === 'theme' && entry.status === 'live',
).map((entry) => ({
    value: entry.id.replace('theme-', ''),
    labelKey: entry.presentation.titleKey,
    icon: getIcon(entry.presentation.iconName),
    theme: entry.tokens,
    isPremium: entry.tier === 'premium',
}));

export default themeRegistry;
