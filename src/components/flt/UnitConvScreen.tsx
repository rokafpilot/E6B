import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { CATEGORIES, UNITS, convertUnits, getUnitsByCategory, getUnitById, type UnitCategory } from '../../utils/units';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export type UCMode = 'MENU' | 'MODE';

function Menu({ onPick }: { onPick: (cat: UnitCategory) => void }) {
  const { cursor, dispatch } = useCx3Nav(CATEGORIES.length);
  useCx3OnEnter(() => {
    const c = CATEGORIES[cursor]; if (c) onPick(c.id);
  });
  return (
    <div className="cx3-lcd-menu">
      {CATEGORIES.map((c, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          onPick(c.id);
        };
        return (
          <div key={c.id} onClick={enter}>
            <Cx3Line label={c.name} state={i === 0 ? 'input' : 'unsolved'} cursor={cursor === i} onClick={enter} />
          </div>
        );
      })}
    </div>
  );
}

function ModeView({ cat, onBack }: { cat: UnitCategory; onBack: () => void }) {
  const units = getUnitsByCategory(cat);
  const TOTAL = units.length + 2;
  const { cursor, dispatch } = useCx3Nav(TOTAL);
  const val = useBlankField('dec', '');
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);

  const converted = useMemo(() => {
    const v = val.toNum();
    if (!isFinite(v)) return NaN;
    const fromU = units[fromIdx]?.id, toU = units[toIdx]?.id;
    if (!fromU || !toU) return NaN;
    try { return convertUnits(v, fromU, toU); } catch { return NaN; }
  }, [val.value, fromIdx, toIdx, units]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { onBack(); return 'stop'; }
    if (k === 'SETU') { setFromIdx(i => (i + 1) % units.length); return 'stop'; }
    if (k === 'CONVU') { setToIdx(i => (i + 1) % units.length); return 'stop'; }
    const lineIdx = cursor;
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
  const catName = CATEGORIES.find(c => c.id === cat)?.name ?? cat;

  return (
    <div className="cx3-lcd-menu">
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 0 })}>
        <Cx3Line label={catName + ' Val'} valueDisplay={val.displayValue} unit={fromU?.symbol}
          state={lineStateFrom(val)} cursor={cursor === 0}
          valueClass={val.isBlank ? 'dashes' : 'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 1 })}>
        <Cx3Line label="From Unit" valueDisplay={(fromU?.name ?? '--')} unit={fromU?.symbol}
          state={'input'} cursor={cursor === 1} valueClass={'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 2 })}>
        <Cx3Line label="To Unit" valueDisplay={(toU?.name ?? '--')} unit={toU?.symbol}
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

export default function UnitConvScreen() {
  const { top, goSub, replaceTop } = useCx3Router();
  if (top.subId === 'UNITCONV') return <Menu onPick={(c) => goSub(`UNITCONV__${c}`, `Unit: ${c}`)} />;
  const parts = top.subId.split('__');
  const cat = parts[1] as UnitCategory;
  const onBack = () => replaceTop('UNITCONV', 'Unit Conversions');
  if (!cat || !CATEGORIES.some(c => c.id === cat)) return <Menu onPick={(c) => goSub(`UNITCONV__${c}`, `Unit: ${c}`)} />;
  return <ModeView cat={cat} onBack={onBack} />;
}
