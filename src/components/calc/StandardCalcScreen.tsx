import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Router } from '../../context/Cx3RouterContext';
import { useCalcResult } from '../../context/CalcResultContext';
import { formatHMS } from '../../hooks/useBlankField';

const MAX_INPUT_DIGITS = 15;
const MAX_HMS_DIGITS = 15;
const MAX_MULTIPLIER_DIGITS = 12;

type Op = '+' | '−' | '×' | '÷' | null;
type HistoryItem = { expr: string; result: string };
type AngleMode = 'DEG' | 'RAD' | 'HMS';

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function fmtComma(numStr: string): string {
  if (numStr === 'Error' || !numStr) return numStr;
  if (numStr.includes('e') || numStr.includes('E')) return numStr;
  const neg = numStr.startsWith('-');
  const body = neg ? numStr.slice(1) : numStr;
  const [intPart, decPart] = body.split('.');
  const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (decPart !== undefined ? `${withComma}.${decPart}` : withComma);
}

function fmt(v: number): string {
  if (!isFinite(v)) return 'Error';
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) {
    return v.toExponential(8).replace(/\.?0+e/, 'e').replace(/e\+?(-?\d+)$/, 'e$1');
  }
  const str = v.toPrecision(12);
  if (str.includes('e')) return str.replace(/\.?0+e/, 'e');
  const num = Number(str);
  let out = num.toString();
  const digits = out.replace(/[^\d]/g, '');
  if (digits.length > MAX_INPUT_DIGITS) {
    const scale = Math.pow(10, Math.max(0, MAX_INPUT_DIGITS - (out.split('.')[0] || '').replace(/[^\d]/g, '').length));
    out = (Math.round(num * scale) / scale).toString();
  }
  return out;
}

function toSec(s: string): number {
  if (!s || s === '-') return NaN;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  if (body.includes(':')) {
    const p = body.split(':').map(x => Number(x.replace(/\D/g, '') || '0'));
    while (p.length < 3) p.unshift(0);
    const [h, m, sc] = p;
    const t = (h || 0) * 3600 + Math.min(59, (m || 0)) * 60 + Math.min(59, (sc || 0));
    return neg ? -t : t;
  }
  const d = body.replace(/\D/g, '');
  if (!d) return 0;
  let sc = 0, m = 0, h = 0;
  if (d.length <= 2) sc = Number(d);
  else if (d.length <= 4) { sc = Number(d.slice(-2)); m = Number(d.slice(0, -2) || '0'); }
  else { sc = Number(d.slice(-2)); m = Number(d.slice(-4, -2) || '0'); h = Number(d.slice(0, -4) || '0'); }
  sc = Math.min(59, sc); m = Math.min(59, m);
  const t = h * 3600 + m * 60 + sc;
  return neg ? -t : t;
}

interface StandardCalcScreenProps {
  mode?: 'STANDARD' | 'SCIENTIFIC';
}

export default function StandardCalcScreen({ mode = 'STANDARD' }: StandardCalcScreenProps) {
  const { dispatch } = useCx3Router();
  const { cursor } = useCx3Nav(1);
  const { angleMode, setAngleMode, setLastResult } = useCalcResult();

  // ===== 공통 상태 =====
  const [display, setDisplay] = useState<string>('0');
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<Op>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(true);
  const [memory, setMemory] = useState<number>(0);
  const [pendingOp, setPendingOp] = useState<{ op: string; val: number } | null>(null);
  const [expression, setExpression] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [powerBase, setPowerBase] = useState<number | null>(null);
  const [rootIndex, setRootIndex] = useState<number | null>(null);
  const mainDisplayRef = useRef<HTMLDivElement>(null);
  const mainInnerRef = useRef<HTMLSpanElement>(null);
  const exprOuterRef = useRef<HTMLDivElement>(null);
  const exprInnerRef = useRef<HTMLSpanElement>(null);
  const [overflowScale, setOverflowScale] = useState<number>(1.0);
  const [exprOverflowScale, setExprOverflowScale] = useState<number>(1.0);

  // ===== HMS 상태 =====
  const [hmsInput, setHmsInput] = useState('');
  const [hmsPrevSec, setHmsPrevSec] = useState<number | null>(null);
  const [hmsOp, setHmsOp] = useState<Op>(null);
  const [hmsWfo, setHmsWfo] = useState(true);

  const pushHistory = (exprStr: string, resStr: string) => {
    setHistory(prev => {
      const next = [...prev, { expr: fmtComma(exprStr), result: fmtComma(resStr) }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
  };

  const displayIsBlank = display === '' || display === '-';
  const displayNum = useMemo(() => (displayIsBlank ? NaN : Number(display)), [display, displayIsBlank]);

  const cleanDecLike = (cand: string): string => {
    let out = cand.replace(/[^\d.\-]/g, '');
    const parts = out.split('.');
    if (parts.length > 2) out = parts[0] + '.' + parts.slice(1).join('');
    const neg = out.startsWith('-');
    let body = neg ? out.slice(1) : out;
    const minusIdx = body.indexOf('-');
    if (minusIdx !== -1) out = (neg ? '-' : '') + body.slice(0, minusIdx);
    if (body.includes('.')) body = body.replace(/^0+(?=\d)/, '') || '0';
    else body = body.replace(/^0+(?=\d)/, '') || '0';
    out = (neg ? '-' : '') + body;
    return out;
  };

  // ===== 표준 계산기 핸들러 =====
  const inputDigit = (d: string) => {
    setDisplay(prev => {
      const curDigits = prev.replace(/[^\d]/g, '').length;
      if (curDigits >= MAX_INPUT_DIGITS) return prev;
      if (waitingForOperand) { setWaitingForOperand(false); return d; }
      if (prev === '0') return d;
      return cleanDecLike(prev + d);
    });

    // Handle power and root operations
    if (powerBase !== null) {
      setPowerBase(null);
    }
    if (rootIndex !== null) {
      setRootIndex(null);
    }
  };

  const inputDot = () => {
    setDisplay(prev => {
      const curDigits = prev.replace(/[^\d]/g, '').length;
      if (curDigits >= MAX_INPUT_DIGITS) return prev;
      if (waitingForOperand) { setWaitingForOperand(false); return '0.'; }
      if (prev.includes('.')) return prev;
      return prev + '.';
    });

    // Handle power and root operations
    if (powerBase !== null) {
      setPowerBase(null);
    }
    if (rootIndex !== null) {
      setRootIndex(null);
    }
  };

  const clearAll = () => {
    setDisplay('0'); setPrevious(null); setOperator(null); setWaitingForOperand(true); setExpression('');
    setHmsInput(''); setHmsPrevSec(null); setHmsOp(null); setHmsWfo(true);
    setHistory([]);
    setPowerBase(null); setRootIndex(null);
  };

  const backspace = () => {
    setDisplay(prev => {
      if (!prev) return '0';
      const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
      if (next === '-') return '0';
      return next;
    });
  };

  const toggleSign = () => {
    setDisplay(prev => {
      if (!prev || prev === '0') return prev;
      return prev.startsWith('-') ? prev.slice(1) : `-${prev}`;
    });
  };

  const squareRoot = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v) || v < 0) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = Math.sqrt(v);
    const expr = `√${fmt(v)} =`;
    const result = fmt(r);
    setExpression(expr);
    setDisplay(result);
    setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(expr, result);
  };

  const performOp = (nextOp: Op) => {
    const input = displayIsBlank ? 0 : Number(display);
    if (previous === null) {
      setPrevious(input);
      setExpression(`${fmt(input)} ${nextOp}`);
    } else if (operator && !waitingForOperand) {
      const r = compute(previous, input, operator);
      setPrevious(r);
      setDisplay(fmt(r));
      setExpression(`${fmt(r)} ${nextOp}`);
    } else {
      setExpression(`${fmt(previous ?? input)} ${nextOp}`);
    }
    setOperator(nextOp);
    setWaitingForOperand(true);
  };

  const performEquals = () => {
    const input = displayIsBlank ? 0 : Number(display);
    
    // Handle power operation (yˣ)
    if (powerBase !== null) {
      const r = Math.pow(powerBase, input);
      const expr = `${fmt(powerBase)}ˣ${fmt(input)} =`;
      const result = fmt(r);
      setExpression(expr);
      setDisplay(result);
      setPowerBase(null);
      setWaitingForOperand(true);
      if (result !== 'Error') {
        pushHistory(expr, result);
        setLastResult(result);
      }
      return;
    }
    
    // Handle root operation (√x or ˣ√y)
    if (rootIndex !== null) {
      if (rootIndex % 2 === 0 && input < 0) {
        setDisplay('Error');
        setRootIndex(null);
        setWaitingForOperand(true);
        return;
      }
      const r = Math.pow(input, 1 / rootIndex);
      const expr = rootIndex === 2 ? `√${fmt(input)} =` : `${fmt(rootIndex)}√${fmt(input)} =`;
      const result = fmt(r);
      setExpression(expr);
      setDisplay(result);
      setRootIndex(null);
      setWaitingForOperand(true);
      if (result !== 'Error') {
        pushHistory(expr, result);
        setLastResult(result);
      }
      return;
    }
    
    if (operator !== null && previous !== null) {
      const r = compute(previous, input, operator);
      const expr = `${fmt(previous)} ${operator} ${fmt(input)} =`;
      const result = fmt(r);
      setExpression(expr);
      setDisplay(result);
      setPrevious(null); setOperator(null); setWaitingForOperand(true);
      if (result !== 'Error') {
        pushHistory(expr, result);
        setLastResult(result);
      }
    } else {
      setExpression(`${fmt(input)} =`);
      setWaitingForOperand(true);
    }
  };

  const mAdd = () => setMemory(m => m + (displayIsBlank ? 0 : Number(display)));
  const mSub = () => setMemory(m => m - (displayIsBlank ? 0 : Number(display)));
  const mRecall = () => { setDisplay(fmt(memory)); setWaitingForOperand(false); };
  const mClear = () => setMemory(0);

  // ===== Scientific functions =====
  const sciSin = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const rad = angleMode === 'DEG' ? (v * Math.PI / 180) : v;
    const r = Math.sin(rad);
    const exprStr = `sin(${fmt(v)})${angleMode === 'DEG' ? '°' : ''} =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciCos = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const rad = angleMode === 'DEG' ? (v * Math.PI / 180) : v;
    const r = Math.cos(rad);
    const exprStr = `cos(${fmt(v)})${angleMode === 'DEG' ? '°' : ''} =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciTan = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const rad = angleMode === 'DEG' ? (v * Math.PI / 180) : v;
    const r = Math.tan(rad);
    const exprStr = `tan(${fmt(v)})${angleMode === 'DEG' ? '°' : ''} =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciLn = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v) || v <= 0) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = Math.log(v);
    const exprStr = `ln(${fmt(v)}) =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciLog = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v) || v <= 0) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = Math.log10(v);
    const exprStr = `log(${fmt(v)}) =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciSquare = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = v * v;
    const exprStr = `${fmt(v)}² =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciInverse = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v) || v === 0) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = 1 / v;
    const exprStr = `1/${fmt(v)} =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciPi = () => {
    const exprStr = 'π =';
    const result = fmt(Math.PI);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciExp = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const r = Math.exp(v);
    const exprStr = `e^${fmt(v)} =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  const sciPower = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    setPowerBase(v);
    setExpression(`${fmt(v)}ˣ`);
    setDisplay('');
    setWaitingForOperand(true);
  };

  const sciRoot = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    setRootIndex(v);
    if (v === 2) {
      setExpression('√');
    } else {
      setExpression(`${fmt(v)}√`);
    }
    setDisplay('');
    setWaitingForOperand(true);
  };



  const sciPowerY = () => {
    const input = displayIsBlank ? 0 : Number(display);
    if (previous === null) {
      setPrevious(input);
      setExpression(`${fmt(input)} ʸ`);
      setPendingOp({ op: 'pow', val: input });
      setWaitingForOperand(true);
    }
  };

  const sciFactorial = () => {
    if (displayIsBlank) return;
    const v = Number(display);
    if (!isFinite(v) || v < 0 || !Number.isInteger(v)) { setDisplay('Error'); setWaitingForOperand(true); return; }
    const n = Math.floor(v);
    if (n > 170) { setDisplay('Error'); setWaitingForOperand(true); return; }
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    const exprStr = `${n}! =`;
    const result = fmt(r);
    setExpression(exprStr); setDisplay(result); setWaitingForOperand(true);
    if (result !== 'Error') pushHistory(exprStr, result);
  };

  // ===== HMS 핸들러 =====
  const hmsOnlyNum = hmsOp === '×' || hmsOp === '÷';

  const hmsCln = (x: string, on = false): string => {
    let o = x.replace(on ? /[^\d.\-]/g : /[^\d:.\-]/g, '');
    const neg = o.startsWith('-');
    let b = neg ? o.slice(1) : o;
    if (!on) {
      let c = 0, ob = '';
      for (const ch of b) { if (ch !== ':' || c < 2) { ob += ch; if (ch === ':') c++; } }
      b = ob;
    }
    const d = b.indexOf('.');
    if (d >= 0) b = b.slice(0, d + 1) + b.slice(d + 1).replace(/\./g, '');
    return (neg ? '-' : '') + b;
  };

  const hmsInD = (d: string) => setHmsInput(p => {
    const max = hmsOnlyNum ? MAX_MULTIPLIER_DIGITS : MAX_HMS_DIGITS;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= max) return p;
    if (hmsWfo) { setHmsWfo(false); return d; }
    if (p === '0') return d;
    return hmsCln(p + d, hmsOnlyNum);
  });

  const hmsInCol = () => setHmsInput(p => {
    if (hmsOnlyNum) return p;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= MAX_HMS_DIGITS - 1) return p;
    if (hmsWfo) { setHmsWfo(false); return '00:'; }
    return hmsCln(p + ':');
  });

  const hmsInDot = () => setHmsInput(p => {
    if (hmsOp === '+' || hmsOp === '−') return p;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= MAX_MULTIPLIER_DIGITS) return p;
    if (hmsWfo) { setHmsWfo(false); return '0.'; }
    if (p.includes('.')) return p;
    return hmsCln(p + '.', true);
  });

  const hmsClr = () => { setHmsInput(''); setHmsPrevSec(null); setHmsOp(null); setHmsWfo(true); setExpression(''); };

  const hmsBks = () => setHmsInput(p => p.length <= 1 ? '' : (p.length <= 2 && p.startsWith('-') ? '' : p.slice(0, -1)));

  const hmsTSig = () => setHmsInput(p => !p || p === '0' ? p : (p.startsWith('-') ? p.slice(1) : '-' + p));

  const hmsDoOp = (nOp: Op) => {
    if (hmsPrevSec === null) {
      const s0 = (hmsInput === '' || hmsInput === '-') ? 0 : (toSec(hmsInput) || 0);
      setHmsPrevSec(s0);
      setExpression(formatHMS(s0) + ' ' + nOp);
    } else if (hmsOp && !hmsWfo) {
      let r = NaN;
      if (hmsOp === '+' || hmsOp === '−') { const bs = toSec(hmsInput) || 0; r = hmsOp === '+' ? hmsPrevSec + bs : hmsPrevSec - bs; }
      else { const bn = Number(hmsInput.replace(/[^\d.\-]/g, '')) || NaN; r = hmsOp === '×' ? hmsPrevSec * bn : (bn === 0 ? NaN : hmsPrevSec / bn); }
      if (isFinite(r)) { setHmsPrevSec(r); setHmsInput(''); setExpression(formatHMS(r) + ' ' + nOp); }
      else { setHmsInput('Error'); setExpression(formatHMS(hmsPrevSec) + ' ' + nOp); }
      setHmsWfo(true);
    } else {
      setExpression(formatHMS(hmsPrevSec) + ' ' + nOp);
    }
    setHmsOp(nOp); setHmsWfo(true);
  };

  const hmsDoEq = () => {
    if (hmsOp === null || hmsPrevSec === null) {
      const s = toSec(hmsInput);
      setExpression(isFinite(s) ? formatHMS(s) + ' =' : '');
      setHmsWfo(true); return;
    }
    let res = NaN, e = '';
    if (hmsOp === '+' || hmsOp === '−') {
      const b = (hmsInput === '' || hmsInput === '-') ? 0 : toSec(hmsInput) || 0;
      res = hmsOp === '+' ? hmsPrevSec + b : hmsPrevSec - b;
      e = formatHMS(hmsPrevSec) + ' ' + hmsOp + ' ' + formatHMS(b) + ' =';
    } else {
      const n = (hmsInput === '' || hmsInput === '-') ? 1 : (Number(hmsInput.replace(/[^\d.\-]/g, '')) || NaN);
      res = hmsOp === '×' ? hmsPrevSec * n : (n === 0 ? NaN : hmsPrevSec / n);
      const nStr = isFinite(n) ? fmtComma(String(n)) : '--';
      e = formatHMS(hmsPrevSec) + ' ' + hmsOp + ' ' + nStr + ' =';
    }
    const rd = isFinite(res) ? formatHMS(res) : 'Error';
    setExpression(e);
    if (rd === 'Error') { setHmsInput('Error'); } else { setHmsInput(rd); }
    setHmsPrevSec(null); setHmsOp(null); setHmsWfo(true);
    if (rd !== 'Error') pushHistory(e, rd);
  };

  // ===== CONVU: 모드 순환 =====
  const cycleMode = () => {
    if (mode === 'STANDARD') {
      if (angleMode === 'DEG') {
        // 표준 계산기에서 CONV UNIT을 누르면 SCI DEG로 전환
        dispatch({ type: 'REPLACE_FRAME', subId: 'SCIENTIFIC', lineCount: 16 });
        setAngleMode('DEG');
      } else if (angleMode === 'HMS') {
        // HMS에서 CONV UNIT을 누르면 표준 계산기(DEG)로 전환
        setAngleMode('DEG');
      }
    } else {
      // 과학 계산기에서 CONV UNIT을 누르면 SCI DEG ↔ SCI RAD ↔ HMS → STANDARD로 전환
      if (angleMode === 'DEG') {
        setAngleMode('RAD');
      } else if (angleMode === 'RAD') {
        dispatch({ type: 'REPLACE_FRAME', subId: 'STANDARD', lineCount: 16 });
        setAngleMode('HMS');
      }
    }
    clearAll();
  };

  // ===== 키 이벤트 처리 (Hook - unconditional) =====
  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'CLR') { clearAll(); return 'stop'; }
    if (k === 'MEM' && mode !== 'SCIENTIFIC') {
      if (angleMode === 'HMS') return undefined;
      if (displayIsBlank || display === '0') mRecall();
      else mAdd();
      return 'stop';
    }
    if (k === 'CONVU' && mode !== 'SCIENTIFIC') { cycleMode(); return 'stop'; }

    if (angleMode === 'HMS') {
      if (k === 'CONVU') { cycleMode(); return 'stop'; }
      if (k === 'BKSP') { hmsBks(); return 'stop'; }
      if (k === 'DOT') { hmsInDot(); return 'stop'; }
      if (k === 'COL') { hmsInCol(); return 'stop'; }
      if (k === 'SIGN') { hmsTSig(); return 'stop'; }
      if (k === 'ADD') { hmsDoOp('+'); return 'stop'; }
      if (k === 'SUB') { hmsDoOp('−'); return 'stop'; }
      if (k === 'MUL') { hmsDoOp('×'); return 'stop'; }
      if (k === 'DIV') { hmsDoOp('÷'); return 'stop'; }
      if (k === 'EQU' || k === 'POWER') { hmsDoEq(); return 'stop'; }
      if (k === 'DICT') { hmsClr(); return 'stop'; }
      const ch = keyIdToChar(k);
      if (ch && /\d/.test(ch)) { hmsInD(ch); return 'stop'; }
      return undefined;
    }

    if (k === 'BKSP') { backspace(); return 'stop'; }
    if (k === 'DOT') { inputDot(); return 'stop'; }
    if (k === 'SIGN') { toggleSign(); return 'stop'; }
    if (k === 'SQRT' && mode !== 'SCIENTIFIC') { squareRoot(); return 'stop'; }
    if (k === 'ADD') { performOp('+'); return 'stop'; }
    if (k === 'SUB') { performOp('−'); return 'stop'; }
    if (k === 'MUL') { performOp('×'); return 'stop'; }
    if (k === 'DIV') { performOp('÷'); return 'stop'; }
    if (k === 'EQU') { performEquals(); return 'stop'; }

    // Scientific mode keys
    if (mode === 'SCIENTIFIC') {
      if (k === 'DUTY') { sciSin(); return 'stop'; }
      if (k === 'HOT') { sciCos(); return 'stop'; }
      if (k === 'BACK') { sciTan(); return 'stop'; }
      if (k === 'CURR') { sciLn(); return 'stop'; }
      if (k === 'FLT') { sciLog(); return 'stop'; }
      if (k === 'CONV') { sciSquare(); return 'stop'; }
      if (k === 'WX') { sciInverse(); return 'stop'; }
      if (k === 'MEM') { sciPi(); return 'stop'; } // STOP WATCH → MEM
      if (k === 'DICT') { sciExp(); return 'stop'; }
      if (k === 'CONVU') { cycleMode(); return 'stop'; } // 각도 모드 전환
      if (k === 'UP') { sciPower(); return 'stop'; } // xʸ
      if (k === 'DN') { sciRoot(); return 'stop'; } // y√x
      if (k === 'POWER') { sciFactorial(); return 'stop'; } // !
      if (k === 'SQRT') { squareRoot(); return 'stop'; } // √x
      if (k === 'CALC') { 
        clearAll(); // 계산기 상태 초기화
        // CALC 키를 누르면 표준 계산기로 전환
        dispatch({ type: 'GOTO_ROOT', root: 'CALC', lineCount: 16 });
        return 'stop'; 
      }
    }

    const ch = keyIdToChar(k);
    if (ch && /[0-9]/.test(ch)) { inputDigit(ch); return 'stop'; }
    if (NUMBER_KEYS.includes(k)) {
      const c = keyIdToChar(k);
      if (c) { inputDigit(c); return 'stop'; }
    }
    return undefined;
  }, [cursor, display, displayIsBlank, previous, operator, waitingForOperand, memory, angleMode, mode,
      hmsInput, hmsPrevSec, hmsOp, hmsWfo], 12);

  useCx3OnEnter(() => {
    if (angleMode === 'HMS') {
      hmsDoEq();
    } else {
      performEquals();
    }
  }, [display, previous, operator, angleMode, hmsInput, hmsPrevSec, hmsOp]);

  // ===== autoFit 유틸 =====
  const autoFit = (outerEl: HTMLElement | null, innerEl: HTMLElement | null, minScale: number = 0.45): number => {
    if (!outerEl || !innerEl) return 1.0;
    innerEl.style.transform = '';
    innerEl.style.transformOrigin = 'right center';
    void outerEl.offsetWidth;
    void innerEl.offsetWidth;
    const avail = outerEl.clientWidth;
    const need = innerEl.scrollWidth || innerEl.offsetWidth;
    if (avail <= 0 || need <= 0) return 1.0;
    if (need <= avail + 1) return 1.0;
    let s = avail / need;
    if (s < minScale) s = minScale;
    const steps = [1.0, 0.92, 0.85, 0.78, 0.72, 0.66, 0.60, 0.55, 0.50, 0.45];
    for (const step of steps) {
      if (need * step <= avail + 1) { s = Math.max(s, step); break; }
    }
    innerEl.style.transform = `scale(${s})`;
    innerEl.style.transformOrigin = 'right center';
    return s;
  };

  // ===== autoFit useEffect (unconditional) =====
  useEffect(() => {
    let raf0 = 0, raf1 = 0;
    const run = () => {
      raf1 = requestAnimationFrame(() => {
        autoFit(mainDisplayRef.current, mainInnerRef.current, 0.45);
        autoFit(exprOuterRef.current, exprInnerRef.current, 0.55);
      });
    };
    raf0 = requestAnimationFrame(run);
    return () => { if (raf0) cancelAnimationFrame(raf0); if (raf1) cancelAnimationFrame(raf1); };
  }, [display, expression, angleMode, memory, history.length]);

  // ===== 공통 포맷팅 변수 (unconditional) =====
  const mainDisplay = display || '0';
  const isError = mainDisplay === 'Error';
  const mainDisplayFormatted = isError ? 'Error' : fmtComma(mainDisplay);
  const memDisplay = memory !== 0 ? `  ${fmtComma(fmt(memory))}` : '';
  const exprFormatted = (() => {
    if (!expression) return '\u00A0';
    return expression.split(' ').map(tok => {
      if (tok === '+' || tok === '−' || tok === '×' || tok === '÷' || tok === '=') return tok;
      return fmtComma(tok);
    }).join(' ');
  })();

  const mainFontStyle = useMemo<React.CSSProperties>(() => ({
    fontSize: 'clamp(28px, 6.2vh, 46px)',
    letterSpacing: '0.45px',
    fontWeight: 800,
  }), []);

  const exprLen = expression.length;
  const exprFontStyle = useMemo<React.CSSProperties>(() => {
    if (exprLen <= 18) return { fontSize: '13.5px', letterSpacing: '0.25px', fontWeight: 600 };
    if (exprLen <= 26) return { fontSize: '12px', letterSpacing: '0.15px', fontWeight: 600 };
    if (exprLen <= 34) return { fontSize: '10.5px', letterSpacing: '0.05px', fontWeight: 600 };
    return { fontSize: '9.5px', letterSpacing: '0px', fontWeight: 600 };
  }, [exprLen]);

  // ===== HMS 포맷팅 변수 (unconditional) =====
  const hmsMainStr = (hmsInput === '' || hmsInput === '-')
    ? (hmsWfo && hmsPrevSec !== null ? formatHMS(hmsPrevSec) : '--:--:--')
    : (hmsInput === 'Error' ? 'Error' : formatHMS(toSec(hmsInput)));
  const hmsErr = hmsMainStr === 'Error';
  const hmsMainDigitLen = hmsMainStr.replace(/[^\d]/g, '').length;

  const hmsExprFormatted = (() => {
    if (!expression) return '\u00A0';
    const toks = expression.split(' ');
    return toks.map(tok => {
      if (tok === '+' || tok === '−' || tok === '×' || tok === '÷' || tok === '=') return tok;
      if (tok.includes(':')) return tok;
      return fmtComma(tok);
    }).join(' ');
  })();

  const hmsMainFontStyle: React.CSSProperties = (() => {
    const n = hmsMainDigitLen;
    if (n <= 6) return { fontSize: 'clamp(26px, 5.2vh, 40px)', letterSpacing: '0.45px', fontWeight: 800, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 7) return { fontSize: 'clamp(24px, 4.8vh, 37px)', letterSpacing: '0.4px', fontWeight: 800, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 8) return { fontSize: 'clamp(21px, 4.3vh, 33px)', letterSpacing: '0.3px', fontWeight: 800, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 9) return { fontSize: 'clamp(19px, 3.9vh, 30px)', letterSpacing: '0.25px', fontWeight: 800, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 10) return { fontSize: 'clamp(17px, 3.5vh, 27px)', letterSpacing: '0.2px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 11) return { fontSize: 'clamp(15.5px, 3.2vh, 25px)', letterSpacing: '0.15px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 12) return { fontSize: 'clamp(14px, 3.0vh, 23px)', letterSpacing: '0.1px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 13) return { fontSize: 'clamp(13px, 2.8vh, 21px)', letterSpacing: '0px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 14) return { fontSize: 'clamp(12px, 2.6vh, 19px)', letterSpacing: '-0.05px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    return { fontSize: 'clamp(11px, 2.4vh, 17px)', letterSpacing: '-0.1px', fontWeight: 700, color: hmsErr ? '#ff5555' : 'var(--cx3-lcd-amber)' };
  })();

  // ===== JSX: 조건부 분기 (Hook 이후에만) =====
  if (angleMode === 'HMS') {
    return (
      <div className="calc-lcd-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="calc-top-row">
            <span className="calc-mode-chip" data-angle="HMS">HMS</span>
          </div>

          {history.length > 0 && (
            <div className="calc-history-wrap" style={{
              marginTop: 4, marginLeft: 8, marginRight: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              justifyContent: 'flex-end', gap: 1, minHeight: 0, flexShrink: 1,
            }}>
              {history.map((h, i) => {
                const opLen = h.expr.length + h.result.length + 2;
                const fs = opLen > 32 ? '11.5px' : opLen > 26 ? '12.5px' : '13.5px';
                const isLatest = i === history.length - 1;
                return (
                  <div key={i} title={`${h.expr} ${h.result}`} style={{
                    width: '100%', textAlign: 'right',
                    color: isLatest ? '#ffd580' : '#e6b86b',
                    opacity: isLatest ? 0.92 : 0.68 - (history.length - 1 - i) * 0.08,
                    fontSize: fs,
                    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: '14.5px', letterSpacing: '0.15px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ opacity: 0.78 }}>{h.expr}</span>{' '}
                    <span style={{ fontWeight: 700, color: isLatest ? '#ffe3a8' : '#ffd59a' }}>{h.result}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="calc-expr-row" ref={exprOuterRef} style={{
            overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'flex-end',
            fontSize: '13px', letterSpacing: '0.2px', fontWeight: 600,
          }}>
            <span ref={exprInnerRef} style={{
              display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'right center',
              flex: '0 0 auto', minWidth: 0, width: 'max-content', textAlign: 'right',
            }}>
              {hmsExprFormatted}
            </span>
          </div>
          <div className={'calc-main-display' + (hmsErr ? ' error' : '')} ref={mainDisplayRef} style={{
            overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'flex-end',
          }}>
            <span ref={mainInnerRef} style={{
              ...hmsMainFontStyle,
              display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'right center',
              flex: '0 0 auto', minWidth: 0, width: 'max-content', textAlign: 'right',
              direction: 'ltr', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
            }}>
              {hmsMainStr}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calc-lcd-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="calc-top-row">
          <span className="calc-mode-chip" data-angle={angleMode}>{mode === 'SCIENTIFIC' ? `SCI ${angleMode}` : 'STANDARD'}</span>
          <span className="calc-mem-chip" data-active={memory !== 0}>
            M{memDisplay}
          </span>
        </div>

        {history.length > 0 && (
          <div className="calc-history-wrap" style={{
            marginTop: 4, marginLeft: 8, marginRight: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            justifyContent: 'flex-end', gap: 1, minHeight: 0, flexShrink: 1,
          }}>
            {history.map((h, i) => {
              const opLen = h.expr.length + h.result.length + 2;
              const fs = opLen > 32 ? '11.5px' : opLen > 26 ? '12.5px' : '13.5px';
              const isLatest = i === history.length - 1;
              return (
                <div key={i} title={`${h.expr} ${h.result}`} style={{
                  width: '100%', textAlign: 'right',
                  color: isLatest ? '#7dff7d' : '#5dc67c',
                  opacity: isLatest ? 0.92 : 0.68 - (history.length - 1 - i) * 0.08,
                  fontSize: fs,
                  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                  lineHeight: '14.5px', letterSpacing: '0.15px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  <span style={{ opacity: 0.78 }}>{h.expr}</span>{' '}
                  <span style={{ fontWeight: 700, color: isLatest ? '#a6ffb8' : '#89e4a1' }}>{h.result}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="calc-expr-row" ref={exprOuterRef} title="expression" style={{
          ...exprFontStyle, overflow: 'hidden', width: '100%',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <span ref={exprInnerRef} style={{
            display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'right center',
            flex: '0 0 auto', minWidth: 0, width: 'max-content',
            justifyContent: 'flex-end', textAlign: 'right',
          }}>
            {exprFormatted}
          </span>
        </div>

        <div className={`calc-main-display ${isError ? 'error' : ''}`} ref={mainDisplayRef} style={{
          overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'flex-end',
        }}>
          <span ref={mainInnerRef} style={{
            ...mainFontStyle,
            display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: 'right center',
            flex: '0 0 auto', minWidth: 0, width: 'max-content', textAlign: 'right',
            direction: 'ltr', fontFamily: 'inherit', color: 'inherit',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {mainDisplayFormatted}
          </span>
        </div>
      </div>
    </div>
  );
}
