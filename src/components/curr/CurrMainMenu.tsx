import React, { useEffect, useRef } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { CURRENCIES } from '../../utils/exchangeRate';

export const CURR_MENU_IDS: string[] = [
  'CONVERTER',   // 0 Currency Converter (메인 기능, 12통화)
  'USDKRW',      // 1 USD → KRW  (① 가장 많이 쓰는 인천 귀국 핵심)
  'EURUSD',      // 2 EUR → USD
  'USDJPY',      // 3 USD → JPY
  'JPYKRW',      // 4 JPY → KRW  (② 일본 출장 후 귀국 숏컷)
  'CNYKRW',      // 5 CNY → KRW  (③ 중국 출장 숏컷)
  'SGDKRW',      // 6 SGD → KRW  (④ 싱가포르 숏컷)
  'GBPUSD',      // 7 GBP → USD
  'HKDKRW',      // 8 HKD → KRW  (⑤ 홍콩 출장 숏컷)
  'THBKRW',      // 9 THB → KRW  (⑥ 태국 출장 숏컷)
  'AEDUSD',      //10 AED → USD  (⑦ 두바이 경유시 USD 환산)
  'CADUSD',      //11 CAD → USD  (⑧ 캐나다 출장)
  'AUDUSD',      //12 AUD → USD  (⑨ 호주 출장)
];

export const CURR_MENU_ITEMS: string[] = [
  'Currency Converter',
  'USD → KRW',
  'EUR → USD',
  'USD → JPY',
  'JPY → KRW',
  'CNY → KRW',
  'SGD → KRW',
  'GBP → USD',
  'HKD → KRW',
  'THB → KRW',
  'AED → USD',
  'CAD → USD',
  'AUD → USD',
];

export function currPresetFrom(subId: string): { from: number; to: number } | null {
  const presets: Record<string, [string, string]> = {
    USDKRW: ['USD', 'KRW'], EURUSD: ['EUR', 'USD'], USDJPY: ['USD', 'JPY'],
    JPYKRW: ['JPY', 'KRW'],
    CNYKRW: ['CNY', 'KRW'], SGDKRW: ['SGD', 'KRW'], GBPUSD: ['GBP', 'USD'],
    HKDKRW: ['HKD', 'KRW'], THBKRW: ['THB', 'KRW'], AEDUSD: ['AED', 'USD'],
    CADUSD: ['CAD', 'USD'], AUDUSD: ['AUD', 'USD'],
  };
  const p = presets[subId];
  if (!p) return null;
  const f = CURRENCIES.findIndex(c => c.code === p[0]);
  const t = CURRENCIES.findIndex(c => c.code === p[1]);
  if (f < 0 || t < 0) return null;
  return { from: f, to: t };
}

export default function CurrMainMenu() {
  const N = CURR_MENU_ITEMS.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const { goSub } = useCx3Router();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useCx3OnEnter(() => {
    const id = CURR_MENU_IDS[cursor];
    if (id) goSub(id, CURR_MENU_ITEMS[cursor]);
  }, [cursor, goSub]);

  useEffect(() => {
    const row = rowRefs.current[cursor];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div className="cx3-lcd-menu">
      {CURR_MENU_ITEMS.map((label, i) => {
        const enter = () => {
          dispatch({ type: 'SET_CURSOR', idx: i });
          const id = CURR_MENU_IDS[i];
          if (id) goSub(id, label);
        };
        return (
          <div
            key={label + i}
            ref={el => { rowRefs.current[i] = el; }}
            onClick={enter}
          >
            <Cx3Line
              label={label}
              state={i === 0 ? 'unsolved' : 'input'}
              cursor={cursor === i}
              onClick={enter}
            />
          </div>
        );
      })}
    </div>
  );
}
