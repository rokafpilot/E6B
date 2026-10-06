import React from 'react';
import type { LineState } from '../../hooks/useBlankField';

interface IconProps { className?: string; size?: number }

export function IconCheckGreen({ className = '', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`cx3-icon green-check ${className}`} fill="none" aria-hidden>
      <path d="M5 12.5 l4 4 l10 -11" stroke="#00ff66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconEqGreen({ className = '', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`cx3-icon green-eq ${className}`} fill="none" aria-hidden>
      <line x1="5" y1="9"  x2="19" y2="9"  stroke="#00ff66" strokeWidth="3" strokeLinecap="round" />
      <line x1="5" y1="15" x2="19" y2="15" stroke="#00ff66" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function IconQAmber({ className = '', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`cx3-icon amber-q ${className}`} aria-hidden>
      <text x="12" y="18" textAnchor="middle" fontSize="18" fontWeight="900" fill="#ffaa00" fontFamily="monospace">?</text>
    </svg>
  );
}
export function IconDotBlue({ className = '', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`cx3-icon blue-dot ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="7" fill="#3399ff" />
    </svg>
  );
}

export function Cx3LineIcon({ state }: { state: LineState }) {
  if (state === 'input') return <IconCheckGreen />;
  if (state === 'calc') return <IconEqGreen />;
  if (state === 'global') return <IconDotBlue />;
  return null;
}

export interface Cx3LineProps {
  label: string;
  valueDisplay?: string;
  unit?: string;
  state?: LineState;
  cursor?: boolean;
  valueClass?: 'default' | 'green' | 'amber' | 'dashes';
  rightExtra?: React.ReactNode;
  onClick?: () => void;
  half?: 'bottom' | 'top';
}

export default function Cx3Line({
  label, valueDisplay = '--', unit, state = 'unsolved', cursor = false,
  valueClass, rightExtra, onClick, half,
}: Cx3LineProps) {
  const cls = valueClass
    ? valueClass
    : state === 'calc' ? 'green'
    : state === 'input' ? 'default'
    : 'dashes';
  const halfClass = half === 'bottom' ? 'half' : '';
  return (
    <div className={`cx3-menu-line ${cursor ? 'cursor' : ''} ${halfClass}`.trim()} onClick={onClick} role={onClick ? 'button' : undefined}>
      <Cx3LineIcon state={state} />
      <span className="cx3-menu-label">{label}</span>
      <span className="cx3-menu-value-wrap" style={{ textAlign: 'right' }}>
        <span className={`cx3-menu-value ${cls}`}>
          {valueDisplay}
        </span>
        {unit ? <span className="cx3-menu-unit">{unit}</span> : null}
        {rightExtra}
      </span>
    </div>
  );
}
