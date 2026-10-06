import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcTopOfDescent } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['ALT', 'TGT', 'GS', 'PATH', 'DIST', 'TIME', 'ROD'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { ALT: 'Alt', TGT: 'Tgt Alt', GS: 'GS', PATH: 'Path', DIST: 'Dist TOD', TIME: 'Time', ROD: 'Req RoD' };
const UNITS: Record<K, string> = { ALT: 'FT', TGT: 'FT', GS: 'KT', PATH: '°', DIST: 'NM', TIME: 'MIN', ROD: 'FPM' };

export default function TODScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const alt = useBlankField('dec', '');
  const tgt = useBlankField('dec', '');
  const gs = useBlankField('dec', '');
  const path = useBlankField('dec', '3.0');

  const r = useMemo(() => {
    const a = alt.toNum();
    const t = tgt.toNum();
    const g = gs.toNum();
    const p = path.toNum();
    if (!isFinite(a) || !isFinite(t) || !isFinite(g) || !isFinite(p) || g <= 0) return null;
    return calcTopOfDescent(a, t, g, p);
  }, [alt, tgt, gs, path]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'ALT' ? alt : key === 'TGT' ? tgt : key === 'GS' ? gs : key === 'PATH' ? path : undefined;
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
  }, [cursor, alt, tgt, gs, path], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    ALT: alt.displayValue,
    TGT: tgt.displayValue,
    GS: gs.displayValue,
    PATH: path.displayValue,
    DIST: r ? formatNumber(r.distanceNm, 1) : '--',
    TIME: r ? formatNumber(r.timeMin, 0) : '--',
    ROD: r ? formatNumber(r.requiredRateFpm, 0) : '--',
  };

  const inputKeys: K[] = ['ALT', 'TGT', 'GS', 'PATH'];

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = !inputKeys.includes(k);
        const f = k === 'ALT' ? alt : k === 'TGT' ? tgt : k === 'GS' ? gs : k === 'PATH' ? path : undefined;
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
