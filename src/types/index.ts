export type MenuId = 'HOME' | 'FLT' | 'CONV' | 'CURR' | 'CALC' | 'HOT' | 'SETTINGS';

export type Theme = 'standard' | 'night' | 'daylight';

export type UnitSystem = 'metric' | 'imperial';

export interface FltFunction {
  id: string;
  name: string;
  description: string;
  category: 'altitude' | 'airspeed' | 'fuel' | 'wind' | 'navigation' | 'conversion' | 'other';
}

export interface AppSettings {
  theme: Theme;
  unitSystem: UnitSystem;
  timeZone: string;
  favorites: string[];
}

export interface CalcState {
  display: string;
  previous: number | null;
  operator: string | null;
  waitingForOperand: boolean;
  memory: number;
}

export interface TimerState {
  stopwatchRunning: boolean;
  stopwatchSeconds: number;
  countdownRunning: boolean;
  countdownTotal: number;
  countdownRemaining: number;
}

export interface WeightStation {
  id: string;
  name: string;
  weight: number;
  arm: number;
}

export interface WbState {
  stations: WeightStation[];
  lemac: number;
  mac: number;
  cgForwardLimit: number;
  cgAftLimit: number;
}

export interface FlightSegment {
  id: string;
  from: string;
  to: string;
  trueCourseDeg: number;
  distanceNm: number;
  altitudeFt: number;
  tasKt: number;
  windDirectionDeg: number;
  windSpeedKt: number;
  fuelBurnRateGph: number;
}
