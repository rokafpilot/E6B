import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type FuelType, FUEL_DENSITY } from '../../context/Cx3SettingsContext';

const FUEL_TYPES: FuelType[] = ['AVGAS', 'JETA', 'OIL'];

export default function AircraftProfileScreen() {
  const { data, setAircraft } = useCx3Settings();
  const kf = useBlankField('dec', String(data.aircraft.kFactor));
  const bem = useBlankField('int', String(data.aircraft.basicEmptyLb));
  const mom = useBlankField('int', String(data.aircraft.basicEmptyMoment));
  const lemac = useBlankField('dec', String(data.aircraft.lemacIn));
  const mac = useBlankField('dec', String(data.aircraft.macLengthIn));
  const { cursor, dispatch } = useCx3Nav(3 + FUEL_TYPES.length + 3);
  const { replaceTop } = useCx3Router();

  const LINE_KEYS = [
    { k: 'KF', label: 'K Factor', f: kf, unit: '' },
    { k: 'FUEL_TYPE', label: 'Fuel Type', f: null as any, unit: '' },
    ...FUEL_TYPES.map((ft) => ({ k: `FT_${ft}`, label: `  ${ft} (${FUEL_DENSITY[ft]} lb/gal)`, f: null as any, unit: '' })),
    { k: 'BEM', label: 'Basic Empty', f: bem, unit: 'LB' },
    { k: 'BEM_MOM', label: 'BEM Moment', f: mom, unit: 'LB·IN' },
    { k: 'LEMAC', label: 'LEMAC', f: lemac, unit: 'IN' },
    { k: 'MAC', label: 'MAC Length', f: mac, unit: 'IN' },
    { k: 'SAVE', label: 'Apply Profile ↵', f: null as any, unit: '' },
  ];

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    const line = LINE_KEYS[cursor]?.f;
    if (!line) return undefined;
    if (k === 'CLR') { line.clear(); return 'stop'; }
    if (k === 'BKSP') { line.backspace(); return 'stop'; }
    if (k === 'SIGN' && (LINE_KEYS[cursor].k === 'KF')) { line.toggleSign(); return 'stop'; }
    if (k === 'DOT' && (LINE_KEYS[cursor].k === 'KF' || LINE_KEYS[cursor].k === 'LEMAC' || LINE_KEYS[cursor].k === 'MAC')) { line.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { line.pushChar(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { line.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, dispatch, replaceTop, kf, bem, mom, lemac, mac], 12);

  useCx3OnEnter(() => {
    const k = LINE_KEYS[cursor]?.k;
    if (!k) return;
    if (k === 'SAVE') {
      const pft = data.aircraft.fuelType;
      const kfN = kf.toNum(), bemN = bem.toNum(), momN = mom.toNum();
      const lemN = lemac.toNum(), macN = mac.toNum();
      setAircraft({
        ...(isFinite(kfN) ? { kFactor: kfN } : {}),
        ...(isFinite(bemN) ? { basicEmptyLb: bemN } : {}),
        ...(isFinite(momN) ? { basicEmptyMoment: momN } : {}),
        ...(isFinite(lemN) ? { lemacIn: lemN } : {}),
        ...(isFinite(macN) ? { macLengthIn: macN } : {}),
        fuelType: pft, fuelLbPerGal: FUEL_DENSITY[pft],
      });
    } else if (k?.startsWith('FT_')) {
      const ft = k.slice(3) as FuelType;
      setAircraft({ fuelType: ft, fuelLbPerGal: FUEL_DENSITY[ft] });
    }
  });

  return (
    <div className="cx3-lcd-menu">
      {LINE_KEYS.map((lk, i) => {
        if (lk.k === 'SAVE') {
          return (
            <div key={lk.k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
              <Cx3Line label={lk.label} state={'input'} cursor={cursor === i} valueClass={'default'} />
            </div>
          );
        }
        if (lk.k.startsWith('FT_')) {
          const ft = lk.k.slice(3) as FuelType;
          const active = data.aircraft.fuelType === ft;
          return (
            <div key={lk.k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
              <Cx3Line label={lk.label}
                state={active ? 'calc' : 'unsolved'}
                cursor={cursor === i}
                valueClass={active ? 'green' : 'dashes'}
                valueDisplay={active ? '●' : ''} />
            </div>
          );
        }
        if (lk.k === 'FUEL_TYPE') {
          return (
            <div key={lk.k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
              <Cx3Line label={lk.label} state={'global'} cursor={cursor === i} valueClass={'default'} valueDisplay={'▼'} />
            </div>
          );
        }
        const f = lk.f;
        const disp = lk.k === 'KF' ? (f.isBlank ? '--' : formatNumber(f.toNum(), 2))
          : f.isBlank ? '--' : formatNumber(f.toNum(), 0);
        return (
          <div key={lk.k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
            <Cx3Line label={lk.label} unit={lk.unit}
              valueDisplay={disp}
              state={lineStateFrom(f)}
              cursor={cursor === i}
              valueClass={f.isBlank ? 'dashes' : 'default'} />
          </div>
        );
      })}
    </div>
  );
}
