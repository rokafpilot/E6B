import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { isTrialExpired } from '../utils/buildFlavor';

export type KeypadType = 'NUMERIC' | 'QWERTY' | 'KOREAN';

export type Cx3KeyId =
  | 'FLT' | 'CONV' | 'CURR' | 'CALC' | 'HOT' | 'WX'
  | 'UP' | 'DN' | 'POWER' | 'BACK' | 'DUTY' | 'MEM'
  | 'SETU' | 'CONVU' | 'DICT'
  | 'N0' | 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7' | 'N8' | 'N9'
  | 'COL' | 'SIGN' | 'DOT'
  | 'DIV' | 'MUL' | 'SUB' | 'ADD'
  | 'CLR' | 'BKSP' | 'SQRT' | 'EQU'
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'SHIFT' | 'SPACE' | 'GO'
  | 'EMOJI' | 'LANG' | 'NUM';

export const NUMERIC_KEYPAD_MAP: Record<string, Cx3KeyId> = {
  'FLT': 'FLT', 'CONV': 'CONV', 'CURR': 'CURR', 'CALC': 'CALC', 'HOT': 'HOT',
  '▲': 'UP', '▼': 'DN', 'POWER': 'POWER',
  'WX': 'WX',
  'BACK': 'BACK', 'DUTY': 'DUTY', 'SET': 'DUTY', 'STOP\nWATCH': 'MEM',
  'DICT': 'DICT', 'CONV\nUNIT': 'CONVU',
  '0': 'N0', '1': 'N1', '2': 'N2', '3': 'N3', '4': 'N4', '5': 'N5', '6': 'N6', '7': 'N7', '8': 'N8', '9': 'N9',
  '.': 'DOT', ':': 'COL', ':/−+': 'COL', '+−': 'SIGN', '±': 'SIGN',
  '÷': 'DIV', '×': 'MUL', '−': 'SUB', '+': 'ADD',
  'C': 'CLR', 'BKSP': 'BKSP', '√': 'SQRT', '✓': 'SQRT', '=': 'EQU',
};

export const QWERTY_KEYPAD_MAP: Record<string, Cx3KeyId> = {
  'FLT': 'FLT', 'CONV': 'CONV', 'CURR': 'CURR', 'CALC': 'CALC', 'HOT': 'HOT',
  '▲': 'UP', '▼': 'DN', 'POWER': 'POWER',
  'WX': 'WX',
  'BACK': 'BACK', 'DUTY': 'DUTY', 'SET': 'DUTY', 'STOP\nWATCH': 'MEM',
  'DICT': 'DICT', 'CONV\nUNIT': 'CONVU',
  'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J', 'K': 'K', 'L': 'L', 'M': 'M',
  'N': 'N', 'O': 'O', 'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T', 'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
  'SHIFT': 'SHIFT', 'SPACE': 'SPACE', 'GO': 'GO',
  'BKSP': 'BKSP', '/': 'DIV',
  '−': 'SUB', 'EN': 'LANG', '123': 'NUM',
};

export const KOREAN_KEYPAD_MAP: Record<string, Cx3KeyId> = {
  'FLT': 'FLT', 'CONV': 'CONV', 'CURR': 'CURR', 'CALC': 'CALC', 'HOT': 'HOT',
  '▲': 'UP', '▼': 'DN', 'POWER': 'POWER',
  'WX': 'WX',
  'BACK': 'BACK', 'DUTY': 'DUTY', 'SET': 'DUTY', 'STOP\nWATCH': 'MEM',
  'DICT': 'DICT', 'CONV\nUNIT': 'CONVU',
  'ㅂ': 'Q', 'ㅈ': 'W', 'ㄷ': 'E', 'ㄱ': 'R', 'ㅅ': 'T', 'ㅛ': 'Y', 'ㅕ': 'U', 'ㅑ': 'I', 'ㅐ': 'O', 'ㅔ': 'P',
  'ㅁ': 'A', 'ㄴ': 'S', 'ㅇ': 'D', 'ㄹ': 'F', 'ㅎ': 'G', 'ㅗ': 'H', 'ㅓ': 'J', 'ㅏ': 'K', 'ㅣ': 'L',
  'ㅋ': 'Z', 'ㅌ': 'X', 'ㅊ': 'C', 'ㅍ': 'V', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅡ': 'M',
  'SHIFT': 'SHIFT', 'SPACE': 'SPACE', 'GO': 'GO',
  'BKSP': 'BKSP', '/': 'DIV',
  '−': 'SUB', '한': 'LANG', '123': 'NUM',
};

export const NUMBER_KEYS: Cx3KeyId[] = ['N0','N1','N2','N3','N4','N5','N6','N7','N8','N9'];

export function keyIdToChar(k: Cx3KeyId): string | null {
  if (NUMBER_KEYS.includes(k)) return k.slice(1);
  if (k === 'DOT') return '.';
  if (k === 'COL') return ':';
  if (k === 'SIGN') return '+-';
  return null;
}

export function keyIdFromKeyboard(e: KeyboardEvent): Cx3KeyId | null {
  const k = e.key;
  if (/^[0-9]$/.test(k)) return `N${k}` as Cx3KeyId;
  if (k === '.') return 'DOT';
  if (k === ':') return 'COL';
  if (k === '+' || k === '=' && e.shiftKey) return 'ADD';
  if (k === '-') return 'SUB';
  if (k === '*' || (k === '8' && e.shiftKey)) return 'MUL';
  if (k === '/') return 'DIV';
  if (k === 'Enter') { e.preventDefault(); return 'POWER'; }
  if (k === 'Escape') return 'BACK';
  if (k === 'ArrowUp') { e.preventDefault(); return 'UP'; }
  if (k === 'ArrowDown') { e.preventDefault(); return 'DN'; }
  if (k === 'Backspace') return 'BKSP';
  if (k === 'Delete' || k === 'c' || k === 'C') return 'CLR';
  if (k === '=') return 'EQU';
  return null;
}

export type KeyHandler = (k: Cx3KeyId) => void | 'stop';

interface Cx3KeypadCtx {
  publish: (k: Cx3KeyId) => void;
  subscribe: (fn: KeyHandler, priority?: number) => () => void;
}

const _Cx3KeypadContext = createContext<Cx3KeypadCtx | null>(null);

export function Cx3KeypadProvider({ children }: { children: React.ReactNode }) {
  const subsRef = useRef<{ fn: KeyHandler; p: number }[]>([]);
  const subscribe = useCallback((fn: KeyHandler, priority = 0) => {
    const item = { fn, p: priority };
    subsRef.current.push(item);
    subsRef.current.sort((a, b) => b.p - a.p);
    return () => {
      subsRef.current = subsRef.current.filter(x => x !== item);
    };
  }, []);
  const publish = useCallback((k: Cx3KeyId) => {
    console.log('=== publish key:', k); // 디버그 로그
    // Trial 만료 상태면 어떤 키도 처리하지 않음 (화면에 만료 오버레이가 표시됨)
    if (isTrialExpired()) return;
    for (const s of [...subsRef.current]) {
      try {
        const r = s.fn(k);
        if (r === 'stop') return;
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
      }
      const k = keyIdFromKeyboard(e);
      if (k) publish(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [publish]);

  const ctx = useMemo(() => ({ publish, subscribe }), [publish, subscribe]);
  return <_Cx3KeypadContext.Provider value={ctx}>{children}</_Cx3KeypadContext.Provider>;
}

export function useCx3Keypad() {
  const ctx = useContext(_Cx3KeypadContext);
  if (!ctx) throw new Error('Cx3KeypadProvider missing');
  return ctx;
}

export function useOnCx3Key(fn: KeyHandler, deps: React.DependencyList = [], priority = 0) {
  const { subscribe } = useCx3Keypad();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const unsub = subscribe(k => fnRef.current(k), priority);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, priority, ...deps]);
}
