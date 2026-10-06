import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type UnitSystem, UNIT_LABELS } from '../../context/Cx3SettingsContext';

const ORDER: UnitSystem[] = ['US', 'METRIC'];

export default function DefaultUnitsScreen() {
  const { data, setDefaultUnits } = useCx3Settings();
  const { cursor, dispatch } = useCx3Nav(ORDER.length);
  const { replaceTop } = useCx3Router();

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    return undefined;
  }, [dispatch, replaceTop], 12);

  useCx3OnEnter(() => { setDefaultUnits(ORDER[cursor]); });

  return (
    <div className="cx3-lcd-menu">
      {ORDER.map((u, i) => (
        <div key={u} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={UNIT_LABELS[u]}
            state={data.defaultUnits === u ? 'calc' : 'unsolved'}
            cursor={cursor === i}
            valueClass={data.defaultUnits === u ? 'green' : 'dashes'}
            valueDisplay={data.defaultUnits === u ? '●' : ''} />
        </div>
      ))}
    </div>
  );
}
