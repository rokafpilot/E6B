import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { convertUnits, getUnitsByCategory, getUnitById, type UnitCategory } from '../../utils/units';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export const CONV_SUBID_TO_CAT: Record<string, { cat: UnitCategory; catLabel: string; fromIdx: number; toIdx: number }> = {
  SPEED: { cat: 'speed', catLabel: 'Speed', fromIdx: 1, toIdx: 0 },
  LENGTH: { cat: 'distance', catLabel: 'Length', fromIdx: 2, toIdx: 3 },
  WEIGHT: { cat: 'weight', catLabel: 'Weight', fromIdx: 1, toIdx: 0 },
  TEMP: { cat: 'temperature', catLabel: 'Temp', fromIdx: 1, toIdx: 0 },
  VOLUME: { cat: 'volume', catLabel: 'Volume', fromIdx: 1, toIdx: 0 },
  PRESSURE: { cat: 'pressure', catLabel: 'Pressure', fromIdx: 1, toIdx: 0 },
  ANGLE: { cat: 'angle', catLabel: 'Angle', fromIdx: 0, toIdx: 3 },
  FUELFLOW: { cat: 'rate', catLabel: 'Fuel Flow', fromIdx: 2, toIdx: 3 },
  DENSITY: { cat: 'density', catLabel: 'Density', fromIdx: 2, toIdx: 0 },
};

export default function UnitConvModeScreen() {
  const { top, replaceTop } = useCx3Router();
  const meta = CONV_SUBID_TO_CAT[top.subId];
  const onBack = () => replaceTop('CONV_MAIN', 'CONV');
  if (!meta) return <div style={{ padding: 6, fontSize: 12 }}>Invalid: {top.subId}</div>;
  return <ModeView meta={meta} onBack={onBack} />;
}

function ModeView({ meta, onBack }: { meta: (typeof CONV_SUBID_TO_CAT)[string]; onBack: () => void }) {
  const units = getUnitsByCategory(meta.cat);
  const TOTAL = units.length + 2;
  const { cursor, dispatch } = useCx3Nav(TOTAL);
  const val = useBlankField('dec', '');
  const [fromIdx, setFromIdx] = useState(meta.fromIdx % units.length);
  const [toIdx, setToIdx] = useState(meta.toIdx % units.length);

  const converted = useMemo(() => {
    const v = val.toNum();
    if (!isFinite(v)) return NaN;
    const fromU = units[fromIdx]?.id, toU = units[toIdx]?.id;
    if (!fromU || !toU) return NaN;
    try { return convertUnits(v, fromU, toU); } catch { return NaN; }
  }, [val.value, fromIdx, toIdx, units]);

  useOnCx3Key((k: Cx3KeyId) => {
    const lineIdx = cursor;
    if (k === 'BACK') { onBack(); return 'stop'; }
    if (k === 'CONVU') {
      if (lineIdx === 1) { setFromIdx(i => (i + 1) % units.length); return 'stop'; }
      if (lineIdx === 2) { setToIdx(i => (i + 1) % units.length); return 'stop'; }
      setFromIdx(i => (i + 1) % units.length);
      return 'stop';
    }
    if (lineIdx === 0) {
      if (k === 'CLR') { val.clear(); return 'stop'; }
      if (k === 'BKSP') { val.backspace(); return 'stop'; }
      if (k === 'SIGN') { val.toggleSign(); return 'stop'; }
      if (k === 'DOT') { val.pushChar('.'); return 'stop'; }
      const ch = keyIdToChar(k);
      if (ch && /[0-9]/.test(ch)) { val.pushChar(ch); return 'stop'; }
      if (NUMBER_KEYS.includes(k)) {
        const c = keyIdToChar(k);
        if (c) { val.pushChar(c); return 'stop'; }
      }
      return undefined;
    } else if (lineIdx === 1) {
      if (k === 'DN') { setFromIdx(i => (i + 1) % units.length); return 'stop'; }
      if (k === 'UP') { setFromIdx(i => (i - 1 + units.length) % units.length); return 'stop'; }
      return undefined;
    } else if (lineIdx === 2) {
      if (k === 'DN') { setToIdx(i => (i + 1) % units.length); return 'stop'; }
      if (k === 'UP') { setToIdx(i => (i - 1 + units.length) % units.length); return 'stop'; }
      return undefined;
    }
    return undefined;
  }, [cursor, onBack, val, fromIdx, toIdx, units.length], 12);

  useCx3OnEnter(() => {
    if (cursor < TOTAL - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const fromU = units[fromIdx];
  const toU = units[toIdx];

  return (
    <div className="cx3-lcd-menu">
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 0 })}>
        <Cx3Line label={meta.catLabel} valueDisplay={val.displayValue} unit={fromU?.symbol}
          state={lineStateFrom(val)} cursor={cursor === 0}
          valueClass={val.isBlank ? 'dashes' : 'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 1 })}>
        <Cx3Line label="SET UNIT" valueDisplay={(fromU?.name ?? '--')} unit={fromU?.symbol}
          state={'input'} cursor={cursor === 1} valueClass={'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 2 })}>
        <Cx3Line label="CONV UNIT" valueDisplay={(toU?.name ?? '--')} unit={toU?.symbol}
          state={'input'} cursor={cursor === 2} valueClass={'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 3 })}>
        <Cx3Line label="Result"
          valueDisplay={isFinite(converted) ? formatNumber(converted, 4) : '--'}
          unit={toU?.symbol}
          state={isFinite(converted) ? 'calc' : 'unsolved'}
          cursor={cursor === 3}
          valueClass={isFinite(converted) ? 'green' : 'dashes'} />
      </div>
    </div>
  );
}
