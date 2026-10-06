import React, { useEffect, useMemo, useState } from 'react';
import Cx3Line, { Cx3LineIcon } from '../common/Cx3Line';
import PopupSelect, { type PopupOption } from '../common/PopupSelect';
import { useBlankField, formatNumber } from '../../hooks/useBlankField';
import { useCalcResult } from '../../context/CalcResultContext';
import {
  CURRENCIES, CURRENCY_CODES,
  convertCurrency, currencyInfo, formatCurrency, loadRates, latestSnapshot,
  type RateCache, ratesStatus, type CurrencyCode,
} from '../../utils/exchangeRate';
import { useCx3Nav, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import RateChart from './RateChart';

type LineIdx = 0 | 1 | 2 | 3 | 4;
type PopupTarget = 'from' | 'to' | null;

export default function CurrencyConverterScreen() {
  const { top } = useCx3Router();
  void top;

  const N_LINES = 5 as const;
  const { cursor, dispatch } = useCx3Nav(N_LINES);
  const val = useBlankField('dec', '1');
  const [fromIdx, setFromIdx] = useState<number>(CURRENCY_CODES.indexOf('USD'));
  const [toIdx, setToIdx] = useState<number>(CURRENCY_CODES.indexOf('KRW'));
  const [snap, setSnap] = useState<RateCache>(() => latestSnapshot());
  const [fetching, setFetching] = useState(false);
  const [popupTarget, setPopupTarget] = useState<PopupTarget>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const { consumeLastResult } = useCalcResult();

  useEffect(() => {
    let alive = true;
    setFetching(true);
    loadRates(false).then(r => { if (alive) { setSnap(r); setFetching(false); } });
    const calcResult = consumeLastResult();
    if (calcResult !== null) {
      val.setValue(calcResult);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyOptions = useMemo<PopupOption<string>[]>(() =>
    CURRENCIES.map((c) => ({
      id: c.code,
      label: c.name,
      unit: c.code,
    })), []);

  const converted = useMemo(() => {
    const v = val.toNum();
    if (!isFinite(v)) return NaN;
    const fc = CURRENCIES[fromIdx].code, tc = CURRENCIES[toIdx].code;
    return convertCurrency(v, fc, tc, snap);
  }, [val.value, fromIdx, toIdx, snap]);

  const openPopup = (target: 'from' | 'to') => setPopupTarget(target);
  const closePopup = () => setPopupTarget(null);
  const swapCurrencies = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };
  const onSelectCurrency = (code: string) => {
    const i = CURRENCIES.findIndex(c => c.code === code);
    if (i < 0) { closePopup(); return; }
    if (popupTarget === 'from') {
      if (i !== toIdx) setFromIdx(i); else setFromIdx(i === 0 ? 1 : 0);
    } else if (popupTarget === 'to') {
      if (i !== fromIdx) setToIdx(i); else setToIdx(i === 0 ? 1 : 0);
    }
    closePopup();
  };

  useOnCx3Key((k: Cx3KeyId) => {
    // 그래프 화면: BACK 계열 키를 누르면 닫기
    if (chartOpen) {
      if (k === 'BACK' || k === 'CLR' || k === 'EQU' || k === 'POWER' || k === 'CONVU') {
        setChartOpen(false);
        return 'stop';
      }
      return undefined;
    }
    if (popupTarget !== null) return undefined;
    if (k === 'BACK') { return undefined; }
    if (k === 'CONVU') {
      if (cursor === 1) { openPopup('from'); return 'stop'; }
      if (cursor === 2) { openPopup('to'); return 'stop'; }
    }
    if (k === 'CLR' && cursor === 0) { val.clear(); return 'stop'; }
    if (k === 'BKSP' && cursor === 0) { val.backspace(); return 'stop'; }
    if (k === 'SIGN' && cursor === 0) { return 'stop'; }
    if (k === 'DOT' && cursor === 0) { val.pushChar('.'); return 'stop'; }
    const ch = keyIdToChar(k);
    if (cursor === 0 && ch && /[0-9]/.test(ch)) { val.pushChar(ch); return 'stop'; }
    if (cursor === 0 && NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { val.pushChar(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, val, fromIdx, toIdx, popupTarget, chartOpen], 12);

  const fc = CURRENCIES[fromIdx];
  const tc = CURRENCIES[toIdx];
  const pairRate = useMemo(() => {
    const rBase = snap.rates[fc.code];
    const rTo = snap.rates[tc.code];
    if (typeof rBase !== 'number' || typeof rTo !== 'number' || rBase <= 0) return NaN;
    return rTo / rBase;
  }, [snap.rates, fc.code, tc.code]);

  const rateDisp = useMemo(
    () => (isFinite(pairRate) ? `1 ${fc.code} = ${formatNumber(pairRate, 4)} ${tc.code}` : '--'),
    [pairRate, fc.code, tc.code],
  );

  const upd = useMemo(() => {
    if (fetching) return { text: 'UPDATING…', color: '#ffaa00', tier: 'default' as const };
    const s = ratesStatus(snap);
    const color =
      s.tier === 'live' ? '#00ff66' :
      s.tier === 'stored' ? '#ffaa00' :
      '#ff5555';
    return { text: s.text, color, tier: s.tier };
  }, [snap, fetching]);

  const fromInfo = currencyInfo(fc.code);
  const toInfo = currencyInfo(tc.code);
  const amtNum = val.toNum();
  const fromDisp = isFinite(amtNum) ? formatCurrency(amtNum, fromInfo, 2) : (val.displayValue || '--');
  const toDisp = isFinite(converted) ? formatCurrency(converted, toInfo, 2) : '--';

  const LINE_STATE: ('input' | 'unsolved' | 'calc' | 'global')[] = ['input', 'input', 'input', 'calc', 'global'];

  const clickRow = (idx: LineIdx) => {
    dispatch({ type: 'SET_CURSOR', idx });
    if (idx === 1) openPopup('from');
    else if (idx === 2) openPopup('to');
  };

  return (
    <>
      <div className="cx3-lcd-menu">
        <div onClick={() => clickRow(0)}>
          <Cx3Line
            label={'Amount'}
            valueDisplay={fromDisp}
            unit={fromInfo.code}
            state={LINE_STATE[0]}
            cursor={cursor === 0}
            valueClass={val.isBlank ? 'dashes' : 'default'}
          />
        </div>
        <div onClick={() => clickRow(1)}>
          <Cx3Line
            label={'SET FROM'}
            valueDisplay={fromInfo.code}
            unit={fromInfo.name}
            state={LINE_STATE[1]}
            cursor={cursor === 1}
            valueClass={'default'}
          />
        </div>
        <div className="curr-swap-row">
          <button
            type="button"
            className="curr-swap-button"
            aria-label="Swap source and target currencies"
            title="Swap currencies"
            onClick={swapCurrencies}
          >
            ⇄
          </button>
        </div>
        <div onClick={() => clickRow(2)}>
          <Cx3Line
            label={'CONV TO'}
            valueDisplay={toInfo.code}
            unit={toInfo.name}
            state={LINE_STATE[2]}
            cursor={cursor === 2}
            valueClass={'default'}
          />
        </div>
        <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 3 })}>
          <div className={`cx3-menu-line ${cursor === 3 ? 'cursor' : ''}`} role="button">
            <Cx3LineIcon state={LINE_STATE[3] as 'calc'} />
            <span className="cx3-menu-label">{'Result'}</span>
            <span
              className="cx3-menu-value-wrap"
              style={{ textAlign: 'right', alignItems: 'baseline' }}
            >
              <span
                className={`cx3-menu-value ${isFinite(converted) ? 'green curr-result-big' : 'dashes'}`}
                style={{ fontSize: 16, letterSpacing: 0.1 }}
              >
                {toDisp}
              </span>
              {toInfo.code ? <span className="cx3-menu-unit" style={{ fontSize: 13 }}>{toInfo.code}</span> : null}
            </span>
          </div>
        </div>
        <div
          onClick={() => { dispatch({ type: 'SET_CURSOR', idx: 4 }); setChartOpen(true); }}
          style={{ cursor: 'pointer' }}
        >
          <div className={`cx3-menu-line cx3-menu-line-sub ${cursor === 4 ? 'cursor' : ''}`}>
            <Cx3LineIcon state={LINE_STATE[4] as 'global'} />
            <span
              className="cx3-menu-label cx3-menu-label-small"
              style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.95 }}
            >
              {'Rate'}
            </span>
            <span className="cx3-menu-value-wrap" style={{ textAlign: 'right', lineHeight: 1.15 }}>
              <div style={{ fontSize: 11.5, opacity: 0.9, lineHeight: 1.2 }}>{rateDisp}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: upd.color,
                  letterSpacing: 0.2,
                  lineHeight: 1.2,
                  marginTop: 1,
                }}
              >
                {upd.text}
              </div>
            </span>
          </div>
        </div>
      </div>

      <PopupSelect<string>
        open={popupTarget !== null}
        title={popupTarget === 'from' ? 'SET FROM Currency' : popupTarget === 'to' ? 'CONV TO Currency' : ''}
        options={currencyOptions}
        selectedId={
          popupTarget === 'from' ? (fc.code as CurrencyCode) :
          popupTarget === 'to'   ? (tc.code as CurrencyCode) :
          undefined
        }
        onClose={closePopup}
        onSelect={onSelectCurrency}
      />

      {chartOpen ? (
        <RateChart
          from={fc.code}
          to={tc.code}
          current={pairRate}
          pairLabel={rateDisp}
          onClose={() => setChartOpen(false)}
        />
      ) : null}
    </>
  );
}
