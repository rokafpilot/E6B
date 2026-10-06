import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcPressureAltitude } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['FLEV', 'ALTIM', 'PA'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { FLEV: 'Fld Elev', ALTIM: 'Altim', PA: 'Press Alt' };
type BaroUnit = 'inhg' | 'hpa';
const inhgToHpa = (inHg: number) => inHg * 33.86389;
const hpaToInhg = (hpa: number) => hpa / 33.86389;

export default function PresAltScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const [altimUnit, setAltimUnit] = useState<BaroUnit>('hpa');
  const flev = useBlankField('dec', '');
  const altim = useBlankField('dec', '1013.25');

  const r = useMemo(() => {
    const f = flev.toNum();
    const a = altim.toNum();
    if (!isFinite(f) || !isFinite(a) || a <= 0) return null;
    const aInHg = altimUnit === 'inhg' ? a : hpaToInhg(a);
    return calcPressureAltitude(f, aInHg);
  }, [flev, altim, altimUnit]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    if (key === 'ALTIM' && (k === 'SETU' || k === 'CONVU')) {
      const cur = altim.toNum();
      if (isFinite(cur)) {
        if (altimUnit === 'inhg') { altim.setValue(formatNumber(inhgToHpa(cur), 2)); setAltimUnit('hpa'); }
        else { altim.setValue(formatNumber(hpaToInhg(cur), 2)); setAltimUnit('inhg'); }
      } else {
        setAltimUnit(u => u === 'inhg' ? 'hpa' : 'inhg');
        altim.setValue(altimUnit === 'inhg' ? '1013.25' : '29.92');
      }
      return 'stop';
    }
    const f: ReturnType<typeof useBlankField> | undefined = key === 'FLEV' ? flev : key === 'ALTIM' ? altim : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && key !== 'ALTIM') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, flev, altim, altimUnit], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const altimUnitLabel = altimUnit === 'inhg' ? 'IN HG' : 'HPA';
  const UNITS: Record<K, string> = { FLEV: 'FT', ALTIM: altimUnitLabel, PA: 'FT' };
  const outs: Record<K, string> = {
    FLEV: flev.displayValue,
    ALTIM: altim.displayValue,
    PA: r != null ? formatNumber(r, 0) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'PA';
        const f = k === 'FLEV' ? flev : k === 'ALTIM' ? altim : undefined;
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
