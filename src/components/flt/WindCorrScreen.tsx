import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { windCorrection } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['TAS', 'TC', 'WDIR', 'WSPD', 'TH', 'GS', 'WCA', 'DRIFT'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = {
  TAS: 'TAS', TC: 'TC', WDIR: 'W Dir', WSPD: 'W Spd',
  TH: 'TH', GS: 'GS', WCA: 'WCA', DRIFT: 'Drift',
};
const UNITS: Record<K, string> = {
  TAS: 'KT', TC: '°', WDIR: '°', WSPD: 'KT',
  TH: '°', GS: 'KT', WCA: '°', DRIFT: '',
};

export default function WindCorrScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const tas = useBlankField('dec', '');
  const tc = useBlankField('int', '');
  const wDir = useBlankField('int', '');
  const wSpd = useBlankField('dec', '');
  const fields: Record<string, ReturnType<typeof useBlankField>> = {
    TAS: tas, TC: tc, WDIR: wDir, WSPD: wSpd,
  };

  const r = useMemo(() => {
    const t = tas.toNum(), c = tc.toNum(), wd = wDir.toNum(), ws = wSpd.toNum();
    if (!isFinite(t) || !isFinite(c) || !isFinite(wd) || !isFinite(ws)) return null;
    return windCorrection({ tasKt: t, trueCourseDeg: c, windDirectionDeg: wd, windSpeedKt: ws });
  }, [tas, tc, wDir, wSpd]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f = fields[key];
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'DOT' && (key === 'TAS' || key === 'WSPD')) { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, tas, tc, wDir, wSpd], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'TH' || k === 'GS' || k === 'WCA' || k === 'DRIFT';
        const f = fields[k];
        let disp = '--';
        if (k === 'TH' && r) disp = formatNumber(r.trueHeadingDeg, 0);
        else if (k === 'GS' && r) disp = formatNumber(r.groundspeedKt, 0);
        else if (k === 'WCA' && r) disp = formatNumber(Math.abs(r.windCorrectionAngleDeg), 1);
        else if (k === 'DRIFT' && r) disp = r.drift;
        else if (f) disp = f.displayValue;
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
        const vc = isOut ? (r ? 'green' : 'dashes') : (f?.isBlank ? 'dashes' : 'default');
        return (
          <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={LABELS[k]} valueDisplay={disp} unit={UNITS[k]}
              state={st} cursor={cursor === i} valueClass={vc as any} />
          </div>
        );
      })}
    </div>
  );
}
