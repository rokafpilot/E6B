import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcColdTempCorrection } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['IND', 'FLEV', 'OAT', 'DISA', 'CORR', 'CORALT'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { IND: 'Indicated', FLEV: 'Fld Elev', OAT: 'OAT', DISA: 'ΔISA', CORR: 'Corr', CORALT: 'Corr Alt' };
const UNITS: Record<K, string> = { IND: 'FT', FLEV: 'FT', OAT: '°C', DISA: '°C', CORR: 'FT', CORALT: 'FT' };

export default function ColdTempScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const ind = useBlankField('dec', '');
  const flev = useBlankField('dec', '');
  const oat = useBlankField('dec', '');

  const r = useMemo(() => {
    const i = ind.toNum();
    const f = flev.toNum();
    const o = oat.toNum();
    if (!isFinite(i) || !isFinite(f) || !isFinite(o)) return null;
    return calcColdTempCorrection(i, f, o);
  }, [ind, flev, oat]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'IND' ? ind : key === 'FLEV' ? flev : key === 'OAT' ? oat : undefined;
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
  }, [cursor, ind, flev, oat], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    IND: ind.displayValue,
    FLEV: flev.displayValue,
    OAT: oat.displayValue,
    DISA: r ? formatNumber(r.deltaIsaC, 1) : '--',
    CORR: r ? formatNumber(r.correctionFt, 0) : '--',
    CORALT: r ? formatNumber(r.correctedAltitudeFt, 0) : '--',
  };

  const inputKeys: K[] = ['IND', 'FLEV', 'OAT'];

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = !inputKeys.includes(k);
        const f = k === 'IND' ? ind : k === 'FLEV' ? flev : k === 'OAT' ? oat : undefined;
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
