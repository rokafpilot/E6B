import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, formatHMS, lineStateFrom } from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['DIST', 'GS', 'TIME'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { DIST: 'Dist', GS: 'GS', TIME: 'Time' };
const UNITS: Record<K, string> = { DIST: 'NM', GS: 'KT', TIME: 'HMS' };

export default function TimeScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const dist = useBlankField('dec', '');
  const gs = useBlankField('dec', '');

  const secs = useMemo(() => {
    const d = dist.toNum();
    const g = gs.toNum();
    if (!isFinite(d) || !isFinite(g) || g <= 0) return NaN;
    return (d / g) * 3600;
  }, [dist, gs]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined = key === 'DIST' ? dist : key === 'GS' ? gs : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && key === 'DIST') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, dist, gs], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    DIST: dist.displayValue,
    GS: gs.displayValue,
    TIME: isFinite(secs) ? formatHMS(secs) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'TIME';
        const f = k === 'DIST' ? dist : k === 'GS' ? gs : undefined;
        const st = isOut ? (isFinite(secs) ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (isFinite(secs) ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
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
