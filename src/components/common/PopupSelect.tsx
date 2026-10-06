import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cx3Line from './Cx3Line';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';

export interface PopupOption<T> {
  id: T;
  label: string;
  unit?: string;
  right?: string;
  isSeparator?: boolean;
}

export interface PopupSelectProps<T> {
  open: boolean;
  title: string;
  options: PopupOption<T>[];
  selectedId?: T;
  onClose: () => void;
  onSelect: (id: T) => void;
  windowSize?: number;
}

const WINDOW_SIZE_DEFAULT = 8;

export default function PopupSelect<T extends string | number>(props: PopupSelectProps<T>) {
  const { open, title, options, selectedId, onClose, onSelect } = props;
  const N = options.length;
  const [popupCursor, setPopupCursor] = useState<number>(() => {
    if (selectedId === undefined) return 0;
    const i = options.findIndex(o => o.id === selectedId && !o.isSeparator);
    return i >= 0 ? i : 0;
  });

  const menuRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    if (selectedId === undefined) { setPopupCursor(0); return; }
    const i = options.findIndex(o => o.id === selectedId && !o.isSeparator);
    setPopupCursor(i >= 0 ? i : 0);
  }, [open, selectedId, options]);

  const stepCursor = useCallback((dir: 1 | -1) => {
    setPopupCursor(i => {
      let j = i;
      do { j = (j + dir + N) % N; } while (options[j]?.isSeparator && j !== i);
      return j;
    });
  }, [N, options]);

  // ===== 키패드 커서 이동시 스크롤 자동 따라가기 =====
  useEffect(() => {
    if (!open) return;
    const row = rowRefs.current[`row-${popupCursor}`];
    if (row && menuRef.current) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [popupCursor, open]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (!open) return undefined;
    if (k === 'BACK' || k === 'DUTY') { onClose(); return 'stop'; }
    if (k === 'UP' || k === 'CONVU') {
      stepCursor(-1);
      return 'stop';
    }
    if (k === 'DN') {
      stepCursor(1);
      return 'stop';
    }
    if (k === 'POWER') {
      const opt = options[popupCursor];
      if (opt && !opt.isSeparator) { onSelect(opt.id); onClose(); }
      return 'stop';
    }
    return undefined;
  }, [open, stepCursor, onClose, popupCursor, options, onSelect], 15);

  if (!open) return null;

  const onMaskClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="cx3-popup-mask"
      onClick={onMaskClick}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="cx3-popup-panel" onClick={e => e.stopPropagation()}>
        <div className="cx3-popup-title">
          <span className="cx3-popup-title-label">{title}</span>
          <span className="cx3-popup-title-count">{popupCursor + 1}/{N}</span>
        </div>
        {/* ===== options 전체 렌더링 · 손가락 터치 스크롤 가능 ===== */}
        <div className="cx3-lcd-menu cx3-popup-menu" ref={menuRef}>
          {options.map((opt, i) => {
            if (opt.isSeparator) {
              return (
                <div key={`sep-${i}`} className="cx3-popup-sep">
                  <span>{opt.label}</span>
                </div>
              );
            }
            const click = () => { onSelect(opt.id); onClose(); };
            return (
              <div
                key={String(opt.id) + i}
                ref={el => { rowRefs.current[`row-${i}`] = el; }}
                onClick={click}
                className="cx3-popup-row-wrap"
              >
                <Cx3Line
                  label={opt.label}
                  valueDisplay={selectedId === opt.id ? '● SEL' : opt.right ?? ''}
                  unit={opt.unit}
                  state={selectedId === opt.id ? 'calc' : (i === 0 ? 'unsolved' : 'input')}
                  cursor={popupCursor === i}
                  valueClass={selectedId === opt.id ? 'green' : 'default'}
                  onClick={click}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
