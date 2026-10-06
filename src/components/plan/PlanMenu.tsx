import React, { useState, useMemo } from 'react';
import type { FlightSegment } from '../../types';
import { calculateSegment, aggregateFlightPlan, etaCalc } from '../../lib/flightCalc';

const uid = () => Math.random().toString(36).slice(2, 9);

function toNum(s: string | number | undefined): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (s == null || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const numOnly = (v: string) => v.replace(/[^\d]/g, '');
const decOnly = (v: string) => v.replace(/[^\d.-]/g, '');

interface FlightSegmentStr {
  id: string;
  from: string;
  to: string;
  trueCourseDeg: string;
  distanceNm: string;
  altitudeFt: string;
  tasKt: string;
  windDirectionDeg: string;
  windSpeedKt: string;
  fuelBurnRateGph: string;
}

function emptySegmentStr(): FlightSegmentStr {
  return {
    id: uid(),
    from: '',
    to: '',
    trueCourseDeg: '',
    distanceNm: '',
    altitudeFt: '',
    tasKt: '120',
    windDirectionDeg: '',
    windSpeedKt: '',
    fuelBurnRateGph: '10',
  };
}

function toSegment(s: FlightSegmentStr): FlightSegment {
  return {
    id: s.id,
    from: s.from,
    to: s.to,
    trueCourseDeg: toNum(s.trueCourseDeg),
    distanceNm: toNum(s.distanceNm),
    altitudeFt: toNum(s.altitudeFt),
    tasKt: toNum(s.tasKt),
    windDirectionDeg: toNum(s.windDirectionDeg),
    windSpeedKt: toNum(s.windSpeedKt),
    fuelBurnRateGph: toNum(s.fuelBurnRateGph),
  };
}

function parseHHMMtoMin(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(':').map((v) => parseInt(v, 10));
  if (isNaN(h) || isNaN(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

export default function PlanMenu() {
  const [segments, setSegments] = useState<FlightSegmentStr[]>([
    {
      id: uid(),
      from: 'RKSI', to: 'RKSS',
      trueCourseDeg: '90', distanceNm: '30', altitudeFt: '5000',
      tasKt: '120', windDirectionDeg: '270', windSpeedKt: '20', fuelBurnRateGph: '10',
    },
    {
      id: uid(),
      from: 'RKSS', to: 'RKPK',
      trueCourseDeg: '180', distanceNm: '60', altitudeFt: '8000',
      tasKt: '140', windDirectionDeg: '180', windSpeedKt: '15', fuelBurnRateGph: '12',
    },
  ]);
  const [departureTime, setDepartureTime] = useState<string>('10:00');

  const numSegments = useMemo(() => segments.map(toSegment), [segments]);
  const totals = useMemo(() => aggregateFlightPlan(numSegments), [numSegments]);

  const eta = useMemo(() => {
    const depMin = parseHHMMtoMin(departureTime);
    return etaCalc({
      departureTimeMin: depMin,
      timeEnrouteMin: Math.round(totals.totalTimeMin),
    });
  }, [departureTime, totals.totalTimeMin]);

  function updateSegment(id: string, patch: Partial<FlightSegmentStr>) {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function addSegment() {
    setSegments((prev) => [...prev, emptySegmentStr()]);
  }

  function removeSegment(id: string) {
    setSegments((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Flight Plan</div>
        <div className="section-sub">
          세그먼트별 비행 계획 · 총 시간/연료 집계 · ETA
        </div>
      </div>

      <div className="input-row" style={{ gridTemplateColumns: '1fr' }}>
        <label className="input-label">
          <span>출발 시간 (HH:MM)</span>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="input-field"
          />
        </label>
      </div>

      <div className="stations-list">
        {segments.map((seg, idx) => {
          const r = calculateSegment(toSegment(seg));
          return (
            <div key={seg.id} className="station-card">
              <div className="station-header">
                <div className="station-title">Leg {idx + 1}</div>
                <button
                  className="btn-ghost"
                  onClick={() => removeSegment(seg.id)}
                  disabled={segments.length <= 1}
                >
                  삭제
                </button>
              </div>

              <div className="input-row">
                <label className="input-label">
                  <span>출발지 (FROM)</span>
                  <input
                    className="input-field"
                    value={seg.from}
                    onChange={(e) => updateSegment(seg.id, { from: e.target.value })}
                    placeholder="RKSI"
                  />
                </label>
                <label className="input-label">
                  <span>목적지 (TO)</span>
                  <input
                    className="input-field"
                    value={seg.to}
                    onChange={(e) => updateSegment(seg.id, { to: e.target.value })}
                    placeholder="RKSS"
                  />
                </label>
              </div>

              <div className="input-row">
                <label className="input-label">
                  <span>True Course (°)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input-field"
                    value={seg.trueCourseDeg}
                    onChange={(e) => updateSegment(seg.id, { trueCourseDeg: numOnly(e.target.value) })}
                  />
                </label>
                <label className="input-label">
                  <span>거리 (NM)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={seg.distanceNm}
                    onChange={(e) => updateSegment(seg.id, { distanceNm: decOnly(e.target.value) })}
                  />
                </label>
                <label className="input-label">
                  <span>고도 (ft)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={seg.altitudeFt}
                    onChange={(e) => updateSegment(seg.id, { altitudeFt: decOnly(e.target.value) })}
                  />
                </label>
              </div>

              <div className="input-row">
                <label className="input-label">
                  <span>TAS (kt)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={seg.tasKt}
                    onChange={(e) => updateSegment(seg.id, { tasKt: decOnly(e.target.value) })}
                  />
                </label>
                <label className="input-label">
                  <span>바람 방향 (°)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input-field"
                    value={seg.windDirectionDeg}
                    onChange={(e) => updateSegment(seg.id, { windDirectionDeg: numOnly(e.target.value) })}
                  />
                </label>
                <label className="input-label">
                  <span>바람 속도 (kt)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={seg.windSpeedKt}
                    onChange={(e) => updateSegment(seg.id, { windSpeedKt: decOnly(e.target.value) })}
                  />
                </label>
                <label className="input-label">
                  <span>연료 소모 (gal/h)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={seg.fuelBurnRateGph}
                    onChange={(e) => updateSegment(seg.id, { fuelBurnRateGph: decOnly(e.target.value) })}
                  />
                </label>
              </div>

              <div className="results-block">
                <div className="result-row">
                  <span>True Heading</span>
                  <span className="result-value">
                    {String(r.trueHeadingDeg).padStart(3, '0')}° ({r.drift})
                  </span>
                </div>
                <div className="result-row">
                  <span>Ground Speed</span>
                  <span className="result-value">{r.groundspeedKt} kt</span>
                </div>
                <div className="result-row">
                  <span>WCA</span>
                  <span className="result-value">{r.windCorrectionAngleDeg}°</span>
                </div>
                <div className="result-row">
                  <span>비행 시간</span>
                  <span className="result-value">{r.timeEnrouteStr}</span>
                </div>
                <div className="result-row">
                  <span>연료 소모</span>
                  <span className="result-value">{r.fuelGal} gal</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '16px 0 24px' }}>
        <button className="btn-primary" onClick={addSegment}>
          + 세그먼트 추가
        </button>
      </div>

      <div className="station-card">
        <div className="station-header">
          <div className="station-title">총합 (Totals)</div>
        </div>
        <div className="results-block">
          <div className="result-row">
            <span>총 Leg 수</span>
            <span className="result-value">{segments.length}</span>
          </div>
          <div className="result-row">
            <span>총 거리</span>
            <span className="result-value">{totals.totalDistanceNm} NM</span>
          </div>
          <div className="result-row">
            <span>총 비행 시간</span>
            <span className="result-value">{totals.totalTimeStr}</span>
          </div>
          <div className="result-row">
            <span>평균 Ground Speed</span>
            <span className="result-value">{totals.avgGroundspeedKt} kt</span>
          </div>
          <div className="result-row">
            <span>총 연료 소모</span>
            <span className="result-value">{totals.totalFuelGal} gal</span>
          </div>
          <div className="result-row" style={{ borderTop: '1px dashed var(--border)' }}>
            <span>ETA (예상 도착)</span>
            <span className="result-value" style={{ color: 'var(--accent)' }}>
              {eta.etaStr}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
