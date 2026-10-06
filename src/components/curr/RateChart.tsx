import React, { useEffect, useMemo, useState } from 'react';
import { loadRateHistory, type CurrencyCode, type RatePoint } from '../../utils/exchangeRate';

const DAYS = 30;
/** viewBox(0 0 100 50) 안에서 선이 그려질 상·하한 */
const PLOT_TOP = 6;
const PLOT_BOTTOM = 44;

function decimalsFor(value: number) {
  const abs = Math.abs(value);
  return abs >= 100 ? 2 : abs >= 1 ? 3 : 5;
}

function fmt(value: number) {
  const dp = decimalsFor(value);
  return value.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function dayLabel(t: number) {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  from: CurrencyCode;
  to: CurrencyCode;
  /** 현재 환율 (마지막 점으로 연결) */
  current: number;
  /** "1 USD = 1,339.0047 KRW" 형태의 표시 문자열 */
  pairLabel: string;
  onClose: () => void;
}

export default function RateChart({ from, to, current, pairLabel, onClose }: Props) {
  const [points, setPoints] = useState<RatePoint[] | null>(null);
  const [source, setSource] = useState<'live' | 'local'>('live');

  useEffect(() => {
    let alive = true;
    setPoints(null);
    loadRateHistory(from, to, DAYS).then(result => {
      if (!alive) return;
      setSource(result.source);
      setPoints(result.points);
    });
    return () => { alive = false; };
  }, [from, to]);

  // 현재 환율을 마지막 점으로 이어 붙여 선이 "지금"까지 닿게 한다
  const series = useMemo(() => {
    const base = points ?? [];
    if (!isFinite(current) || current <= 0) return base;
    const last = base[base.length - 1];
    return last && Date.now() - last.t < 12 * 3600 * 1000 ? base : [...base, { t: Date.now(), v: current }];
  }, [points, current]);

  const chart = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map(p => p.v);
    const hi = Math.max(...values);
    const lo = Math.min(...values);
    const span = hi - lo;
    const coords = series.map((p, i) => {
      const x = (i / (series.length - 1)) * 100;
      const ratio = span > 0 ? (p.v - lo) / span : 0.5;
      return [x, PLOT_BOTTOM - ratio * (PLOT_BOTTOM - PLOT_TOP)] as const;
    });
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const first = series[0].v;
    const change = current - first;
    return {
      hi, lo, line,
      area: `${line} L100 50 L0 50 Z`,
      change,
      pct: first !== 0 ? (change / first) * 100 : 0,
    };
  }, [series, current]);

  const focus = isFinite(current) && current > 0 ? current : series[series.length - 1]?.v ?? NaN;

  return (
    <div className="cx3-ratechart">
      <div className="cx3-ratechart-head">
        <span className="cx3-ratechart-pair">{pairLabel}</span>
        <span className="cx3-ratechart-range">{DAYS}D</span>
      </div>

      {points === null ? (
        <div className="cx3-ratechart-msg">LOADING…</div>
      ) : chart === null ? (
        <div className="cx3-ratechart-msg">
          추이 데이터 없음 · {source === 'local' ? '오프라인' : 'API 응답 없음'}
        </div>
      ) : (
        <>
          <div className="cx3-ratechart-hero">
            <strong>{fmt(focus)}</strong>
            <em className={chart.change >= 0 ? 'up' : 'down'}>
              {chart.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(chart.change))} ({chart.pct >= 0 ? '+' : '−'}{Math.abs(chart.pct).toFixed(2)}%)
            </em>
          </div>

          <div className="cx3-ratechart-plot">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-label={`${from} to ${to} rate trend`}>
              <line className="cx3-ratechart-grid" x1="0" y1={PLOT_TOP} x2="100" y2={PLOT_TOP} />
              <line className="cx3-ratechart-grid" x1="0" y1={(PLOT_TOP + PLOT_BOTTOM) / 2} x2="100" y2={(PLOT_TOP + PLOT_BOTTOM) / 2} />
              <line className="cx3-ratechart-grid" x1="0" y1={PLOT_BOTTOM} x2="100" y2={PLOT_BOTTOM} />
              <path className="cx3-ratechart-area" d={chart.area} />
              <path className="cx3-ratechart-line" d={chart.line} />
            </svg>
            <span className="hi">{fmt(chart.hi)}</span>
            <span className="lo">{fmt(chart.lo)}</span>
          </div>

          <div className="cx3-ratechart-foot">
            <span>{dayLabel(series[0].t)}</span>
            <span className="src">{source === 'live' ? `ECB · ${DAYS}D` : `기기 기록 ${series.length}건`}</span>
            <span>{dayLabel(series[series.length - 1].t)}</span>
          </div>
        </>
      )}

      <button type="button" className="cx3-ratechart-close" onClick={onClose}>CLOSE<small>BACK</small></button>
    </div>
  );
}
