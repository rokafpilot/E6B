import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOnCx3Key, keyIdToChar, Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Router } from '../../context/Cx3RouterContext';

type ClockMode = 'STOPWATCH' | 'COUNTDOWN';

const MAX_COUNTDOWN_SEC = 99 * 3600 + 59 * 60 + 59;
/** 눈금 안쪽에 놓이는 진행 링의 반지름 (viewBox 100 기준) */
const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** 경과(ELAPSED) 링: 카운트다운 링(두께 7)과 맞닿도록 바깥쪽에 배치 */
const RING_ELAPSED_RADIUS = 37;
const RING_ELAPSED_CIRCUMFERENCE = 2 * Math.PI * RING_ELAPSED_RADIUS;
/** 키친 타이머 다이얼을 한 바퀴 돌릴 때 설정되는 최대 분 */
const WIND_MAX_MINUTES = 60;

function two(value: number) {
  return String(Math.max(0, Math.floor(value))).padStart(2, '0');
}

function formatElapsed(milliseconds: number) {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  return `${two(Math.floor(totalSeconds / 3600))}:${two(Math.floor(totalSeconds / 60) % 60)}:${two(totalSeconds % 60)}.${two(totalCentiseconds % 100)}`;
}

/** 시계 안쪽 CHRONO 전용: 시(hh) 없이 분:초.1/100초 (mm:ss.CC) 만 표시 */
function formatElapsedMS(milliseconds: number) {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  return `${two(Math.floor(totalSeconds / 60))}:${two(totalSeconds % 60)}.${two(totalCentiseconds % 100)}`;
}

function formatCountdown(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${two(Math.floor(value / 3600))}:${two(Math.floor(value / 60) % 60)}:${two(value % 60)}`;
}

function digitsToSeconds(digits: string) {
  const padded = digits.padStart(6, '0').slice(-6);
  return Math.min(99, Number(padded.slice(0, 2))) * 3600
    + Math.min(59, Number(padded.slice(2, 4))) * 60
    + Math.min(59, Number(padded.slice(4, 6)));
}

function secondsToDigits(total: number) {
  const value = Math.max(0, Math.min(MAX_COUNTDOWN_SEC, Math.floor(total)));
  return two(Math.floor(value / 3600)) + two(Math.floor(value / 60) % 60) + two(value % 60);
}

function beepAlert() {
  try {
    const Audio = window.AudioContext || (window as any).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    [0, 0.32, 0.64].forEach(delay => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 880;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const start = context.currentTime + delay;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
  } catch { /* ignore unavailable audio */ }
}

function dialTicks(majorLength: number, minorLength: number) {
  return Array.from({ length: 60 }, (_, index) => {
    const major = index % 5 === 0;
    const angle = (index * 6 - 90) * Math.PI / 180;
    const inner = 50 - (major ? majorLength : minorLength);
    return (
      <line
        key={index}
        className={major ? 'cx3-tick major' : 'cx3-tick'}
        x1={50 + inner * Math.cos(angle)} y1={50 + inner * Math.sin(angle)}
        x2={50 + 47 * Math.cos(angle)} y2={50 + 47 * Math.sin(angle)}
      />
    );
  });
}

export default function StopwatchScreen({ initialMode = 'STOPWATCH' }: { initialMode?: ClockMode }) {
  const { dispatch } = useCx3Router();
  const [mode, setMode] = useState<ClockMode>(initialMode);
  const [now, setNow] = useState(() => new Date());

  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchBase, setStopwatchBase] = useState(0);
  const [stopwatchStartedAt, setStopwatchStartedAt] = useState<number | null>(null);

  const [countdownDigits, setCountdownDigits] = useState('000500');
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownRunBase, setCountdownRunBase] = useState(300);
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(null);
  const [countdownEnded, setCountdownEnded] = useState(false);
  /** PAUSE 시 얼려 둔 남은 시간(초) — 링·포인터가 제자리에 멈추도록 보존한다. null = 정지 아님 */
  const [countdownPausedRemain, setCountdownPausedRemain] = useState<number | null>(null);

  const [winding, setWinding] = useState(false);
  const alertedRef = useRef(false);
  const ringRef = useRef<SVGSVGElement | null>(null);
  /** true면 다음 숫자 입력은 기존 값을 지우고 새로 시작한다 (H:M:S 타자 입력) */
  const countdownFreshRef = useRef(true);
  /** 마지막으로 사용자가 설정한 카운트다운 시간(초) — 만료/정지 후 RESET 시 이 값으로 되돌린다 */
  const countdownLastSetRef = useRef(300);

  useEffect(() => {
    const period = stopwatchRunning ? 50 : countdownRunning ? 200 : 500;
    const interval = window.setInterval(() => setNow(new Date()), period);
    return () => window.clearInterval(interval);
  }, [stopwatchRunning, countdownRunning]);

  const stopwatchMs = stopwatchRunning && stopwatchStartedAt != null
    ? stopwatchBase + Date.now() - stopwatchStartedAt
    : stopwatchBase;
  const countdownSetSec = digitsToSeconds(countdownDigits);
  const countdownRemain = countdownRunning && countdownStartedAt != null
    ? Math.max(0, countdownRunBase - (Date.now() - countdownStartedAt) / 1000)
    : (countdownPausedRemain != null ? countdownPausedRemain : countdownSetSec);

  useEffect(() => {
    if (countdownRunning && countdownRemain <= 0) {
      setCountdownRunning(false);
      setCountdownStartedAt(null);
      setCountdownDigits('000000');
      setCountdownEnded(true);
      countdownFreshRef.current = true;
      if (!alertedRef.current) {
        alertedRef.current = true;
        beepAlert();
      }
    }
  }, [countdownRemain, countdownRunning]);

  const toggleMode = () => {
    setMode(current => (current === 'STOPWATCH' ? 'COUNTDOWN' : 'STOPWATCH'));
    setCountdownEnded(false);
    countdownFreshRef.current = true;
  };

  const toggleStopwatch = () => {
    if (stopwatchRunning) {
      setStopwatchBase(stopwatchMs);
      setStopwatchStartedAt(null);
      setStopwatchRunning(false);
    } else {
      setStopwatchStartedAt(Date.now());
      setStopwatchRunning(true);
    }
  };

  const resetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchStartedAt(null);
    setStopwatchBase(0);
  };

  const toggleCountdown = () => {
    if (countdownRunning) {
      // PAUSE: 남은 시간을 얼려 두고 링·포인터도 현재 위치에 그대로 정지시킨다.
      setCountdownPausedRemain(countdownRemain);
      setCountdownStartedAt(null);
      setCountdownRunning(false);
      countdownFreshRef.current = true;
      return;
    }
    const resumeFrom = countdownPausedRemain ?? countdownSetSec;
    if (resumeFrom <= 0) return;
    alertedRef.current = false;
    setCountdownEnded(false);
    if (countdownPausedRemain == null) {
      // 최초 시작: 설정값이 전체 시간이 된다.
      countdownLastSetRef.current = countdownSetSec;
      setCountdownRunBase(countdownSetSec);
      setCountdownStartedAt(Date.now());
    } else {
      // 재개: 정지 시점의 남은 시간이 유지되도록 시작 기준 시각을 과거로 되감는다.
      setCountdownStartedAt(Date.now() - (countdownRunBase - resumeFrom) * 1000);
    }
    setCountdownPausedRemain(null);
    setCountdownRunning(true);
  };



  const resetCountdown = () => {
    // 실행 중이었거나 일시정지/만료된 뒤라면 직전에 설정한 시간으로 되돌려 바로 재실행할 수 있게 하고,
    // 그 외(대기 중)에는 00:00:00으로 지운다.
    const restore = countdownRunning || countdownEnded || countdownPausedRemain != null;
    setCountdownRunning(false);
    setCountdownStartedAt(null);
    setCountdownEnded(false);
    setCountdownPausedRemain(null);
    alertedRef.current = false;
    countdownFreshRef.current = true;
    setCountdownDigits(secondsToDigits(restore ? countdownLastSetRef.current : 0));
  };

  const adjustCountdown = (delta: number) => {
    if (countdownRunning) return;
    const next = secondsToDigits(countdownSetSec + delta);
    countdownLastSetRef.current = digitsToSeconds(next);
    setCountdownDigits(next);
    setCountdownEnded(false);
    setCountdownPausedRemain(null);
    countdownFreshRef.current = true;
  };

  /** 다이얼을 돌려 남은 시간을 감는 키친 타이머 방식 입력 */
  const windFromPointer = (clientX: number, clientY: number) => {
    const element = ringRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let degrees = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (degrees < 0) degrees += 360;
    const minutes = Math.min(WIND_MAX_MINUTES, Math.round(degrees / 6));
    countdownLastSetRef.current = minutes * 60;
    setCountdownDigits(secondsToDigits(minutes * 60));
    setCountdownEnded(false);
    setCountdownPausedRemain(null);
    countdownFreshRef.current = true;
  };

  useOnCx3Key((key: Cx3KeyId) => {
    if (key === 'BACK') { dispatch({ type: 'GOTO_ROOT', root: 'FLT', lineCount: 16 }); return 'stop'; }
    if (key === 'CONVU') { toggleMode(); return 'stop'; }
    if (key === 'POWER' || key === 'EQU') { mode === 'STOPWATCH' ? toggleStopwatch() : toggleCountdown(); return 'stop'; }
    if (key === 'CLR') { mode === 'STOPWATCH' ? resetStopwatch() : resetCountdown(); return 'stop'; }
    if (mode !== 'COUNTDOWN' || countdownRunning) return undefined;
    if (key === 'UP') { adjustCountdown(60); return 'stop'; }
    if (key === 'DN') { adjustCountdown(-60); return 'stop'; }
    if (key === 'BKSP') {
      countdownFreshRef.current = false;
      const next = countdownDigits.slice(0, -1);
      countdownLastSetRef.current = digitsToSeconds(next);
      setCountdownDigits(next);
      setCountdownPausedRemain(null);
      return 'stop';
    }
    const char = keyIdToChar(key);
    if (char && /[0-9]/.test(char)) {
      const base = countdownFreshRef.current ? '000000' : countdownDigits;
      countdownFreshRef.current = false;
      const next = (base + char).slice(-6);
      countdownLastSetRef.current = digitsToSeconds(next);
      setCountdownDigits(next);
      setCountdownEnded(false);
      setCountdownPausedRemain(null);
      return 'stop';
    }
    return undefined;
  }, [mode, stopwatchRunning, stopwatchMs, countdownRunning, countdownRemain, countdownSetSec, countdownDigits, countdownRunBase, countdownPausedRemain, dispatch], 12);


  // 아날로그 초침은 스톱워치 전용: START 해야만 움직인다.
  const chronoSecondAngle = ((stopwatchMs / 1000) % 60) * 6;

  // PAUSE 중에도 전체 시간(runBase)을 유지해야 링·포인터가 제자리에 멈춘다.
  const countdownTotal = (countdownRunning || countdownPausedRemain != null) ? countdownRunBase : countdownSetSec;
  const countdownRatio = countdownTotal > 0 ? Math.max(0, Math.min(1, countdownRemain / countdownTotal)) : 0;
  const ringOffset = RING_CIRCUMFERENCE * (1 - countdownRatio);
  // 링 안에 REMAIN과 함께 위아래로 표시할 경과 시간
  const countdownElapsed = Math.max(0, countdownTotal - countdownRemain);
  // 바깥쪽 초침 대신 ELAPSED 링: 경과 비율만큼 12시 방향에서 시계방향으로 채워진다.
  const elapsedRatio = countdownTotal > 0 ? Math.max(0, Math.min(1, countdownElapsed / countdownTotal)) : 0;
  const elapsedOffset = RING_ELAPSED_CIRCUMFERENCE * (1 - elapsedRatio);

  const running = mode === 'STOPWATCH' ? stopwatchRunning : countdownRunning;
  const statusText = countdownEnded ? 'TIME EXPIRED' : running ? 'RUNNING' : 'STANDBY';

  // 시(hh:mm:ss)와 1/100초를 분리 — 1/100초는 작게 표시해 앞자리를 최대한 크게 키운다.
  const [chronoMain, chronoCentis] = formatElapsed(stopwatchMs).split('.');
  // 시계 안쪽 오버레이는 시(hh) 없이 분:초.1/100초만 표시.
  const [chronoDialMain, chronoDialCentis] = formatElapsedMS(stopwatchMs).split('.');

  return (
    <div className={`cx3-clock ${countdownEnded ? 'alarm' : ''}`}>
      <div className="cx3-clock-main">
        <div className="cx3-clock-stage">
          {mode === 'STOPWATCH' ? (
            <div className="cx3-analog-wrap" aria-label="Analog stopwatch with Breitling face">
              <img src="/breitling.png" alt="" className="cx3-analog-face" draggable={false} />
              <img
                src="/tagheuer_hours.png" alt="" className="cx3-analog-hand hour" draggable={false}
                style={{ transform: `translate(-50%, -49.5%) rotate(${(now.getUTCHours() % 12) * 30 + now.getUTCMinutes() * 0.5}deg)` }}
              />
              <img
                src="/tagheuer_minutes.png" alt="" className="cx3-analog-hand minute" draggable={false}
                style={{ transform: `translate(-50%, -49.5%) rotate(${now.getUTCMinutes() * 6 + now.getUTCSeconds() * 0.1}deg)` }}
              />
              <img
                src="/tagheuer_seconds.png" alt="" className="cx3-analog-hand second" draggable={false}
                style={{ transform: `translate(-50%, -49.5%) rotate(${chronoSecondAngle}deg)` }}
              />
              <div className="cx3-analog-center" />
              <div className={`cx3-chrono-display ${stopwatchRunning ? 'running' : ''}`}>
                <strong>{chronoDialMain}<small>.{chronoDialCentis}</small></strong>
              </div>
            </div>
          ) : (
            <svg
              viewBox="0 0 100 100"
              className={`cx3-ring ${countdownRunning ? 'locked' : ''}`}
              ref={ringRef}
              onPointerDown={event => {
                if (countdownRunning) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setWinding(true);
                windFromPointer(event.clientX, event.clientY);
              }}
              onPointerMove={event => {
                if (!winding || countdownRunning) return;
                windFromPointer(event.clientX, event.clientY);
              }}
              onPointerUp={() => setWinding(false)}
              onPointerCancel={() => setWinding(false)}
              aria-label="Kitchen timer dial"
            >
              <image href="/nighthawk.png" x="1" y="1" width="98" height="98" className="cx3-dial-face" />

              {/* ELAPSED: 처음에 꽉 찬 원으로, 9시 방향에서 시작, 시계 반대방향으로 점차 줄어드는 */}
              <circle
                cx="50" cy="50" r={RING_RADIUS}
                className="cx3-ring-elapsed"
                fill="none"
                stroke={countdownRatio > 0.5 ? '#00ff00' : countdownRatio > 0.25 ? '#ffff00' : '#ff0000'}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * countdownRatio}
                transform="rotate(180 50 50)"
              />
              {/* 역방향 카운트다운 바늘 */}
              <g transform={`rotate(${(1 - countdownRatio) * 360 - 90} 50 50)`}>
                <line x1="50" y1="50" x2="50" y2="15" stroke={countdownRatio > 0.5 ? '#00ff00' : countdownRatio > 0.25 ? '#ffff00' : '#ff0000'} strokeWidth="2" strokeLinecap="round" />
                <circle cx="50" cy="50" r="3" fill={countdownRatio > 0.5 ? '#00ff00' : countdownRatio > 0.25 ? '#ffff00' : '#ff0000'} />
              </g>
              {/* 중앙 정보 표시 */}
              <circle cx="50" cy="50" r="26" className="cx3-ring-hub" />
              <text x="50" y="34" className="cx3-ring-hub-label">REMAIN</text>
              <text x="50" y="45" className="cx3-ring-hub-time">{formatCountdown(countdownRemain)}</text>
              <text x="50" y="56" className="cx3-ring-hub-label">ELAPSED</text>
              <text x="50" y="65.5" className="cx3-ring-hub-elapsed">{formatCountdown(countdownElapsed)}</text>
            </svg>
          )}
        </div>

        <div className="cx3-clock-side">

          {mode === 'STOPWATCH' ? (
            <div className={`cx3-readout primary ${stopwatchRunning ? 'running' : ''}`}>
              <span>CHRONO</span>
              <strong>{chronoMain}<small>.{chronoCentis}</small></strong>
            </div>
          ) : (
            <div className="cx3-readout set">
              <span>SET H:M:S</span>
              <strong>{formatCountdown(countdownSetSec)}</strong>
              <div className="cx3-stepper">
                <button type="button" aria-label="Decrease by one minute" onClick={() => adjustCountdown(-60)}>−</button>
                <em>±1 MIN</em>
                <button type="button" aria-label="Increase by one minute" onClick={() => adjustCountdown(60)}>+</button>
              </div>

            </div>
          )}

          <div className={`cx3-status ${running ? 'on' : ''} ${countdownEnded ? 'expired' : ''}`}>{statusText}</div>

          {/* 모드 버튼: 한 번 누를 때마다 STOPWATCH ↔ COUNTDOWN 전환 */}
          <button type="button" className="cx3-mode-toggle" onClick={toggleMode}>
            <b>{mode}</b>
            <small>SWITCH TO {mode === 'STOPWATCH' ? 'COUNTDOWN' : 'STOPWATCH'}</small>
          </button>
        </div>
      </div>

      <div className="cx3-controls">
        <button type="button" className="reset" onClick={mode === 'STOPWATCH' ? resetStopwatch : resetCountdown}>RESET</button>
        <button type="button" className={running ? 'pause' : 'start'} onClick={mode === 'STOPWATCH' ? toggleStopwatch : toggleCountdown}>{running ? 'PAUSE' : 'START'}</button>
      </div>
    </div>
  );
}
