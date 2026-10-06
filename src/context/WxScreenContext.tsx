import React, { createContext, useContext, useState, useMemo } from 'react';

interface WxScreenCtx {
  inDisplay: boolean;
  setInDisplay: (inDisplay: boolean) => void;
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  dictDetailMode: boolean;
  setDictDetailMode: (detailMode: boolean) => void;
}

const _WxScreenContext = createContext<WxScreenCtx | null>(null);

export function WxScreenProvider({ children }: { children: React.ReactNode }) {
  const [inDisplay, setInDisplay] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [dictDetailMode, setDictDetailMode] = useState(false);

  const ctx = useMemo(() => ({
    inDisplay,
    setInDisplay,
    inputFocused,
    setInputFocused,
    dictDetailMode,
    setDictDetailMode,
  }), [inDisplay, inputFocused, dictDetailMode]);

  return <_WxScreenContext.Provider value={ctx}>{children}</_WxScreenContext.Provider>;
}

export function useWxScreen() {
  const ctx = useContext(_WxScreenContext);
  if (!ctx) throw new Error('WxScreenProvider missing');
  return ctx;
}
