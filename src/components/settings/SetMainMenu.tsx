import React, { useEffect, useRef } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';

export const SET_MENU_IDS = ['THEME', 'BACKLIGHT', 'TIMESET', 'DEFAULTUNITS', 'FAVORITE', 'AIRCRAFT', 'USERDATA', 'VERSION'] as const;
export type SetMenuId = typeof SET_MENU_IDS[number];
export const SET_MENU_LABELS: Record<SetMenuId, string> = {
  THEME: 'Theme',
  BACKLIGHT: 'Backlighting',
  TIMESET: 'Time Set',
  DEFAULTUNITS: 'Default Units',
  FAVORITE: 'Favorite',
  AIRCRAFT: 'Aircraft Profile',
  USERDATA: 'User Data',
  VERSION: 'Version',
};

export default function SetMainMenu() {
  const N = SET_MENU_IDS.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { goSub } = useCx3Router();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useCx3OnEnter(() => {
    const id = SET_MENU_IDS[cursor];
    if (id) goSub(id, SET_MENU_LABELS[id]);
  }, [cursor, goSub]);

  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {SET_MENU_IDS.map((id, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          goSub(id, SET_MENU_LABELS[id]);
        };
        return (
          <div
            key={id}
            ref={el => { rowRefs.current[i] = el; }}
            onClick={enter}
          >
            <Cx3Line
              label={SET_MENU_LABELS[id]}
              state={i === 0 ? 'input' : 'unsolved'}
              cursor={cursor === i}
              onClick={enter}
            />
          </div>
        );
      })}
    </div>
  );
}
