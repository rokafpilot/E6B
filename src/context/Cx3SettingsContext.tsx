import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId = 'standard' | 'night' | 'dusk';
export type BacklightLevel = 1 | 2 | 3 | 4;
export type TimeUnit = 'LOCAL' | 'UTC' | 'PILOT';
export type UnitSystem = 'US' | 'METRIC';
export type FuelType = 'AVGAS' | 'JETA' | 'OIL';

export interface AircraftArm { id: string; label: string; armIn: number; }
export interface AircraftProfile {
  kFactor: number;
  fuelType: FuelType;
  fuelLbPerGal: number;
  basicEmptyLb: number;
  basicEmptyMoment: number;
  arms: AircraftArm[];
  lemacIn: number;
  macLengthIn: number;
}

export interface UserData {
  theme: ThemeId;
  backlight: BacklightLevel;
  timeUnit: TimeUnit;
  pilotOffsetMin: number;
  defaultUnits: UnitSystem;
  favorite: string | null;
  aircraft: AircraftProfile;
  savedFields: Record<string, Record<string, string>>;
}

const DEFAULT_AIRCRAFT: AircraftProfile = {
  kFactor: 1.0,
  fuelType: 'AVGAS',
  fuelLbPerGal: 6.0,
  basicEmptyLb: 1500,
  basicEmptyMoment: 120000,
  arms: [
    { id: 'pax1', label: 'Pilot', armIn: 37 },
    { id: 'pax2', label: 'Copilot', armIn: 37 },
    { id: 'pax3', label: 'Pax Rear', armIn: 73 },
    { id: 'cargo1', label: 'Baggage 1', armIn: 95 },
    { id: 'cargo2', label: 'Baggage 2', armIn: 125 },
    { id: 'fuel', label: 'Fuel', armIn: 48 },
  ],
  lemacIn: 20,
  macLengthIn: 60,
};

const DEFAULT: UserData = {
  theme: 'standard',
  backlight: 3,
  timeUnit: 'LOCAL',
  pilotOffsetMin: 0,
  defaultUnits: 'US',
  favorite: null,
  aircraft: DEFAULT_AIRCRAFT,
  savedFields: {},
};

const STORAGE_KEY = 'cx3-settings-v1';

interface Cx3SettingsState {
  data: UserData;
  setTheme: (t: ThemeId) => void;
  cycleTheme: () => void;
  setBacklight: (b: BacklightLevel) => void;
  cycleBacklight: () => void;
  setTimeUnit: (t: TimeUnit) => void;
  setPilotOffset: (m: number) => void;
  setDefaultUnits: (u: UnitSystem) => void;
  setFavorite: (subId: string | null) => void;
  setAircraft: (p: Partial<AircraftProfile>) => void;
  saveFieldSnapshot: (screenId: string, fields: Record<string, string>) => void;
  resetAll: () => void;
}

const Ctx = createContext<Cx3SettingsState | null>(null);

function loadInitial(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, aircraft: { ...DEFAULT_AIRCRAFT, ...(parsed.aircraft ?? {}) } };
  } catch {
    return DEFAULT;
  }
}

export function Cx3SettingsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<UserData>(() => loadInitial());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
  }, [data]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.cx3Theme = data.theme;
    root.style.setProperty('--cx3-bright', String(0.4 + (data.backlight * 0.2)));
    root.style.setProperty('--cx3-keypad-glow', String(0.3 + (data.backlight * 0.175)));
  }, [data.theme, data.backlight]);

  const setTheme = useCallback((t: ThemeId) => setData(d => ({ ...d, theme: t })), []);
  const cycleTheme = useCallback(() => setData(d => {
    const order: ThemeId[] = ['standard', 'night', 'dusk'];
    const next = order[(order.indexOf(d.theme) + 1) % order.length];
    return { ...d, theme: next };
  }), []);
  const setBacklight = useCallback((b: BacklightLevel) => setData(d => ({ ...d, backlight: b })), []);
  const cycleBacklight = useCallback(() => setData(d => ({
    ...d, backlight: (d.backlight % 4 + 1) as BacklightLevel,
  })), []);
  const setTimeUnit = useCallback((t: TimeUnit) => setData(d => ({ ...d, timeUnit: t })), []);
  const setPilotOffset = useCallback((m: number) => setData(d => ({ ...d, pilotOffsetMin: m })), []);
  const setDefaultUnits = useCallback((u: UnitSystem) => setData(d => ({ ...d, defaultUnits: u })), []);
  const setFavorite = useCallback((subId: string | null) => setData(d => ({ ...d, favorite: subId })), []);
  const setAircraft = useCallback((p: Partial<AircraftProfile>) =>
    setData(d => ({ ...d, aircraft: { ...d.aircraft, ...p } })), []);
  const saveFieldSnapshot = useCallback((screenId: string, fields: Record<string, string>) =>
    setData(d => ({ ...d, savedFields: { ...d.savedFields, [screenId]: fields } })), []);
  const resetAll = useCallback(() => setData(DEFAULT), []);

  const value = useMemo<Cx3SettingsState>(() => ({
    data, setTheme, cycleTheme, setBacklight, cycleBacklight,
    setTimeUnit, setPilotOffset, setDefaultUnits, setFavorite,
    setAircraft, saveFieldSnapshot, resetAll,
  }), [data, setTheme, cycleTheme, setBacklight, cycleBacklight,
      setTimeUnit, setPilotOffset, setDefaultUnits, setFavorite,
      setAircraft, saveFieldSnapshot, resetAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCx3Settings(): Cx3SettingsState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCx3Settings must be used within Cx3SettingsProvider');
  return c;
}

export const THEME_LABELS: Record<ThemeId, string> = {
  standard: 'Standard', night: 'Night', dusk: 'Dusk',
};
export const UNIT_LABELS: Record<UnitSystem, string> = {
  US: 'US / Imperial', METRIC: 'Metric',
};
export const TIME_LABELS: Record<TimeUnit, string> = {
  LOCAL: 'LOCAL', UTC: 'UTC', PILOT: 'PILOT',
};
export const FUEL_DENSITY: Record<FuelType, number> = {
  AVGAS: 6.0, JETA: 6.84, OIL: 7.5,
};
