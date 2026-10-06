import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings } from '../../context/Cx3SettingsContext';

export default function UserDataScreen() {
  const { data, resetAll } = useCx3Settings();
  const keys = Object.keys(data.savedFields).length;
  const items = ['Save Snapshot', 'Restore Snapshot', 'Reset All ↵'];
  const { cursor, dispatch } = useCx3Nav(items.length);
  const { replaceTop } = useCx3Router();

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    return undefined;
  }, [dispatch, replaceTop], 12);

  useCx3OnEnter(() => {
    if (cursor === 2) resetAll();
  });

  return (
    <div className="cx3-lcd-menu">
      <Cx3Line label={`Saved Snapshots`} state={'unsolved'} valueClass={'dashes'} valueDisplay={`${keys}`} />
      {items.map((lbl, i) => (
        <div key={lbl} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={lbl}
            state={i === 2 ? 'calc' : 'input'}
            cursor={cursor === i}
            valueClass={i === 2 ? 'green' : 'default'} />
        </div>
      ))}
    </div>
  );
}
