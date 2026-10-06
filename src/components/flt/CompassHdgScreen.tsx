import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { compassHeading } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

export type ChMode = 'MENU' | 'TH2CH' | 'CH2TH';
const MODES: { id: ChMode; label: string }[] = [
  { id: 'TH2CH', label: 'TH → CH' },
  { id: 'CH2TH', label: 'CH → TH' },
];

function Menu({ onPick }: { onPick: (m: ChMode) => void }) {
  const { cursor, dispatch } = useCx3Nav(MODES.length);
  useCx3OnEnter(() => {
    const id = MODES[cursor]?.id; if (id) onPick(id);
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

const SPECS: Record<Exclude<ChMode, 'MENU'>, { title: string; keys: readonly string[];
  labels: Record<string, string>; units: Record<string, string>;
  inKeys: string[]; }> = {
  TH2CH: {
    title: 'TH → CH',
    keys: ['TH', 'VAR', 'DEV', 'MH', 'CH'] as const,
    labels: { TH: 'TH', VAR: 'Var', DEV: 'Dev', MH: 'MH', CH: 'CH' },
    units: { TH: '°', VAR: '°E/W', DEV: '°E/W', MH: '°', CH: '°' },
    inKeys: ['TH', 'VAR', 'DEV'],
  },
  CH2TH: {
    title: 'CH → TH',
    keys: ['CH', 'VAR', 'DEV', 'MH', 'TH'] as const,
    labels: { CH: 'CH', VAR: 'Var', DEV: 'Dev', MH: 'MH', TH: 'TH' },
    units: { CH: '°', VAR: '°E/W', DEV: '°E/W', MH: '°', TH: '°' },
    inKeys: ['CH', 'VAR', 'DEV'],
  },
};

function ModeView({ mode, onBack }: { mode: Exclude<ChMode, 'MENU'>; onBack: () => void }) {
  const spec = SPECS[mode];
  const { cursor, dispatch } = useCx3Nav(spec.keys.length);
  const f1 = useBlankField('int', '');
  const fVar = useBlankField('dec', '');
  const fDev = useBlankField('dec', '');
  const headKey = spec.inKeys[0];
  const fields: Record<string, ReturnType<typeof useBlankField>> =
    mode === 'TH2CH' ? { TH: f1, VAR: fVar, DEV: fDev } : { CH: f1, VAR: fVar, DEV: fDev };

  const r = useMemo(() => {
    const v = fVar.toNum(), d = fDev.toNum();
    const head = f1.toNum();
    if (!isFinite(v) || !isFinite(d) || !isFinite(head)) return null;
    return mode === 'TH2CH'
      ? compassHeading({ mode: 'TH_TO_CH', trueHeadingDeg: head, variationDeg: v, deviationDeg: d })
      : compassHeading({ mode: 'CH_TO_TH', compassHeadingDeg: head, variationDeg: v, deviationDeg: d });
  }, [mode, f1, fVar, fDev]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = spec.keys[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'BACK') { onBack(); return 'stop'; }
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT' && (key === 'VAR' || key === 'DEV')) { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, mode, onBack, ...Object.values(fields).map(f => f.value)], 12);

  useCx3OnEnter(() => {
    if (cursor < spec.keys.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {spec.keys.map((k, i) => {
        const isOut = !spec.inKeys.includes(k);
        const f = fields[k];
        let disp = '--';
        if (isOut && r) {
          disp = k === 'TH' ? formatNumber(r.trueHeadingDeg, 0)
            : k === 'MH' ? formatNumber(r.magneticHeadingDeg, 0)
            : k === 'CH' ? formatNumber(r.compassHeadingDeg, 0)
            : '--';
        } else if (f) {
          disp = f.displayValue;
        }
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={spec.labels[k]} valueDisplay={disp} unit={spec.units[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}

export default function CompassHdgScreen() {
  const { top, goSub, replaceTop } = useCx3Router();
  const sub = (top.subId.includes('__') ? top.subId.split('__')[1] : 'MENU') as ChMode;
  const onPick = (m: ChMode) => goSub(`COMPASHDG__${m}`, `Compass ${m}`);
  const onBack = () => replaceTop('COMPASHDG', 'Compass Hdg');
  if (sub === 'MENU') return <Menu onPick={onPick} />;
  return <ModeView mode={sub as Exclude<ChMode, 'MENU'>} onBack={onBack} />;
}
