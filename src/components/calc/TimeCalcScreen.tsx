import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOnCx3Key, keyIdToChar } from '../../context/Cx3KeypadContext';
import { formatHMS } from '../../hooks/useBlankField';

const MAX_HMS_DIGITS = 15;
const MAX_MULTIPLIER_DIGITS = 12;

type Op = '+' | '−' | '×' | '÷' | null;
type HistoryItem = { expr: string; result: string };

function fmtComma(numStr: string): string {
  if (!numStr || numStr === 'Error') return numStr;
  if (numStr.includes('e') || numStr.includes('E')) return numStr;
  const neg = numStr.startsWith('-');
  const body = neg ? numStr.slice(1) : numStr;
  const [intPart, decPart] = body.split('.');
  const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (decPart !== undefined ? `${withComma}.${decPart}` : withComma);
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

export default function TimeCalcScreen() {
  const [input, setInput] = useState('');
  const [prevSec, setPrevSec] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [wfo, setWfo] = useState(true);
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [memory, setMemory] = useState<number>(0);
  const mainDisplayRef = useRef<HTMLDivElement>(null);
  const mainInnerRef = useRef<HTMLSpanElement>(null);
  const exprOuterRef = useRef<HTMLDivElement>(null);
  const exprInnerRef = useRef<HTMLSpanElement>(null);

  const pushHistory = (e: string, r: string) => {
    setHistory(prev => {
      const next = [...prev, { expr: e, result: r }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
  };

  const blank = input === '' || input === '-';
  const onlyNum = op === '×' || op === '÷';

  const cln = (x: string, on = false): string => {
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

  const inD = (d: string) => setInput(p => {
    const max = onlyNum ? MAX_MULTIPLIER_DIGITS : MAX_HMS_DIGITS;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= max) return p;
    if (wfo) { setWfo(false); return d; }
    if (p === '0') return d;
    return cln(p + d, onlyNum);
  });
  const inCol = () => setInput(p => {
    if (onlyNum) return p;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= MAX_HMS_DIGITS - 1) return p;
    if (wfo) { setWfo(false); return '00:'; }
    return cln(p + ':');
  });
  const inDot = () => setInput(p => {
    if (op === '+' || op === '−') return p;
    const curDigits = p.replace(/[^\d]/g, '').length;
    if (curDigits >= MAX_MULTIPLIER_DIGITS) return p;
    if (wfo) { setWfo(false); return '0.'; }
    if (p.includes('.')) return p;
    return cln(p + '.', true);
  });
  const clr = () => { setInput(''); setPrevSec(null); setOp(null); setWfo(true); setExpr(''); };
  const bks = () => setInput(p => p.length <= 1 ? '' : (p.length <= 2 && p.startsWith('-') ? '' : p.slice(0, -1)));
  const tSig = () => setInput(p => !p || p === '0' ? p : (p.startsWith('-') ? p.slice(1) : '-' + p));

  const doOp = (nOp: Op) => {
    if (prevSec === null) {
      const s0 = blank ? 0 : (toSec(input) || 0);
      setPrevSec(s0);
      setExpr(formatHMS(s0) + ' ' + nOp);
    } else if (op && !wfo) {
      let r = NaN;
      if (op === '+' || op === '−') { const bs = toSec(input) || 0; r = op === '+' ? prevSec + bs : prevSec - bs; }
      else { const bn = Number(input.replace(/[^\d.\-]/g, '')) || NaN; r = op === '×' ? prevSec * bn : (bn === 0 ? NaN : prevSec / bn); }
      if (isFinite(r)) { setPrevSec(r); setInput(''); setExpr(formatHMS(r) + ' ' + nOp); }
      else { setInput('Error'); setExpr(formatHMS(prevSec) + ' ' + nOp); }
      setWfo(true);
    } else {
      setExpr(formatHMS(prevSec) + ' ' + nOp);
    }
    setOp(nOp); setWfo(true);
  };

  const doEq = () => {
    if (op === null || prevSec === null) {
      const s = toSec(input);
      setExpr(isFinite(s) ? formatHMS(s) + ' =' : '');
      setWfo(true); return;
    }
    let res = NaN, e = '';
    if (op === '+' || op === '−') {
      const b = blank ? 0 : toSec(input) || 0;
      res = op === '+' ? prevSec + b : prevSec - b;
      e = formatHMS(prevSec) + ' ' + op + ' ' + formatHMS(b) + ' =';
    } else {
      const n = blank ? 1 : (Number(input.replace(/[^\d.\-]/g, '')) || NaN);
      res = op === '×' ? prevSec * n : (n === 0 ? NaN : prevSec / n);
      const nStr = isFinite(n) ? fmtComma(String(n)) : '--';
      e = formatHMS(prevSec) + ' ' + op + ' ' + nStr + ' =';
    }
    const rd = isFinite(res) ? formatHMS(res) : 'Error';
    setExpr(e); setInput(rd === 'Error' ? 'Error' : rd);
    setPrevSec(null); setOp(null); setWfo(true);
    if (rd !== 'Error') pushHistory(e, rd);
  };

  const memAdd = () => {
    const sec = blank ? 0 : (toSec(input) || 0);
    if (isFinite(sec)) setMemory(m => m + sec);
  };

  const memSub = () => {
    const sec = blank ? 0 : (toSec(input) || 0);
    if (isFinite(sec)) setMemory(m => m - sec);
  };

  const memRecall = () => {
    if (memory === 0) return;
    setInput(formatHMS(memory));
    setWfo(false);
  };

  const memClear = () => setMemory(0);

  useOnCx3Key((k) => {
    if (k === 'CLR') { clr(); return 'stop'; }
    if (k === 'BKSP') { bks(); return 'stop'; }
    if (k === 'DOT') { inDot(); return 'stop'; }
    if (k === 'COL') { inCol(); return 'stop'; }
    if (k === 'SIGN') { tSig(); return 'stop'; }
    if (k === 'ADD') { doOp('+'); return 'stop'; }
    if (k === 'SUB') { doOp('−'); return 'stop'; }
    if (k === 'MUL') { doOp('×'); return 'stop'; }
    if (k === 'DIV') { doOp('÷'); return 'stop'; }
    if (k === 'EQU' || k === 'POWER') { doEq(); return 'stop'; }
    if (k === 'DICT') { clr(); return 'stop'; }
    if (k === 'MEM') {
      if (blank) memRecall();
      else memAdd();
      return 'stop';
    }
    const ch = keyIdToChar(k);
    if (ch && /\d/.test(ch)) { inD(ch); return 'stop'; }
    return undefined;
  }, [memory, input, blank], 12);

  const memDisplay = memory !== 0 ? `  ${formatHMS(memory)}` : '';

  const main = blank
    ? (wfo && prevSec !== null ? formatHMS(prevSec) : '--:--:--')
    : (input === 'Error' ? 'Error' : formatHMS(toSec(input)));
  const err = main === 'Error';

  const exprFormatted = (() => {
    if (!expr) return '\u00A0';
    const toks = expr.split(' ');
    return toks.map(tok => {
      if (tok === '+' || tok === '−' || tok === '×' || tok === '÷' || tok === '=') return tok;
      if (tok.includes(':')) return tok;
      return fmtComma(tok);
    }).join(' ');
  })();

  const mainDigitLen = useMemo(() => main.replace(/[^\d]/g, '').length, [main]);

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
  }, [main, exprFormatted]);

  const mainFontStyle = useMemo<React.CSSProperties>(() => {
    const n = mainDigitLen;
    if (n <= 6) return { fontSize: 'clamp(26px, 5.2vh, 40px)', letterSpacing: '0.45px', fontWeight: 800, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 7) return { fontSize: 'clamp(24px, 4.8vh, 37px)', letterSpacing: '0.4px', fontWeight: 800, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 8) return { fontSize: 'clamp(21px, 4.3vh, 33px)', letterSpacing: '0.3px', fontWeight: 800, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 9) return { fontSize: 'clamp(19px, 3.9vh, 30px)', letterSpacing: '0.25px', fontWeight: 800, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 10) return { fontSize: 'clamp(17px, 3.5vh, 27px)', letterSpacing: '0.2px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 11) return { fontSize: 'clamp(15.5px, 3.2vh, 25px)', letterSpacing: '0.15px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 12) return { fontSize: 'clamp(14px, 3.0vh, 23px)', letterSpacing: '0.1px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 13) return { fontSize: 'clamp(13px, 2.8vh, 21px)', letterSpacing: '0px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    if (n === 14) return { fontSize: 'clamp(12px, 2.6vh, 19px)', letterSpacing: '-0.05px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
    return { fontSize: 'clamp(11px, 2.4vh, 17px)', letterSpacing: '-0.1px', fontWeight: 700, color: err ? '#ff5555' : 'var(--cx3-lcd-amber)' };
  }, [mainDigitLen, err]);

  return (
    <div className="calc-lcd-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="calc-top-row">
          <span className="calc-mode-chip" data-angle="HMS">HMS</span>
          <span className="calc-mem-chip" data-active={memory !== 0}>
            M{memDisplay}
          </span>
        </div>

        {history.length > 0 && (
          <div className="calc-history-wrap" style={{
            marginTop: 4,
            marginLeft: 8,
            marginRight: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            gap: 1,
            minHeight: 0,
            flexShrink: 1,
          }}>
            {history.map((h, i) => {
              const opLen = h.expr.length + h.result.length + 2;
              const fs = opLen > 32 ? '10.5px' : opLen > 26 ? '11.5px' : '12.5px';
              const isLatest = i === history.length - 1;
              return (
                <div key={i}
                  title={`${h.expr} ${h.result}`}
                  style={{
                    width: '100%',
                    textAlign: 'right',
                    color: isLatest ? '#ffd580' : '#e6b86b',
                    opacity: isLatest ? 0.92 : 0.68 - (history.length - 1 - i) * 0.08,
                    fontSize: fs,
                    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: '13.5px',
                    letterSpacing: '0.15px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
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
        <div
          className="calc-expr-row"
          ref={exprOuterRef}
          style={{
            overflow: 'hidden',
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: '13px',
            letterSpacing: '0.2px',
            fontWeight: 600,
          }}
        >
          <span
            ref={exprInnerRef}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              transformOrigin: 'right center',
              flex: '0 0 auto',
              minWidth: 0,
              width: 'max-content',
              textAlign: 'right',
            }}
          >
            {exprFormatted}
          </span>
        </div>
        <div
          className={'calc-main-display' + (err ? ' error' : '')}
          ref={mainDisplayRef}
          style={{
            overflow: 'hidden',
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <span
            ref={mainInnerRef}
            style={{
              ...mainFontStyle,
              display: 'inline-block',
              whiteSpace: 'nowrap',
              transformOrigin: 'right center',
              flex: '0 0 auto',
              minWidth: 0,
              width: 'max-content',
              textAlign: 'right',
              direction: 'ltr',
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {main}
          </span>
        </div>
      </div>
    </div>
  );
}
