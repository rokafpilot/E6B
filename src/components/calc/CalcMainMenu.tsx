import React, { useEffect, useRef } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';

export const CALC_MENU_IDS: string[] = ['STANDARD', 'SCIENTIFIC', 'TIME'];
export const CALC_MENU_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  SCIENTIFIC: 'Scientific',
  TIME: 'Time (HMS)',
};

export default function CalcMainMenu() {
  const N = CALC_MENU_IDS.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { goSub } = useCx3Router();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useCx3OnEnter(() => {
    const id = CALC_MENU_IDS[cursor];
    if (id) goSub(id, CALC_MENU_LABELS[id]);
  }, [cursor, goSub]);

  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {CALC_MENU_IDS.map((id, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          goSub(id, CALC_MENU_LABELS[id]);
        };
        return (
          <div
            key={id}
            ref={el => { rowRefs.current[i] = el; }}
            onClick={enter}
          >
            <Cx3Line
              label={CALC_MENU_LABELS[id]}
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
