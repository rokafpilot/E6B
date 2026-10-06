import React, { useMemo, useState, useEffect } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calculateAltitude } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type UnitSystem } from '../../context/Cx3SettingsContext';

const fToC = (f: number) => (f - 32) * 5 / 9;
const cToF = (c: number) => (c * 9 / 5) + 32;
type TempUnit = 'f' | 'c';

const LINES = ['OAT', 'DEWP', 'ALT', 'CBAGL', 'CBMSL'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { OAT: 'OAT', DEWP: 'Dewp', ALT: 'Alt', CBAGL: 'CB AGL', CBMSL: 'CB MSL' };

export default function CloudBaseScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const { data } = useCx3Settings();
  const oat = useBlankField('dec', '');
  const dewp = useBlankField('dec', '');
  const alt = useBlankField('int', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { OAT: oat, DEWP: dewp, ALT: alt };

  const [oatUnit, setOatUnit] = useState<TempUnit>('c');
  const [dewpUnit, setDewpUnit] = useState<TempUnit>('c');
  const [initU, setInitU] = useState<UnitSystem>(data.defaultUnits);
  useEffect(() => {
    if (initU !== data.defaultUnits) {
      setInitU(data.defaultUnits);
      setOatUnit('c'); setDewpUnit('c');
    }
  }, [data.defaultUnits, initU]);

  const r = useMemo(() => {
    const oc = oat.toNum(), dc = dewp.toNum(), a = alt.toNum();
    if (!isFinite(a) || !isFinite(oc) || !isFinite(dc)) return null;
    const oC = oatUnit === 'c' ? oc : fToC(oc);
    const dC = dewpUnit === 'c' ? dc : fToC(dc);
    return calculateAltitude({
      fieldElevationFt: a, altimeterSettingInHg: 29.92,
      oatC: oC, dewPointC: dC,
    });
  }, [oat, dewp, alt, oatUnit, dewpUnit]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    if ((key === 'OAT' || key === 'DEWP') && (k === 'SETU' || k === 'CONVU')) {
      const f = fields[key];
      const curUnit = key === 'OAT' ? oatUnit : dewpUnit;
      const setU = key === 'OAT' ? setOatUnit : setDewpUnit;
      const cur = f.toNum();
      if (isFinite(cur)) {
        if (curUnit === 'f') { f.setValue(formatNumber(fToC(cur), 1)); setU('c'); }
        else { f.setValue(formatNumber(cToF(cur), 0)); setU('f'); }
      } else {
        setU(u => u === 'f' ? 'c' : 'f');
      }
      return 'stop';
    }
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
  }, [cursor, oat, dewp, alt, oatUnit, dewpUnit], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const cbagl = r ? formatNumber(r.cloudBaseFtAGL, 0) : '--';
  const cbmsl = r ? formatNumber(r.cloudBaseFtMSL, 0) : '--';
  const oatSym = oatUnit === 'f' ? '°F' : '°C';
  const dewSym = dewpUnit === 'f' ? '°F' : '°C';
  const UNITS: Record<K, string> = { OAT: oatSym, DEWP: dewSym, ALT: 'FT', CBAGL: 'FT', CBMSL: 'FT' };
  const outs: Record<K, string> = { OAT: oat.displayValue, DEWP: dewp.displayValue, ALT: alt.displayValue, CBAGL: cbagl, CBMSL: cbmsl };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'CBAGL' || k === 'CBMSL';
        const f = fields[k];
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
