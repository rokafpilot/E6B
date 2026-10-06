import React, { useEffect, useRef } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';

export const CONV_MENU_IDS: string[] = [
  'SPEED',        // 0 Speed
  'LENGTH',       // 1 Length (Distance)
  'WEIGHT',       // 2 Weight
  'TEMP',         // 3 Temperature
  'VOLUME',       // 4 Volume
  'PRESSURE',     // 5 Pressure
  'ANGLE',        // 6 Angle / % Slope (활강각 / 접근각)
  'FUELFLOW',     // 7 Fuel Flow (PPH / KPH / GPH / LPH)
  'DENSITY',      // 8 Density / SG (Jet A1 lb/gal ↔ kg/L)
  'MACHTAS',      // 9 Mach ↔ TAS (ISA 표준대기 고도별)
  'TZONE',        // 10 Time Zone
];

export const CONV_MENU_ITEMS: string[] = [
  'Speed',
  'Length',
  'Weight',
  'Temperature',
  'Volume',
  'Pressure',
  'Angle',
  'Fuel Flow (P·K·G·L)',
  'Density / SG',
  'Mach ↔ TAS',
  'Time Zone',
];

export default function ConvMainMenu() {
  const N = CONV_MENU_ITEMS.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { goSub } = useCx3Router();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useCx3OnEnter(() => {
    const id = CONV_MENU_IDS[cursor];
    if (id) goSub(id, CONV_MENU_ITEMS[cursor]);
  }, [cursor, goSub]);

  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {CONV_MENU_ITEMS.map((label, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          const id = CONV_MENU_IDS[i];
          if (id) goSub(id, label);
        };
        return (
          <div
            key={label + i}
            ref={el => { rowRefs.current[i] = el; }}
            onClick={enter}
          >
            <Cx3Line
              label={label}
              state="input"
              cursor={cursor === i}
              onClick={enter}
            />
          </div>
        );
      })}
    </div>
  );
}
