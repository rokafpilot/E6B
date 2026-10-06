import React, { useState, useMemo } from 'react';
import { windCorrection, windComponents } from '../../lib/flightCalc';

type WindMode = 'wind_corr' | 'wind_comp' | 'wind_rev';

function toNum(s: string | number | undefined): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (s == null || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default function WindCalculator({ mode, onBack }: { mode: WindMode; onBack: () => void }) {
  const [tc, setTc] = useState<string>('90');
  const [tas, setTas] = useState<string>('120');
  const [wd, setWd] = useState<string>('270');
  const [ws, setWs] = useState<string>('20');
  const [rwy, setRwy] = useState<string>('90');

  const tcN = toNum(tc), tasN = toNum(tas), wdN = toNum(wd), wsN = toNum(ws), rwyN = toNum(rwy);

  const title = mode === 'wind_corr' ? 'Wind Correction' : mode === 'wind_comp' ? 'Wind Components' : 'Reverse Wind';
  const corr = useMemo(() => windCorrection({ tasKt: tasN, trueCourseDeg: tcN, windDirectionDeg: wdN, windSpeedKt: wsN }), [tasN, tcN, wdN, wsN]);
  const comp = useMemo(() => windComponents({ runwayHeadingDeg: rwyN, windDirectionDeg: wdN, windSpeedKt: wsN }), [rwyN, wdN, wsN]);

  const numOnly = (v: string) => v.replace(/[^\d]/g, '');
  const decOnly = (v: string) => v.replace(/[^\d.-]/g, '');

  return (
    <div className="calc-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title">{title}</div>
      </div>

      {mode === 'wind_corr' && (
        <>
          <div className="input-group">
            <div className="input-row">
              <div className="input-label">True Course (TC)</div>
              <div className="input-field">
                <input type="text" inputMode="numeric" placeholder="000 ~ 359" value={tc} onChange={e => setTc(numOnly(e.target.value))} />
              </div>
              <div className="result-unit">°</div>
            </div>
            <div className="input-row">
              <div className="input-label">TAS</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 120)" value={tas} onChange={e => setTas(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">kt</div>
            </div>
            <div className="input-row">
              <div className="input-label">Wind Direction</div>
              <div className="input-field">
                <input type="text" inputMode="numeric" placeholder="000 ~ 359" value={wd} onChange={e => setWd(numOnly(e.target.value))} />
              </div>
              <div className="result-unit">°</div>
            </div>
            <div className="input-row">
              <div className="input-label">Wind Speed</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 20)" value={ws} onChange={e => setWs(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">kt</div>
            </div>
          </div>

          <div className="input-group">
            <div className="section-title" style={{ marginBottom: 12 }}>Results</div>
            <div className="result-row">
              <div className="result-label">True Heading (TH)</div>
              <div className="result-value">{String(corr.trueHeadingDeg).padStart(3, '0')}°</div>
              <div className="result-unit">{corr.drift === 'L' ? 'WCA Left' : 'WCA Right'}</div>
            </div>
            <div className="result-row">
              <div className="result-label">WCA</div>
              <div className="result-value">{corr.windCorrectionAngleDeg > 0 ? '+' : ''}{corr.windCorrectionAngleDeg}</div>
              <div className="result-unit">°</div>
            </div>
            <div className="result-row">
              <div className="result-label">Groundspeed (GS)</div>
              <div className="result-value">{corr.groundspeedKt}</div>
              <div className="result-unit">kt</div>
            </div>
          </div>
        </>
      )}

      {mode === 'wind_comp' && (
        <>
          <div className="input-group">
            <div className="input-row">
              <div className="input-label">Runway Heading</div>
              <div className="input-field">
                <input type="text" inputMode="numeric" placeholder="000 ~ 359" value={rwy} onChange={e => setRwy(numOnly(e.target.value))} />
              </div>
              <div className="result-unit">°</div>
            </div>
            <div className="input-row">
              <div className="input-label">Wind Direction</div>
              <div className="input-field">
                <input type="text" inputMode="numeric" placeholder="000 ~ 359" value={wd} onChange={e => setWd(numOnly(e.target.value))} />
              </div>
              <div className="result-unit">°</div>
            </div>
            <div className="input-row">
              <div className="input-label">Wind Speed</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 20)" value={ws} onChange={e => setWs(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">kt</div>
            </div>
          </div>

          <div className="input-group">
            <div className="section-title" style={{ marginBottom: 12 }}>Components</div>
            <div className="result-row">
              <div className="result-label">Headwind</div>
              <div className="result-value">{comp.headwindKt}</div>
              <div className="result-unit">kt</div>
            </div>
            <div className="result-row">
              <div className="result-label">Tailwind</div>
              <div className="result-value">{comp.tailwindKt}</div>
              <div className="result-unit">kt</div>
            </div>
            <div className="result-row">
              <div className="result-label">Crosswind</div>
              <div className="result-value">{comp.crosswindKt}</div>
              <div className="result-unit">kt {comp.crosswindSide}</div>
            </div>
          </div>
        </>
      )}

      {mode === 'wind_rev' && (
        <div className="input-group">
          <div className="empty-state">
            <div className="empty-title">Reverse Wind</div>
            <div className="empty-desc">
              역바람 계산 기능은 차후 업데이트됩니다.<br/>
              (TH, TAS, TC, GS → Wind 방향/속도 계산)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
