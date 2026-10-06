import { useCallback, useMemo, useState } from 'react';

export type FieldKind = 'int' | 'dec' | 'time' | 'text';
export type LineState = 'unsolved' | 'input' | 'calc' | 'global';

export interface BlankField {
  value: string;
  setValue: (v: string) => void;
  pushChar: (ch: string) => void;
  backspace: () => void;
  clear: () => void;
  toggleSign: () => void;
  toNum: () => number;
  isBlank: boolean;
  displayValue: string;
}

function stripLeadingZeros(s: string): string {
  if (s === '' || s === '-') return s;
  const neg = s.startsWith('-');
  let body = neg ? s.slice(1) : s;
  if (body.includes('.')) {
    body = body.replace(/^0+(?=\d)/, '') || '0';
  } else {
    body = body.replace(/^0+(?=\d)/, '') || '0';
  }
  return (neg ? '-' : '') + body;
}

function decOnlyFilter(v: string): string {
  let out = v.replace(/[^\d.\-]/g, '');
  const parts = out.split('.');
  if (parts.length > 2) out = parts[0] + '.' + parts.slice(1).join('');
  const neg = out.startsWith('-');
  const body = neg ? out.slice(1) : out;
  const minusIdx = body.indexOf('-');
  if (minusIdx !== -1) out = (neg ? '-' : '') + body.slice(0, minusIdx);
  return out;
}

function intOnlyFilter(v: string): string {
  const neg = v.startsWith('-');
  let body = (neg ? v.slice(1) : v).replace(/[^\d]/g, '');
  return (neg && body ? '-' : '') + body;
}

function timeOnlyFilter(v: string): string {
  return v.replace(/[^\d:]/g, '').slice(0, 8);
}

export function useBlankField(kind: FieldKind = 'dec', initialValue = ''): BlankField {
  const [raw, setRaw] = useState<string>(initialValue);

  const filter = useMemo(() => {
    switch (kind) {
      case 'int': return intOnlyFilter;
      case 'time': return timeOnlyFilter;
      case 'text': return (v: string) => v;
      case 'dec':
      default: return decOnlyFilter;
    }
  }, [kind]);

  const setValue = useCallback((v: string) => {
    setRaw(prev => {
      const cleaned = filter(v);
      if (kind !== 'time') return stripLeadingZeros(cleaned);
      return cleaned;
    });
  }, [filter, kind]);

  const pushChar = useCallback((ch: string) => {
    setRaw(prev => {
      let next: string;
      if (kind === 'time') {
        next = (prev + ch).replace(/[^\d:]/g, '').slice(0, 8);
        return next;
      }
      if (ch === '.' && prev.includes('.')) return prev;
      const candidate = prev + ch;
      return stripLeadingZeros(filter(candidate));
    });
  }, [filter, kind]);

  const backspace = useCallback(() => {
    setRaw(prev => prev.length <= 1 ? '' : prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => setRaw(''), []);

  const toggleSign = useCallback(() => {
    if (kind === 'time') return;
    setRaw(prev => {
      if (!prev || prev === '0') return prev;
      return prev.startsWith('-') ? prev.slice(1) : `-${prev}`;
    });
  }, [kind]);

  const toNum = useCallback((): number => {
    if (!raw) return NaN;
    if (kind === 'time') {
      if (raw.includes(':')) {
        const parts = raw.split(':').map(Number);
        // CX-3: 콜론이 모자라면 왼쪽(시)부터 채움. 10:00 → 00:10:00 (10분), 1:00:00 → 1시간
        while (parts.length < 3) parts.unshift(0);
        const [h, m, s] = parts;
        return (isFinite(h) ? h : 0) * 3600 + (isFinite(m) ? Math.min(59, Math.max(0, m)) : 0) * 60 + (isFinite(s) ? Math.min(59, Math.max(0, s)) : 0);
      }
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 0) return 0;
      let s = 0, m = 0, h = 0;
      if (digits.length <= 2) {
        s = Number(digits);
      } else if (digits.length <= 4) {
        s = Number(digits.slice(-2));
        m = Number(digits.slice(0, -2));
      } else {
        s = Number(digits.slice(-2));
        m = Number(digits.slice(-4, -2));
        h = Number(digits.slice(0, -4));
      }
      return h * 3600 + Math.min(59, m) * 60 + Math.min(59, s);
    }
    return Number(raw);
  }, [raw, kind]);

  const isBlank = raw === '' || raw === '-';

  const displayValue = useMemo(() => {
    if (isBlank) return '--';
    if (kind !== 'time') return raw;
    if (raw.includes(':')) {
      const parts = raw.split(':');
      while (parts.length < 3) parts.unshift('00');
      const pad = (p: string) => (p.length <= 1 ? `0${p}` : p).slice(-2);
      const hhRaw = parts[0].replace(/^0+(?=\d)/, '') || '0';
      const hh = hhRaw.length > 2 ? hhRaw : pad(parts[0]);
      const mm = pad(parts[1]);
      const ss = pad(parts[2]);
      return `${hh}:${mm}:${ss}`;
    }
    const total = toNum();
    if (!isFinite(total)) return '--';
    return formatHMS(total);
  }, [raw, isBlank, kind, toNum]);

  return { value: raw, setValue, pushChar, backspace, clear, toggleSign, toNum, isBlank, displayValue };
}

export function lineStateFrom(field: BlankField, override?: LineState): LineState {
  if (override) return override;
  if (!field.isBlank) return 'input';
  return 'unsolved';
}

export function formatNumber(n: number, digits = 2): string {
  if (!isFinite(n)) return '--';
  if (digits <= 0) return `${Math.round(n)}`;
  const s = n.toFixed(digits);
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '') || '0';
}

export function formatHMS(totalSeconds: number): string {
  if (!isFinite(totalSeconds)) return '--:--:--';
  const sign = totalSeconds < 0 ? '-' : '';
  let t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600); t -= h * 3600;
  const m = Math.floor(t / 60); t -= m * 60;
  const s = Math.floor(t);
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}
