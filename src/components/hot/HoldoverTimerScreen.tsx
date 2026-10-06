import React, { useEffect, useRef, useState } from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav } from '../../context/Cx3RouterContext';
import { useOnCx3Key, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { consumeHoldoverTimerParams, HoldoverTimerParams } from '../../hot/holdoverTimerParams';

/** HOT Holdover Timer 화면 (3행 + Start/Reset Button)
 *  DSHOT 정밀 단일값 기반이므로 Min/Max 범위 없이 정확한 단일 타이머만 표시 ✅
 *  0: START TIME       시작 전 = --:--:--   / Start 누르면 그 시각 고정 (hh:mm:ss)
 *  1: Time Remaining   시작 전 = 원래 duration (HH:MM:SS) / 시작 후 = 1초마다 countdown
 *  2: [ START ▶ ]      누르면 타이머 시작 → [ ↻ RESET ] 으로 토글. Reset 누르면 전부 원복
 */
const LINES = ['START_TIME','REMAIN','BTN_ROW'] as const;
type K = typeof LINES[number];
const LABELS: Record<K,string> = {
  START_TIME: 'START TIME',
  REMAIN:     'Time Remaining',
  BTN_ROW:    '',
};

const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
function fmtHMS(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSec));
  const hh = Math.floor(abs / 3600);
  const mm = Math.floor((abs % 3600) / 60);
  const ss = abs % 60;
  return `${sign}${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
function fmtHMClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export default function HoldoverTimerScreen() {
  const { cursor, dispatch } = useCx3Nav(LINES.length);

  const initParams = useRef<HoldoverTimerParams | null>(null);
  if (initParams.current === null) {
    initParams.current = consumeHoldoverTimerParams() ?? { durationMinutes: 0, startedAtEpochMs: Date.now() };
  }
  const [params] = useState<HoldoverTimerParams>(initParams.current);
  const totalDurationSec = Math.max(0, Math.round(params.durationMinutes * 60));

  // 타이머 상태: started=false 이면 START TIME = --:--:--, remain = totalDuration 그대로 (idle)
  // started=true 이면 startedAtMs 기록, START TIME 고정, remain 1초마다 차감
  const [started, setStarted] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setTick(t => (t + 1) % 86_400_000), 1000);
    return () => clearInterval(id);
  }, [started]);

  // cursor 가 항상 BTN_ROW (4) 에 있으면 좋지만, 위아래 이동은 자유롭게 둠. Enter 는 버튼 토글만.
  const handleToggle = () => {
    if (!started) {
      setStartedAtMs(Date.now());
      setTick(0);
      setStarted(true);
    } else {
      // Reset → idle 상태로
      setStarted(false);
      setStartedAtMs(null);
      setTick(0);
    }
  };

  // M 키와 = ENTER 키로도 토글 작동
  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'MEM' || k === 'EQU') {
      handleToggle();
      return 'stop';
    }
    if (k === 'CLR') {
      // C 키 → Reset 으로 강제 원복
      setStarted(false);
      setStartedAtMs(null);
      setTick(0);
      return 'stop';
    }
    void tick; void dispatch;
    return undefined;
  }, [cursor, tick, started, dispatch], 12);

  // === 값 계산 ===
  const elapsedSec = started && startedAtMs != null
    ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
    : 0;
  const remainSec = totalDurationSec - elapsedSec;

  const outs: Record<K, string> = {
    START_TIME: started && startedAtMs != null ? fmtHMClock(startedAtMs) : '--:--:--',
    REMAIN:     fmtHMS(started ? remainSec : totalDurationSec),
    BTN_ROW:    '',
  };
  const units: Record<K, string> = {
    START_TIME: started ? '● LIVE' : '○ IDLE',
    REMAIN:     started ? (remainSec < 0 ? '⚠ OVERDUE' : (remainSec < 5*60 ? '⚠ <5MIN' : '▼ LIVE')) : 'READY',
    BTN_ROW:    '',
  };
  const valueClass: Record<K, 'default'|'green'|'amber'|'dashes'> = {
    START_TIME: started ? 'green' : 'default',
    REMAIN:     started ? (remainSec < 0 ? 'amber' : (remainSec < 5*60 ? 'amber' : 'green')) : 'default',
    BTN_ROW:    'default',
  };

  const btnLabel = started ? '↻  RESET' : '▶  START';
  const btnIsReset = started;

  return (
    <div className="cx3-lcd-menu hot-timer-screen" style={{ gap: 6 }}>
      {LINES.map((k, i) => {
        if (k === 'BTN_ROW') {
          return (
            <div
              key="btn-row"
              className="cx3-line"
              style={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 4px',
              }}
            >
              <button
                type="button"
                onClick={handleToggle}
                style={{
                  width: '92%',
                  height: 32,
                  borderRadius: 10,
                  border: `2px solid ${btnIsReset ? '#e05a5a' : '#d4a24c'}`,
                  background: btnIsReset
                    ? 'linear-gradient(180deg,#6b1b1b 0%, #3a0d0d 100%)'
                    : 'linear-gradient(180deg,#5a3d12 0%, #2e1e08 100%)',
                  color: btnIsReset ? '#ffd9d9' : '#ffe4a8',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: 15,
                  letterSpacing: 4,
                  cursor: 'pointer',
                  boxShadow: cursor === i
                    ? `0 0 0 3px ${btnIsReset ? 'rgba(224,90,90,.6)' : 'rgba(212,162,76,.55)'}, inset 0 0 10px rgba(0,0,0,.4)`
                    : 'inset 0 0 10px rgba(0,0,0,.4)',
                }}
              >
                {btnLabel}
              </button>
            </div>
          );
        }
        return (
          <Cx3Line
            key={k}
            label={LABELS[k]}
            valueDisplay={outs[k]}
            unit={units[k]}
            state={k === 'REMAIN' ? 'calc' : 'input'}
            cursor={cursor === i}
            valueClass={valueClass[k]}
          />
        );
      })}
    </div>
  );
}
