import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcRateOfDescentMach } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['MACH', 'ANGLE', 'OAT', 'ROD', 'TAS', 'SOS'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { MACH: 'Mach', ANGLE: 'Angle', OAT: 'OAT', ROD: 'RoD', TAS: 'TAS', SOS: 'Spd Sound' };
const UNITS: Record<K, string> = { MACH: 'M', ANGLE: '°', OAT: '°C', ROD: 'FPM', TAS: 'KT', SOS: 'KT' };

export default function RoDMachScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const mach = useBlankField('dec', '');
  const angle = useBlankField('dec', '3.0');
  const oat = useBlankField('dec', '15');

  const r = useMemo(() => {
    const m = mach.toNum();
    const a = angle.toNum();
    const o = oat.toNum();
    if (!isFinite(m) || !isFinite(a) || !isFinite(o) || m <= 0) return null;
    return calcRateOfDescentMach(m, a, o);
  }, [mach, angle, oat]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'MACH' ? mach : key === 'ANGLE' ? angle : key === 'OAT' ? oat : undefined;
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
  }, [cursor, mach, angle, oat], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    MACH: mach.displayValue,
    ANGLE: angle.displayValue,
    OAT: oat.displayValue,
    ROD: r ? formatNumber(r.rodFpm, 0) : '--',
    TAS: r ? formatNumber(r.tasKt, 1) : '--',
    SOS: r ? formatNumber(r.speedOfSoundKt, 1) : '--',
  };

  const inputKeys: K[] = ['MACH', 'ANGLE', 'OAT'];

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = !inputKeys.includes(k);
        const f = k === 'MACH' ? mach : k === 'ANGLE' ? angle : k === 'OAT' ? oat : undefined;
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
