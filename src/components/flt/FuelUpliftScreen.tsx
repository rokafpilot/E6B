import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcFuelUplift, lbToGal } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['TOT', 'CUR', 'DEN', 'UP', 'UPGAL', 'ONBD'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { TOT: 'Tot Req', CUR: 'Current', DEN: 'Density', UP: 'Uplift', UPGAL: 'Uplift Gal', ONBD: 'Tot Onbd' };
const UNITS: Record<K, string> = { TOT: 'LBS', CUR: 'LBS', DEN: 'LB/GAL', UP: 'LBS', UPGAL: 'GAL', ONBD: 'LBS' };

export default function FuelUpliftScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const tot = useBlankField('dec', '');
  const cur = useBlankField('dec', '');
  const den = useBlankField('dec', '6.7');

  const r = useMemo(() => {
    const tLb = tot.toNum();
    const cLb = cur.toNum();
    const d = den.toNum();
    if (!isFinite(tLb) || !isFinite(cLb) || !isFinite(d) || tLb < 0 || cLb < 0 || d <= 0) return null;
    const tGal = lbToGal(tLb, d);
    const cGal = lbToGal(cLb, d);
    return calcFuelUplift(tGal, cGal, d);
  }, [tot, cur, den]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'TOT' ? tot : key === 'CUR' ? cur : key === 'DEN' ? den : undefined;
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
  }, [cursor, tot, cur, den], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    TOT: tot.displayValue,
    CUR: cur.displayValue,
    DEN: den.displayValue,
    UP: r ? formatNumber(r.upliftLb, 0) : '--',
    UPGAL: r ? formatNumber(r.upliftGal, 1) : '--',
    ONBD: r ? formatNumber(r.totalOnboardLb, 0) : '--',
  };

  const inputKeys: K[] = ['TOT', 'CUR', 'DEN'];

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = !inputKeys.includes(k);
        const f = k === 'TOT' ? tot : k === 'CUR' ? cur : k === 'DEN' ? den : undefined;
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
