import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, lineStateFrom } from '../../hooks/useBlankField';
import { holdingEntry, type HoldingEntry } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['INBDCRS', 'HDGFIX', 'ENTRY'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { INBDCRS: 'Inbd Crs', HDGFIX: 'Hdg Fix', ENTRY: 'Entry' };
const UNITS: Record<K, string> = { INBDCRS: '°', HDGFIX: '°', ENTRY: '' };

export default function HoldingScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const ic = useBlankField('int', '');
  const hf = useBlankField('int', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { INBDCRS: ic, HDGFIX: hf };

  const r = useMemo<HoldingEntry | null>(() => {
    const i = ic.toNum(), h = hf.toNum();
    if (!isFinite(i) || !isFinite(h)) return null;
    return holdingEntry({ inboundCourseDeg: i, headingToFixDeg: h });
  }, [ic, hf]);

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
  }, [cursor, ic, hf], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'ENTRY';
        const f = fields[k];
        const disp = isOut ? (r ?? '--') : (f?.displayValue ?? '--');
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={LABELS[k]} valueDisplay={String(disp)} unit={UNITS[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}
