import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, formatHMS, lineStateFrom } from '../../hooks/useBlankField';
import { calculateFuel } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['DIST', 'DUR', 'GS'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { DIST: 'Dist', DUR: 'Dur', GS: 'GS' };
const UNITS: Record<K, string> = { DIST: 'NM', DUR: 'HMS', GS: 'KT' };

export default function GroundSpeedScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const dist = useBlankField('dec', '');
  const dur = useBlankField('time', '');

  const r = useMemo(() => {
    const d = dist.toNum();
    const secs = dur.toNum();
    if (!isFinite(d) || !isFinite(secs) || secs <= 0) return null;
    return calculateFuel({ mode: 'gs', distanceNm: d, timeEnrouteH: secs / 3600 });
  }, [dist, dur]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined = key === 'DIST' ? dist : key === 'DUR' ? dur : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && key === 'DIST') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT' && key === 'DIST') { f.pushChar('.'); return 'stop'; }
    if (k === 'COL' && key === 'DUR') { f.pushChar(':'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, dist, dur], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const dispDur = (() => {
    const secs = dur.toNum();
    if (!isFinite(secs)) return '--';
    return dur.displayValue;
  })();

  const outs: Record<K, string> = {
    DIST: dist.displayValue,
    DUR: dispDur,
    GS: r?.groundspeedKt != null ? formatNumber(r.groundspeedKt, 1) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'GS';
        const f = k === 'DIST' ? dist : k === 'DUR' ? dur : undefined;
        const st = isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={LABELS[k]} valueDisplay={outs[k]} unit={UNITS[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}
