import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface CalcResultCtx {
  /** 계산기 마지막 결과 (display 문자열) */
  lastResult: string | null;
  /** 계산기에서 = 키 누를 때 호출 */
  setLastResult: (v: string) => void;
  /** 환율 화면에서 읽고 리셋 (consume) */
  consumeLastResult: () => string | null;
  /** 각도 모드 (DEG/RAD/HMS) */
  angleMode: 'DEG' | 'RAD' | 'HMS';
  /** 각도 모드 설정 */
  setAngleMode: (mode: 'DEG' | 'RAD' | 'HMS') => void;
}

const _Ctx = createContext<CalcResultCtx | null>(null);

export function CalcResultProvider({ children }: { children: React.ReactNode }) {
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [angleMode, setAngleMode] = useState<'DEG' | 'RAD' | 'HMS'>('DEG');
  const ref = useRef(lastResult);
  ref.current = lastResult;

  const consumeLastResult = useCallback(() => {
    const v = ref.current;
    if (v !== null) setLastResult(null);
    return v;
  }, []);

  const ctx = useMemo<CalcResultCtx>(
    () => ({ lastResult, setLastResult, consumeLastResult, angleMode, setAngleMode }),
    [lastResult, consumeLastResult, angleMode, setAngleMode],
  );

  return <_Ctx.Provider value={ctx}>{children}</_Ctx.Provider>;
}

export function useCalcResult(): CalcResultCtx {
  const ctx = useContext(_Ctx);
  if (!ctx) throw new Error('CalcResultProvider missing');
  return ctx;
}
