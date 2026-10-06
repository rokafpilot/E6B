import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, formatHMS, lineStateFrom } from '../../hooks/useBlankField';
import { climbDescent, FUEL_LB_PER_GAL_DEFAULT, galToLb, lbphToGph } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export type CdMode = 'MENU' | 'CLIMB' | 'DESCENT';
const MODES: { id: CdMode; label: string }[] = [
  { id: 'CLIMB', label: 'Climb' },
  { id: 'DESCENT', label: 'Descent' },
];

function Menu({ onPick }: { onPick: (m: CdMode) => void }) {
  const { cursor, dispatch } = useCx3Nav(MODES.length);
  useCx3OnEnter(() => {
    const id = MODES[cursor]?.id; if (id) onPick(id);
  });
  return (
    <div className="cx3-lcd-menu">
      {MODES.map((m, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          onPick(m.id);
        };
        return (
          <div key={m.id} onClick={enter}>
            <Cx3Line label={m.label} state={i === 0 ? 'input' : 'unsolved'} cursor={cursor === i} onClick={enter} />
          </div>
        );
      })}
    </div>
  );
}

const SPECS: Record<Exclude<CdMode, 'MENU'>, { title: string; keys: readonly string[];
  labels: Record<string, string>; units: Record<string, string>; kinds: Record<string, 'int' | 'dec'> }> = {
  CLIMB: {
    title: 'Climb',
    keys: ['RATE', 'ALTCHG', 'GS', 'FUEL', 'TIME', 'DIST', 'BURN'] as const,
    labels: { RATE: 'Rate', ALTCHG: 'Alt Chg', GS: 'GS', FUEL: 'Fuel', TIME: 'Time', DIST: 'Dist', BURN: 'Burn' },
    units: { RATE: 'FPM', ALTCHG: 'FT', GS: 'KT', FUEL: 'LB/HR', TIME: 'HMS', DIST: 'NM', BURN: 'LBS' },
    kinds: { RATE: 'int', ALTCHG: 'int', GS: 'dec', FUEL: 'dec' },
  },
  DESCENT: {
    title: 'Descent',
    keys: ['RATE', 'ALTCHG', 'GS', 'FUEL', 'TIME', 'DIST', 'BURN'] as const,
    labels: { RATE: 'Rate', ALTCHG: 'Alt Chg', GS: 'GS', FUEL: 'Fuel', TIME: 'Time', DIST: 'Dist', BURN: 'Burn' },
    units: { RATE: 'FPM', ALTCHG: 'FT', GS: 'KT', FUEL: 'LB/HR', TIME: 'HMS', DIST: 'NM', BURN: 'LBS' },
    kinds: { RATE: 'int', ALTCHG: 'int', GS: 'dec', FUEL: 'dec' },
  },
};

function ModeView({ mode, onBack }: { mode: Exclude<CdMode, 'MENU'>; onBack: () => void }) {
  const spec = SPECS[mode];
  const { cursor, dispatch } = useCx3Nav(spec.keys.length);
  const rate = useBlankField(spec.kinds.RATE, '');
  const altChg = useBlankField(spec.kinds.ALTCHG, '');
  const gs = useBlankField(spec.kinds.GS, '');
  const fuel = useBlankField(spec.kinds.FUEL, '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = { RATE: rate, ALTCHG: altChg, GS: gs, FUEL: fuel };

  const r = useMemo(() => {
    const rt = rate.toNum(), ac = altChg.toNum(), g = gs.toNum(), flLb = fuel.toNum();
    if (!isFinite(rt) || !isFinite(ac) || !isFinite(g)) return null;
    const flGph = isFinite(flLb) ? lbphToGph(flLb) : undefined;
    const res = climbDescent({ rateFpm: rt, altitudeChangeFt: ac, tasKt: g, fuelBurnRateGph: flGph });
    return { ...res, fuelLb: res.fuelGal != null ? galToLb(res.fuelGal) : undefined };
  }, [rate, altChg, gs, fuel]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = spec.keys[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'BACK') { onBack(); return 'stop'; }
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && key !== 'RATE') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT' && spec.kinds[key as keyof typeof spec.kinds] === 'dec') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, mode, onBack, rate, altChg, gs, fuel], 12);

  useCx3OnEnter(() => {
    if (cursor < spec.keys.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<string, string> = {
    RATE: rate.displayValue,
    ALTCHG: altChg.displayValue,
    GS: gs.displayValue,
    FUEL: fuel.displayValue,
    TIME: r ? formatHMS(r.timeMin * 60) : '--',
    DIST: r ? formatNumber(r.distanceNm, 1) : '--',
    BURN: r?.fuelLb != null ? formatNumber(r.fuelLb, 0) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {spec.keys.map((k, i) => {
        const isOut = k === 'TIME' || k === 'DIST' || k === 'BURN';
        const f = fields[k];
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={spec.labels[k]} valueDisplay={outs[k]} unit={spec.units[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}

export default function ClimbDescScreen() {
  const { top, goSub, replaceTop } = useCx3Router();
  let sub: CdMode = 'MENU';
  if (top.subId === 'ROD') sub = 'DESCENT';
  else if (top.subId.includes('__')) sub = top.subId.split('__')[1] as CdMode;
  const onPick = (m: CdMode) => goSub(`CLIMBDESC__${m}`, `${m}`);
  const onBack = () => replaceTop('FLT_MAIN', 'Climb/Desc');
  if (sub === 'MENU') return <Menu onPick={onPick} />;
  return <ModeView mode={sub as Exclude<CdMode, 'MENU'>} onBack={onBack} />;
}
