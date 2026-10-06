import React, { useState } from 'react';

type CalcState = {
  display: string;
  previous: number | null;
  operator: string | null;
  waitingForOperand: boolean;
  memory: number;
  expression: string;
};

const initialState: CalcState = {
  display: '0',
  previous: null,
  operator: null,
  waitingForOperand: false,
  memory: 0,
  expression: '',
};

function compute(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

export default function CalcMenu() {
  const [state, setState] = useState<CalcState>(initialState);

  const inputDigit = (digit: string) => {
    setState(s => {
      if (s.waitingForOperand) {
        return { ...s, display: digit, waitingForOperand: false };
      }
      return { ...s, display: s.display === '0' ? digit : s.display + digit };
    });
  };

  const inputDot = () => {
    setState(s => {
      if (s.waitingForOperand) return { ...s, display: '0.', waitingForOperand: false };
      if (s.display.includes('.')) return s;
      return { ...s, display: s.display + '.' };
    });
  };

  const clearAll = () => setState(initialState);
  const clearEntry = () => setState(s => ({ ...s, display: '0' }));
  const backspace = () => setState(s => ({
    ...s,
    display: s.display.length <= 1 ? '0' : s.display.slice(0, -1),
  }));

  const toggleSign = () => setState(s => ({
    ...s,
    display: s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display,
  }));

  const squareRoot = () => setState(s => {
    const v = parseFloat(s.display);
    if (isNaN(v) || v < 0) return { ...s, display: 'Error' };
    return { ...s, display: String(Math.sqrt(v)) };
  });

  const performOperator = (nextOp: string) => {
    setState(s => {
      const inputValue = parseFloat(s.display);
      if (s.previous === null) {
        return { ...s, previous: inputValue, operator: nextOp, waitingForOperand: true, expression: `${s.display} ${nextOp}` };
      }
      if (s.operator && !s.waitingForOperand) {
        const result = compute(s.previous, inputValue, s.operator);
        return { ...s, previous: result, display: String(result), operator: nextOp, waitingForOperand: true, expression: `${result} ${nextOp}` };
      }
      return { ...s, operator: nextOp, expression: `${s.display} ${nextOp}`, waitingForOperand: true };
    });
  };

  const performEquals = () => {
    setState(s => {
      const inputValue = parseFloat(s.display);
      if (s.operator && s.previous !== null) {
        const result = compute(s.previous, inputValue, s.operator);
        return { ...s, previous: null, operator: null, display: String(result), waitingForOperand: true, expression: `${s.previous} ${s.operator} ${s.display} =` };
      }
      return { ...s, expression: `${s.display} =`, waitingForOperand: true };
    });
  };

  const memoryAdd = () => setState(s => ({ ...s, memory: s.memory + parseFloat(s.display || '0') }));
  const memorySub = () => setState(s => ({ ...s, memory: s.memory - parseFloat(s.display || '0') }));
  const memoryRecall = () => setState(s => ({ ...s, display: String(s.memory), waitingForOperand: true }));
  const memoryClear = () => setState(s => ({ ...s, memory: 0 }));

  const btn = (label: string, onClick: () => void, cls = '') => (
    <button className={`calc-btn ${cls}`} onClick={onClick}>{label}</button>
  );

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Calculator {state.memory !== 0 && <span style={{ color: 'var(--accent)' }}>M</span>}</div>
      </div>
      <div className="calculator">
        <div className="calc-display">
          <div className="calc-expression">{state.expression}</div>
          <div className="calc-value">{state.display}</div>
        </div>
        <div className="calc-grid">
          {btn('MC', memoryClear, 'fn')}
          {btn('MR', memoryRecall, 'fn')}
          {btn('M-', memorySub, 'fn')}
          {btn('M+', memoryAdd, 'fn')}

          {btn('AC', clearAll, 'fn')}
          {btn('CE', clearEntry, 'fn')}
          {btn('⌫', backspace, 'fn')}
          {btn('÷', () => performOperator('÷'), 'op')}

          {btn('7', () => inputDigit('7'))}
          {btn('8', () => inputDigit('8'))}
          {btn('9', () => inputDigit('9'))}
          {btn('×', () => performOperator('×'), 'op')}

          {btn('4', () => inputDigit('4'))}
          {btn('5', () => inputDigit('5'))}
          {btn('6', () => inputDigit('6'))}
          {btn('-', () => performOperator('-'), 'op')}

          {btn('1', () => inputDigit('1'))}
          {btn('2', () => inputDigit('2'))}
          {btn('3', () => inputDigit('3'))}
          {btn('+', () => performOperator('+'), 'op')}

          {btn('±', toggleSign)}
          {btn('0', () => inputDigit('0'))}
          {btn('.', inputDot)}
          {btn('√', squareRoot, 'fn')}

          {btn('=', performEquals, 'eq')}
        </div>
      </div>
    </div>
  );
}
