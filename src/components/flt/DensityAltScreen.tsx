import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcDensityAltitude } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['PA', 'OAT', 'DA'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { PA: 'Press Alt', OAT: 'OAT', DA: 'Dens Alt' };
type TempUnit = 'f' | 'c';
const fToC = (f: number) => (f - 32) * 5 / 9;
const cToF = (c: number) => (c * 9 / 5) + 32;

export default function DensityAltScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const [oatUnit, setOatUnit] = useState<TempUnit>('c');
  const pa = useBlankField('dec', '');
  const oat = useBlankField('dec', '');

  const r = useMemo(() => {
    const p = pa.toNum();
    const o = oat.toNum();
    if (!isFinite(p) || !isFinite(o)) return null;
    const oC = oatUnit === 'c' ? o : fToC(o);
    return calcDensityAltitude(p, oC);
  }, [pa, oat, oatUnit]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    if (key === 'OAT' && (k === 'SETU' || k === 'CONVU')) {
      const cur = oat.toNum();
      if (isFinite(cur)) {
        if (oatUnit === 'f') { oat.setValue(formatNumber(fToC(cur), 1)); setOatUnit('c'); }
        else { oat.setValue(formatNumber(cToF(cur), 0)); setOatUnit('f'); }
      } else {
        setOatUnit(u => u === 'f' ? 'c' : 'f');
      }
      return 'stop';
    }
    const f: ReturnType<typeof useBlankField> | undefined = key === 'PA' ? pa : key === 'OAT' ? oat : undefined;
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
  }, [cursor, pa, oat, oatUnit], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const oatSym = oatUnit === 'f' ? '°F' : '°C';
  const UNITS: Record<K, string> = { PA: 'FT', OAT: oatSym, DA: 'FT' };
  const outs: Record<K, string> = {
    PA: pa.displayValue,
    OAT: oat.displayValue,
    DA: r != null ? formatNumber(r, 0) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'DA';
        const f = k === 'PA' ? pa : k === 'OAT' ? oat : undefined;
        const st = isOut ? (r != null ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r != null ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
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
