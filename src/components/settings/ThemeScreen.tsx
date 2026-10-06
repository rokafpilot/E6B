import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, THEME_LABELS, type ThemeId } from '../../context/Cx3SettingsContext';

const ORDER: ThemeId[] = ['standard', 'night', 'dusk'];

export default function ThemeScreen() {
  const { data, setTheme } = useCx3Settings();
  const { cursor, dispatch } = useCx3Nav(ORDER.length);
  const { replaceTop } = useCx3Router();

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    return undefined;
  }, [dispatch, replaceTop], 12);

  useCx3OnEnter(() => { setTheme(ORDER[cursor]); });

  return (
    <div className="cx3-lcd-menu">
      {ORDER.map((t, i) => (
        <div key={t} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={THEME_LABELS[t]}
            state={data.theme === t ? 'calc' : 'unsolved'}
            cursor={cursor === i}
            valueClass={data.theme === t ? 'green' : 'dashes'}
            valueDisplay={data.theme === t ? '●' : ''} />
        </div>
      ))}
    </div>
  );
}
