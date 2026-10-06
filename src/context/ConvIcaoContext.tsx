import React, { createContext, useContext, useState, useMemo } from 'react';

interface ConvIcaoCtx {
  icaoActive: boolean;
  setIcaoActive: (active: boolean) => void;
}

const _ConvIcaoContext = createContext<ConvIcaoCtx | null>(null);

export function ConvIcaoProvider({ children }: { children: React.ReactNode }) {
  const [icaoActive, setIcaoActive] = useState(false);
  const ctx = useMemo(() => ({ icaoActive, setIcaoActive }), [icaoActive]);
  return <_ConvIcaoContext.Provider value={ctx}>{children}</_ConvIcaoContext.Provider>;
}

export function useConvIcao() {
  const ctx = useContext(_ConvIcaoContext);
  if (!ctx) throw new Error('ConvIcaoProvider missing');
  return ctx;
}
