import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type TimeUnit, TIME_LABELS } from '../../context/Cx3SettingsContext';

const ORDER: TimeUnit[] = ['LOCAL', 'UTC', 'PILOT'];

export default function TimeSetScreen() {
  const { data, setTimeUnit, setPilotOffset } = useCx3Settings();
  const LINES = [...ORDER, 'OFFSET'];
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const { replaceTop } = useCx3Router();
  const offset = useBlankField('int', data.pilotOffsetMin ? String(data.pilotOffsetMin) : '');

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    if (LINES[cursor] === 'OFFSET') {
      if (k === 'CLR') { offset.clear(); return 'stop'; }
      if (k === 'BKSP') { offset.backspace(); return 'stop'; }
      if (k === 'SIGN') { offset.toggleSign(); return 'stop'; }
      const ch = keyIdToChar(k);
      if (ch && /[0-9]/.test(ch)) { offset.pushChar(ch); return 'stop'; }
      if (NUMBER_KEYS.includes(k)) {
        const c = keyIdToChar(k);
        if (c) { offset.pushChar(c); return 'stop'; }
      }
    }
    return undefined;
  }, [cursor, dispatch, replaceTop, offset], 12);

  useCx3OnEnter(() => {
    const sel = LINES[cursor];
    if (sel === 'OFFSET') {
      const m = offset.toNum();
      if (isFinite(m)) setPilotOffset(m);
    } else {
      setTimeUnit(sel as TimeUnit);
    }
  });

  return (
    <div className="cx3-lcd-menu">
      {ORDER.map((t, i) => (
        <div key={t} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={`TZ: ${TIME_LABELS[t]}`}
            state={data.timeUnit === t ? 'calc' : 'unsolved'}
            cursor={cursor === i}
            valueClass={data.timeUnit === t ? 'green' : 'dashes'}
            valueDisplay={data.timeUnit === t ? '●' : ''} />
        </div>
      ))}
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: ORDER.length })}>
        <Cx3Line label="Pilot Offset" unit="MIN"
          valueDisplay={offset.isBlank ? '--' : formatNumber(offset.toNum(), 0)}
          state={lineStateFrom(offset)} cursor={cursor === ORDER.length}
          valueClass={offset.isBlank ? 'dashes' : 'default'} />
      </div>
    </div>
  );
}
