import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { I18n } from 'i18n-js';
import { useSettings } from '../hooks/useSettings';
import en from './locales/en.json';
import pl from './locales/pl.json';

import { Language } from './types';

const i18n = new I18n({ en, pl });
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

// Polish has three plural forms (one/few/many) — i18n-js only ships the
// English-style one/other rule, so register the CLDR cardinal rule for `pl`.
i18n.pluralization.register('pl', (_i18n, count) => {
    const n = Math.abs(count);
    if (n === 1) return ['one'];
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return ['few'];
    return ['many'];
});

interface TranslationContextValue {
    t: (key: string, options?: Record<string, any>) => any;
    locale: Language;
}

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

export const TranslationProvider = ({ children }: { children: React.ReactNode }) => {
    const { language } = useSettings();

    // update i18n locale whenever language setting changes
    i18n.locale = language;

    const t = useCallback(
        (key: string, options?: Record<string, any>) => {
            return i18n.t(key, options);
        },
        // language is kept so memoized callers re-run when the locale changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [language],
    );

    const value = useMemo(() => ({ t, locale: language as Language }), [t, language]);

    return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
};

export const useTranslation = () => {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslation must be used within TranslationProvider');
    }
    return context;
};
