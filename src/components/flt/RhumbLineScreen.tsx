import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { rhumbLine } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['LAT1', 'LON1', 'LAT2', 'LON2', 'DIST', 'TRK'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { LAT1: 'Lat 1', LON1: 'Lon 1', LAT2: 'Lat 2', LON2: 'Lon 2', DIST: 'Dist', TRK: 'Trk' };
const UNITS: Record<K, string> = { LAT1: '°N/S', LON1: '°E/W', LAT2: '°N/S', LON2: '°E/W', DIST: 'NM', TRK: '°' };

export default function RhumbLineScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const lat1 = useBlankField('dec', '');
  const lon1 = useBlankField('dec', '');
  const lat2 = useBlankField('dec', '');
  const lon2 = useBlankField('dec', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { LAT1: lat1, LON1: lon1, LAT2: lat2, LON2: lon2 };

  const r = useMemo(() => {
    const la1 = lat1.toNum(), lo1 = lon1.toNum(), la2 = lat2.toNum(), lo2 = lon2.toNum();
    if (!isFinite(la1) || !isFinite(lo1) || !isFinite(la2) || !isFinite(lo2)) return null;
    return rhumbLine({ lat1Deg: la1, lon1Deg: lo1, lat2Deg: la2, lon2Deg: lo2 });
  }, [lat1, lon1, lat2, lon2]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, lat1, lon1, lat2, lon2], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'DIST' || k === 'TRK';
        const f = fields[k];
        let disp = '--';
        if (k === 'DIST' && r) disp = formatNumber(r.distanceNm, 1);
        else if (k === 'TRK' && r) disp = formatNumber(r.trackAngleDeg, 0);
        else if (f) disp = f.displayValue;
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
