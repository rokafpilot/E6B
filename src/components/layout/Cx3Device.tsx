import React, { useEffect, useMemo, useState } from 'react';
import { useWxScreen } from '../../context/WxScreenContext';
import { useConvIcao } from '../../context/ConvIcaoContext';
import './Cx3Device.css';
import { Cx3KeypadProvider, NUMERIC_KEYPAD_MAP, QWERTY_KEYPAD_MAP, KOREAN_KEYPAD_MAP, KeypadType, useCx3Keypad, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { Cx3RouterProvider, useCx3Router } from '../../context/Cx3RouterContext';
import { CalcResultProvider, useCalcResult } from '../../context/CalcResultContext';
import Cx3Screen, { rootLabelFor } from '../common/Cx3Screen';
import {
  APP_VERSION,
  TRIAL_EXPIRE_RAW,
  buildBannerText,
  isTrialBuild,
  isTrialExpired,
  daysUntilExpire,
} from '../../utils/buildFlavor';

/* 🔥 HOT 화면 전용 · 상단 BATT 영역 DAY/NIGHT 토글 상태
 * - 기존 HOT 스크린 내부 Time of Day 행 삭제 후 status-bar 우측 BATT 옆에 버튼으로 대체
 * - BATT 자체 클릭 = DAY ↔ NIGHT swap (직관적, 터치 유저 친화적)
 */
let _hotTodIdx: 0 | 1 = 0;
const _hotTodListeners = new Set<(v: 0 | 1) => void>();
export function getHotTodIdx(): 0 | 1 { return _hotTodIdx; }
export function setHotTodIdx(v: 0 | 1) {
  _hotTodIdx = v;
  _hotTodListeners.forEach(fn => fn(v));
}
export function toggleHotTod() { setHotTodIdx(_hotTodIdx === 0 ? 1 : 0); }
export function useHotTod(): [0 | 1, React.Dispatch<React.SetStateAction<0 | 1>>] {
  const [v, s] = useState<0|1>(() => getHotTodIdx());
  useEffect(() => {
    const fn = (nv: 0|1) => s(nv);
    _hotTodListeners.add(fn);
    return () => { _hotTodListeners.delete(fn); };
  }, []);
  const set = (updater: any) => {
    const nv = typeof updater === 'function' ? updater(getHotTodIdx()) : updater;
    setHotTodIdx(nv);
  };
  return [v, set];
}



export const ASA_WING_LOGO = (
  <svg className="cx3-asa-wing-logo" viewBox="0 0 400 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="sp-gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFD96A"/>
        <stop offset="50%" stopColor="#E8B33A"/>
        <stop offset="100%" stopColor="#B8860B"/>
      </linearGradient>
    </defs>
    {/* 브랜드 로고는 1 열: textLength 제거하고 viewBox 와 fontSize 로 크기 조절 */}
    <text
      x="200" y="18" fontSize="20" letterSpacing="1.5"
      textAnchor="middle" fontFamily="'Arial Black', 'Helvetica Neue', sans-serif" fontWeight="900" fill="#E8E8E8"
    >
      <tspan fill="#F5F5F5">Smart</tspan>
      <tspan fill="url(#sp-gold)">Pilots</tspan>
      <tspan fill="#BFBFBF"> FLIGHTCAL</tspan>
    </text>
    <line x1="6" y1="25" x2="394" y2="25" stroke="url(#sp-gold)" strokeWidth="0.9" opacity="0.33"/>
  </svg>
);

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function useClock(tz: 'UTC' | 'LOCAL' = 'UTC'): { hhmm: string; zSuffix: string } {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    const d = now;
    const hh = tz === 'UTC' ? d.getUTCHours() : d.getHours();
    const mm = tz === 'UTC' ? d.getUTCMinutes() : d.getMinutes();
    return {
      hhmm: `${pad2(hh)}:${pad2(mm)}`,
      zSuffix: tz === 'UTC' ? 'UTC' : '',
    };
  }, [now, tz]);
}

export const FLT_MENU_ITEMS = [
  'Density Altitude',
  'Distance',
  'Endurance',
  'Fuel Consumption',
  'Pressure Altitude',
  'Rate of Descent',
  'Rate of Descent Mach',
  'Reserve Fuel',
  'Speed (Airspeed)',
  'Time (ETA)',
  'Top of Descent',
  'Wind Component',
  'Fuel Uplift',
  'Cold Temp Correction',
];

export const NUMERIC_KEYPAD_KEYS: { row: string[] }[] = [
  { row: ['FLT','CONV','▲','CURR','CALC'] },
  { row: ['WX','BACK','POWER','HOT','DUTY'] },
  { row: ['STOP\nWATCH','DICT','▼','CONV\nUNIT','÷'] },
  { row: ['C','7','8','9','×'] },
  { row: ['BKSP','4','5','6','−'] },
  { row: [':','1','2','3','+'] },
  { row: ['+−','.','0','√','='] },
];

export const QWERTY_KEYPAD_KEYS: { row: string[] }[] = [
  { row: ['FLT','CONV','▲','CURR','CALC'] },
  { row: ['WX','BACK','POWER','HOT','DUTY'] },
  { row: ['STOP\nWATCH','DICT','▼','CONV\nUNIT'] },
  { row: ['Q','W','E','R','T','Y','U','I','O','P'] },
  { row: ['A','S','D','F','G','H','J','K','L'] },
  { row: ['SHIFT','Z','X','C','V','B','N','M','BKSP'] },
  { row: ['123','EN','−','SPACE','/','GO'] },
];

export const KOREAN_KEYPAD_KEYS: { row: string[] }[] = [
  { row: ['FLT','CONV','▲','CURR','CALC'] },
  { row: ['WX','BACK','POWER','HOT','DUTY'] },
  { row: ['STOP\nWATCH','DICT','▼','CONV\nUNIT'] },
  { row: ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'] },
  { row: ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'] },
  { row: ['SHIFT','ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ','BKSP'] },
  { row: ['123','한','−','SPACE','/','GO'] },
];

function renderKeyLabel(raw: string, isScientificMode: boolean, isHmsMode: boolean): React.ReactNode {
  // 과학 계산기 모드에서 버튼 라벨 변경
  if (isScientificMode) {
          if (raw === 'DUTY') return 'sin';
          if (raw === 'HOT') return 'cos';
          if (raw === 'BACK') return 'tan';
          if (raw === 'CURR') return 'ln';
          if (raw === 'FLT') return 'log';
          if (raw === 'CONV') return 'x²';
          if (raw === 'WX') return '1/x';
          if (raw === 'STOP\nWATCH') return 'π';
          if (raw === 'DICT') return 'eˣ';
          if (raw === '▲') return 'xʸ';
          if (raw === '▼') return '√x';
          if (raw === 'POWER') return '!';
          if (raw === 'CALC') return 'CALC'; // CALC 버튼은 기존 라벨 유지
        }
  // HMS 모드는 표준 계산기 라벨 사용
  if (isHmsMode) {
    return renderKeyLabel(raw, false, false);
  }
  if (raw === 'WX') return <><span style={{display:'block'}}>WX</span><span style={{display:'block', fontSize:'0.72em', opacity:0.8}}>NOTAM</span></>;
  if (raw === '+−') return <>+−</>;
  if (raw === '±') return <>±</>;
  if (raw === '√') return <>√</>;
  if (raw === 'SHIFT') return <span style={{fontSize:'0.8em'}}>⇧</span>;
  if (raw === 'SPACE') return <span style={{fontSize:'0.8em'}}>␣</span>;
  if (raw === 'GO') return <span style={{fontSize:'0.9em', fontWeight:'bold'}}>GO</span>;
  if (raw === '123') return <span style={{fontSize:'0.8em'}}>123</span>;
  if (raw === 'EN' || raw === '한') return <span style={{fontSize:'0.8em'}}>🌍</span>; // 지구본 아이콘 (흑백)
  if (raw === 'EMOJI') return <span style={{fontSize:'0.8em'}}>😊</span>;
  if (raw === 'BKSP') return <span style={{fontSize:'1.6em'}}>⌫</span>;
  if (raw.includes('\n')) return raw.split('\n').map((s, i) => <React.Fragment key={i}>{s}{i < raw.split('\n').length - 1 ? <br /> : null}</React.Fragment>);
  return raw;
}

function Cx3KeypadShell() {
  const { state } = useCx3Router();
  const { icaoActive } = useConvIcao();
  const isQwertyMode = state.activeRoot === 'WX' || state.activeRoot === 'DICT' || (state.activeRoot === 'CONV' && icaoActive);
  const isScientificMode = state.activeRoot === 'CALC' && state.stack[state.stack.length - 1]?.subId === 'SCIENTIFIC';
  const { angleMode } = useCalcResult();
  const isHmsMode = state.activeRoot === 'CALC' && state.stack[state.stack.length - 1]?.subId === 'STANDARD' && angleMode === 'HMS';
  const [keypadType, setKeypadType] = useState<KeypadType>(isQwertyMode ? 'QWERTY' : 'NUMERIC');
  
  // 라우터 상태가 변경될 때 키보드 타입 재설정 (기본 영어로)
  useEffect(() => {
    setKeypadType(isQwertyMode ? 'QWERTY' : 'NUMERIC');
  }, [isQwertyMode]);
  
  // "한/En" 키를 클릭할 때 키보드 타입 전환
  const { publish, subscribe } = useCx3Keypad();
  useEffect(() => {
    const unsubscribe = subscribe((k: Cx3KeyId) => {
      if (k === 'LANG') {
        setKeypadType(prev => prev === 'QWERTY' ? 'KOREAN' : 'QWERTY');
        return 'stop'; // 다른 핸들러가 처리하지 않도록 중단
      }
      if (k === 'NUM') {
        // NUM 키를 클릭할 때 keypadType 전환 (QWERTY ↔ NUMERIC)
        setKeypadType(prev => prev === 'NUMERIC' ? 'QWERTY' : 'NUMERIC');
        return 'stop'; // 다른 핸들러가 처리하지 않도록 중단
      }
      if (k === 'CONVU' && state.activeRoot === 'DICT') {
        // CONV UNIT 키를 클릭할 때 keypadType 전환 (QWERTY ↔ NUMERIC) - DICT 모드에서만
        setKeypadType(prev => prev === 'NUMERIC' ? 'QWERTY' : 'NUMERIC');
        return 'stop'; // 다른 핸들러가 처리하지 않도록 중단
      }
    });
    return unsubscribe;
  }, [subscribe, state.activeRoot]);
  
  // 상태에 따라 키패드 설정
  // isQwertyMode가 true일 때 keypadType이 NUMERIC이면 NUMERIC 키패드 사용, 아니면 QWERTY/KOREAN
  const isNumericMode = keypadType === 'NUMERIC';
  const rows = isQwertyMode ? 
    (isNumericMode ? NUMERIC_KEYPAD_KEYS : (keypadType === 'QWERTY' ? QWERTY_KEYPAD_KEYS : KOREAN_KEYPAD_KEYS)) : 
    NUMERIC_KEYPAD_KEYS;
  const keypadMap = isQwertyMode ? 
    (isNumericMode ? NUMERIC_KEYPAD_MAP : (keypadType === 'QWERTY' ? QWERTY_KEYPAD_MAP : KOREAN_KEYPAD_MAP)) : 
    NUMERIC_KEYPAD_MAP;
  const onClick = (raw: string) => {
    console.log('=== raw key clicked:', raw); // 디버그 로그
    const id = keypadMap[raw];
    console.log('=== mapped key id:', id); // 디버그 로그
    if (id) publish(id as Cx3KeyId);
  };
  
  // 디버그 로그: NUMERIC_KEYPAD_KEYS 확인
  console.log('=== NUMERIC_KEYPAD_KEYS:', NUMERIC_KEYPAD_KEYS);
  
  return (
    <div className="cx3-keypad" aria-label="cx3 keypad">
      {rows.map((r, ri) => {
            console.log(`=== Row ${ri} length:`, r.row.length);
            const isQwertyRow = isQwertyMode && keypadType !== 'NUMERIC' && r.row.length > 5;
            return (
              <div key={ri} className={`cx3-keypad-row${isQwertyRow ? ' cx3-keypad-row--qwerty' : ''}`}>
                {r.row.map((raw, ci) => {
              const isPower = raw === 'POWER';
              const isEqualOrange = raw === '=';
              const isMenu = ['FLT','CONV','CURR','CALC','HOT','BACK','DUTY','SET','WX','STOP\nWATCH','DICT','CONV\nUNIT'].includes(raw);
              const isOp = ['÷','×','−','+','√','+−','/'].includes(raw);
              const isNav = raw === '▲' || raw === '▼';
              const isClear = raw === 'BKSP';
              const isQwertyKey = /^[A-Z]$/.test(raw); // A-Z
              const isSpecial = ['SHIFT','SPACE','GO','123','KR','EMOJI'].includes(raw);
              let long = raw === 'DICT' || raw === 'CONV\nUNIT' || raw === 'STOP\nWATCH' || raw === 'SPACE';
              // QWERTY 키패드에서 SPACE 키를 4열로 늘리기
              if (isQwertyMode && raw === 'SPACE') {
                long = true;
              }
              // 과학 계산기 모드에서 상하 버튼과 파워버튼을 fn 클래스로 적용
              const isScientificNav = isScientificMode && (raw === '▲' || raw === '▼');
              const isScientificPower = isScientificMode && raw === 'POWER';
              const cls = [
                'cx3-key',
                isScientificPower ? 'fn' : (isPower ? 'power' : ''),
                isEqualOrange ? 'orange-equal' : '',
                isMenu ? 'fn menu' : (isScientificNav || isScientificPower ? 'fn menu' : (long && !isOp && !isNav && !isClear) ? 'fn' : ''),
                isOp ? 'op' : '',
                isScientificNav ? '' : (isNav ? 'nav arrow' : ''),
                isClear ? 'fn' : '',
                isQwertyKey ? 'qwerty' : '',
                isSpecial ? 'special' : '',
                // QWERTY 키패드에서 SPACE 키를 4열로 늘리기
                (isQwertyMode && raw === 'SPACE') ? 'span4' : '',
                // QWERTY 키패드에서 BKSP 키를 2열로 늘리기
                (isQwertyMode && keypadType !== 'NUMERIC' && raw === 'BKSP') ? 'span2' : '',
                // QWERTY 키패드에서 GO 키를 2열로 늘리기
                (isQwertyMode && keypadType !== 'NUMERIC' && raw === 'GO') ? 'span2' : '',
                // QWERTY 키패드에서 두 번째 행(ASDFGHJKL)과 세 번째 행(SHIFT, ZXCVBNM, BKSP)을 중앙 정렬하기 위한 클래스
                (isQwertyMode && (ri === 4 || ri === 5)) ? 'cx3-key--center' : '',
              ].filter(Boolean).join(' ');
              const title = raw.replace(/\n/g, ' ');
              return (
                <button
                  key={ci}
                  className={cls}
                  aria-label={title}
                  onClick={() => onClick(raw)}
                  title={title}
                  type="button"
                >
                  {(isPower && !isScientificPower) ? null : renderKeyLabel(raw, isScientificMode, isHmsMode)}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Cx3Body({ battLevel, clockTz }: { battLevel: number; clockTz: 'UTC'|'LOCAL' }) {
  const clock = useClock(clockTz);
  const { state } = useCx3Router();
  const label = rootLabelFor(state.activeRoot, 'E6-B');
  const banner = buildBannerText();
  const expired = isTrialExpired();
  const daysLeft = isTrialBuild() ? daysUntilExpire() : -1;
  
  // Capacitor Native 환경 여부 판단
  const isCapacitorNative = () => {
    try {
      const w = window as any;
      if (!w?.Capacitor) return false;
      const Cap = w.Capacitor;
      if (typeof Cap?.getPlatform === 'function') {
        const platform = Cap.getPlatform();
        if (platform === 'android' || platform === 'ios') return true;
      }
      if (Cap?.platform && Cap.platform !== 'web') return true;
      const Http = Cap?.Plugins?.Http ?? Cap?.Plugins?.CapacitorHttp ?? w?.CapacitorHttp;
      if (Http && (Http.request || Http.get)) return true;
      return false;
    } catch (e) {
      console.error('isCapacitorNative check failed:', e);
      return false;
    }
  };
  
  const { inDisplay, inputFocused, dictDetailMode } = useWxScreen();
  const isAndroidApp = true; // 안드로이드 에뮬레이터에서도 키패드가 정상적으로 작동하도록 강제로 true로 설정
  // WX 화면에서 키패드 숨김 조건:
  //   1) 결과 표시 중(inDisplay) → 키패드 숨김 (기존)
  //   2) 입력 모드이지만 ICAO input이 focus되어 안드로이드 키보드가 떠야 할 때 → 키패드 숨김
  // DICT 화면에서 키패드 숨김 조건:
  //   - DICT 상세 모드일 때만 키패드 숨김 (상세보기에서 스크롤이 가능하도록 전체 화면 사용)
  const hideKeypad = (state.activeRoot === 'WX' && isAndroidApp && (inDisplay || inputFocused)) || (state.activeRoot === 'DICT' && dictDetailMode);
  return (
    <div className="cx3-app" role="application" aria-label="FlightCal">
      <div className="cx3-device">
        <div className="cx3-brand-wrap">
          {ASA_WING_LOGO}
        </div>
        <div className="cx3-lcd-wrap">
          <div className="cx3-status-bar">
            <div className="cx3-status-left">{label}</div>
            <div className="cx3-status-clock">
              {clock.hhmm}
              <span style={{ opacity: 0.9, marginLeft: 3, letterSpacing: 0.5 }}>{clock.zSuffix}</span>
            </div>
          </div>

          {banner && !expired && (
            <div className="cx3-trial-banner" title={banner}>
              <span className="cx3-trial-banner-main">{banner}</span>
              <span className="cx3-trial-banner-sub">
                {daysLeft >= 0 ? `D-${daysLeft}` : ''}
              </span>
            </div>
          )}

          <div className="cx3-lcd-screen" id="cx3-lcd">
            <Cx3Screen />
            {expired && (
              <div className="cx3-trial-expired-lock" role="alert" aria-live="assertive">
                <div className="cx3-trial-expired-title">SMART FLIGHTCAL</div>
                <div className="cx3-trial-expired-ver">ver {APP_VERSION} · TRIAL</div>
                <div className="cx3-trial-expired-line">TRIAL PERIOD EXPIRED</div>
                <div className="cx3-trial-expired-date">{TRIAL_EXPIRE_RAW}</div>
                <div className="cx3-trial-expired-contact">PLEASE CONTACT SMART PILOTS</div>
                <div className="cx3-trial-expired-contact2">smartpilot@smartpilot.co.kr</div>
              </div>
            )}
          </div>
        </div>
        {/* WX 화면: 결과 표시 중이거나 ICAO input이 focus되면 키패드 숨김 */}
        {!hideKeypad ? (
          <Cx3KeypadShell />
        ) : null}
      </div>
    </div>
  );
}

export interface Cx3DeviceProps {
  children?: React.ReactNode;
  battLevel?: number;
  clockTz?: 'UTC' | 'LOCAL';
}

export default function Cx3Device({ battLevel = 100, clockTz = 'UTC' }: Cx3DeviceProps) {
  return (
    <Cx3KeypadProvider>
      <Cx3RouterProvider>
        <CalcResultProvider>
          <Cx3Body battLevel={battLevel} clockTz={clockTz} />
        </CalcResultProvider>
      </Cx3RouterProvider>
    </Cx3KeypadProvider>
  );
}
