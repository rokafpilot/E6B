import React, { useMemo, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import {
  useBlankField, formatNumber, lineStateFrom,
} from '../../hooks/useBlankField';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import {
  useOnCx3Key, keyIdToChar, NUMBER_KEYS, Cx3KeyId,
} from '../../context/Cx3KeypadContext';

/*
 * FAA Part 91K · 135 · FTL · EASA OPS 기준 Duty / Rest Time 분할 계산기
 *
 * 입력: 총 시간 (hh:mm HMS 포맷 또는 분 정수)
 *      콜론(:) 있으면 HMS 자동 인식, 없으면 → 순수 분 (ex: 540 = 9시간 00분)
 *
 * 출력 (FAR 주요 분할 비율):
 *  R1 = 1/2 · Half (휴식 절반, 승무원 교대 등)
 *  R2 = 1/3 · Third (FL350 이상 3분할 휴식)
 *  R3 = 2/3 · Two Thirds (잔여 2/3 듀티 등)
 *  R4 = 1/4 · Quarter (4인 승무 / FDP 4분할)
 *
 * 각 결과는 3가지 포맷 동시 제공:
 *  · M = 총 분 단위 (정수)
 *  · HMS = hh:mm (시:분, 가장 많이 쓰는 포맷)
 *  · HR = 소수점 2자리 시간 단위 (log book 기입용)
 */
type InputMode = 'HMS' | 'MIN';
type RatioKey = 'HALF' | 'THIRD' | 'TWOTHIRD' | 'QUARTER';
const RATIO_LABELS: Record<RatioKey, string> = {
  HALF: '1/2 Half',
  THIRD: '1/3 Third',
  TWOTHIRD: '2/3 2Third',
  QUARTER: '1/4 Quarter',
};
const RATIO_VALUES: Record<RatioKey, number> = {
  HALF: 1 / 2,
  THIRD: 1 / 3,
  TWOTHIRD: 2 / 3,
  QUARTER: 1 / 4,
};
const RATIO_ORDER: RatioKey[] = ['HALF', 'QUARTER', 'THIRD', 'TWOTHIRD'];

// 입력 총 분
function parseToMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p, 10));
    const valid = parts.every(p => Number.isFinite(p));
    if (!valid) return null;
    if (parts.length === 2) {
      const [hh, mm] = parts;
      return Math.max(0, hh * 60 + mm);
    }
    if (parts.length === 3) {
      const [hh, mm, ss] = parts;
      return Math.max(0, hh * 60 + mm + Math.round(ss / 60));
    }
  }
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  // 1~4자리 숫자인 경우: 1000 이상이면 hhmm으로 간주 (2200 → 22시간 00분)
  if (n >= 100) {
    const s2 = String(n).padStart(4, '0');
    const hh = parseInt(s2.slice(0, -2), 10);
    const mm = parseInt(s2.slice(-2), 10);
    if (mm < 60 && Number.isFinite(hh) && Number.isFinite(mm)) {
      return hh * 60 + mm;
    }
  }
  return n;
}

function fmtHMS(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const a = Math.abs(Math.round(totalMin));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtM(totalMin: number): string {
  return `${Math.round(totalMin)}M`;
}

function fmtHr(totalMin: number): string {
  const h = totalMin / 60;
  return `${formatNumber(h, 2)}H`;
}

// LCD 너비에 맞춰 한 줄에 3포맷 합성: label + HMS + (M / H)  22자 내로
function buildResultLine(rkey: RatioKey, totalMin: number): {
  label2: string;
  hms: string;
  extra: string;
  ok: boolean;
} {
  const ok = Number.isFinite(totalMin) && totalMin >= 0;
  if (!ok) return { label2: RATIO_LABELS[rkey].slice(0, 11), hms: '--:--', extra: '--M  --H', ok: false };
  const rval = totalMin * RATIO_VALUES[rkey];
  return {
    label2: RATIO_LABELS[rkey].slice(0, 11),
    hms: fmtHMS(rval),
    extra: `${fmtM(rval).padStart(5,' ')} ${fmtHr(rval).padStart(5,' ')}`,
    ok: true,
  };
}

const LINES = ['TOTAL', 'HALF', 'QUARTER', 'THIRD', 'TWOTHIRD'] as const;
type K = typeof LINES[number];
const LABELS: Record<K, string> = {
  TOTAL: 'Total Duty',
  HALF: RATIO_LABELS.HALF,
  QUARTER: RATIO_LABELS.QUARTER,
  THIRD: RATIO_LABELS.THIRD,
  TWOTHIRD: RATIO_LABELS.TWOTHIRD,
};

export default function DutyTimeCalculatorScreen() {
  const N = LINES.length;
  const { cursor, dispatch } = useCx3Nav(N);
  const field = useBlankField('time', '09:00');
  const [mode, setMode] = useState<InputMode>('HMS');

  const totalMin = useMemo<number | null>(() => parseToMinutes(field.value), [field.value]);

  useOnCx3Key((k: Cx3KeyId) => {
    const L = LINES[cursor];
    if (L === 'TOTAL') {
      if (k === 'CONVU') { setMode(m => m === 'HMS' ? 'MIN' : 'HMS'); return 'stop'; }
      if (k === 'CLR') { field.clear(); return 'stop'; }
      if (k === 'BKSP') { field.backspace(); return 'stop'; }
      if (k === 'COL') { field.pushChar(':'); return 'stop'; }
      if (k === 'DOT') { field.pushChar(':'); return 'stop'; }
      if (NUMBER_KEYS.includes(k)) {
        const c = keyIdToChar(k);
        if (c) { field.pushChar(c); return 'stop'; }
      }
    }
    return undefined;
  }, [cursor, mode, field], 12);

  useCx3OnEnter(() => {
    if (cursor < N - 1) dispatch({ type: 'NAV', delta: 1 });
  }, [cursor, N, dispatch]);

  function renderLine(k: K, i: number) {
    if (k === 'TOTAL') {
      // ✅ 파싱 로직을 parseToMinutes로 양쪽 통일 → 1458 → 898분 → 14:58 정확 표시
      // ✅ 기장님 요청: Duty Time + Total 합쳐서 첫 행 한번에 (HMS + 분M + 소수H 동시)
      let hms = '--:--';
      let extra = '--M  --H';
      let cls: any = 'dashes';
      let st: any = 'unsolved';
      if (totalMin != null && Number.isFinite(totalMin) && totalMin >= 0) {
        hms = fmtHMS(totalMin);
        extra = `${fmtM(totalMin).padStart(5,' ')} ${fmtHr(totalMin).padStart(5,' ')}`;
        cls = 'green';
        st = 'calc';
      }
      return (
        <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
          <Cx3Line label={LABELS.TOTAL} valueDisplay={hms} unit={extra}
            state={cursor === i ? lineStateFrom(field as any) : st}
            cursor={cursor === i}
            valueClass={cursor === i ? (field.isBlank ? 'dashes' : 'default') : cls} />
        </div>
      );
    }
    const r = buildResultLine(k, totalMin ?? NaN);
    return (
      <div key={k} onClick={() => dispatch({ type: 'SET_CURSOR', idx: i })}>
        <Cx3Line label={r.label2} valueDisplay={r.hms} unit={r.extra}
          state={r.ok ? 'calc' : 'unsolved'} cursor={cursor === i}
          valueClass={r.ok ? 'green' : 'dashes'} />
      </div>
    );
  }

  return (
    <div className="cx3-lcd-menu">
      {LINES.map((k, i) => renderLine(k, i))}
    </div>
  );
}
