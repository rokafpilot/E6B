import React from 'react';
import { useApp } from '../../context/AppContext';
import { MenuId } from '../../types';
import FltMenu from '../flt/FltMenu';
import CalcMenu from '../calc/CalcMenu';
import HOTCalculatorScreen from '../hot/HOTCalculatorScreen';
import SettingsMenu from '../settings/SettingsMenu';
import HomeMenu from './HomeMenu';
import './MainLayout.css';

const MENUS: { id: MenuId; label: string; icon: string }[] = [
  { id: 'FLT', label: 'FLT', icon: '✈️' },
  { id: 'CONV', label: 'CONV', icon: '🔁' },
  { id: 'CURR', label: 'CURR', icon: '💱' },
  { id: 'CALC', label: 'CALC', icon: '🧮' },
  { id: 'HOT', label: 'HOT', icon: '🧊' },
];

export default function MainLayout() {
  const { currentMenu, setCurrentMenu } = useApp();

  const renderContent = () => {
    switch (currentMenu) {
      case 'HOME': return <HomeMenu />;
      case 'FLT': return <FltMenu />;
      case 'CONV': return <FltMenu />;
      case 'CURR': return <FltMenu />;
      case 'CALC': return <CalcMenu />;
      case 'HOT': return <HOTCalculatorScreen />;
      case 'SETTINGS': return <SettingsMenu />;
      default: return <HomeMenu />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <button
          className="home-btn"
          onClick={() => setCurrentMenu('HOME')}
          aria-label="Home"
        >
          SFC
        </button>
        <div className="menu-title">
          {currentMenu === 'HOME' ? 'HOME' : currentMenu === 'SETTINGS' ? 'SETTINGS' : (MENUS.find(m => m.id === currentMenu)?.label || '')}
        </div>
        <button
          className="settings-btn"
          onClick={() => setCurrentMenu('SETTINGS')}
          aria-label="Settings"
        >
          ⚙️
        </button>
      </header>

      <main className="app-content">
        {renderContent()}
      </main>

      <nav className="bottom-nav">
        {MENUS.map(menu => (
          <button
            key={menu.id}
            className={`nav-item ${currentMenu === menu.id ? 'active' : ''}`}
            onClick={() => setCurrentMenu(menu.id)}
          >
            <span className="nav-icon">{menu.icon}</span>
            <span className="nav-label">{menu.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
