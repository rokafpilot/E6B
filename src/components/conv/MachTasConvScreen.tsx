import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import {
  useBlankField, formatNumber, lineStateFrom,
} from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import {
  useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId,
} from '../../context/Cx3KeypadContext';
import { standardAtmosphere } from '../../lib/flightCalc';

type InputMode = 'MACH' | 'TAS';
const LINES = ['ALT', 'INP', 'TAS', 'INFO'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = {
  ALT: 'Press Alt (ft)',
  INP: 'Mach Nr',
  TAS: 'TAS (kt)',
  INFO: 'ISA · SoS',
};

export default function MachTasConvScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const { replaceTop } = useCx3Router();
  const altField = useBlankField('int', '35000');
  const machField = useBlankField('dec', '0.80');
  const tasField = useBlankField('dec', '');
  const [mode, setMode] = useState<InputMode>('MACH');

  const altFt = altField.toNum();
  const isa = useMemo(() => {
    if (!isFinite(altFt) || altFt < -1500) return null;
    return standardAtmosphere(altFt);
  }, [altFt]);

  const { tasKtCalc, machCalc } = useMemo(() => {
    if (!isa) return { tasKtCalc: NaN, machCalc: NaN };
    const sos = isa.speedOfSoundKt;
    if (mode === 'MACH') {
      const m = machField.toNum();
      if (!isFinite(m)) return { tasKtCalc: NaN, machCalc: NaN };
      return { tasKtCalc: m * sos, machCalc: m };
    } else {
      const t = tasField.toNum();
      if (!isFinite(t)) return { tasKtCalc: NaN, machCalc: NaN };
      return { tasKtCalc: t, machCalc: t / sos };
    }
  }, [isa, mode, machField.value, tasField.value]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('CONV', 'CONV'); return 'stop'; }
    if (k === 'SETU') { setMode('MACH'); return 'stop'; }
    if (k === 'CONVU') { setMode('TAS'); return 'stop'; }
    const L = LINES[cursor];
    if (L === 'ALT' || L === 'INP') {
      const isDecField = L === 'INP';
      const field = L === 'ALT' ? altField : (mode === 'MACH' ? machField : tasField);
      if (k === 'CLR') { field.clear(); return 'stop'; }
      if (k === 'BKSP') { field.backspace(); return 'stop'; }
      if (isDecField && k === 'SIGN') { field.toggleSign(); return 'stop'; }
      if (isDecField && k === 'DOT') { field.pushChar('.'); return 'stop'; }
      if (NUMBER_KEYS.includes(k)) {
        const c = keyIdToChar(k);
        if (c) { field.pushChar(c); return 'stop'; }
      }
    }
    return undefined;
  }, [cursor, mode, replaceTop, altField, machField, tasField], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  }, [cursor, dispatch]);

  const inpLabel = mode === 'MACH' ? 'Mach Nr' : 'TAS In (kt)';
  const inpUnit = mode === 'MACH' ? 'M' : 'kt';
  const inpDisplay = mode === 'MACH' ? machField.displayValue : tasField.displayValue;
  const inpField = mode === 'MACH' ? machField : tasField;

  function renderLine(k: K, i: number) {
    if (k === 'ALT') {
      return (
        <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={LABELS.ALT} valueDisplay={altField.displayValue} unit="ft"
            state={lineStateFrom(altField as any)} cursor={cursor === i}
            valueClass={altField.isBlank ? 'dashes' : 'default'} />
        </div>
      );
    }
    if (k === 'INP') {
      return (
        <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={inpLabel} valueDisplay={inpDisplay} unit={inpUnit}
            state={lineStateFrom(inpField as any)} cursor={cursor === i}
            valueClass={inpField.isBlank ? 'dashes' : 'default'} />
        </div>
      );
    }
    if (k === 'TAS') {
      const outVal = mode === 'MACH' ? tasKtCalc : machCalc;
      const outUnit = mode === 'MACH' ? 'kt' : 'M';
      const outLabel = mode === 'MACH' ? 'TAS →' : 'Mach →';
      const ok = isFinite(outVal) && isa;
      return (
        <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={outLabel}
            valueDisplay={ok ? formatNumber(outVal, mode === 'MACH' ? 1 : 3) : '--'}
            unit={outUnit}
            state={ok ? 'calc' : 'unsolved'} cursor={cursor === i}
            valueClass={ok ? 'green' : 'dashes'} />
        </div>
      );
    }
    if (k === 'INFO') {
      const ok = !!isa;
      const v = ok
        ? `ISA${isa.tempC >= 0 ? '+' : ''}${isa.tempC}°C  SoS${Math.round(isa.speedOfSoundKt)}`
        : '--';
      return (
        <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label="ISA / SoS kt" valueDisplay={v} unit={ok ? `${isa!.pressureInHg.toFixed(2)}inHg` : ''}
            state={ok ? 'calc' : 'unsolved'} cursor={cursor === i}
            valueClass={ok ? 'green' : 'dashes'} />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => renderLine(k, i))}
    </div>
  );
}
