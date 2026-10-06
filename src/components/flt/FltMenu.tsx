import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FltFunction } from '../../types';
import AltitudeCalculator from './AltitudeCalculator';
import WindCalculator from './WindCalculator';
import UnitConverter from './UnitConverter';
import FuelCalculator from './FuelCalculator';

export const FLT_FUNCTIONS: FltFunction[] = [
  { id: 'altitude', name: 'Altitude', description: 'Pressure, Density, Cloud Base', category: 'altitude' },
  { id: 'std_atm', name: 'Std Atmosphere', description: 'ISA table by altitude', category: 'altitude' },
  { id: 'airspeed', name: 'Airspeed / Mach', description: 'CAS, TAS, Mach conversions', category: 'airspeed' },
  { id: 'fuel', name: 'Fuel / Endurance', description: 'Burn rate, time, groundspeed', category: 'fuel' },
  { id: 'glide', name: 'Glide', description: 'Glide distance & angle', category: 'fuel' },
  { id: 'climb', name: 'Climb / Descent', description: 'Time, distance, fuel', category: 'fuel' },
  { id: 'wind_comp', name: 'Wind Components', description: 'Headwind / Crosswind', category: 'wind' },
  { id: 'wind_corr', name: 'Wind Correction', description: 'TH, GS from TC, TAS, Wind', category: 'wind' },
  { id: 'wind_rev', name: 'Reverse Wind', description: 'Wind from TH, TAS, GS, TC', category: 'wind' },
  { id: 'eta', name: 'ETA', description: 'Estimated Time of Arrival', category: 'navigation' },
  { id: 'to_from', name: 'To / From', description: 'Bearing & distance', category: 'navigation' },
  { id: 'heading', name: 'Compass Heading', description: 'Magnetic variation', category: 'navigation' },
  { id: 'loxo', name: 'Rhumb Line', description: 'Loxodromic course', category: 'navigation' },
  { id: 'hold', name: 'Holding Pattern', description: 'Entry, leg time/distance', category: 'navigation' },
  { id: 'convert', name: 'Unit Conversion', description: '12 categories, 38 units', category: 'conversion' },
];

const CATEGORIES: { id: FltFunction['category']; label: string }[] = [
  { id: 'altitude', label: 'Altitude' },
  { id: 'airspeed', label: 'Airspeed' },
  { id: 'fuel', label: 'Fuel, Glide, Climb' },
  { id: 'wind', label: 'Wind' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'conversion', label: 'Utilities' },
];

export default function FltMenu() {
  const { toggleFavorite, isFavorite } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  if (selected === 'altitude') {
    return <AltitudeCalculator onBack={() => setSelected(null)} />;
  }
  if (selected === 'wind_corr' || selected === 'wind_comp' || selected === 'wind_rev') {
    return <WindCalculator mode={selected as any} onBack={() => setSelected(null)} />;
  }
  if (selected === 'convert') {
    return <UnitConverter onBack={() => setSelected(null)} />;
  }
  if (selected === 'fuel' || selected === 'glide' || selected === 'climb') {
    return <FuelCalculator mode={selected as any} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      {CATEGORIES.map(cat => {
        const items = FLT_FUNCTIONS.filter(f => f.category === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 20 }}>
            <div className="section-header">
              <div className="section-title">{cat.label}</div>
            </div>
            <div className="menu-grid">
              {items.map(f => (
                <button
                  key={f.id}
                  className="menu-card"
                  onClick={() => setSelected(f.id)}
                >
                  <div className="menu-card-title">
                    {f.name}
                    <button
                      className="fav-star"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(f.id); }}
                    >
                      {isFavorite(f.id) ? '⭐' : '☆'}
                    </button>
                  </div>
                  <div className="menu-card-desc">{f.description}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
