import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, formatHMS, lineStateFrom } from '../../hooks/useBlankField';
import { calculateFuel } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export type FuelMode = 'MENU' | 'BURN' | 'RATE' | 'ENDURANCE';

const MODES: { id: FuelMode; label: string }[] = [
  { id: 'BURN', label: 'Fuel Burn' },
  { id: 'RATE', label: 'Fuel Rate' },
  { id: 'ENDURANCE', label: 'Endurance' },
];

function Menu({ onPick }: { onPick: (m: FuelMode) => void }) {
  const { cursor, dispatch } = useCx3Nav(MODES.length);
  useCx3OnEnter(() => {
    const id = MODES[cursor]?.id;
    if (id) onPick(id);
  });
  return (
    <div className="cx3-lcd-menu">
      {MODES.map((m, i) => (
        <div key={m.id} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={m.label} state={i === 0 ? 'input' : 'unsolved'} cursor={cursor === i} />
        </div>
      ))}
    </div>
  );
}

type LineSpec = {
  key: string; label: string; unit: string; kind: 'dec' | 'time' | 'int'; dir: 'in' | 'out';
  outFrom?: (r: ReturnType<typeof calculateFuel>, hours: number) => string;
};

const SPECS: Record<Exclude<FuelMode, 'MENU'>, { title: string; lines: LineSpec[] }> = {
  BURN: {
    title: 'Fuel Burn',
    lines: [
      { key: 'RATE', label: 'Rate', unit: 'LB/HR', kind: 'dec', dir: 'in' },
      { key: 'DUR', label: 'Dur', unit: 'HMS', kind: 'time', dir: 'in' },
      { key: 'WT', label: 'Wt', unit: 'LBS', kind: 'dec', dir: 'out',
        outFrom: (r) => formatNumber(r.totalFuelGal ?? NaN, 0) },
    ],
  },
  RATE: {
    title: 'Fuel Rate',
    lines: [
      { key: 'WT', label: 'Wt', unit: 'LBS', kind: 'dec', dir: 'in' },
      { key: 'DUR', label: 'Dur', unit: 'HMS', kind: 'time', dir: 'in' },
      { key: 'RATE', label: 'Rate', unit: 'LB/HR', kind: 'dec', dir: 'out',
        outFrom: (r) => formatNumber(r.fuelBurnRateGph ?? NaN, 0) },
    ],
  },
  ENDURANCE: {
    title: 'Endurance',
    lines: [
      { key: 'WT', label: 'Wt', unit: 'LBS', kind: 'dec', dir: 'in' },
      { key: 'RATE', label: 'Rate', unit: 'LB/HR', kind: 'dec', dir: 'in' },
      { key: 'DUR', label: 'Dur', unit: 'HMS', kind: 'time', dir: 'out',
        outFrom: (_r, hrs) => isFinite(hrs) ? formatHMS(hrs * 3600) : '--' },
    ],
  },
};

function useFields(lines: LineSpec[]) {
  const res: Record<string, ReturnType<typeof useBlankField>> = {};
  for (const l of lines) {
    if (l.dir === 'in') {
      // @ts-ignore
      res[l.key] = useBlankField(l.kind, '');
    }
  }
  return res;
}

function ModeView({ mode, onBack }: { mode: Exclude<FuelMode, 'MENU'>; onBack: () => void }) {
  const spec = SPECS[mode];
  const { cursor, dispatch } = useCx3Nav(spec.lines.length);
  const fields = useFields(spec.lines);

  const { result, totalHours } = useMemo(() => {
    const getN = (k: string) => fields[k]?.toNum() ?? NaN;
    const wtLb = getN('WT') || getN('VOL');
    const rateLbph = getN('RATE');
    const totalSeconds = fields.DUR?.toNum() ?? NaN;
    const hours = isFinite(totalSeconds) ? totalSeconds / 3600 : NaN;
    // LB/HR · LBS 그대로 계산. gal 왕복(÷6.7 후 소수 1자리 반올림)하면 2500 lbs가 2499.77이 됨.
    let r: ReturnType<typeof calculateFuel> = {};
    if (mode === 'BURN') {
      r = calculateFuel({ mode: 'fuel', fuelBurnRateGph: rateLbph, timeEnrouteH: hours });
    } else if (mode === 'RATE') {
      r = calculateFuel({ mode: 'fuel', totalFuelGal: wtLb, timeEnrouteH: hours });
    } else if (mode === 'ENDURANCE') {
      r = calculateFuel({ mode: 'endurance', totalFuelGal: wtLb, fuelBurnRateGph: rateLbph });
    }
    const finalH = (mode === 'ENDURANCE' ? r.enduranceH : hours) ?? NaN;
    return { result: r, totalHours: finalH };
  }, Object.values(fields).map(f => f.value).concat([mode]));

  useOnCx3Key((k: Cx3KeyId) => {
    const line = spec.lines[cursor];
    if (!line || line.dir !== 'in') return undefined;
    if (k === 'BACK') { onBack(); return 'stop'; }
    const f = fields[line.key];
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && line.kind !== 'time') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT' && line.kind === 'dec') { f.pushChar('.'); return 'stop'; }
    if (k === 'COL' && line.kind === 'time') { f.pushChar(':'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, mode, onBack, ...Object.values(fields).map(f => f.value)], 12);

  useCx3OnEnter(() => {
    if (cursor < spec.lines.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {spec.lines.map((line, i) => {
        const f = fields[line.key];
        let disp = '--';
        let st: import('../../hooks/useBlankField').LineState = 'unsolved';
        let vClass: 'default' | 'green' | 'dashes' = 'dashes';
        if (line.dir === 'in' && f) {
          disp = line.kind === 'time'
            ? (f.isBlank ? '--' : f.displayValue)
            : f.displayValue;
          st = lineStateFrom(f as any);
          vClass = f.isBlank ? 'dashes' : 'default';
        } else if (line.dir === 'out' && line.outFrom) {
          const ok = mode === 'ENDURANCE'
            ? isFinite(totalHours)
            : (result.totalFuelGal != null || result.fuelBurnRateGph != null);
          disp = ok ? line.outFrom(result, totalHours) : '--';
          st = ok ? 'calc' : 'unsolved';
          vClass = ok ? 'green' : 'dashes';
        }
        return (
          <div key={line.key} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={line.label} valueDisplay={disp} unit={line.unit}
              state={st} cursor={cursor === i} valueClass={vClass} />
          </div>
        );
      })}
    </div>
  );
}

export default function FuelScreen() {
  const { top, goSub, replaceTop } = useCx3Router();
  let sub: FuelMode = 'MENU';
  if (top.subId === 'ENDUR') sub = 'ENDURANCE';
  else if (top.subId === 'FUELCON') sub = 'BURN';
  else if (top.subId.includes('__')) sub = top.subId.split('__')[1] as FuelMode;
  const onPick = (m: FuelMode) => goSub(`FUEL__${m}`, `Fuel ${m}`);
  const onBack = () => replaceTop('FLT_MAIN', 'Fuel');
  if (sub === 'MENU') return <Menu onPick={onPick} />;
  return <ModeView mode={sub as Exclude<FuelMode, 'MENU'>} onBack={onBack} />;
}
