import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { windComponents } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['RWY', 'WDIR', 'WSPD', 'HEAD', 'TAIL', 'CROSS'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { RWY: 'Rwy', WDIR: 'W Dir', WSPD: 'W Spd', HEAD: 'Head', TAIL: 'Tail', CROSS: 'Cross' };
const UNITS: Record<K, string> = { RWY: '°', WDIR: '°', WSPD: 'KT', HEAD: 'KT', TAIL: 'KT', CROSS: 'KT' };

export default function WindCompScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const rwy = useBlankField('int', '');
  const wDir = useBlankField('int', '');
  const wSpd = useBlankField('dec', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { RWY: rwy, WDIR: wDir, WSPD: wSpd };

  const r = useMemo(() => {
    const rw = rwy.toNum(), wd = wDir.toNum(), ws = wSpd.toNum();
    if (!isFinite(rw) || !isFinite(wd) || !isFinite(ws)) return null;
    return windComponents({ runwayHeadingDeg: rw, windDirectionDeg: wd, windSpeedKt: ws });
  }, [rwy, wDir, wSpd]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'DOT' && key === 'WSPD') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, rwy, wDir, wSpd], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'HEAD' || k === 'TAIL' || k === 'CROSS';
        const f = fields[k];
        let disp = '--';
        if (k === 'HEAD') disp = r ? formatNumber(r.headwindKt, 1) : '--';
        else if (k === 'TAIL') disp = r ? formatNumber(r.tailwindKt, 1) : '--';
        else if (k === 'CROSS') disp = r ? `${formatNumber(r.crosswindKt, 1)} ${r.crosswindSide}` : '--';
        else disp = f!.displayValue;
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={LABELS[k]} valueDisplay={disp} unit={isOut && k === 'CROSS' ? '' : UNITS[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}
