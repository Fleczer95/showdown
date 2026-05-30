import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'showdown' });

const THEME_KEY = 'theme';

export function loadThemePreference(): string {
    return storage.getString(THEME_KEY) ?? 'party';
}

export function saveThemePreference(id: string): void {
    storage.set(THEME_KEY, id);
}
