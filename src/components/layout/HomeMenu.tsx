import React from 'react';
import { useApp } from '../../context/AppContext';
import { FLT_FUNCTIONS } from '../flt/FltMenu';

export default function HomeMenu() {
  const { settings, setCurrentMenu, toggleFavorite, isFavorite } = useApp();
  const favorites = settings.favorites
    .map(id => FLT_FUNCTIONS.find(f => f.id === id))
    .filter(Boolean);

  return (
    <div>
      <div className="hero">
        <h1>FlightCal</h1>
        <p>Pilot-grade E6-B · HOT Calc · 14 FLT tools, offline-ready</p>
      </div>

      {favorites.length > 0 && (
        <>
          <div className="section-header">
            <div className="section-title">⭐ Favorites</div>
          </div>
          <div className="menu-grid" style={{ marginBottom: 24 }}>
            {favorites.map(f => f && (
              <button
                key={f.id}
                className="menu-card"
                onClick={() => setCurrentMenu('FLT')}
              >
                <div className="menu-card-title">
                  {f.name}
                  <button
                    className="fav-star"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(f.id); }}
                  >
                    ⭐
                  </button>
                </div>
                <div className="menu-card-desc">{f.description}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-header">
        <div className="section-title">Quick Start</div>
      </div>
      <div className="menu-grid">
        <button className="menu-card" onClick={() => setCurrentMenu('FLT')}>
          <div className="menu-card-title">✈️ FLT</div>
          <div className="menu-card-desc">E6-B calculations: altitude, wind, fuel, airspeed & more</div>
        </button>
        <button className="menu-card" onClick={() => setCurrentMenu('HOT')}>
          <div className="menu-card-title">🧊 HOT</div>
          <div className="menu-card-desc">Holdover Time Calculator, FAA 2026-27 DSHOT tables</div>
        </button>
        <button className="menu-card" onClick={() => setCurrentMenu('CONV')}>
          <div className="menu-card-title">🔁 CONV</div>
          <div className="menu-card-desc">Unit & Time Zone converters (7 categories)</div>
        </button>
        <button className="menu-card" onClick={() => setCurrentMenu('CURR')}>
          <div className="menu-card-title">💱 CURR</div>
          <div className="menu-card-desc">Real-time FX · 12 pilot currencies + 6 shortcuts</div>
        </button>
        <button className="menu-card" onClick={() => setCurrentMenu('CALC')}>
          <div className="menu-card-title">🧮 CALC</div>
          <div className="menu-card-desc">Basic calculator, memory, square root</div>
        </button>
        <button className="menu-card" onClick={() => setCurrentMenu('SETTINGS')}>
          <div className="menu-card-title">⚙️ SETTINGS</div>
          <div className="menu-card-desc">Themes, units, time zone</div>
        </button>
      </div>
    </div>
  );
}
