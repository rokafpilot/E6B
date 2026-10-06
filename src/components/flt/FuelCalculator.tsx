import React, { useState, useMemo } from 'react';
import { calculateFuel, glideDistance, climbDescent } from '../../lib/flightCalc';

type FuelMode = 'fuel' | 'glide' | 'climb';

function toNum(s: string | number | undefined): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (s == null || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const decOnly = (v: string) => v.replace(/[^\d.-]/g, '');

export default function FuelCalculator({ mode, onBack }: { mode: FuelMode; onBack: () => void }) {
  const title = mode === 'fuel' ? 'Fuel & Endurance' : mode === 'glide' ? 'Glide Performance' : 'Climb / Descent';

  const [gs, setGs] = useState<string>('120');
  const [dist, setDist] = useState<string>('240');
  const [timeHours, setTimeHours] = useState<string>('2');
  const [burnRate, setBurnRate] = useState<string>('10');
  const [fuelTotal, setFuelTotal] = useState<string>('30');

  const [glideRatio, setGlideRatio] = useState<string>('10');
  const [altLoss, setAltLoss] = useState<string>('5000');

  const [climbRate, setClimbRate] = useState<string>('500');
  const [altChange, setAltChange] = useState<string>('3000');
  const [climbTas, setClimbTas] = useState<string>('90');
  const [climbBurn, setClimbBurn] = useState<string>('8');

  const gsN = toNum(gs), distN = toNum(dist), timeN = toNum(timeHours), burnN = toNum(burnRate), fuelTotN = toNum(fuelTotal);
  const grN = toNum(glideRatio), altLN = toNum(altLoss);
  const crN = toNum(climbRate), altCN = toNum(altChange), cTasN = toNum(climbTas), cBurnN = toNum(climbBurn);

  const fuel = useMemo(() => calculateFuel({
    mode: 'fuel',
    groundspeedKt: gsN,
    distanceNm: distN,
    timeEnrouteH: timeN,
    fuelBurnRateGph: burnN,
    totalFuelGal: fuelTotN,
  }), [gsN, distN, timeN, burnN, fuelTotN]);

  const glide = useMemo(() => glideDistance({ glideRatio: grN, altitudeLossFt: altLN }), [grN, altLN]);
  const climb = useMemo(() => climbDescent({
    rateFpm: crN, altitudeChangeFt: altCN, tasKt: cTasN, fuelBurnRateGph: cBurnN,
  }), [crN, altCN, cTasN, cBurnN]);

  return (
    <div className="calc-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title">{title}</div>
      </div>

      {mode === 'fuel' && (
        <>
          <div className="input-group">
            <div className="input-row">
              <div className="input-label">Groundspeed</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 120)" value={gs} onChange={e => setGs(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">kt</div>
            </div>
            <div className="input-row">
              <div className="input-label">Distance</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 240)" value={dist} onChange={e => setDist(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">NM</div>
            </div>
            <div className="input-row">
              <div className="input-label">Time Enroute</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 2.5)" value={timeHours} onChange={e => setTimeHours(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">hrs</div>
            </div>
            <div className="input-row">
              <div className="input-label">Fuel Burn Rate</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 10)" value={burnRate} onChange={e => setBurnRate(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">gal/hr</div>
            </div>
            <div className="input-row">
              <div className="input-label">Total Fuel</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 30)" value={fuelTotal} onChange={e => setFuelTotal(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">gal</div>
            </div>
          </div>

          <div className="input-group">
            <div className="section-title" style={{ marginBottom: 12 }}>Results</div>
            {fuel.timeEnrouteStr && (
              <div className="result-row">
                <div className="result-label">Time Enroute</div>
                <div className="result-value">{fuel.timeEnrouteStr}</div>
                <div className="result-unit">hrs:min</div>
              </div>
            )}
            {fuel.groundspeedKt != null && (
              <div className="result-row">
                <div className="result-label">Groundspeed</div>
                <div className="result-value">{fuel.groundspeedKt}</div>
                <div className="result-unit">kt</div>
              </div>
            )}
            {fuel.distanceNm != null && (
              <div className="result-row">
                <div className="result-label">Distance</div>
                <div className="result-value">{fuel.distanceNm}</div>
                <div className="result-unit">NM</div>
              </div>
            )}
            {fuel.totalFuelGal != null && (
              <div className="result-row">
                <div className="result-label">Fuel Required</div>
                <div className="result-value">{fuel.totalFuelGal}</div>
                <div className="result-unit">gal</div>
              </div>
            )}
            {fuel.enduranceStr && (
              <div className="result-row">
                <div className="result-label">Endurance</div>
                <div className="result-value">{fuel.enduranceStr}</div>
                <div className="result-unit">hrs:min</div>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'glide' && (
        <>
          <div className="input-group">
            <div className="input-row">
              <div className="input-label">Glide Ratio</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 10)" value={glideRatio} onChange={e => setGlideRatio(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">:1</div>
            </div>
            <div className="input-row">
              <div className="input-label">Altitude Loss</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 5000)" value={altLoss} onChange={e => setAltLoss(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">ft</div>
            </div>
          </div>
          <div className="input-group">
            <div className="result-row">
              <div className="result-label">Glide Distance</div>
              <div className="result-value">{glide.distanceFt.toLocaleString()}</div>
              <div className="result-unit">ft</div>
            </div>
            <div className="result-row">
              <div className="result-label">Glide Distance</div>
              <div className="result-value">{glide.distanceNm}</div>
              <div className="result-unit">NM</div>
            </div>
            <div className="result-row">
              <div className="result-label">Glide Path Angle</div>
              <div className="result-value">{glide.glideAngleDeg}</div>
              <div className="result-unit">°</div>
            </div>
          </div>
        </>
      )}

      {mode === 'climb' && (
        <>
          <div className="input-group">
            <div className="input-row">
              <div className="input-label">Rate</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 500)" value={climbRate} onChange={e => setClimbRate(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">fpm</div>
            </div>
            <div className="input-row">
              <div className="input-label">Altitude Change</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 3000)" value={altChange} onChange={e => setAltChange(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">ft</div>
            </div>
            <div className="input-row">
              <div className="input-label">TAS</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 90)" value={climbTas} onChange={e => setClimbTas(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">kt</div>
            </div>
            <div className="input-row">
              <div className="input-label">Fuel Burn</div>
              <div className="input-field">
                <input type="text" inputMode="decimal" placeholder="(ex: 8)" value={climbBurn} onChange={e => setClimbBurn(decOnly(e.target.value))} />
              </div>
              <div className="result-unit">gal/hr</div>
            </div>
          </div>
          <div className="input-group">
            <div className="result-row">
              <div className="result-label">Time</div>
              <div className="result-value">{climb.timeStr}</div>
              <div className="result-unit">mm:ss</div>
            </div>
            <div className="result-row">
              <div className="result-label">Distance</div>
              <div className="result-value">{climb.distanceNm}</div>
              <div className="result-unit">NM</div>
            </div>
            {climb.fuelGal != null && (
              <div className="result-row">
                <div className="result-label">Fuel Used</div>
                <div className="result-value">{climb.fuelGal}</div>
                <div className="result-unit">gal</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
