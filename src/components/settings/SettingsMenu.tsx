import React from 'react';
import { useApp } from '../../context/AppContext';
import { Theme, UnitSystem } from '../../types';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'night', label: 'Night' },
  { id: 'daylight', label: 'Daylight' },
];

const UNIT_SYSTEMS: { id: UnitSystem; label: string }[] = [
  { id: 'imperial', label: 'Imperial (ft, kt, lb, gal)' },
  { id: 'metric', label: 'Metric (m, km/h, kg, L)' },
];

const TIMEZONES: string[] = (Intl as any).supportedValuesOf?.('timeZone')?.length
  ? (Intl as any).supportedValuesOf('timeZone')
  : [
    'UTC',
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
    'Europe/London', 'Europe/Paris', 'Europe/Frankfurt', 'Europe/Seoul',
    'Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
    'Australia/Sydney',
  ];

export default function SettingsMenu() {
  const { settings, setTheme, setUnitSystem, setTimeZone, toggleFavorite, isFavorite } = useApp();
  const favCount = settings.favorites.length;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Display</div>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-label">Theme</div>
          <select
            className="settings-select"
            value={settings.theme}
            onChange={e => setTheme(e.target.value as Theme)}
          >
            {THEMES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Default Units</div>
          <select
            className="settings-select"
            value={settings.unitSystem}
            onChange={e => setUnitSystem(e.target.value as UnitSystem)}
          >
            {UNIT_SYSTEMS.map(u => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Time Zone</div>
          <select
            className="settings-select"
            value={settings.timeZone}
            onChange={e => setTimeZone(e.target.value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Favorites ({favCount})</div>
      </div>
      <div className="settings-group">
        {favCount === 0 ? (
          <div className="settings-row" style={{ justifyContent: 'center', color: 'var(--text-secondary)' }}>
            No favorites yet — tap ⭐ in FLT menu
          </div>
        ) : (
          settings.favorites.map(fid => (
            <div key={fid} className="settings-row">
              <div className="settings-label">{fid}</div>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => toggleFavorite(fid)}
              >Remove</button>
            </div>
          ))
        )}
      </div>

      <div className="section-header">
        <div className="section-title">About</div>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-label">App</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
            FlightCal v1.0
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">Based on</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
            CX-3 E6B Style · FAA HOT 26-27
          </div>
        </div>
      </div>
    </div>
  );
}
