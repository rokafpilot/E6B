import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, MenuId, Theme, UnitSystem } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'standard',
  unitSystem: 'imperial',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  favorites: [],
};

const STORAGE_KEY = 'e6b-settings-v1';

interface AppContextValue {
  currentMenu: MenuId;
  setCurrentMenu: (menu: MenuId) => void;
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  setUnitSystem: (system: UnitSystem) => void;
  setTimeZone: (tz: string) => void;
  toggleFavorite: (functionId: string) => void;
  isFavorite: (functionId: string) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentMenu, setCurrentMenu] = useState<MenuId>('HOME');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const setTheme = (theme: Theme) => setSettings(s => ({ ...s, theme }));
  const setUnitSystem = (unitSystem: UnitSystem) => setSettings(s => ({ ...s, unitSystem }));
  const setTimeZone = (timeZone: string) => setSettings(s => ({ ...s, timeZone }));

  const toggleFavorite = (functionId: string) => {
    setSettings(s => ({
      ...s,
      favorites: s.favorites.includes(functionId)
        ? s.favorites.filter(f => f !== functionId)
        : [...s.favorites, functionId],
    }));
  };

  const isFavorite = (functionId: string) => settings.favorites.includes(functionId);

  return (
    <AppContext.Provider value={{
      currentMenu,
      setCurrentMenu,
      settings,
      setTheme,
      setUnitSystem,
      setTimeZone,
      toggleFavorite,
      isFavorite,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
