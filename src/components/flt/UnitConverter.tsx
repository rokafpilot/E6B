import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, getUnitsByCategory, convertUnits, UnitCategory, UnitDefinition } from '../../utils/units';
import { useApp } from '../../context/AppContext';
import type { UnitSystem } from '../../types';

const DEFAULTS: Record<UnitSystem, Partial<Record<UnitCategory, [string, string]>>> = {
  imperial: {
    distance: ['ft', 'nm'],
    speed: ['kt', 'mph'],
    temperature: ['f', 'c'],
    pressure: ['inhg', 'psi'],
    volume: ['gal', 'usqt'],
    weight: ['lb', 'oz'],
    climbRate: ['fpm', 'mps'],
    climbAngle: ['deg', '%'],
  },
  metric: {
    distance: ['m', 'km'],
    speed: ['kmh', 'ms'],
    temperature: ['c', 'k'],
    pressure: ['hpa', 'mb'],
    volume: ['l', 'ml'],
    weight: ['kg', 'g'],
    climbRate: ['mps', 'fpm'],
    climbAngle: ['%', 'deg'],
  },
};

function pickDefault(cat: UnitCategory, system: UnitSystem): [string, string] {
  const us = getUnitsByCategory(cat);
  if (us.length === 0) return ['', ''];
  const pref = DEFAULTS[system]?.[cat];
  if (pref) {
    const [a, b] = pref;
    const va = us.find((u) => u.id === a) ? a : us[0].id;
    const vb = us.find((u) => u.id === b) ? b : us[Math.min(1, us.length - 1)].id;
    return [va, vb];
  }
  return [us[0].id, us[Math.min(1, us.length - 1)].id];
}

export default function UnitConverter({ onBack }: { onBack: () => void }) {
  const { settings } = useApp();
  const [category, setCategory] = useState<UnitCategory>('distance');
  const initial = pickDefault('distance', settings.unitSystem);
  const [fromUnit, setFromUnit] = useState<string>(initial[0]);
  const [toUnit, setToUnit] = useState<string>(initial[1]);
  const [value, setValue] = useState<number>(1);

  const units = useMemo<UnitDefinition[]>(() => getUnitsByCategory(category), [category]);

  const result = useMemo(() => {
    try {
      const r = convertUnits(value, fromUnit, toUnit);
      return Number.isFinite(r) ? r : NaN;
    } catch {
      return NaN;
    }
  }, [value, fromUnit, toUnit]);

  useEffect(() => {
    const [f, t] = pickDefault(category, settings.unitSystem);
    setFromUnit((prev) => (units.find((u) => u.id === prev) ? prev : f));
    setToUnit((prev) => (units.find((u) => u.id === prev) ? prev : t));
  }, [settings.unitSystem, category, units]);

  const handleCategoryChange = (c: UnitCategory) => {
    const us = getUnitsByCategory(c);
    const [f, t] = pickDefault(c, settings.unitSystem);
    setCategory(c);
    setFromUnit(us.find((u) => u.id === f) ? f : us[0].id);
    setToUnit(us.find((u) => u.id === t) ? t : us[Math.min(1, us.length - 1)].id);
  };

  return (
    <div className="calc-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title">Unit Conversion</div>
      </div>

      <div className="input-group">
        <div className="section-title" style={{ marginBottom: 12 }}>Category</div>
        <div className="menu-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 8 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className="menu-card"
              style={{ padding: 10, minHeight: 0, borderColor: category === c.id ? 'var(--accent)' : undefined }}
              onClick={() => handleCategoryChange(c.id)}
            >
              <div className="menu-card-title" style={{ fontSize: 12 }}>{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <div className="input-row">
          <div className="input-label">From</div>
          <div className="input-field">
            <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} />
            <select
              className="unit-select"
              value={fromUnit}
              onChange={e => setFromUnit(e.target.value)}
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="input-row">
          <div className="input-label">To</div>
          <div className="input-field">
            <input type="number" value={Number.isFinite(result) ? +result.toFixed(6) : ''} readOnly />
            <select
              className="unit-select"
              value={toUnit}
              onChange={e => setToUnit(e.target.value)}
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="input-group">
        <div className="result-row">
          <div className="result-label">Result</div>
          <div className="result-value">{Number.isFinite(result) ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</div>
          <div className="result-unit">{units.find(u => u.id === toUnit)?.symbol}</div>
        </div>
      </div>
    </div>
  );
}
