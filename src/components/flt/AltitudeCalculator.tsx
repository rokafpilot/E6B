import React, { useState, useMemo } from 'react';
import { calculateAltitude, standardAtmosphere } from '../../lib/flightCalc';
import { convertUnits } from '../../utils/units';

type PressUnit = 'inhg' | 'hpa';

function toNum(s: string | number | undefined): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (s == null || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default function AltitudeCalculator({ onBack }: { onBack: () => void }) {
  const [fieldElev, setFieldElev] = useState<string>('');
  const [altimeter, setAltimeter] = useState<string>('29.92');
  const [altimeterUnit, setAltimeterUnit] = useState<PressUnit>('inhg');
  const [oat, setOat] = useState<string>('15');
  const [dewPoint, setDewPoint] = useState<string>('10');

  const altimeterInHg = useMemo(() => {
    const value = toNum(altimeter);
    if (altimeterUnit === 'inhg') return value;
    return convertUnits(value, 'hpa', 'inhg');
  }, [altimeter, altimeterUnit]);

  const fieldElevN = toNum(fieldElev);
  const oatN = toNum(oat);
  const dewN = toNum(dewPoint);

  const alt = useMemo(() => calculateAltitude({
    fieldElevationFt: fieldElevN,
    altimeterSettingInHg: altimeterInHg,
    oatC: oatN,
    dewPointC: dewN,
  }), [fieldElevN, altimeterInHg, oatN, dewN]);

  const std = useMemo(() => standardAtmosphere(alt.pressureAltitudeFt), [alt.pressureAltitudeFt]);

  return (
    <div className="calc-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title">Altitude & Atmosphere</div>
      </div>

      <div className="input-group">
        <div className="input-row">
          <div className="input-label">Field Elevation</div>
          <div className="input-field">
            <input
              type="text"
              inputMode="decimal"
              placeholder="(ex: 1500)"
              value={fieldElev}
              onChange={e => setFieldElev(e.target.value.replace(/[^\d.-]/g, ''))}
            />
          </div>
          <div className="result-unit">ft</div>
        </div>

        <div className="input-row">
          <div className="input-label">Altimeter Setting</div>
          <div className="input-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="decimal"
              placeholder={altimeterUnit === 'inhg' ? '29.92' : '1013.25'}
              value={altimeter}
              onChange={e => setAltimeter(e.target.value.replace(/[^\d.]/g, ''))}
              style={{ flex: 1 }}
            />
            <div className="unit-toggle" role="radiogroup" aria-label="Pressure unit">
              <button
                type="button"
                className={altimeterUnit === 'inhg' ? 'unit-toggle-on' : 'unit-toggle-off'}
                onClick={() => {
                  const val = toNum(altimeter);
                  if (val > 0) {
                    const converted = altimeterUnit === 'inhg' ? convertUnits(val, 'inhg', 'hpa') : convertUnits(val, 'hpa', 'inhg');
                    setAltimeter(String(Math.round(converted * 100) / 100));
                  }
                  setAltimeterUnit('inhg');
                }}
              >inHg</button>
              <button
                type="button"
                className={altimeterUnit === 'hpa' ? 'unit-toggle-on' : 'unit-toggle-off'}
                onClick={() => {
                  const val = toNum(altimeter);
                  if (val > 0) {
                    const converted = altimeterUnit === 'inhg' ? convertUnits(val, 'inhg', 'hpa') : convertUnits(val, 'hpa', 'inhg');
                    setAltimeter(String(Math.round(converted * 100) / 100));
                  }
                  setAltimeterUnit('hpa');
                }}
              >hPa</button>
            </div>
          </div>
        </div>

        <div className="input-row">
          <div className="input-label">OAT</div>
          <div className="input-field">
            <input
              type="text"
              inputMode="decimal"
              placeholder="(ex: 25)"
              value={oat}
              onChange={e => setOat(e.target.value.replace(/[^\d.-]/g, ''))}
            />
          </div>
          <div className="result-unit">°C</div>
        </div>
        <div className="input-row">
          <div className="input-label">Dew Point</div>
          <div className="input-field">
            <input
              type="text"
              inputMode="decimal"
              placeholder="(ex: 10)"
              value={dewPoint}
              onChange={e => setDewPoint(e.target.value.replace(/[^\d.-]/g, ''))}
            />
          </div>
          <div className="result-unit">°C</div>
        </div>
      </div>

      <div className="input-group">
        <div className="section-title" style={{ marginBottom: 12 }}>Results</div>
        <div className="result-row">
          <div className="result-label">Pressure Altitude</div>
          <div className="result-value">{alt.pressureAltitudeFt.toLocaleString()}</div>
          <div className="result-unit">ft</div>
        </div>
        <div className="result-row">
          <div className="result-label">Density Altitude</div>
          <div className="result-value">{alt.densityAltitudeFt.toLocaleString()}</div>
          <div className="result-unit">ft</div>
        </div>
        <div className="result-row">
          <div className="result-label">ISA Temperature</div>
          <div className="result-value">{alt.standardTempC}</div>
          <div className="result-unit">°C (ISA {(oatN - alt.standardTempC) >= 0 ? '+' : ''}{(oatN - alt.standardTempC).toFixed(1)})</div>
        </div>
        <div className="result-row">
          <div className="result-label">Cloud Base (AGL)</div>
          <div className="result-value">{alt.cloudBaseFtAGL.toLocaleString()}</div>
          <div className="result-unit">ft</div>
        </div>
        <div className="result-row">
          <div className="result-label">Cloud Base (MSL)</div>
          <div className="result-value">{alt.cloudBaseFtMSL.toLocaleString()}</div>
          <div className="result-unit">ft</div>
        </div>
      </div>

      <div className="input-group">
        <div className="section-title" style={{ marginBottom: 12 }}>Standard Atmosphere @ {alt.pressureAltitudeFt.toLocaleString()} ft</div>
        <div className="result-row">
          <div className="result-label">Temp</div>
          <div className="result-value">{std.tempC}</div>
          <div className="result-unit">°C</div>
        </div>
        <div className="result-row">
          <div className="result-label">Pressure</div>
          <div className="result-value">{std.pressureInHg}</div>
          <div className="result-unit">inHg / {Math.round(convertUnits(std.pressureInHg, 'inhg', 'hpa') * 10) / 10} hPa</div>
        </div>
        <div className="result-row">
          <div className="result-label">Speed of Sound</div>
          <div className="result-value">{std.speedOfSoundKt}</div>
          <div className="result-unit">kt</div>
        </div>
      </div>
    </div>
  );
}
