import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatHMS, lineStateFrom } from '../../hooks/useBlankField';
import { etaCalc } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['DEP', 'ETE', 'ETA'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { DEP: 'Dep', ETE: 'Ete', ETA: 'Eta' };
const UNITS: Record<K, string> = { DEP: 'UTC', ETE: 'HMS', ETA: 'UTC' };

function hhmmToMin(s: string): number {
  if (!s) return NaN;
  const parts = s.split(':').map(Number);
  while (parts.length < 2) parts.push(0);
  const [h, m] = parts;
  if (!isFinite(h) || !isFinite(m)) return NaN;
  return h * 60 + m;
}

function minToHHMM(m: number): string {
  if (!isFinite(m)) return '--';
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function EtaScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const dep = useBlankField('time', '');
  const ete = useBlankField('time', '');

  const r = useMemo(() => {
    const dSec = dep.toNum(), eSec = ete.toNum();
    if (!isFinite(dSec) || !isFinite(eSec)) return null;
    return etaCalc({ departureTimeMin: dSec / 60, timeEnrouteMin: eSec / 60 });
  }, [dep, ete]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined = key === 'DEP' ? dep : key === 'ETE' ? ete : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'COL') { f.pushChar(':'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, dep, ete], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    DEP: dep.isBlank ? '--' : dep.displayValue,
    ETE: ete.isBlank ? '--' : ete.displayValue,
    ETA: r ? minToHHMM(r.etaMin) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'ETA';
        const f = k === 'DEP' ? dep : k === 'ETE' ? ete : undefined;
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
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
