import React, { useMemo } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calcReserveFuel, galToLb, lbToGal } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';

const LINES = ['REQ', 'RSVP', 'ALT', 'HOLD', 'CONT', 'RSV', 'TOT'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = { REQ: 'Req Fuel', RSVP: 'Rsv %', ALT: 'Alt Fuel', HOLD: 'Hold Fuel', CONT: 'Conting', RSV: 'Reserve', TOT: 'Total Req' };
const UNITS: Record<K, string> = { REQ: 'LBS', RSVP: '%', ALT: 'LBS', HOLD: 'LBS', CONT: 'LBS', RSV: 'LBS', TOT: 'LBS' };

export default function ReserveFuelScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const req = useBlankField('dec', '');
  const rsvp = useBlankField('dec', '15');
  const alt = useBlankField('dec', '0');
  const hold = useBlankField('dec', '0');

  const r = useMemo(() => {
    const rqLb = req.toNum(), rp = rsvp.toNum(), alLb = alt.toNum(), hdLb = hold.toNum();
    if (!isFinite(rqLb) || !isFinite(rp) || !isFinite(alLb) || !isFinite(hdLb) || rqLb < 0) return null;
    const rg = calcReserveFuel(lbToGal(rqLb), rp, lbToGal(alLb), lbToGal(hdLb));
    return {
      contingencyLb: galToLb(rg.contingencyGal),
      reserveLb: galToLb(rg.reserveGal),
      totalRequiredLb: galToLb(rg.totalRequiredGal),
    };
  }, [req, rsvp, alt, hold]);

  useOnCx3Key((k: Cx3KeyId) => {
    const key = LINES[cursor];
    const f: ReturnType<typeof useBlankField> | undefined =
      key === 'REQ' ? req : key === 'RSVP' ? rsvp : key === 'ALT' ? alt : key === 'HOLD' ? hold : undefined;
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
  }, [cursor, req, rsvp, alt, hold], 12);

  useCx3OnEnter(() => {
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  });

  const outs: Record<K, string> = {
    REQ: req.displayValue,
    RSVP: rsvp.displayValue,
    ALT: alt.displayValue,
    HOLD: hold.displayValue,
    CONT: r ? formatNumber(r.contingencyLb, 0) : '--',
    RSV: r ? formatNumber(r.reserveLb, 0) : '--',
    TOT: r ? formatNumber(r.totalRequiredLb, 0) : '--',
  };

  const inputKeys: K[] = ['REQ', 'RSVP', 'ALT', 'HOLD'];

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => {
        const isOut = !inputKeys.includes(k);
        const f = k === 'REQ' ? req : k === 'RSVP' ? rsvp : k === 'ALT' ? alt : k === 'HOLD' ? hold : undefined;
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
