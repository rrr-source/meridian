// Reactive locale: holds the active locale in React state so changing it re-renders
// the whole app (every t() / countryLabel() call re-evaluates against the new locale).
// The actual locale value lives in i18n.js (read directly by t() without a hook); this
// provider just keeps that module value and React state in lockstep and persists it.

import { createContext, useCallback, useContext, useState } from "react";
import { getInitialLocale, setStoredLocale } from "./i18n";

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = useCallback((next) => {
    const applied = setStoredLocale(next); // module value + localStorage + <html lang>
    setLocaleState(applied); // re-render the tree so t()/countryLabel() update live
  }, []);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
