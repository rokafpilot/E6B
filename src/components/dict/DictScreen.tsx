import React, { useMemo, useState, useRef, useEffect } from 'react';
import { searchTerms, getAllTerms } from '../../lib/dict';
import type { AviationTerm } from '../../lib/dict/types';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter } from '../../context/Cx3RouterContext';
import { useOnCx3Key } from '../../context/Cx3KeypadContext';
import { useWxScreen } from '../../context/WxScreenContext';

const CHUNK_SIZE = 8;

export default function DictScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState<AviationTerm | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const { cursor, dispatch } = useCx3Nav(CHUNK_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { setInputFocused, setDictDetailMode } = useWxScreen();

  // Set dictDetailMode when detailMode changes
  useEffect(() => {
    setDictDetailMode(detailMode);
  }, [detailMode, setDictDetailMode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return getAllTerms();
    return searchTerms(search);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CHUNK_SIZE));
  const pageItems = useMemo(() => {
    const start = page * CHUNK_SIZE;
    return filtered.slice(start, start + CHUNK_SIZE);
  }, [filtered, page]);

  // search 입력 처리: 알파벳/숫자/기호/백스페이스/클리어
  useOnCx3Key((k) => {
    if (detailMode) return undefined;
    if (/^[A-Z]$/.test(k)) {
      setSearch(prev => prev + k);
      setPage(0);
      return 'stop';
    }
    if (k >= 'N0' && k <= 'N9') {
      const map: Record<string, string> = { N2: 'ABC', N3: 'DEF', N4: 'GHI', N5: 'JKL', N6: 'MNO', N7: 'PQRS', N8: 'TUV', N9: 'WXYZ' };
      const letters = map[k] || '';
      if (!letters) {
        // N0나 N1 등 글자 맵핑이 없는 숫자 키는 직접 숫자로 입력
        setSearch(prev => prev + k.slice(1));
        setPage(0);
        return 'stop';
      }
      setSearch(prev => {
        if (prev.length === 0) return letters[0];
        return prev + letters[0];
      });
      setPage(0);
      return 'stop';
    }
    if (k === 'SUB') { setSearch(prev => prev + '-'); setPage(0); return 'stop'; }
    if (k === 'DIV') { setSearch(prev => prev + '/'); setPage(0); return 'stop'; }
    if (k === 'BKSP') { setSearch(prev => prev.slice(0, -1)); setPage(0); return 'stop'; }
    if (k === 'CLR') { setSearch(''); setPage(0); return 'stop'; }
    if (k === 'GO') { return 'stop'; } // GO 키는 특별한 동작 없음
    return undefined;
  }, [detailMode]);

  // UP/DN: 페이지 내 커서 이동 + 페이지 넘기기
  useOnCx3Key((k) => {
    if (detailMode) return undefined;
    
    if (k === 'UP') {
      if (cursor > 0) {
        dispatch({ type: 'NAV', delta: -1 });
      } else if (page > 0) {
        setPage(prev => prev - 1);
        // 페이지 변경 시 커서를 마지막 위치로 이동
        const prevPageItemCount = Math.min(filtered.length - (page - 1) * CHUNK_SIZE, CHUNK_SIZE);
        dispatch({ type: 'SET_CURSOR', idx: prevPageItemCount - 1 });
      }
      return 'stop';
    }
    
    if (k === 'DN') {
      const currentPageItemCount = pageItems.length;
      if (cursor < currentPageItemCount - 1) {
        dispatch({ type: 'NAV', delta: 1 });
      } else if (page < totalPages - 1) {
        setPage(prev => prev + 1);
        dispatch({ type: 'SET_CURSOR', idx: 0 });
      }
      return 'stop';
    }
    
    return undefined;
  }, [detailMode, cursor, page, totalPages, pageItems.length, filtered.length, dispatch]);

  // BACK: detailMode 종료 + 커서 초기화
  useOnCx3Key((k) => {
    if (k === 'BACK') {
      if (detailMode) { 
        setDetailMode(false); 
        dispatch({ type: 'SET_CURSOR', idx: 0 });
        return 'stop'; 
      }
      return undefined;
    }
    return undefined;
  }, [detailMode, dispatch], 20);

  // POWER/EQU: 선택한 항목 상세보기
  useCx3OnEnter(() => {
    if (detailMode) return;
    const idx = page * CHUNK_SIZE + cursor;
    if (idx < filtered.length) {
      setSelectedTerm(filtered[idx]);
      setDetailMode(true);
    }
  }, [detailMode, cursor, page, filtered]);

  // 상세 모드
  if (detailMode && selectedTerm) {
    // 설명을 줄바꿈으로 적절히 분할 (LCD 폭 완전 활용)
    const MAX_LINE_LENGTH = 60;
    const wrapText = (text: string): string[] => {
      const lines: string[] = [];
      const words = text.split(/\s+/);
      let currentLine = '';
      
      for (const word of words) {
        if (currentLine.length + word.length + 1 <= MAX_LINE_LENGTH) {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        } else {
          if (currentLine) lines.push(currentLine);
          if (word.length <= MAX_LINE_LENGTH) {
            currentLine = word;
          } else {
            // 긴 단어는 강제로 분할
            for (let i = 0; i < word.length; i += MAX_LINE_LENGTH) {
              lines.push(word.slice(i, i + MAX_LINE_LENGTH));
            }
            currentLine = '';
          }
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };
    
    const descriptionLines = wrapText(selectedTerm.korean);
    const handleClose = () => {
      setDetailMode(false);
      setSelectedTerm(null);
      setPage(0);
      dispatch({ type: 'SET_CURSOR', idx: 0 });
    };
    
    return (
      <div className="cx3-lcd-menu" style={{
        height: '100%',
        minHeight: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignContent: 'flex-start',
        alignItems: 'stretch',
        fontSize: 16,
        lineHeight: '1.8'
      }}>
        <div style={{ padding: '10px 15px', background: '#000', color: 'var(--cx3-lcd-green)', fontSize: 18, fontWeight: 700, borderBottom: '1px solid var(--cx3-lcd-divider)' }}>
          {selectedTerm.term}
        </div>
        {selectedTerm.english && (
          <div style={{ padding: '6px 15px', background: 'rgba(0,0,0,0.25)', color: 'var(--cx3-lcd-amber)', fontSize: 14, borderBottom: '1px solid var(--cx3-lcd-divider)' }}>
            {selectedTerm.english}
          </div>
        )}
        <div style={{ flex: 1, padding: '12px 15px', overflowY: 'auto' }}>
          {descriptionLines.map((line, i) => (
            <div key={i} style={{ marginBottom: 6, color: 'var(--cx3-lcd-green)' }}>
              {line}
            </div>
          ))}
        </div>
        {/* Close button */}
        <div style={{ flexShrink: 0, marginTop: 6, display: 'flex', justifyContent: 'center' }}>
          <div onClick={handleClose}
            style={{
              padding: '8px 24px', border: '1px solid var(--cx3-lcd-red)', borderRadius: 6,
              color: 'var(--cx3-lcd-red)', fontSize: 19, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(255,51,48,0.1)', userSelect: 'none', textAlign: 'center',
              width: '100%', maxWidth: 280, letterSpacing: 2,
            }}>
            CLOSE · BACK
          </div>
        </div>
      </div>
    );
  }

  // 검색 모드
  return (
    <div className="cx3-lcd-menu dict-lcd-menu">
      {/* 검색 입력창 */}
      <div className="cx3-menu-line input">
        <Cx3LineIcon state="input" />
        <span className="cx3-menu-label">SEARCH</span>
        <span className="cx3-menu-value-wrap" style={{ textAlign: 'left' }}>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value.toUpperCase()); setPage(0); }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className="cx3-search-input"
            placeholder="SEARCH"
            maxLength={10}
          />
        </span>
      </div>
      {/* 검색 결과 */}
      {pageItems.map((item, i) => (
        <Cx3Line
          key={`${item.term}-${item.english}`}
          label={item.term}
          state={i === cursor ? 'input' : 'unsolved'}
          cursor={i === cursor}
          valueDisplay={item.english || item.term} // 검색 결과에서는 영어 용어만 표시 (짧게)
        />
      ))}
      {Array.from({ length: Math.max(0, CHUNK_SIZE - pageItems.length) }).map((_, i) => (
        <Cx3Line key={`empty-${i}`} label="" state="unsolved" />
      ))}

    </div>
  );
}

// Cx3LineIcon 컴포넌트 재사용 (복사해온 것)
function Cx3LineIcon({ state }: { state: 'input' | 'calc' | 'global' | 'unsolved' }) {
  if (state === 'input') return <span className="cx3-icon green-check">✓</span>;
  if (state === 'calc') return <span className="cx3-icon green-eq">==</span>;
  if (state === 'global') return <span className="cx3-icon blue-dot">●</span>;
  return null;
}
