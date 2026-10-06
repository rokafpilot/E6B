import React, { useMemo, useState, useEffect } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useBlankField, formatNumber, lineStateFrom } from '../../hooks/useBlankField';
import { calculateAltitude } from '../../lib/flightCalc';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings, type UnitSystem } from '../../context/Cx3SettingsContext';

type AltFieldKey = 'IALT' | 'BARO' | 'OAT' | 'PALT' | 'DALT';

const LINES: AltFieldKey[] = ['IALT', 'BARO', 'OAT', 'PALT', 'DALT'];
const LABELS: Record<AltFieldKey, string> = {
  IALT: 'IAlt',
  BARO: 'Baro',
  OAT: 'OAT',
  PALT: 'PAlt',
  DALT: 'DAlt',
};

const fToC = (f: number): number => (f - 32) * 5 / 9;
const cToF = (c: number): number => (c * 9 / 5) + 32;
const inhgToHpa = (inHg: number): number => inHg * 33.86389;
const hpaToInhg = (hpa: number): number => hpa / 33.86389;

type BaroUnit = 'inhg' | 'hpa';
type TempUnit = 'f' | 'c';

function initialBaroUnit(u: UnitSystem): BaroUnit { return 'hpa'; }
function initialOatUnit(u: UnitSystem): TempUnit { return 'c'; }
function initialBaroDefault(u: UnitSystem): string { return '1013.25'; }

export default function AltitudeScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);
  const { top } = useCx3Router();
  const { data } = useCx3Settings();

  const [baroUnit, setBaroUnit] = useState<BaroUnit>(() => initialBaroUnit(data.defaultUnits));
  const [oatUnit, setOatUnit] = useState<TempUnit>(() => initialOatUnit(data.defaultUnits));
  const [initialU, setInitialU] = useState<UnitSystem>(data.defaultUnits);

  useEffect(() => {
    if (initialU !== data.defaultUnits) {
      setInitialU(data.defaultUnits);
      setBaroUnit(initialBaroUnit(data.defaultUnits));
      setOatUnit(initialOatUnit(data.defaultUnits));
      baro.setValue(initialBaroDefault(data.defaultUnits));
      oat.clear();
    }
  }, [data.defaultUnits, initialU]);

  const ialt = useBlankField('int', '');
  const baro = useBlankField('dec', initialBaroDefault(data.defaultUnits));
  const oat  = useBlankField('dec', '');

  const fields: Record<'IALT'|'BARO'|'OAT', ReturnType<typeof useBlankField>> = {
    IALT: ialt, BARO: baro, OAT: oat,
  };

  const result = useMemo(() => {
    const i = ialt.toNum();
    const bRaw = baro.toNum();
    const oRaw = oat.toNum();
    if (!isFinite(i) || !isFinite(bRaw)) return null;
    const bInHg = baroUnit === 'inhg' ? bRaw : hpaToInhg(bRaw);
    const oC = !isFinite(oRaw) ? 15 : (oatUnit === 'c' ? oRaw : fToC(oRaw));
    return calculateAltitude({
      fieldElevationFt: i,
      altimeterSettingInHg: bInHg,
      oatC: oC,
    });
  }, [ialt, baro, oat, baroUnit, oatUnit]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') {
      const { replaceTop } = useCx3Router();
      replaceTop('FLT_MAIN', 'E6-B');
      return 'stop';
    }
    const key = LINES[cursor];
    if (!key || key === 'PALT' || key === 'DALT') return undefined;
    const f = fields[key as 'IALT'|'BARO'|'OAT'];

    if (key === 'BARO' && (k === 'SETU' || k === 'CONVU')) {
      const curNum = baro.toNum();
      if (isFinite(curNum)) {
        if (baroUnit === 'inhg') { baro.setValue(formatNumber(inhgToHpa(curNum), 2)); setBaroUnit('hpa'); }
        else { baro.setValue(formatNumber(hpaToInhg(curNum), 2)); setBaroUnit('inhg'); }
      } else {
        setBaroUnit(u => u === 'inhg' ? 'hpa' : 'inhg');
        baro.setValue(initialBaroDefault(data.defaultUnits));
      }
      return 'stop';
    }
    if (key === 'OAT' && (k === 'SETU' || k === 'CONVU')) {
      const curNum = oat.toNum();
      if (isFinite(curNum)) {
        if (oatUnit === 'f') { oat.setValue(formatNumber(fToC(curNum), 1)); setOatUnit('c'); }
        else { oat.setValue(formatNumber(cToF(curNum), 0)); setOatUnit('f'); }
      } else {
        setOatUnit(u => u === 'f' ? 'c' : 'f');
      }
      return 'stop';
    }

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
  }, [cursor, ialt, baro, oat, baroUnit, oatUnit], 12);

  useCx3OnEnter(() => {
    dispatch({ type: 'NAV', delta: 1 });
  });

  const paltDisp = result ? formatNumber(Math.round(result.pressureAltitudeFt), 0) : '--';
  const daltDisp = result && isFinite(oat.toNum()) ? formatNumber(Math.round(result.densityAltitudeFt), 0) : '--';
  const baroUnitLabel = baroUnit === 'inhg' ? 'IN HG' : 'HPA';
  const oatUnitLabel = oatUnit === 'f' ? '°F' : '°C';
  void top;

  return (
    <div className="cx3-lcd-menu">
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 0 })}>
        <Cx3Line label={LABELS.IALT} valueDisplay={ialt.displayValue} unit="FT"
          state={lineStateFrom(ialt)} cursor={cursor === 0}
          valueClass={ialt.isBlank ? 'dashes' : 'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 1 })}>
        <Cx3Line label={LABELS.BARO} valueDisplay={baro.displayValue} unit={baroUnitLabel}
          state={lineStateFrom(baro)} cursor={cursor === 1}
          valueClass={baro.isBlank ? 'dashes' : 'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 2 })}>
        <Cx3Line label={LABELS.OAT} valueDisplay={oat.displayValue} unit={oatUnitLabel}
          state={lineStateFrom(oat)} cursor={cursor === 2}
          valueClass={oat.isBlank ? 'dashes' : 'default'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 3 })}>
        <Cx3Line label={LABELS.PALT} valueDisplay={paltDisp} unit="FT"
          state={result ? 'calc' : 'unsolved'} cursor={cursor === 3}
          valueClass={result ? 'green' : 'dashes'} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 4 })}>
        <Cx3Line label={LABELS.DALT} valueDisplay={daltDisp || '--'} unit="FT"
          state={(result && isFinite(oat.toNum())) ? 'calc' : 'unsolved'} cursor={cursor === 4}
          valueClass={(result && isFinite(oat.toNum())) ? 'green' : 'dashes'} />
      </div>
    </div>
  );
}

