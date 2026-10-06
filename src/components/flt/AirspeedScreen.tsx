import React, { useEffect, useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import {
  airspeedPlannedTas, airspeedActualTas, airspeedRequiredCas,
  airspeedPlannedMach, airspeedActualMach, Airspeed5Result,
} from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export type AirspeedMode =
  | 'MENU'
  | 'PLANNED_TAS'
  | 'ACTUAL_TAS'
  | 'REQ_CAS'
  | 'PLANNED_MACH'
  | 'ACTUAL_MACH';

const MODES: { id: AirspeedMode; label: string }[] = [
  { id: 'PLANNED_TAS', label: 'Planned TAS' },
  { id: 'ACTUAL_TAS', label: 'Actual TAS' },
  { id: 'REQ_CAS', label: 'Required CAS' },
  { id: 'PLANNED_MACH', label: 'Planned MACH#' },
  { id: 'ACTUAL_MACH', label: 'Actual MACH#' },
];

const AIRSPEED_ROOT_SUBIDS = ['SPEED', 'AIRSPEED', 'MENU'];

const fToC = (f: number) => (f - 32) * 5 / 9;
const cToF = (c: number) => c * 9 / 5 + 32;

function AirspeedMenu({ onPick }: { onPick: (m: AirspeedMode) => void }) {
  const N = MODES.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { replaceTop } = useCx3Router();
  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('FLT_MAIN', 'E6-B'); return 'stop'; }
    return undefined;
  }, [replaceTop], 99);
  useCx3OnEnter(() => {
    const id = MODES[cursor]?.id;
    if (id) onPick(id);
  });
  const rowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);
  return (
    <div className="cx3-lcd-menu">
      {MODES.map((m, i) => (
        <div
          key={m.id}
          ref={(el) => { rowRefs.current[i] = el; }}
          onClick={() => { dispatch({ type: 'SET_CURSOR', idx: i }); setTimeout(() => onPick(m.id), 0); }}
        >
          <Cx3Line label={m.label} state={i === 0 ? 'input' : 'unsolved'} cursor={cursor === i} />
        </div>
      ))}
    </div>
  );
}

interface ModeSpec {
  title: string;
  lines: {
    key: string;
    label: string;
    unit: string;
    kind: 'int' | 'dec';
    direction: 'in' | 'out';
    outFrom?: (r: Airspeed5Result) => number | string;
    outClass?: 'default' | 'green' | 'amber' | 'dashes';
  }[];
}

const SPECS: Record<Exclude<AirspeedMode, 'MENU'>, ModeSpec> = {
  PLANNED_TAS: {
    title: 'Planned TAS',
    lines: [
      { key: 'CAS', label: 'CAS', unit: 'KTS', kind: 'dec', direction: 'in' },
      { key: 'OAT', label: 'OAT', unit: '°F', kind: 'dec', direction: 'in' },
      { key: 'PALT', label: 'PAlt', unit: 'FT', kind: 'int', direction: 'in' },
      { key: 'TAS', label: 'TAS', unit: 'KTS', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.tasKt, 2), outClass: 'green' },
      { key: 'TAT', label: 'TAT', unit: '°F', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(cToF(r.tatC), 1), outClass: 'green' },
      { key: 'MACH', label: 'MACH', unit: '', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.mach, 3), outClass: 'green' },
    ],
  },
  ACTUAL_TAS: {
    title: 'Actual TAS',
    lines: [
      { key: 'CAS', label: 'CAS', unit: 'KTS', kind: 'dec', direction: 'in' },
      { key: 'TAT', label: 'TAT', unit: '°C', kind: 'dec', direction: 'in' },
      { key: 'PALT', label: 'PAlt', unit: 'FT', kind: 'int', direction: 'in' },
      { key: 'TAS', label: 'TAS', unit: 'KTS', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.tasKt, 2), outClass: 'green' },
      { key: 'OAT', label: 'OAT', unit: '°C', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.oatC, 1), outClass: 'green' },
      { key: 'MACH', label: 'MACH', unit: '', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.mach, 3), outClass: 'green' },
    ],
  },
  REQ_CAS: {
    title: 'Required CAS',
    lines: [
      { key: 'TAS', label: 'TAS', unit: 'KTS', kind: 'dec', direction: 'in' },
      { key: 'OAT', label: 'OAT', unit: '°F', kind: 'dec', direction: 'in' },
      { key: 'PALT', label: 'PAlt', unit: 'FT', kind: 'int', direction: 'in' },
      { key: 'CAS', label: 'CAS', unit: 'KTS', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.casKt, 2), outClass: 'green' },
      { key: 'TAT', label: 'TAT', unit: '°F', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(cToF(r.tatC), 1), outClass: 'green' },
      { key: 'MACH', label: 'MACH', unit: '', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.mach, 3), outClass: 'green' },
    ],
  },
  PLANNED_MACH: {
    title: 'Planned MACH#',
    lines: [
      { key: 'MACH', label: 'MACH', unit: '', kind: 'dec', direction: 'in' },
      { key: 'OAT', label: 'OAT', unit: '°F', kind: 'dec', direction: 'in' },
      { key: 'TAS', label: 'TAS', unit: 'KTS', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.tasKt, 2), outClass: 'green' },
      { key: 'TAT', label: 'TAT', unit: '°F', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(cToF(r.tatC), 1), outClass: 'green' },
    ],
  },
  ACTUAL_MACH: {
    title: 'Actual MACH#',
    lines: [
      { key: 'MACH', label: 'MACH', unit: '', kind: 'dec', direction: 'in' },
      { key: 'TAT', label: 'TAT', unit: '°F', kind: 'dec', direction: 'in' },
      { key: 'TAS', label: 'TAS', unit: 'KTS', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.tasKt, 2), outClass: 'green' },
      { key: 'OAT', label: 'OAT', unit: '°F', kind: 'dec', direction: 'out',
        outFrom: (r) => formatNumber(r.oatC, 1), outClass: 'green' },
    ],
  },
};

function AirspeedModeView({ mode, onBack }: { mode: Exclude<AirspeedMode, 'MENU'>; onBack: () => void }) {
  const spec = SPECS[mode];
  const N = spec.lines.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>('C');

  const fCAS  = useBlankField('dec');
  const fOAT  = useBlankField('dec');
  const fPALT = useBlankField('int');
  const fTAS  = useBlankField('dec');
  const fTAT  = useBlankField('dec');
  const fMACH = useBlankField('dec');

  const fields: Record<string, ReturnType<typeof useBlankField>> = {};
  const allIn = spec.lines.filter(l => l.direction === 'in').map(l => l.key);
  if (allIn.includes('CAS')) fields.CAS = fCAS;
  if (allIn.includes('OAT')) fields.OAT = fOAT;
  if (allIn.includes('PALT')) fields.PALT = fPALT;
  if (allIn.includes('TAS')) fields.TAS = fTAS;
  if (allIn.includes('TAT')) fields.TAT = fTAT;
  if (allIn.includes('MACH')) fields.MACH = fMACH;

  const result = useMemo<Airspeed5Result | null>(() => {
    const get = (k: string) => (fields[k]?.toNum() ?? NaN);
    const getTempC = (k: string) => {
      const v = get(k);
      return isFinite(v) ? (tempUnit === 'F' ? fToC(v) : v) : NaN;
    };
    const pAlt = get('PALT');
    switch (mode) {
      case 'PLANNED_TAS': {
        const cas = get('CAS'), oatC = getTempC('OAT');
        if (!isFinite(cas) || !isFinite(pAlt)) return null;
        return airspeedPlannedTas(cas, isFinite(oatC) ? oatC : 15, pAlt);
      }
      case 'ACTUAL_TAS': {
        const cas = get('CAS'), tatC = get('TAT');
        if (!isFinite(cas) || !isFinite(tatC) || !isFinite(pAlt)) return null;
        return airspeedActualTas(cas, tatC, pAlt);
      }
      case 'REQ_CAS': {
        const tas = get('TAS'), oatC = getTempC('OAT');
        if (!isFinite(tas) || !isFinite(pAlt)) return null;
        return airspeedRequiredCas(tas, isFinite(oatC) ? oatC : 15, pAlt);
      }
      case 'PLANNED_MACH': {
        const mach = get('MACH'), oatC = getTempC('OAT');
        if (!isFinite(mach) || !isFinite(oatC)) return null;
        return airspeedPlannedMach(mach, oatC);
      }
      case 'ACTUAL_MACH': {
        const mach = get('MACH'), tatC = getTempC('TAT');
        if (!isFinite(mach) || !isFinite(tatC)) return null;
        return airspeedActualMach(mach, tatC);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Object.values(fields).map(f => f.value), mode, tempUnit,
      fCAS.value, fOAT.value, fPALT.value, fTAS.value, fTAT.value, fMACH.value]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { onBack(); return 'stop'; }
    if (cursor < 0 || cursor >= N) return undefined;
    const line = spec.lines[cursor];
    if (!line) return undefined;
    const f = fields[line.key];
    if ((line.key === 'OAT' || line.key === 'TAT') && (k === 'CONVU' || k === 'SETU')) {
      if (f) {
        const value = f.toNum();
        if (isFinite(value)) f.setValue(formatNumber(tempUnit === 'F' ? fToC(value) : cToF(value), 1));
      }
      setTempUnit(unit => unit === 'F' ? 'C' : 'F');
      return 'stop';
    }
    if (line.direction !== 'in' || !f) return undefined;
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
  }, [cursor, mode, onBack, tempUnit, ...Object.values(fields).map(f => f.value),
      fCAS.value, fOAT.value, fPALT.value, fTAS.value, fTAT.value, fMACH.value], 12);

  useCx3OnEnter(() => {
    if (cursor < N - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const rowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {spec.lines.map((line, i) => {
        const f = fields[line.key];
        const disp = line.direction === 'in'
          ? f?.displayValue ?? '--'
          : (result && line.outFrom ? String(line.outFrom(result)) : '--');
        const st = line.direction === 'in'
          ? lineStateFrom(f as any)
          : (result ? 'calc' : 'unsolved');
        const vClass = line.direction === 'out'
          ? (result ? (line.outClass ?? 'green') : 'dashes')
          : (f?.isBlank ? 'dashes' : 'default');
        const enter = () => dispatch({ type: 'SET_CURSOR', idx: i });
        return (
          <div
            key={line.key}
            ref={(el) => { rowRefs.current[i] = el; }}
            onClick={enter}
          >
            <Cx3Line
              label={line.label}
              valueDisplay={disp}
              unit={line.key === 'OAT' || line.key === 'TAT' ? `°${tempUnit}` : line.unit}
              state={st}
              cursor={cursor === i}
              valueClass={vClass}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AirspeedScreen() {
  const { top, replaceTop, goSub } = useCx3Router();

  // Fix (b) SPEED 서브루팅: SPEED → MENU, SPEED__XX → 모드뷰 두가지 모두 지원
  let subMode: AirspeedMode = 'MENU';
  const sub = top?.subId ?? '';
  if (sub.includes('__')) {
    const m = sub.split('__')[1] as AirspeedMode;
    if (MODES.some(x => x.id === m)) subMode = m;
  } else if (AIRSPEED_ROOT_SUBIDS.includes(sub)) {
    subMode = 'MENU';
  }

  const onPick = (m: AirspeedMode) => {
    goSub(`SPEED__${m}`, `Airspeed ${m.replace(/_/g, ' ')}`);
  };
  const onBack = () => replaceTop('SPEED', 'Airspeed');

  if (subMode === 'MENU') return <AirspeedMenu onPick={onPick} />;
  return <AirspeedModeView key={subMode} mode={subMode as Exclude<AirspeedMode, 'MENU'>} onBack={onBack} />;
}
