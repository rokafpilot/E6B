import React, { useMemo, useState, useEffect } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { standardAtmosphere } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type UnitSystem } from '../../context/Cx3SettingsContext';

const cToF = (c: number) => c * 9 / 5 + 32;
const inhgToHpa = (inHg: number) => inHg * 33.86389;

type TempUnit = 'f' | 'c';
type PresUnit = 'inhg' | 'hpa';

const LINES = ['ALT', 'PRES', 'OAT', 'MBAR', 'SOS'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { ALT: 'Alt', PRES: 'Pres', OAT: 'OAT', MBAR: 'mb', SOS: 'SoS' };

export default function StdAtmosScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const { data } = useCx3Settings();
  const alt = useBlankField('int', '');

  const [presUnit, setPresUnit] = useState<PresUnit>('hpa');
  const [oatUnit, setOatUnit] = useState<TempUnit>('c');
  const [initU, setInitU] = useState<UnitSystem>(data.defaultUnits);

  useEffect(() => {
    if (initU !== data.defaultUnits) {
      setInitU(data.defaultUnits);
      setPresUnit('hpa');
      setOatUnit('c');
    }
  }, [data.defaultUnits, initU]);

  const r = useMemo(() => {
    const a = alt.toNum();
    if (!isFinite(a)) return null;
    return standardAtmosphere(a);
  }, [alt]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    if (key === 'PRES' && (k === 'SETU' || k === 'CONVU')) {
      setPresUnit(u => u === 'inhg' ? 'hpa' : 'inhg');
      return 'stop';
    }
    if (key === 'OAT' && (k === 'SETU' || k === 'CONVU')) {
      setOatUnit(u => u === 'f' ? 'c' : 'f');
      return 'stop';
    }
    if (LINES[cursor] !== 'ALT') return undefined;
    if (k === 'CLR') { alt.clear(); return 'stop'; }
    if (k === 'BKSP') { alt.backspace(); return 'stop'; }
    if (k === 'SIGN') { alt.toggleSign(); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { alt.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { alt.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, alt, presUnit, oatUnit], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const presDisp = r ? (presUnit === 'inhg' ? formatNumber(r.pressureInHg, 2) : formatNumber(inhgToHpa(r.pressureInHg), 1)) : '--';
  const oatDisp  = r ? (oatUnit  === 'f'   ? formatNumber(cToF(r.tempC), 1)   : formatNumber(r.tempC, 1)) : '--';
  const mbarDisp = r ? formatNumber(inhgToHpa(r.pressureInHg), 1) : '--';
  const sosDisp  = r ? formatNumber(r.speedOfSoundKt, 1) : '--';
  const outs: Record<K, string> = { ALT: alt.displayValue, PRES: presDisp, OAT: oatDisp, MBAR: mbarDisp, SOS: sosDisp };
  const UNITS: Record<K, string> = { ALT: 'FT', PRES: presUnit === 'inhg' ? 'IN HG' : 'HPA', OAT: oatUnit==='f'?'°F':'°C', MBAR: 'HPA', SOS: 'KT' };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k !== 'ALT';
        const st = isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(alt);
        const vc = isOut ? (r ? 'green' : 'dashes') : (alt.isBlank ? 'dashes' : 'default');
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
