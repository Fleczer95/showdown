import { createContext } from 'react';
/** Scoped, never writes the user's selected theme. */
export const EventAccentContext = createContext<string | undefined>(undefined);
