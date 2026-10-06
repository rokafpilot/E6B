import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { glideDistance } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['RATIO', 'ALTLOSS', 'DISTFT', 'DISTNM', 'ANGLE'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { RATIO: 'Ratio', ALTLOSS: 'Alt Loss', DISTFT: 'Dist', DISTNM: 'Dist', ANGLE: 'Ang' };
const UNITS: Record<K, string> = { RATIO: ':1', ALTLOSS: 'FT', DISTFT: 'FT', DISTNM: 'NM', ANGLE: '°' };

export default function GlideScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const ratio = useBlankField('dec', '');
  const altLoss = useBlankField('int', '');

  const r = useMemo(() => {
    const ra = ratio.toNum(), al = altLoss.toNum();
    if (!isFinite(ra) || !isFinite(al) || ra <= 0) return null;
    return glideDistance({ glideRatio: ra, altitudeLossFt: al });
  }, [ratio, altLoss]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'RATIO' ? ratio : key === 'ALTLOSS' ? altLoss : undefined;
    if (!f) return undefined;
    if (k === 'CLR') { f.clear(); return 'stop'; }
    if (k === 'BKSP') { f.backspace(); return 'stop'; }
    if (k === 'SIGN' && key === 'ALTLOSS') { f.toggleSign(); return 'stop'; }
    if (k === 'DOT' && key === 'RATIO') { f.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { f.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { f.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, ratio, altLoss], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    RATIO: ratio.displayValue,
    ALTLOSS: altLoss.displayValue,
    DISTFT: r ? formatNumber(r.distanceFt, 0) : '--',
    DISTNM: r ? formatNumber(r.distanceNm, 2) : '--',
    ANGLE: r ? formatNumber(r.glideAngleDeg, 1) : '--',
  };

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = k === 'DISTFT' || k === 'DISTNM' || k === 'ANGLE';
        const f = k === 'RATIO' ? ratio : k === 'ALTLOSS' ? altLoss : undefined;
        const st: import('../../hooks/useBlankField').LineState =
          isOut ? (r ? 'calc' : 'unsolved') : lineStateFrom(f as any);
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
