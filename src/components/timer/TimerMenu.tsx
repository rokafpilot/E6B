import React, { useState, useEffect, useRef } from 'react';

export default function TimerMenu() {
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const swIntervalRef = useRef<number | null>(null);

  const [countdownTotal, setCountdownTotal] = useState(60);
  const [countdownRemaining, setCountdownRemaining] = useState(60);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const cdIntervalRef = useRef<number | null>(null);
  const cdInputRef = useRef<{ h: number; m: number; s: number }>({ h: 0, m: 1, s: 0 });

  useEffect(() => {
    if (stopwatchRunning) {
      swIntervalRef.current = window.setInterval(() => {
        setStopwatchSeconds(s => s + 1);
      }, 1000);
    } else if (swIntervalRef.current) {
      clearInterval(swIntervalRef.current);
    }
    return () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); };
  }, [stopwatchRunning]);

  useEffect(() => {
    if (countdownRunning) {
      cdIntervalRef.current = window.setInterval(() => {
        setCountdownRemaining(s => {
          if (s <= 1) {
            if (cdIntervalRef.current) clearInterval(cdIntervalRef.current);
            setCountdownRunning(false);
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880; osc.type = 'sine';
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.start(); osc.stop(ctx.currentTime + 0.5);
            } catch { /* ignore */ }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else if (cdIntervalRef.current) {
      clearInterval(cdIntervalRef.current);
    }
    return () => { if (cdIntervalRef.current) clearInterval(cdIntervalRef.current); };
  }, [countdownRunning]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const applyCountdownInputs = () => {
    const { h, m, s } = cdInputRef.current;
    const total = h * 3600 + m * 60 + s;
    if (total > 0) {
      setCountdownTotal(total);
      setCountdownRemaining(total);
      setCountdownRunning(false);
    }
  };

  return (
    <div className="timer-container">
      <div className="timer-card">
        <div className="timer-title">Stopwatch</div>
        <div className="timer-display">{formatTime(stopwatchSeconds)}</div>
        <div className="timer-controls">
          <button
            className="btn btn-primary"
            onClick={() => setStopwatchRunning(r => !r)}
          >
            {stopwatchRunning ? 'Pause' : 'Start'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setStopwatchRunning(false); setStopwatchSeconds(0); }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="timer-card">
        <div className="timer-title">Countdown</div>
        <div className="timer-display">{formatTime(countdownRemaining)}</div>
        <div className="input-group" style={{ padding: 12, marginBottom: 16 }}>
          <div className="input-row">
            <div className="input-label">Set Time</div>
            <div className="input-field" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={99}
                defaultValue={cdInputRef.current.h}
                onChange={e => { cdInputRef.current.h = Number(e.target.value); }}
                onBlur={applyCountdownInputs}
              />
              <span>:</span>
              <input
                type="number" min={0} max={59}
                defaultValue={cdInputRef.current.m}
                onChange={e => { cdInputRef.current.m = Number(e.target.value); }}
                onBlur={applyCountdownInputs}
              />
              <span>:</span>
              <input
                type="number" min={0} max={59}
                defaultValue={cdInputRef.current.s}
                onChange={e => { cdInputRef.current.s = Number(e.target.value); }}
                onBlur={applyCountdownInputs}
              />
            </div>
          </div>
        </div>
        <div className="timer-controls">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (countdownRemaining <= 0) {
                setCountdownRemaining(countdownTotal);
              }
              setCountdownRunning(r => !r);
            }}
          >
            {countdownRunning ? 'Pause' : 'Start'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setCountdownRunning(false); setCountdownRemaining(countdownTotal); }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
