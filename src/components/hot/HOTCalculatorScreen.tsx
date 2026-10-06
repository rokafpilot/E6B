import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import PopupSelect, { type PopupOption } from '../common/PopupSelect';
import {
  useBlankField, lineStateFrom,
} from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import {
  useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId,
} from '../../context/Cx3KeypadContext';
import {
  HOT_FLUIDS_DSHOT,
  HOT_PRECIP9_LABELS,
  HOT_MRATIO3_SHORT,
  HOT_VIS11_SHORT,
  HOT_TOD2_SHORT,
  lookupHOT, precip9ShortLabel, mratioShortLabel, visShortLabel,
  findRangeIndex,
  cToF, fToC, type HOTFluidType, type HOTFluid4,
} from '../../lib/holdoverTables';
import { useHotTod } from '../layout/Cx3Device';
import { setHoldoverTimerParams } from '../../hot/holdoverTimerParams';
import { parseTotalToMin } from '../../lib/holdoverTables';

/* 7행 구조 (TOD 맨 위 + 6행 통합) · 8행 LCD 꽉차지 않게 1행 여유 확보 ✅
 * 0: TOD    Time of Day (Day ☀️ / Night 🌙 2종)
 * 1: WCON   Weather Condition (Precip 16종)
 * 2: OAT    Outside Air Temperature °C / °F
 * 3: VIS    Visibility 11단계
 * 4: FLUID  Fluid (Type I/II/III/IV + Brand 19종 통합 · 1 popup!)
 * 5: MRATIO Mixture Ratio Fluid:Water
 * 6: HOT    Holdover Time 결과
 */
const LINES = ['TOD','WCON','OAT','VIS','FLUID','MRATIO','HOT'] as const;
type K = typeof LINES[number];
type PopupId = 'WCON' | 'OAT' | 'VIS' | 'FLUID' | 'MRATIO' | null;
const LABELS: Record<K, string> = {
  TOD: 'Time of Day',
  WCON: 'Weather',
  OAT: 'OAT (Outside)',
  VIS: 'Visibility',
  FLUID: 'Fluid',
  MRATIO: 'Mixture Ratio',
  HOT: 'Holdover HOT',
};
const TEMP_PRESET_C: number[] = [
  1, 0,
  -1, -2, -3, -4, -5,
  -6, -7, -8, -9, -10,
  -11, -12, -13, -14, -15,
  -16, -17, -18, -19, -20,
  -21, -22, -23, -24, -25,
  -26, -27, -28, -29, -30
];
const MRATIO_FULL_SHORT = ['100 / 0', '75 / 25', '50 / 50'];

function buildWCONOptions(): PopupOption<number>[] {
  return HOT_PRECIP9_LABELS.map((lb, i) => ({
    id: i, label: lb, unit: precip9ShortLabel(i),
  }));
}
function buildMRATIOOptions(): PopupOption<number>[] {
  return MRATIO_FULL_SHORT.map((lb, i) => ({
    id: i, label: lb, unit: '',
  }));
}
function buildVISOptions(): PopupOption<number>[] {
  return HOT_VIS11_SHORT.map((lb, i) => ({
    id: i, label: lb, unit: '',
  }));
}
function buildFLUIDOptions(): PopupOption<number>[] {
  const out: PopupOption<number>[] = [];
  let lastType: HOTFluidType | '' = '';
  HOT_FLUIDS_DSHOT.forEach((f, i) => {
    if (lastType !== f.type) {
      lastType = f.type;
      const n = HOT_FLUIDS_DSHOT.filter(x => x.type === f.type).length;
      out.push({ id: -(i + 1000) as any, label: `──── Type ${f.type} (${n}종) ────`, isSeparator: true });
    }
    out.push({ id: i, label: f.brand, unit: '' });
  });
  return out;
}
function buildTEMPTOptions(unit: 'C' | 'F'): PopupOption<string>[] {
  const warm: PopupOption<string>[] = [];
  const cold: PopupOption<string>[] = [];
  TEMP_PRESET_C.forEach(tc => {
    const v = unit === 'C' ? tc : Math.round(cToF(tc));
    const label = unit === 'C'
      ? `${tc >= 0 ? '+' : ''}${tc} °C`
      : `${v >= 0 ? '+' : ''}${v} °F`;
    const pop: PopupOption<string> = {
      id: String(tc),
      label,
      unit: '',
    };
    if (tc >= 0) warm.push(pop); else cold.push(pop);
  });
  return [
    { id: '__sep_warm', label: '── Above Freezing ──', isSeparator: true } as PopupOption<string>,
    ...warm,
    { id: '__sep_cold', label: '── Below Freezing ──', isSeparator: true } as PopupOption<string>,
    ...cold,
  ];
}

export default function HOTCalculatorScreen() {
  const { cursor, dispatch, goSub } = useCx3Nav(LINES.length);

  const [wIdx, setWIdx] = useState<number>(5);
  const [visIdx, setVisIdx] = useState<number>(10);
  const [todIdx, setTodIdx] = useHotTod();
  const [mrIdx, setMrIdx] = useState<number>(0);
  const [fluidIdx, setFluidIdx] = useState<number>(0);
  const fluid: HOTFluid4 | null = HOT_FLUIDS_DSHOT[fluidIdx] ?? null;

  const tempField = useBlankField('dec', '-10');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  /** ✅ Excel DSHOT는 1도 단위 정수로만 구성 → OAT/C 모두 1도 단위 정수로 강제
   *  (1) 입력: 소수점 키 비허용 → 정수만 입력 가능
   *  (2) 계산: 최종 °C 환산 후 Math.round() → 정수 매칭으로 Excel과 1:1 일치
   */
  const oatC = useMemo<number>(() => {
    const n = tempField.toNum();
    if (!isFinite(n)) return NaN;
    const celsius = tempUnit === 'C' ? n : fToC(n);
    return Math.round(celsius); /* 1도 단위 정수화 */
  }, [tempField.value, tempUnit]);

  const [popup, setPopup] = useState<PopupId>(null);

  /* Selected Fluid Temp Range 라벨 (플루이드 선택지 라벨 우측 작은 표시용) */
  const trLabel = useMemo(() => {
    if (!fluid || !isFinite(oatC)) return '';
    const ri = findRangeIndex(fluid.ranges, oatC);
    if (ri < 0) return '';
    const r = fluid.ranges[ri];
    if (r.t === 99) return '≥0°C';
    if (r.t === -999) return '<-3°C';
    const next = fluid.ranges[ri + 1];
    const tmax = next ? next.t - 1 : null;
    if (tmax === null) return `≥${r.t}°C`;
    return `${r.t}~${tmax}°C`;
  }, [fluid, oatC]);

  /** OAT strictly > 0°C 영상이면 De-icing 자체 불필요 → HOT 계산 차단
   *  ✅ oatC = 항상 °C 단위 Math.round() 로 정규화된 값이므로 직접 비교
   *  정확히 0°C 까지는 FAA DSHOT 공식 데이터 존재하므로 허용
   */
  const isOATPositiveInvalid = isFinite(oatC) && oatC > 0;

  const hotResult = useMemo<string | null>(() => {
    if (!fluid || !isFinite(oatC)) return null;
    if (isOATPositiveInvalid) return null;
    return lookupHOT(fluid, oatC, wIdx, mrIdx, visIdx, todIdx);
  }, [fluid, oatC, wIdx, mrIdx, visIdx, todIdx, isOATPositiveInvalid]);

  /* HOT 총분 표시 (FAA 규격): '180:00'(3시간) → 180 min · "3:00 = 3분" 오해 방지 */
  const hotMin = useMemo<number | null>(() => {
    if (!hotResult) return null;
    const m = parseTotalToMin(hotResult);
    return m === null ? null : Math.round(m);
  }, [hotResult]);

  /** OAT 가 유체 최저 정의 온도(LOUT) 미만 → DSHOT 데이터 없음 → 'unavailable' 표시
   *  (findRangeIndex 가 -1 반환: 레거시 -999 catch-all Type I 제외) */
  const isOATBelowFluidMin = useMemo<boolean>(() => {
    if (!fluid || !isFinite(oatC) || isOATPositiveInvalid) return false;
    return findRangeIndex(fluid.ranges, oatC) < 0;
  }, [fluid, oatC, isOATPositiveInvalid]);

  useOnCx3Key((k: Cx3KeyId) => {
    const L = LINES[cursor];
    if (popup) return undefined;

    if (L === 'TOD') {
      /* Time of Day 2종 토글: DAY ↔ NIGHT · SETU/CONVU/UP/DN 아무 키나 토글! */
      if (k === 'CONVU' || k === 'UP' || k === 'DN') {
        setTodIdx(i => (i === 0 ? 1 : 0) as 0 | 1);
        return 'stop';
      }
    }
    if (L === 'WCON') {
      const N = HOT_PRECIP9_LABELS.length;
      if (k === 'DN') { setWIdx(i => (i+1) % N); return 'stop'; }
      if (k === 'CONVU' || k === 'UP') { setWIdx(i => (i - 1 + N) % N); return 'stop'; }
    }
    if (L === 'VIS') {
      const N = HOT_VIS11_SHORT.length;
      if (k === 'DN') { setVisIdx(i => (i+1) % N); return 'stop'; }
      if (k === 'CONVU' || k === 'UP') { setVisIdx(i => (i - 1 + N) % N); return 'stop'; }
    }
    if (L === 'FLUID') {
      const N = HOT_FLUIDS_DSHOT.length;
      if (k === 'DN') { setFluidIdx(i => (i+1) % N); return 'stop'; }
      if (k === 'CONVU' || k === 'UP') { setFluidIdx(i => (i - 1 + N) % N); return 'stop'; }
    }
    if (L === 'MRATIO') {
      const N = HOT_MRATIO3_SHORT.length;
      if (k === 'DN') { setMrIdx(i => (i+1) % N); return 'stop'; }
      if (k === 'CONVU' || k === 'UP') { setMrIdx(i => (i - 1 + N) % N); return 'stop'; }
    }
    if (L === 'OAT') {
      if (k === 'CONVU') {
        const cur = tempField.toNum();
        if (isFinite(cur)) {
          const newV = tempUnit === 'C' ? cToF(cur) : fToC(cur);
          tempField.setValue(String(Math.round(newV))); /* 1도 단위 정수로만 전환 */
        }
        setTempUnit(u => u === 'C' ? 'F' : 'C');
        return 'stop';
      }
      if (k === 'CLR')  { tempField.clear(); return 'stop'; }
      if (k === 'BKSP') { tempField.backspace(); return 'stop'; }
      if (k === 'SIGN') { tempField.toggleSign(); return 'stop'; }
      /* OAT 1도 단위: 소수점(.) 키 아예 무시 → 소수 입력 불가! */
      if (k === 'DOT')  { return 'stop'; }
      if (NUMBER_KEYS.includes(k)) {
        const c = keyIdToChar(k);
        if (c) { tempField.pushChar(c); return 'stop'; }
      }
    }
    return undefined;
  }, [cursor, wIdx, visIdx, todIdx, fluidIdx, mrIdx, tempField, tempUnit, popup], 12);

  useCx3OnEnter(() => {
    if (popup) return;
    if (LINES[cursor] === 'HOT' && hotResult) {
      const minutes = parseTotalToMin(hotResult) ?? 0;
      if (minutes > 0) {
        setHoldoverTimerParams({ durationMinutes: minutes, rawLabel: hotResult });
        goSub('HOT_TIMER', `HOT Timer · ${Math.round(minutes)} min`, LINES.length);
      }
      return;
    }
    if (cursor < LINES.length - 1) dispatch({ type: 'NAV', delta: 1 });
  }, [cursor, popup, hotResult, goSub]);

  const tempDisplay = (() => {
    if (tempField.isBlank) return '--';
    const n = tempField.toNum();
    if (!isFinite(n)) return '--';
    return String(Math.round(n)); /* OAT 1도 단위 정수만 표시 */
  })();
  const tempUnitS = tempUnit === 'C' ? '°C' : '°F';

  // === 값 디스플레이 (outs): 분수 (N/16, 1/3 등) prefix 완전 삭제 · 실제 label만 깔끔히 노출! ===
  const outs: Record<K, string> = {
    TOD: HOT_TOD2_SHORT[todIdx] ?? 'DAY',
    WCON: precip9ShortLabel(wIdx) ?? '--',
    OAT: tempDisplay,
    VIS: visShortLabel(visIdx) ?? '--',
    FLUID: fluid ? fluid.brand : '--',
    MRATIO: MRATIO_FULL_SHORT[mrIdx],
    HOT: isOATPositiveInvalid ? 'OAT+ De-Icing NOT Needed'
       : isOATBelowFluidMin ? 'unavailable'
       : (hotMin !== null ? String(hotMin) : '--'),
  };
  // === units: 순수 단위(°C, °F, min) 외 FLUID 범위 라벨만 trLabel 유지! ===
  const units: Record<K, string> = {
    TOD: '',
    WCON: '',
    OAT: tempUnitS,
    VIS: '',
    FLUID: trLabel ? trLabel : '',
    MRATIO: '',
    HOT: (isOATPositiveInvalid || isOATBelowFluidMin) ? '' : 'min',
  };

  const openPopupFor = (idx: number) => {
    if (LINES[idx] === 'TOD') {
      // TOD 행 클릭 → Day / Night 바로 토글!
      setTodIdx(i => (i === 0 ? 1 : 0) as 0 | 1);
      dispatch({ type: 'SET_CURSOR', idx });
      return;
    }
    if (LINES[idx] === 'HOT') {
      // HOT 행 클릭 → Holdover Timer 화면 이동!
      if (hotResult) {
        const minutes = parseTotalToMin(hotResult) ?? 0;
        if (minutes > 0) {
          setHoldoverTimerParams({ durationMinutes: minutes, rawLabel: hotResult });
          goSub('HOT_TIMER', `HOT Timer · ${Math.round(minutes)} min`, LINES.length);
        }
      }
      return;
    }
    dispatch({ type: 'SET_CURSOR', idx });
    switch (LINES[idx]) {
      case 'WCON':  setPopup('WCON'); break;
      case 'OAT':   setPopup('OAT');  break;
      case 'VIS':   setPopup('VIS');  break;
      case 'FLUID': setPopup('FLUID');break;
      case 'MRATIO':setPopup('MRATIO'); break;
    }
  };

  return (
    <>
      <div className="cx3-lcd-menu">
        {LINES.map((k, i) => {
          // ✅ TOD: 토글 ↻ · 나머지 팝업 행: ▾ 소형 아이콘!
          const TAP_POPUPS: K[] = ['WCON','OAT','VIS','FLUID','MRATIO'];
          let hintRight: React.ReactNode = null;
          if (k === 'TOD') {
            hintRight = (
              <span style={{ fontSize: 12, marginLeft: 6, color: todIdx === 0 ? '#7dff7d' : '#ffc46b', opacity: 0.92 }}>
                {todIdx === 0 ? '☀️' : '🌙'}
              </span>
            );
          } else if (TAP_POPUPS.includes(k)) {
            hintRight = (
              <span style={{ fontSize: 11, opacity: 0.85, marginLeft: 6, color: '#8ab4ff' }}>▾</span>
            );
          }
          // ✅ valueClass TOD 커스텀: Day=그린/양호 / Night=앰버/야간 보수치
          const vcK: 'default'|'green'|'amber'|'dashes' =
            (k === 'TOD') ? (todIdx === 0 ? 'green' : 'amber')
            : (k === 'HOT' && (isOATPositiveInvalid || isOATBelowFluidMin)) ? 'amber'
            : (k === 'HOT') ? (hotResult ? 'green' : 'dashes')
            : (k === 'OAT' && tempField.isBlank) ? 'dashes'
            : (k === 'FLUID' && !fluid) ? 'dashes'
            : 'default';
          const st: any =
            (k === 'HOT' && hotResult) ? 'calc'
            : (k === 'OAT') ? lineStateFrom(tempField as any)
            : 'input';
          return (
            <div key={k} onClick={() => openPopupFor(i)}>
              <Cx3Line
                label={LABELS[k]} valueDisplay={outs[k]} unit={units[k]}
                state={st} cursor={cursor === i} valueClass={vcK as any}
                rightExtra={hintRight}
              />
            </div>
          );
        })}
      </div>

      <PopupSelect open={popup==='WCON'} title="Weather Type · 16종" options={buildWCONOptions()} selectedId={wIdx} onClose={()=>setPopup(null)} onSelect={id=>setWIdx(id as number)} />
      <PopupSelect open={popup==='VIS'}  title="Visibility · 11단계 (m)" options={buildVISOptions()} selectedId={visIdx} onClose={()=>setPopup(null)} onSelect={id=>setVisIdx(id as number)} />
      <PopupSelect open={popup==='FLUID'} title="Fluid" options={buildFLUIDOptions()} selectedId={fluidIdx} onClose={()=>setPopup(null)} onSelect={(id)=>{
        const i = id as number;
        if (i >= 0 && i < HOT_FLUIDS_DSHOT.length) setFluidIdx(i);
      }} />
      <PopupSelect open={popup==='MRATIO'} title="Mixture Ratio · Fluid : Water 3종" options={buildMRATIOOptions()} selectedId={mrIdx} onClose={()=>setPopup(null)} onSelect={(id)=>setMrIdx(id as number)} />
      <PopupSelect open={popup==='OAT'} title={`OAT 프리셋 · 현재: °${tempUnit}`} options={buildTEMPTOptions(tempUnit)} selectedId={isFinite(tempField.toNum())? String(tempUnit==='C'?Math.round(tempField.toNum()):Math.round(fToC(tempField.toNum()))):undefined} onClose={()=>setPopup(null)} onSelect={(id)=>{
        if (id.startsWith('__sep_')) return;
        const tcC = parseInt(id, 10);
        const final = tempUnit === 'C' ? tcC : Math.round(cToF(tcC) * 10) / 10;
        tempField.setValue(String(final));
      }} />
    </>
  );
}

export function HOT_BATT_SWAP(setTod: (fn: (i: number) => number) => void) {
  setTod(i => (i + 1) % 2);
}
