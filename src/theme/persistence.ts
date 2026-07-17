import { profileStore } from '../storage/appStores';

const THEME_KEY = 'theme';

export function loadThemePreference(): string {
    return profileStore.getString(THEME_KEY) ?? 'party';
}

export function saveThemePreference(id: string): void {
    profileStore.set(THEME_KEY, id);
}
