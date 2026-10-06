import React, { useEffect, useRef } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { FLT_MENU_ITEMS } from '../layout/Cx3Device';

export const FLT_MENU_IDS: string[] = [
  'DENSALT',      // 0 Density Altitude
  'DIST',         // 1 Distance
  'ENDUR',        // 2 Endurance
  'FUELCON',      // 3 Fuel Consumption
  'PRESALT',      // 4 Pressure Altitude
  'ROD',          // 5 Rate of Descent
  'RODMACH',      // 6 Rate of Descent Mach
  'RESFUEL',      // 7 Reserve Fuel
  'SPEED',        // 8 Speed (Airspeed)
  'TIME',         // 9 Time (ETA)
  'TOD',          // 10 Top of Descent
  'WINDCOMP',     // 11 Wind Component
  'FUELUPLIFT',   // 12 Fuel Uplift
  'COLDTEMP',     // 13 Cold Temp Correction
];

export default function FltMainMenu() {
  const N = FLT_MENU_ITEMS.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { goSub } = useCx3Router();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useCx3OnEnter(() => {
    const id = FLT_MENU_IDS[cursor];
    if (id) goSub(id, FLT_MENU_ITEMS[cursor]);
  }, [cursor, goSub]);

  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {FLT_MENU_ITEMS.map((label, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          const id = FLT_MENU_IDS[i];
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
