import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { vorToFrom } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['RAD', 'CRS', 'STAT', 'INT'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { RAD: 'Radial', CRS: 'Course', STAT: 'Status', INT: 'Intercept' };
const UNITS: Record<K, string> = { RAD: '°', CRS: '°', STAT: '', INT: '°' };

export default function ToFromScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const rad = useBlankField('int', '');
  const crs = useBlankField('int', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { RAD: rad, CRS: crs };

  const r = useMemo(() => {
    const ra = rad.toNum(), cr = crs.toNum();
    if (!isFinite(ra) || !isFinite(cr)) return null;
    return vorToFrom({ vorRadialDeg: ra, courseDeg: cr });
  }, [rad, crs]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, rad, crs], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'STAT' || k === 'INT';
        const f = fields[k];
        let disp = '--';
        if (k === 'STAT') disp = r ? r.status : '--';
        else if (k === 'INT') disp = r ? formatNumber(r.interceptDeg, 0) : '--';
        else disp = f!.displayValue;
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={LABELS[k]} valueDisplay={disp} unit={UNITS[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}
