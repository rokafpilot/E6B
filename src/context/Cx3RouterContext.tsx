import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Cx3KeyId, useOnCx3Key } from './Cx3KeypadContext';

export type Cx3RootId = 'FLT' | 'CONV' | 'CURR' | 'CALC' | 'HOT' | 'DUTY' | 'WX' | 'DICT' | 'TIMER';

export interface MenuStackFrame {
  root: Cx3RootId;
  subId: string;
  title?: string;
}

export interface Cx3RouterState {
  activeRoot: Cx3RootId;
  stack: MenuStackFrame[];
  lineCursor: number;
  lineCount: number;
}

export type RouterAction =
  | { type: 'GOTO_ROOT'; root: Cx3RootId; lineCount?: number }
  | { type: 'NAV'; delta: -1 | 1 }
  | { type: 'ENTER'; subId: string; title?: string; lineCount?: number }
  | { type: 'BACK' }
  | { type: 'SET_LINECOUNT'; lineCount: number }
  | { type: 'SET_CURSOR'; idx: number }
  | { type: 'HOME' }
  | { type: 'REPLACE_FRAME'; subId: string; title?: string; lineCount?: number };

const INITIAL: Cx3RouterState = {
  activeRoot: 'FLT',
  stack: [{ root: 'FLT', subId: 'FLT_MAIN' }],
  lineCursor: 0,
  lineCount: 16,
};

function topIsMainMenu(frame: MenuStackFrame): boolean {
  return frame.subId.endsWith('_MAIN');
}

function reducer(state: Cx3RouterState, a: RouterAction): Cx3RouterState {
  switch (a.type) {
    case 'GOTO_ROOT': {
      const newLineCount = a.lineCount ?? state.lineCount;
      let subId: string;
      if (a.root === 'CALC') {
        subId = 'STANDARD'; // CALC 라우트는 직접 표준 계산기로
      } else {
        subId = `${a.root}_MAIN`; // 다른 라우트는 기존 behavior 유지
      }
      return {
        ...state,
        activeRoot: a.root,
        stack: [{ root: a.root, subId: subId }],
        lineCursor: 0,
        lineCount: newLineCount,
      };
    }
    case 'NAV': {
      if (topIsMainMenu(state.stack[state.stack.length - 1])) {
        let next = state.lineCursor + a.delta;
        if (next < 0) next = state.lineCount - 1;
        else if (next >= state.lineCount) next = 0;
        return { ...state, lineCursor: next };
      }
      const next = Math.max(0, Math.min(state.lineCount - 1, state.lineCursor + a.delta));
      return { ...state, lineCursor: next };
    }
    case 'SET_CURSOR':
      return { ...state, lineCursor: Math.max(0, Math.min(state.lineCount - 1, a.idx)) };
    case 'ENTER': {
      const frame: MenuStackFrame = {
        root: state.activeRoot, subId: a.subId, title: a.title,
      };
      return {
        ...state,
        stack: [...state.stack, frame],
        lineCursor: 0,
        lineCount: a.lineCount ?? state.lineCount,
      };
    }
    case 'REPLACE_FRAME': {
      const stack = [...state.stack];
      stack[stack.length - 1] = { root: state.activeRoot, subId: a.subId, title: a.title };
      return { ...state, stack, lineCursor: 0, lineCount: a.lineCount ?? state.lineCount };
    }
    case 'BACK': {
      if (state.stack.length <= 1) {
        return { ...state, lineCursor: 0 };
      }
      const newStack = state.stack.slice(0, -1);
      return { ...state, stack: newStack, lineCursor: 0 };
    }
    case 'SET_LINECOUNT':
      return { ...state, lineCount: Math.max(1, a.lineCount), lineCursor: Math.min(state.lineCursor, Math.max(0, a.lineCount - 1)) };
    case 'HOME':
      return { ...INITIAL };
    default:
      return state;
  }
}

interface Cx3RouterCtx {
  state: Cx3RouterState;
  dispatch: React.Dispatch<RouterAction>;
  top: MenuStackFrame;
  isMainMenu: boolean;
  rootFromKey: (k: Cx3KeyId, defaultLineCount?: number) => void;
  goSub: (subId: string, title?: string, lineCount?: number) => void;
  replaceTop: (subId: string, title?: string, lineCount?: number) => void;
}

const _Ctx = createContext<Cx3RouterCtx | null>(null);

export const ROOT_KEY_MAP: Record<string, Cx3RootId> = {
  FLT: 'FLT',
  CONV: 'CONV',
  CURR: 'CURR',
  CALC: 'CALC',
  HOT: 'HOT',
  DUTY: 'DUTY',
  WX: 'WX',
  DICT: 'DICT',
  TIMER: 'TIMER',
};

export function Cx3RouterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const top = state.stack[state.stack.length - 1] ?? state.stack[0];
  const isMainMenu = topIsMainMenu(top);

  const rootFromKey = useCallback((k: Cx3KeyId, defaultLineCount = 16) => {
    const map: Partial<Record<Cx3KeyId, Cx3RootId>> = {
      FLT: 'FLT', CONV: 'CONV', CURR: 'CURR', CALC: 'CALC', HOT: 'HOT', DUTY: 'DUTY', WX: 'WX', MEM: 'TIMER',
    };
    const r = map[k];
    if (r) {
      if (r === 'CALC') {
        // CALC 키를 누르면 직접 표준 계산기 화면으로
        dispatch({ type: 'GOTO_ROOT', root: r, lineCount: defaultLineCount });
      } else {
        // 다른 키는 기존 behavior 유지
        dispatch({ type: 'GOTO_ROOT', root: r, lineCount: defaultLineCount });
      }
    }
  }, []);

  const goSub = useCallback((subId: string, title?: string, lineCount?: number) => {
    dispatch({ type: 'ENTER', subId, title, lineCount });
  }, []);

  const replaceTop = useCallback((subId: string, title?: string, lineCount?: number) => {
    dispatch({ type: 'REPLACE_FRAME', subId, title, lineCount });
  }, []);

  // DICT: DICT key → DICT root로 이동 (과학 계산기 모드에서는除外)
  useOnCx3Key((k) => {
    console.log('=== DICT key pressed, activeRoot:', state.activeRoot, 'subId:', top.subId); // 디버그 로그
    if (k !== 'DICT') return undefined;
    
    // 과학 계산기 모드에서는 DICT 키를 sin 함수로 사용하기 위해 라우터가 처리하지 않음
    if (state.activeRoot === 'CALC' && top.subId === 'SCIENTIFIC') {
      console.log('=== SCIENTIFIC mode, skipping GOTO_ROOT'); // 디버그 로그
      return undefined; // 라우터에서 처리하지 않고, StandardCalcScreen에서 처리하도록 함
    }
    
    dispatch({ type: 'GOTO_ROOT', root: 'DICT', lineCount: 16 });
    console.log('=== GOTO_ROOT dispatched to DICT'); // 디버그 로그
    return 'stop';
  }, [state.activeRoot, top.subId], 25); // MEM보다 높은 우선순위

  // STOP WATCH: MEM key → 무조건 STOP WATCH root로 이동
  // (CALC 메모리, WX T9 확정, HOT 타이머 등 화면 핸들러가 MEM을 선점하지 못하도록 최우선 처리)
  useOnCx3Key((k) => {
    if (k !== 'MEM') return undefined;
    // 과학 계산기 모드에서는 MEM 키를 π 함수로 사용하기 위해 라우터가 처리하지 않음
    if (state.activeRoot === 'CALC' && top.subId === 'SCIENTIFIC') {
      return undefined;
    }
    if (state.activeRoot !== 'TIMER') dispatch({ type: 'GOTO_ROOT', root: 'TIMER', lineCount: 16 });
    return 'stop';
  }, [state.activeRoot, top.subId], 20);

  // keypad defaults
  useOnCx3Key((k) => {
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    if (k === 'CALC') {
      // 과학 계산기 모드에서는 CALC 키를 누르면 모든 키를 원래 설정으로 복구
      if (state.activeRoot === 'CALC' && top.subId === 'SCIENTIFIC') {
        return undefined; // 라우터에서 처리하지 않고, StandardCalcScreen에서 처리하도록 함
      }
      rootFromKey(k);
      return 'stop';
    }
    if (state.activeRoot === 'CALC' && top.subId === 'SCIENTIFIC') {
      // 과학 계산기 모드에서 root nav 키들을 라우터가 처리하지 않고, StandardCalcScreen에서 처리하도록 함
      return undefined;
    }
    if (k === 'BACK') { dispatch({ type: 'BACK' }); return 'stop'; }
    if (k === 'FLT' || k === 'CONV' || k === 'CURR' || k === 'HOT' || k === 'DUTY' || k === 'WX' || k === 'MEM') {
      rootFromKey(k);
      return 'stop';
    }
    return undefined;
  }, [rootFromKey, state.activeRoot, top.subId], 10);

  const ctx: Cx3RouterCtx = useMemo(() => ({ state, dispatch, top, isMainMenu, rootFromKey, goSub, replaceTop }),
    [state, top, isMainMenu, rootFromKey, goSub, replaceTop]);

  return <_Ctx.Provider value={ctx}>{children}</_Ctx.Provider>;
}

export function useCx3Router() {
  const ctx = useContext(_Ctx);
  if (!ctx) throw new Error('Cx3RouterProvider missing');
  return ctx;
}

export function useCx3Nav(defaultLineCount?: number) {
  const { state, dispatch, goSub } = useCx3Router();
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && defaultLineCount != null) {
      dispatch({ type: 'SET_LINECOUNT', lineCount: defaultLineCount });
      didInit.current = true;
    }
  }, [defaultLineCount, dispatch]);
  return { cursor: state.lineCursor, dispatch, goSub };
}

export function useCx3OnEnter(fn: () => void, deps: React.DependencyList = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useOnCx3Key((k) => {
    if (k === 'POWER' || k === 'EQU') { fnRef.current(); return 'stop'; }
    return undefined;
  }, deps, 9);
}
