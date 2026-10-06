import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WxScreenProvider, useWxScreen } from '../../context/WxScreenContext';
import Cx3Line, { Cx3LineIcon } from '../common/Cx3Line';
import {
  useCx3Nav, useCx3OnEnter, useCx3Router,
} from '../../context/Cx3RouterContext';
import {
  useOnCx3Key, keyIdToChar, Cx3KeyId, NUMBER_KEYS,
} from '../../context/Cx3KeypadContext';
import {
  fetchAtis, fetchMetar, fetchTaf, WxApiError, shortLabelOf as wxShortLabel, parseAtisDetails, calcTimeDiff,
  fetchMetarSummary, fetchTafSummary, formatTafZulu, MetarSummary, TafSummary, TafGroup,
} from '../../lib/weatherApi';
import { getAirportLocalObservedTime } from '../../lib/airportTimezone';
import {
  fetchNotams, shortLabelOf as notamShortLabel, NotamEntry, NotamFetchResult,
} from '../../lib/notamApi';

const WINDOW_SIZE = 8;
const FULL_ROWS = 8;

type WxStatus = 'IDLE' | 'INPUT' | 'FETCHING' | 'OK' | 'PARTIAL' | 'ERR';
type WxMode = 'ATIS' | 'METAR/TAF' | 'NOTAM';

const BLOCK_TITLES = ['ATIS', 'METAR', 'TAF'] as const;
const BLOCK_COUNT = BLOCK_TITLES.length;
type BlockKey = typeof BLOCK_TITLES[number];

interface FetchedBlock {
  key: BlockKey;
  title: string;
  raw: string;
  ok: boolean;
  errMsg?: string;
  fetchedAt?: number;
}

export default function WxScreen() {
  const { replaceTop } = useCx3Router();
  const { setInDisplay, setInputFocused } = useWxScreen();
  const [icao, setIcao] = useState('');
  const [icaoDraft, setIcaoDraft] = useState('');
  const [status, setStatus] = useState<WxStatus>('IDLE');
  const [statusMsg, setStatusMsg] = useState('4자 ICAO 코드 입력');
  const [blocks, setBlocks] = useState<FetchedBlock[]>([]);
  const [metarSummary, setMetarSummary] = useState<MetarSummary | null>(null);
  const [tafSummary, setTafSummary] = useState<TafSummary | null>(null);
  const [mode, setMode] = useState<WxMode>('METAR/TAF');
  // NOTAM state
  const [notamResult, setNotamResult] = useState<NotamFetchResult | null>(null);
  const [notamFilter, setNotamFilter] = useState<string>('ALL');
  const [notamScrollTop, setNotamScrollTop] = useState(0);
  const notamContentRef = useRef<HTMLDivElement>(null);
  const icaoInputRef = useRef<HTMLInputElement>(null);
  const { cursor, dispatch } = useCx3Nav(500);
  const isNotamMode = mode === 'NOTAM';
  const hasWxData = blocks.length > 0;
  const hasNotamData = notamResult !== null;
  const inInput = !hasWxData && !hasNotamData;
  const inDisplay = hasWxData || hasNotamData;
  
  // 컴포넌트 초기화 시 inDisplay를 false로 설정
  React.useEffect(() => {
    setInDisplay(false);
  }, []);
  
  // 상태 변경 시 inDisplay 동기화 (blocks 또는 notamResult)
  React.useEffect(() => {
    setInDisplay(inDisplay);
  }, [inDisplay, setInDisplay]);

  const rawContentRef = useRef<HTMLDivElement>(null);
  const [rawScrollTop, setRawScrollTop] = useState(0);
  const doFetchGuardRef = useRef<{ inProgress: boolean; lastKey: string; lastAt: number }>({
    inProgress: false, lastKey: '', lastAt: 0,
  });

  const T9: Record<string, string[]> = {
    '2':['A','B','C'],'3':['D','E','F'],'4':['G','H','I'],'5':['J','K','L'],
    '6':['M','N','O'],'7':['P','Q','R','S'],'8':['T','U','V'],'9':['W','X','Y','Z'],
    '0':['0'],'1':['1'],
  };
  const t9Ref = useRef<{ key: string; count: number; timeoutId: any } | null>(null);

  const clearT9Timer = () => {
    if (t9Ref.current?.timeoutId) {
      clearTimeout(t9Ref.current.timeoutId);
      t9Ref.current.timeoutId = undefined;
    }
  };
  const commitT9 = () => {
    clearT9Timer();
    t9Ref.current = null;
  };
  const autoCommitT9Soon = () => {
    clearT9Timer();
    if (!t9Ref.current) return;
    t9Ref.current.timeoutId = setTimeout(commitT9, 900);
  };
  const tryFetchIfReady = (draft: string) => {
    const only = (draft || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (only.length === 4) {
      commitT9();
      setIcao(only);
      setRawScrollTop(0);
      void doFetchAll(only);
    }
  };
  const handleT9Press = (num: string) => {
    if (!T9[num]) return;
    setIcaoDraft(prevDraft => {
      const letters = T9[num];
      if (!t9Ref.current) {
        if (prevDraft.length >= 4) return prevDraft;
        const addCh = letters[0];
        t9Ref.current = { key: num, count: 0, timeoutId: undefined };
        const next = prevDraft + addCh;
        autoCommitT9Soon();
        if (icaoInputRef.current) icaoInputRef.current.value = next;
        tryFetchIfReady(next);
        return next;
      }
      if (t9Ref.current.key === num) {
        t9Ref.current.count = (t9Ref.current.count + 1) % letters.length;
        const newCh = letters[t9Ref.current.count];
        const next = prevDraft.slice(0, -1) + newCh;
        clearT9Timer();
        autoCommitT9Soon();
        if (icaoInputRef.current) icaoInputRef.current.value = next;
        tryFetchIfReady(next);
        return next;
      }
      commitT9();
      if (prevDraft.length >= 4) return prevDraft;
      const addCh = letters[0];
      t9Ref.current = { key: num, count: 0, timeoutId: undefined };
      const next = prevDraft + addCh;
      autoCommitT9Soon();
      if (icaoInputRef.current) icaoInputRef.current.value = next;
      tryFetchIfReady(next);
      return next;
    });
  };
  const handleBackspaceT9 = () => {
    setIcaoDraft(prevDraft => {
      if (t9Ref.current) {
        commitT9();
        const next = prevDraft.slice(0, -1);
        if (icaoInputRef.current) icaoInputRef.current.value = next;
        return next;
      }
      const next = prevDraft.slice(0, -1);
      if (icaoInputRef.current) icaoInputRef.current.value = next;
      return next;
    });
  };
  const handleClearT9 = () => {
    commitT9();
    setIcaoDraft('');
    if (icaoInputRef.current) icaoInputRef.current.value = '';
  };

  // QWERTY 키패드 알파벳 키 처리
  useOnCx3Key(key => {
    if (!inInput) return;
    if (/^[A-Z]$/.test(key)) {
      setIcaoDraft(prev => {
        if (prev.length >= 4) return prev;
        const next = prev + key;
        if (icaoInputRef.current) icaoInputRef.current.value = next;
        tryFetchIfReady(next);
        return next;
      });
      return 'stop';
    }
    if (key === 'BKSP') {
      handleBackspaceT9();
      return 'stop';
    }
    if (key === 'CLR') {
      handleClearT9();
      return 'stop';
    }
    if (key === 'GO') {
      const draft = icaoDraft.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (draft.length === 4) {
        setIcao(draft);
        setRawScrollTop(0);
        void doFetchAll(draft);
      }
      return 'stop';
    }
    return undefined;
  });



  useEffect(() => {
    const vp = document.querySelector('.wx-raw-viewport') as HTMLDivElement | null;
    if (vp) {
      vp.scrollTop = rawScrollTop;
    }
  }, [rawScrollTop, inDisplay]);

  const rawTotalLines = useMemo<number>(() => {
    if (!inDisplay) return 0;
    let lines = 0;
    blocks.forEach(b => {
      lines += 1; // title
      if (b.ok) {
        const text = b.raw || '';
        const wrapCols = 42;
        const textLines = text.split(/\r?\n/).reduce<number>((acc, ln) => {
          if (ln.length === 0) return acc + 1;
          return acc + Math.max(1, Math.ceil(ln.length / wrapCols));
        }, 0);
        lines += Math.max(1, textLines);
      } else {
        lines += 1;
      }
    });
    return lines;
  }, [blocks, inDisplay]);

  const RAW_LINE_HEIGHT = 13.6;
  const HEADER_ROW_H_PX = useMemo(() => inDisplay ? 0 : 37 * 2, [inDisplay]);
  const LCD_CONTENT_H_PX = 290 - 12 - 4;
  const RAW_VIEWPORT_HEIGHT = Math.max(105, LCD_CONTENT_H_PX - HEADER_ROW_H_PX);
  const RAW_VIEWPORT_LINES = Math.max(6, Math.floor(RAW_VIEWPORT_HEIGHT / RAW_LINE_HEIGHT));
  const maxScrollPx = useMemo(() => {
    const totalPx = rawTotalLines * RAW_LINE_HEIGHT;
    return Math.max(0, totalPx - RAW_VIEWPORT_HEIGHT);
  }, [rawTotalLines, RAW_VIEWPORT_HEIGHT]);

  useEffect(() => {
    dispatch({ type: 'SET_LINECOUNT', lineCount: Math.max(WINDOW_SIZE, rawTotalLines + 2) });
  }, [rawTotalLines, dispatch]);

  const startIdx = useMemo(() => {
    if (inDisplay) return 0;
    const totalLines = WINDOW_SIZE;
    if (totalLines <= FULL_ROWS) return 0;
    const maxStart = totalLines - FULL_ROWS;
    let s = cursor - Math.floor(FULL_ROWS / 2);
    if (s < 0) s = 0;
    if (s > maxStart) s = maxStart;
    return s;
  }, [cursor, inDisplay]);

  useCx3OnEnter(() => {
    if (status === 'FETCHING') return;
    if (inInput) {
      const draft = (icaoDraft || icao || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (draft.length === 4) {
        setIcao(draft);
        setRawScrollTop(0);
        void doFetchAll(draft, true);
      } else {

      }
      return;
    }
    if (inDisplay && icao.length === 4) {
      setRawScrollTop(0);
      void doFetchAll(icao, true);
    }
  }, [status, icaoDraft, icao, inInput, inDisplay, blocks.length]);

  useOnCx3Key((k: Cx3KeyId) => {
    if (status === 'FETCHING' && k !== 'BACK') return undefined;
    if (k === 'BACK') {
      if (inDisplay) {
        if (mode === 'NOTAM') {
          setNotamResult(null);
        } else {
          setBlocks([]);
        }
        setStatus('IDLE');
        setIcao('');
        setIcaoDraft('');
        setRawScrollTop(0);
        setMetarSummary(null);
        setTafSummary(null);
        if (icaoInputRef.current) icaoInputRef.current.value = '';
        dispatch({ type: 'SET_CURSOR', idx: 0 });
        return 'stop';
      }
      replaceTop('HOME', 'HOME');
      return 'stop';
    }
    if (k === 'DN') {
      if (inDisplay) {
        setRawScrollTop(prev => Math.min(maxScrollPx, prev + RAW_LINE_HEIGHT));
      } else if (cursor < WINDOW_SIZE - 1) {
        dispatch({ type: 'NAV', delta: 1 });
      }
      return 'stop';
    }
    if (k === 'CONVU') { // CONV UNIT 버튼으로 Mode 전환: ATIS ↔ METAR/TAF ↔ NOTAM
      setMode(prev => {
        if (prev === 'ATIS') return 'METAR/TAF';
        if (prev === 'METAR/TAF') return 'NOTAM';
        return 'ATIS';
      });
      setRawScrollTop(0);
      setNotamScrollTop(0);
      // 입력 모드일 때 mode 전환 시 이전 결과 클리어
      if (inInput) {
        setBlocks([]);
        setMetarSummary(null);
        setTafSummary(null);
        setNotamResult(null);
        setIcao('');
        setIcaoDraft('');
        if (icaoInputRef.current) icaoInputRef.current.value = '';
      }
      return 'stop';
    }
    if (k === 'UP') {
      if (inDisplay) {
        setRawScrollTop(prev => Math.max(0, prev - RAW_LINE_HEIGHT));
      } else if (cursor > 0) {
        dispatch({ type: 'NAV', delta: -1 });
      }
      return 'stop';
    }
    if (k === 'POWER' || k === 'DUTY') {
      if (inDisplay && icao.length === 4) {
        setRawScrollTop(0);
        void doFetchAll(icao, true);
        return 'stop';
      }

      return 'stop';
    }
    if (inInput) {
      if (k === 'MEM') { commitT9(); return 'stop'; }
      if (k === 'CLR') { handleClearT9(); return 'stop'; }
      if (k === 'BKSP') { handleBackspaceT9(); return 'stop'; }
      const ch = keyIdToChar(k);
      if (ch && /^[0-9]$/.test(ch)) {
        if (cursor !== 1) dispatch({ type: 'SET_CURSOR', idx: 1 });
        handleT9Press(ch);
        return 'stop';
      }
      if (NUMBER_KEYS.includes(k)) {
        if (cursor !== 1) dispatch({ type: 'SET_CURSOR', idx: 1 });
        return 'stop';
      }
      return undefined;
    }
    return undefined;
  }, [status, cursor, inInput, inDisplay, icao, dispatch, replaceTop, maxScrollPx], 12);



  function onIcaoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = (e.target.value || '').toUpperCase();
    const only = raw.replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setIcaoDraft(only);
    if (only.length === 4) {
      setIcao(only);
      setRawScrollTop(0);
      void doFetchAll(only);
    }
  }

  function onIcaoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const only = (icaoDraft || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (only.length === 4) {
        setIcao(only);
        setRawScrollTop(0);
        void doFetchAll(only, true);
      }
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  async function doFetchAll(code4: string, force = false) {
    const g = doFetchGuardRef.current;
    // 모드별로 가드 키를 분리 (WX 조회 후 NOTAM 전환 시 같은 ICAO도 자동 조회 가능하도록)
    const guardKey = `${mode}:${code4}`;
    if (!force) {
      if (g.inProgress) return;
      if (g.lastKey === guardKey && Date.now() - g.lastAt < 3000) return;
    }
    g.inProgress = true;
    g.lastKey = guardKey;
    g.lastAt = Date.now();
    icaoInputRef.current?.blur();
    setStatus('FETCHING');
    setStatusMsg('조회 중...');
    setBlocks([]);
    setMetarSummary(null);
    setTafSummary(null);
    setNotamResult(null);
    try {
      if (mode === 'NOTAM') {
        // NOTAM 모드
        const data = await fetchNotams(code4, force);
        setNotamResult(data);
        if (data.entries.length > 0) {
          setStatus('OK');
          setStatusMsg(`${data.entries.length} 건`);
        } else {
          setStatus('OK');
          setStatusMsg('NOTAM 없음');
        }
        dispatch({ type: 'SET_CURSOR', idx: 0 });
        return;
      }

      // WX 모드 (ATIS 또는 METAR/TAF)
      if (mode === 'ATIS') {
        const requests: Promise<any>[] = [];
        requests.push(fetchAtis(code4).then(r => ({ key: 'ATIS' as BlockKey, title: 'ATIS', raw: r.raw, fetchedAt: r.fetchedAtMs })));
        
        const results = await Promise.allSettled(requests);
        const done: FetchedBlock[] = [];
        const targetKeys = ['ATIS'];
        
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const key = targetKeys[i] as BlockKey;
          if (r.status === 'fulfilled') {
            const v = r.value;
            const hasData = typeof v.raw === 'string' && v.raw.trim().length >= 4;
            if (hasData) {
              done.push({ key, title: key, raw: v.raw.trim(), ok: true, fetchedAt: v.fetchedAt });
            } else {
              done.push({ key, title: key, raw: '', ok: false, errMsg: 'NODATA' });
            }
          } else {
            const e = r.reason as any;
            const label = wxShortLabel(e);
            done.push({ key, title: key, raw: '', ok: false, errMsg: label.toUpperCase() });
          }
        }
        setBlocks(done);
        const okCount = done.filter(d => d.ok).length;
        if (okCount === targetKeys.length) { setStatus('OK'); setStatusMsg(`${okCount}종 정상`); }
        else if (okCount > 0) { setStatus('PARTIAL'); setStatusMsg(`${okCount}/${targetKeys.length} OK`); }
        else { setStatus('ERR'); setStatusMsg('전체 실패 · RETRY'); }
        dispatch({ type: 'SET_CURSOR', idx: 0 });
      } else {
        // METAR/TAF 모드: fetchMetarSummary/fetchTafSummary 병렬 요청
        const summaryResults = await Promise.all([
          fetchMetarSummary(code4).catch(() => null),
          fetchTafSummary(code4).catch(() => null),
        ]);
        
        const done: FetchedBlock[] = [];
        if (summaryResults[0]) {
          done.push({ key: 'METAR', title: 'METAR', raw: summaryResults[0].raw, ok: true, fetchedAt: Date.now() });
        } else {
          done.push({ key: 'METAR', title: 'METAR', raw: '', ok: false, errMsg: 'NODATA' });
        }
        if (summaryResults[1]) {
          done.push({ key: 'TAF', title: 'TAF', raw: summaryResults[1].raw, ok: true, fetchedAt: Date.now() });
        } else {
          done.push({ key: 'TAF', title: 'TAF', raw: '', ok: false, errMsg: 'NODATA' });
        }
        
        if (summaryResults[0]) setMetarSummary(summaryResults[0]);
        if (summaryResults[1]) setTafSummary(summaryResults[1]);
        
        setBlocks(done);
        const okCount = done.filter(d => d.ok).length;
        if (okCount === 2) { setStatus('OK'); setStatusMsg(`${okCount}종 정상`); }
        else if (okCount > 0) { setStatus('PARTIAL'); setStatusMsg(`${okCount}/2 OK`); }
        else { setStatus('ERR'); setStatusMsg('전체 실패 · RETRY'); }
        dispatch({ type: 'SET_CURSOR', idx: 0 });
      }


    } catch (e: any) {
      const label = mode === 'NOTAM' ? notamShortLabel(e) : wxShortLabel(e);
      setStatus('ERR');
      const detailedMsg = mode === 'NOTAM' && e?.message ? `${label}·${String(e.message).slice(0, 120)}` : label;
      console.error('NOTAM Fetch Error:', e); // 로그에 상세 오류 출력
      setStatusMsg(detailedMsg);
      if (mode !== 'NOTAM') {
        const targetKeys = mode === 'ATIS' ? ['ATIS'] : ['METAR', 'TAF'];
        const mkEmpty = (k: BlockKey) => ({ key: k, title: k, raw: '', ok: false as const, errMsg: label });
        setBlocks(targetKeys.map(k => mkEmpty(k as BlockKey)));
      }
    } finally {
      doFetchGuardRef.current.inProgress = false;
    }
  }

  function renderHeaderRows(): React.ReactNode[] {
    // 입력 모드 전용: WX/NOTAM 타이틀 + ICAO 입력 행
    const rows: React.ReactNode[] = [];
    const isNotam = mode === 'NOTAM';
    rows.push(
      <div key="wx-h-0" onClick={() => { dispatch({ type: 'SET_CURSOR', idx: 0 }); }}>
        <Cx3Line
          key="wx-line-0"
          label={isNotam ? 'NOTAM' : 'WX'}
          valueDisplay={isNotam ? 'FAA NMS' : 'WEATHER'}
          unit=""
          state="calc"
          cursor={cursor === 0}
          valueClass="green"
        />
      </div>
    );
    rows.push(
      <div key="wx-h-1" onClick={() => { dispatch({ type: 'SET_CURSOR', idx: 1 }); }}>
        <div className="cx3-menu-line cursor-placeholder wx-icao-row-line" style={{
            display: 'grid', gridTemplateColumns: '22px 1fr auto',
            alignItems: 'center', gap: 6, padding: '3px 2px 5px',
            borderBottom: '1px solid var(--cx3-lcd-divider)',
            minHeight: 33, maxHeight: 33, zIndex: 3, position: 'relative',
            fontWeight: 600, boxSizing: 'border-box', flex: '0 0 auto',
          }}>
            <Cx3LineIcon state="input" />
            <span className="cx3-menu-label">ICAO</span>
            <span className="cx3-menu-value-wrap" style={{ textAlign: 'right', display: 'inline-flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'flex-end', paddingRight: 3 }}>
              <div style={{
                position: 'relative', width: 128, height: 22, border: '1px solid var(--cx3-lcd-green)',
                borderRadius: 4, background: 'rgba(0,0,0,0.25)', display: 'inline-flex',
                alignItems: 'center', padding: '2px 7px', boxSizing: 'border-box', zIndex: 10,
              }} onClick={(e) => { e.stopPropagation(); }}>
                <input
                ref={icaoInputRef}
                type="text" inputMode="none" autoCapitalize="characters" autoCorrect="off"
                autoComplete="off" spellCheck={false} maxLength={4} placeholder="RKPK"
                readOnly
                value={icaoDraft || (icao || '')}
                onChange={onIcaoInputChange} onKeyDown={onIcaoKeyDown}
                onClick={(e) => { e.stopPropagation(); }}
                onFocus={(e) => { e.target.blur(); (e.target as HTMLInputElement).blur(); }}
                onPointerDown={(e) => { e.preventDefault(); }}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--cx3-lcd-green)', fontFamily: 'JetBrains Mono, Consolas, "SF Mono", Menlo, monospace',
                  fontSize: 15, fontWeight: 800, textAlign: 'right', letterSpacing: 4, padding: 0,
                  caretColor: 'transparent', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  lineHeight: '18px', height: '18px',
                }}
              />
              </div>
            </span>
          </div>
      </div>
    );
    return rows;
  }

  function renderInputEmptyRows(pos: number): React.ReactNode {
    return (
      <div
        key={`wx-wrap-empty-${pos}`}
        onClick={() => { dispatch({ type: 'SET_CURSOR', idx: pos }); }}
        style={{
          position: 'relative', overflow: 'hidden',
          minHeight: 31, maxHeight: 31, flex: '0 0 auto',
          boxSizing: 'border-box',
          borderBottom: '1px solid var(--cx3-lcd-divider)',
        }}
      />
    );
  }

  // ─── NOTAM Helpers ────────────────────────────────────────────────
  const FEATURE_FILTERS = ['ALL', 'RWY', 'TWY', 'NAV', 'AIRSPACE', 'COM', 'APRON', 'FDC'] as const;

  // Q-code 주제별 필터 옵션 추출
  const qcodeSubjectFilters = useMemo<string[]>(() => {
    if (!notamResult) return [];
    const subjects = new Set<string>();
    notamResult.entries.forEach(entry => {
      entry.decodedQcodes?.forEach(qcode => {
        if (qcode.code.length === 2) { // Q-code 주제는 2자리
          subjects.add(qcode.code);
        }
      });
    });
    return Array.from(subjects).sort();
  }, [notamResult]);

  // 모든 필터 옵션 (기존 feature 필터 + Q-code 주제 필터)
  const ALL_FILTERS = useMemo<string[]>(() => {
    return [...FEATURE_FILTERS, ...qcodeSubjectFilters];
  }, [qcodeSubjectFilters]);

  const filteredNotamEntries = useMemo<NotamEntry[]>(() => {
    if (!notamResult) return [];
    if (notamFilter === 'ALL') return notamResult.entries;
    
    // 기존 feature 필터
    if (FEATURE_FILTERS.includes(notamFilter as any)) {
      return notamResult.entries.filter(e => {
        const feat = (e.feature ?? '').toUpperCase();
        const cls = (e.classification ?? '').toUpperCase();
        return feat === notamFilter || cls === notamFilter;
      });
    }
    
    // Q-code 주제 필터
    return notamResult.entries.filter(e => {
      return e.decodedQcodes?.some(qcode => qcode.code === notamFilter);
    });
  }, [notamResult, notamFilter]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  function renderNotamFullscreen(): React.ReactNode {
    const isLoading = status === 'FETCHING';
    const handleClose = () => {
      setNotamResult(null); setResultCleanup();
    };

    const handleFilterChange = (filter: string) => {
      setNotamFilter(filter);
      setDropdownOpen(false);
    };

    const handleDropdownToggle = () => {
      setDropdownOpen(!dropdownOpen);
    };

    const handleDropdownItemClick = (filter: string) => {
      setNotamFilter(filter);
      setDropdownOpen(false);
    };

    return (
      <div className="wx-fullscreen-viewer" key="notam-fullscreen"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: '#000', display: 'flex', flexDirection: 'column',
          padding: '10px 12px', boxSizing: 'border-box', overflow: 'hidden',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, marginBottom: 6 }}>
          <span className="wx-raw-title" style={{ fontSize: 19 }}>
            NOTAM · {icao.toUpperCase()}
          </span>
          {/* Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={handleDropdownToggle}
              style={{
                padding: '4px 12px', borderRadius: 4,
                border: '1px solid var(--cx3-lcd-amber)',
                color: 'var(--cx3-lcd-amber)', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', background: 'rgba(255,191,0,0.1)',
                userSelect: 'none', textAlign: 'center',
              }}
            >
              [{notamFilter}]
            </div>
            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#000', border: '1px solid var(--cx3-lcd-amber)',
                  borderRadius: 4, padding: 2, minWidth: 120,
                  zIndex: 10000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                {ALL_FILTERS.map((filter) => (
                  <div
                    key={filter}
                    onClick={() => handleDropdownItemClick(filter)}
                    style={{
                      padding: '6px 12px', fontSize: 14,
                      color: filter === notamFilter ? 'var(--cx3-lcd-green)' : 'var(--cx3-lcd-fg)',
                      fontWeight: filter === notamFilter ? 700 : 500,
                      cursor: 'pointer', borderRadius: 2,
                      background: filter === notamFilter ? 'rgba(0,255,102,0.1)' : 'transparent',
                      textAlign: 'center',
                    }}
                  >
                    {filter}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, fontSize: 13, color: 'var(--cx3-lcd-fg)', opacity: 0.6, marginBottom: 4 }}>
          {notamResult ? `${filteredNotamEntries.length} / ${notamResult.entries.length} NOTAMs` : ''}
        </div>
        {/* Content */}
        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div className="cx3-loading-flash" style={{ fontSize: 16 }}>·· LOADING NOTAM ··</div>
            <div className="cx3-loading-flash" style={{ fontSize: 14, opacity: 0.7 }}>FAA NMS API</div>
          </div>
        ) : filteredNotamEntries.length === 0 ? (
          <div style={{ flex: 1, padding: 16, color: 'var(--cx3-lcd-amber)', fontSize: 15 }}>
            No NOTAMs for {icao.toUpperCase()}
            {notamFilter !== 'ALL' ? ` [filter: ${notamFilter}]` : ''}
          </div>
        ) : (
          <div ref={notamContentRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
            {filteredNotamEntries.map((entry, idx) => renderNotamLine(entry, idx))}
            <div style={{ height: 12 }} />
          </div>
        )}
        {/* Close bar */}
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

  function renderNotamLine(entry: NotamEntry, idx: number): React.ReactNode {
    const text = entry.icaoFormattedText || entry.text || '';
    const feature = entry.feature || '';
    const classification = entry.classification || '';
    const nmsId = entry.nmsId || '';
    const decodedQcodes = entry.decodedQcodes || [];

    let color = 'var(--cx3-lcd-green)';
    let prefix = '○';
    if (feature.toUpperCase() === 'RWY' || feature.toUpperCase() === 'TWY') {
      color = 'var(--cx3-lcd-red)';
      prefix = '●';
    } else if (feature.toUpperCase() === 'NAV' || feature.toUpperCase() === 'COM') {
      color = 'var(--cx3-lcd-amber)';
      prefix = '◆';
    } else if (classification.toUpperCase() === 'FDC') {
      color = 'var(--cx3-lcd-blue)';
      prefix = '▲';
    }

    // ICAO formatted text를 줄바꿈으로 분리
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    return (
      <div key={`notam-entry-${idx}`} style={{
        padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 14, lineHeight: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color, fontWeight: 700, fontSize: 16 }}>{prefix}</span>
          <span style={{ color: 'var(--cx3-lcd-fg)', fontSize: 12, opacity: 0.5 }}>
            {feature || classification || 'NOTAM'}
          </span>
        </div>
        {/* ICAO NOTAM 표시 */}
        <div style={{ color: 'var(--cx3-lcd-green)', marginTop: 4, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
          {lines.map((line, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
              {line.trim()}
            </div>
          ))}
        </div>
        {nmsId && (
          <div style={{ color: 'var(--cx3-lcd-fg)', fontSize: 11, opacity: 0.35, marginTop: 1 }}>
            ID: {nmsId}
          </div>
        )}
      </div>
    );
  }

  function setResultCleanup() {
    setNotamResult(null);
    setStatus('IDLE');
    setIcao('');
    setIcaoDraft('');
    setRawScrollTop(0);
    setBlocks([]);
    setMetarSummary(null);
    setTafSummary(null);
    if (icaoInputRef.current) icaoInputRef.current.value = '';
    dispatch({ type: 'SET_CURSOR', idx: 0 });
  }

  function renderRawViewer(): React.ReactNode {
    // NOTAM mode
    if (mode === 'NOTAM') {
      return renderNotamFullscreen();
    }

    const targetBlock = blocks.find(b => b.key === mode);
    const metarBlock = blocks.find(b => b.key === 'METAR');
    const tafBlock = blocks.find(b => b.key === 'TAF');
    const isMetarTafMode = mode === 'METAR/TAF';
    
    // Capacitor Native 환경 여부 판단 (전체화면 렌더링)
    const isCapacitorNative = () => {
      try {
        // 1. window.Capacitor가 존재하는지 확인
        const w = window as any;
        if (!w?.Capacitor) return false;
        
        // 2. 명시적인 플랫폼 확인
        const Cap = w.Capacitor;
        if (typeof Cap?.getPlatform === 'function') {
          const platform = Cap.getPlatform();
          if (platform === 'android' || platform === 'ios') return true;
        }
        
        // 3. 플랫폼 속성 확인
        if (Cap?.platform && Cap.platform !== 'web') return true;
        
        // 4. Native 플러그인 존재 확인
        const Http = Cap?.Plugins?.Http ?? Cap?.Plugins?.CapacitorHttp ?? w?.CapacitorHttp;
        if (Http && (Http.request || Http.get)) return true;
        
        return false;
      } catch (e) {
        console.error('isCapacitorNative check failed:', e);
        return false;
      }
    };
    
    // 실제 안드로이드 앱에서 전체 화면으로 렌더링하도록 강제로 true로 설정
    const isAndroidApp = true;
    
    // METAR/TAF Mode
    if (isMetarTafMode) {
      // 안드로이드 앱(Capacitor Native) → 전체 화면
      // 웹 시뮬레이터 → LCD 영역 내 표시
      if (isAndroidApp) {
        return renderMetarTafFullscreen(metarBlock, tafBlock);
      } else {
        // 웹 시뮬레이터용: 기존 LCD 내부 렌더링
        return renderMetarTafInLCD(metarBlock, tafBlock);
      }
    }
    
    // ATIS Mode
    if (mode === 'ATIS' && targetBlock?.ok) {
      const atisDetails = parseAtisDetails(targetBlock.raw);
      const now = new Date();
      const nowHms = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}`;
      
      let issueTime = '';
      if (atisDetails.issueTime) {
        issueTime = atisDetails.issueTime;
      }
      
      const timeDiff = calcTimeDiff(issueTime, nowHms);
      
      return (
        <div className="wx-raw-viewer" key="wx-raw-viewer"
          style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT, minHeight: RAW_VIEWPORT_HEIGHT }}>
          <div className="wx-raw-viewport" onClick={() => dispatch({ type: 'SET_CURSOR', idx: 2 })}
            style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT }}>
            <div ref={rawContentRef} className="wx-raw-content" style={{ willChange: 'transform' }}>
              <div className="wx-raw-title">ATIS Mode [ACTIVE]</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: 6, border: '1px solid var(--cx3-lcd-divider)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--cx3-lcd-amber)', marginBottom: 2 }}>ATIS 발신시간</div>
                  <div style={{ fontSize: '14px', color: 'var(--cx3-lcd-green)', fontWeight: 700 }}>{issueTime || 'UNKNOWN'}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: 6, border: '1px solid var(--cx3-lcd-divider)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--cx3-lcd-amber)', marginBottom: 2 }}>경과 시간</div>
                  <div style={{ fontSize: '14px', color: 'var(--cx3-lcd-green)', fontWeight: 700 }}>{timeDiff}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="wx-raw-title">● ATIS RAW DATA</div>
                <div style={{ color: 'var(--cx3-lcd-green)', marginTop: 1 }}>{targetBlock.raw}</div>
              </div>
              {renderLoadingFooter()}
            </div>
          </div>
          {maxScrollPx > 0 && <div className="wx-raw-scroll-hint">{Math.round(rawScrollTop / RAW_LINE_HEIGHT) + RAW_VIEWPORT_LINES}/{rawTotalLines}  ▲▼</div>}
        </div>
      );
    }
    
    // Fallback
    return (
      <div className="wx-raw-viewer" key="wx-raw-viewer"
        style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT, minHeight: RAW_VIEWPORT_HEIGHT }}>
        <div className="wx-raw-viewport" style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT }}>
          <div ref={rawContentRef} className="wx-raw-content" style={{ willChange: 'transform' }}>
            <div className="wx-raw-title">○ ATIS</div>
            <div className="wx-raw-error">ERR: NOT AVAILABLE</div>
            {renderLoadingFooter()}
          </div>
        </div>
      </div>
    );
  }
  
  /** METAR/TAF LCD 내부 렌더러 — 웹 시뮬레이터용 */
  function renderMetarTafInLCD(metarBlock: FetchedBlock | undefined, tafBlock: FetchedBlock | undefined): React.ReactNode {
    const ms = metarSummary;
    const ts = tafSummary;
    const obsTimeStr = ms?.timestamp ? `${ms.timestamp.slice(0,2)}:${ms.timestamp.slice(2,4)}Z` : '';
    const obsLocalStr = ms?.localTimestamp || (ms ? getAirportLocalObservedTime(icao || ms.station, ms.obsTime || ms.timestamp, ms.lon).fullStr : '');
    
    return (
      <div className="wx-raw-viewer" key="wx-raw-viewer"
        style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT, minHeight: RAW_VIEWPORT_HEIGHT }}>
        <div className="wx-raw-viewport" onClick={() => dispatch({ type: 'SET_CURSOR', idx: 2 })}
          style={{ height: RAW_VIEWPORT_HEIGHT, maxHeight: RAW_VIEWPORT_HEIGHT }}>
          <div ref={rawContentRef} className="wx-raw-content" style={{ willChange: 'transform' }}>
            {/* Header: Station + Flight Category */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div className="wx-raw-title">{icao.toUpperCase()} · {ms?.station || ''}</div>
              {ms && (
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: '1px 8px', borderRadius: 3,
                  color: '#000', background: ms.flightCategory === 'VFR' ? '#00cc66' :
                    ms.flightCategory === 'MVFR' ? '#3399ff' :
                    ms.flightCategory === 'IFR' ? '#ff6600' : '#ff3330',
                }}>
                  {ms.flightCategory}
                </span>
              )}
            </div>
            
            {/* METAR Section */}
            {metarBlock?.ok && (
              <>
                <div className="wx-raw-title" style={{ fontSize: 12, color: 'var(--cx3-lcd-amber)' }}>
                  Current observation (METAR)
                </div>
                <div style={{ fontSize: 11, color: 'var(--cx3-lcd-fg)', opacity: 0.6, marginBottom: 4 }}>{metarBlock.raw}</div>
                
                {ms && (
                  <div style={{ marginBottom: 8, padding: '4px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                    <span style={{ color: 'var(--cx3-lcd-amber)', fontSize: 11 }}>Observed </span>
                    <span style={{ color: 'var(--cx3-lcd-green)', fontSize: 11 }}>{obsTimeStr} UTC · {obsLocalStr} local</span>
                  </div>
                )}
                
                {ms && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                    <InfoCard label="Wind" value={`${ms.windDir != null ? `${ms.windDir}° ` : ''}${ms.windSpeed != null ? `${ms.windSpeed} kt` : ''}${ms.windGust ? ` (G${ms.windGust})` : ''}`} sub={ms.windVar ? `Variable ${ms.windVar}` : undefined} />
                    <InfoCard label="Visibility" value={ms.visibility || (metarBlock.raw.includes('CAVOK') ? '10 km or more' : '')} />
                    {ms.weather.length > 0 && <InfoCard label="Weather" value={ms.weather.join(', ') || 'No significant weather'} />}
                    {ms.clouds.length > 0 && <InfoCard label="Clouds" value={ms.clouds.join('; ')} />}
                    <InfoCard label="Temperature" value={`${ms.temp != null ? `${ms.temp}°C` : ''}${ms.dewPoint != null ? ` / ${ms.dewPoint}°C` : ''}${ms.humidity != null ? ` (${ms.humidity}%)` : ''}`} />
                    <InfoCard label="Pressure (QNH)" value={`${ms.qnh ? `${ms.qnh} hPa` : ''}${ms.qnh ? ` · ${(ms.qnh * 0.02953).toFixed(2)} inHg` : ''}`} />
                  </div>
                )}
                
                {ms && (
                  <div style={{ marginTop: 6, marginBottom: 10, padding: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 4, border: '1px solid var(--cx3-lcd-divider)' }}>
                    <div style={{ fontSize: 10, color: 'var(--cx3-lcd-amber)', marginBottom: 4 }}>Visual summary</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: '0 0 72px', height: 72, position: 'relative', border: '1px solid var(--cx3-lcd-divider)', borderRadius: '50%', background: 'rgba(0,0,0,0.3)' }}>
                        {ms.windDir != null && ms.windSpeed != null && (() => {
                          const rad = (ms.windDir - 180) * Math.PI / 180;
                          const len = Math.min(ms.windSpeed / 30, 1) * 26;
                          const cx = 36, cy = 36;
                          return (<><div style={{ position: 'absolute', top: 1, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: 'var(--cx3-lcd-fg)', opacity: 0.4 }}>N</div><svg width="72" height="72" style={{ position: 'absolute', top: 0, left: 0 }}><circle cx="36" cy="36" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" /><line x1={cx} y1={cy} x2={cx + Math.cos(rad)*len} y2={cy + Math.sin(rad)*len} stroke="#00ff66" strokeWidth="2" /><circle cx={cx + Math.cos(rad)*len} cy={cy + Math.sin(rad)*len} r="3" fill="#00ff66" /></svg></>);
                        })()}
                        {(!ms.windDir || !ms.windSpeed) && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 10, color: 'var(--cx3-lcd-fg)', opacity: 0.3 }}>No wind data</div>}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: 'var(--cx3-lcd-green)' }}>Temp {ms.temp != null ? `${ms.temp}°C` : '--'}</span>
                          <span style={{ color: 'var(--cx3-lcd-blue)' }}>Dewpoint {ms.dewPoint != null ? `${ms.dewPoint}°C` : '--'}</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                          {ms.temp != null && ms.dewPoint != null && (() => {
                            const minT = -10, maxT = 50, range = maxT - minT;
                            const tPct = ((ms.temp! - minT) / range) * 100;
                            const dPct = ((ms.dewPoint! - minT) / range) * 100;
                            return (<><div style={{ position: 'absolute', left: `${Math.min(tPct,dPct)}%`, width: `${Math.abs(tPct-dPct)}%`, height: '100%', background: 'linear-gradient(90deg,#3399ff,#00ff66)' }} /><div style={{ position: 'absolute', left: `${tPct}%`, top: 0, width: 2, height: '100%', background: '#00ff66', transform: 'translateX(-50%)' }} /><div style={{ position: 'absolute', left: `${dPct}%`, top: 0, width: 2, height: '100%', background: '#3399ff', transform: 'translateX(-50%)' }} /></>);
                          })()}
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--cx3-lcd-fg)', opacity: 0.4, textAlign: 'right' }}>-10°C ················· 50°C</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {metarBlock && !metarBlock.ok && (
              <div style={{ marginBottom: 8 }}><div className="wx-raw-title">○ METAR</div><div className="wx-raw-error">ERR: {metarBlock.errMsg || 'FAIL'}</div></div>
            )}
            
            <div style={{ borderTop: '1px solid var(--cx3-lcd-divider)', margin: '6px 0' }} />
            
            {/* TAF Section */}
            {tafBlock?.ok && (
              <>
                <div className="wx-raw-title" style={{ fontSize: 12, color: 'var(--cx3-lcd-amber)' }}>Forecast (TAF)</div>
                <div style={{ fontSize: 11, color: 'var(--cx3-lcd-fg)', opacity: 0.6, marginBottom: 4 }}>{tafBlock.raw}</div>
                
                {ts && (
                  <div style={{ marginBottom: 6, padding: '4px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                    <span style={{ color: 'var(--cx3-lcd-amber)', fontSize: 11 }}>Issued {formatTafZulu(ts.issueTime)} · </span>
                    <span style={{ color: 'var(--cx3-lcd-green)', fontSize: 11 }}>valid {formatTafZulu(ts.validFrom)} → {formatTafZulu(ts.validTo)}</span>
                  </div>
                )}
                
                {ts?.groups.map((g, gi) => (
                  <div key={`taf-g-${gi}`} style={{ marginBottom: 4, padding: '4px 6px', background: g.type === 'INITIAL' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                    <div style={{ fontSize: 10, color: 'var(--cx3-lcd-amber)', fontWeight: 600 }}>
                      {g.type === 'INITIAL' ? 'Initial' : g.type}
                      {g.fromTime || g.toTime ? ` ${formatTafZulu(g.fromTime)} → ${formatTafZulu(g.toTime)}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cx3-lcd-green)' }}>
                      {g.windVRB ? `VRB at ${g.windSpeed} kt` : g.windDir != null ? `${g.windDir}° at ${g.windSpeed} kt` : ''}
                      {g.windGust ? ` (G${g.windGust})` : ''}{g.visibility ? `. Visibility ${g.visibility}` : ''}
                    </div>
                    {g.clouds.length > 0 && <div style={{ fontSize: 11, color: 'var(--cx3-lcd-fg)', opacity: 0.7 }}>{g.clouds.join('; ')}</div>}
                    {g.weather.length > 0 && <div style={{ fontSize: 11, color: 'var(--cx3-lcd-fg)', opacity: 0.7 }}>{g.weather.join(', ')}</div>}
                  </div>
                ))}
                
                {ts?.tempExtremes && ts.tempExtremes.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {ts.tempExtremes.map((te, tei) => {
                      const m = te.match(/(TX|TN)(M?\d{2})\/(\d{4})Z/);
                      if (!m) return null;
                      return (
                        <div key={`te-${tei}`} style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, fontSize: 11, border: '1px solid var(--cx3-lcd-divider)' }}>
                          <span style={{ color: 'var(--cx3-lcd-amber)' }}>{m[1] === 'TX' ? 'Max' : 'Min'} </span>
                          <span style={{ color: 'var(--cx3-lcd-green)', fontWeight: 600 }}>{m[2].startsWith('M') ? `-${parseInt(m[2].slice(1), 10)}` : parseInt(m[2], 10)}°C</span>
                          <span style={{ color: 'var(--cx3-lcd-fg)', opacity: 0.5 }}> at {formatTafZulu(m[3])}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            
            {tafBlock && !tafBlock.ok && (
              <div style={{ marginTop: 8 }}><div className="wx-raw-title">○ TAF</div><div className="wx-raw-error">ERR: {tafBlock.errMsg || 'FAIL'}</div></div>
            )}
            
            {renderLoadingFooter()}
          </div>
        </div>
        {maxScrollPx > 0 && <div className="wx-raw-scroll-hint">{Math.round(rawScrollTop / RAW_LINE_HEIGHT) + RAW_VIEWPORT_LINES}/{rawTotalLines}  ▲▼</div>}
      </div>
    );
  }
  
  /** METAR/TAF 전체화면 렌더러 — position: fixed, CLOSE 버튼 포함 (안드로이드 앱) */
  function renderMetarTafFullscreen(metarBlock: FetchedBlock | undefined, tafBlock: FetchedBlock | undefined): React.ReactNode {
    const ms = metarSummary;
    const ts = tafSummary;
    const obsTimeStr = ms?.timestamp ? `${ms.timestamp.slice(0,2)}:${ms.timestamp.slice(2,4)}Z` : '';
    const obsLocalStr = ms?.localTimestamp || (ms ? getAirportLocalObservedTime(icao || ms.station, ms.obsTime || ms.timestamp, ms.lon).fullStr : '');

    const handleClose = () => {
      setBlocks([]); setStatus('IDLE'); setIcao(''); setIcaoDraft(''); setRawScrollTop(0);
      if (icaoInputRef.current) icaoInputRef.current.value = '';
      dispatch({ type: 'SET_CURSOR', idx: 0 });
    };
    
    return (
      <div className="wx-fullscreen-viewer" key="wx-fullscreen"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: '#000', display: 'flex', flexDirection: 'column',
          padding: '10px 12px', boxSizing: 'border-box', overflow: 'hidden',
        }}>
        {/* 상단 헤더: Station + Flight Category */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="wx-raw-title" style={{ fontSize: 19 }}>{icao.toUpperCase()}</span>
            {ms && (
              <span style={{
                fontSize: 17, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                color: '#000', background: ms.flightCategory === 'VFR' ? '#00cc66' :
                  ms.flightCategory === 'MVFR' ? '#3399ff' :
                  ms.flightCategory === 'IFR' ? '#ff6600' : '#ff3330',
              }}>
                {ms.flightCategory}
              </span>
            )}
          </div>
        </div>
        
        {/* 스크롤 가능 콘텐츠 */}
        <div ref={rawContentRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          {/* METAR */}
          {metarBlock?.ok && (
            <>
              <div className="wx-raw-title" style={{ fontSize: 15, color: 'var(--cx3-lcd-amber)' }}>
                Current observation (METAR)
              </div>
              <div style={{ fontSize: 14, color: 'var(--cx3-lcd-fg)', opacity: 0.6, marginBottom: 4 }}>{metarBlock.raw}</div>
              {ms && (
                <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                  <span style={{ color: 'var(--cx3-lcd-amber)', fontSize: 14 }}>Observed </span>
                  <span style={{ color: 'var(--cx3-lcd-green)', fontSize: 14 }}>{obsTimeStr} UTC · {obsLocalStr} local</span>
                </div>
              )}
              {ms && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                  <InfoCard label="Wind" value={`${ms.windDir != null ? `${ms.windDir}° ` : ''}${ms.windSpeed != null ? `${ms.windSpeed} kt` : ''}${ms.windGust ? ` (G${ms.windGust})` : ''}`} sub={ms.windVar ? `Variable ${ms.windVar}` : undefined} />
                  <InfoCard label="Visibility" value={ms.visibility || (metarBlock.raw.includes('CAVOK') ? '10 km or more' : '')} />
                  {ms.weather.length > 0 && <InfoCard label="Weather" value={ms.weather.join(', ') || 'No significant weather'} />}
                  {ms.clouds.length > 0 && <InfoCard label="Clouds" value={ms.clouds.join('; ')} />}
                  <InfoCard label="Temperature" value={`${ms.temp != null ? `${ms.temp}°C` : ''}${ms.dewPoint != null ? ` / ${ms.dewPoint}°C` : ''}${ms.humidity != null ? ` (${ms.humidity}%)` : ''}`} />
                  <InfoCard label="Pressure (QNH)" value={`${ms.qnh ? `${ms.qnh} hPa` : ''}${ms.qnh ? ` · ${(ms.qnh * 0.02953).toFixed(2)} inHg` : ''}`} />
                </div>
              )}

            </>
          )}
          {metarBlock && !metarBlock.ok && (
            <div style={{ marginBottom: 8 }}><div className="wx-raw-title">○ METAR</div><div className="wx-raw-error">ERR: {metarBlock.errMsg || 'FAIL'}</div></div>
          )}
          
          <div style={{ borderTop: '1px solid var(--cx3-lcd-divider)', margin: '6px 0' }} />
          
          {/* TAF */}
          {tafBlock?.ok && (
            <>
              <div className="wx-raw-title" style={{ fontSize: 15, color: 'var(--cx3-lcd-amber)' }}>Forecast (TAF)</div>
              <div style={{ fontSize: 14, color: 'var(--cx3-lcd-fg)', opacity: 0.6, marginBottom: 4 }}>{tafBlock.raw}</div>
              {ts && (
                <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                  <span style={{ color: 'var(--cx3-lcd-amber)', fontSize: 14 }}>Issued {formatTafZulu(ts.issueTime)} · </span>
                  <span style={{ color: 'var(--cx3-lcd-green)', fontSize: 14 }}>valid {formatTafZulu(ts.validFrom)} → {formatTafZulu(ts.validTo)}</span>
                </div>
              )}
              {ts?.groups.map((g, gi) => (
                <div key={`taf-g-${gi}`} style={{ marginBottom: 4, padding: '4px 6px', background: g.type === 'INITIAL' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0.1)', borderRadius: 3, border: '1px solid var(--cx3-lcd-divider)' }}>
                  <div style={{ fontSize: 13, color: 'var(--cx3-lcd-amber)', fontWeight: 600 }}>
                    {g.type === 'INITIAL' ? 'Initial' : g.type}
                    {g.fromTime || g.toTime ? ` ${formatTafZulu(g.fromTime)} → ${formatTafZulu(g.toTime)}` : ''}
                  </div>
                  <div style={{ fontSize: 15, color: 'var(--cx3-lcd-green)', fontWeight: 700 }}>
                    {g.windVRB ? `VRB at ${g.windSpeed} kt` : g.windDir != null ? `${g.windDir}° at ${g.windSpeed} kt` : ''}
                    {g.windGust ? ` (G${g.windGust})` : ''}{g.visibility ? `. Visibility ${g.visibility}` : ''}
                  </div>
                  {g.clouds.length > 0 && <div style={{ fontSize: 14, color: 'var(--cx3-lcd-fg)', opacity: 0.7 }}>{g.clouds.join('; ')}</div>}
                  {g.weather.length > 0 && <div style={{ fontSize: 14, color: 'var(--cx3-lcd-fg)', opacity: 0.7 }}>{g.weather.join(', ')}</div>}
                </div>
              ))}
              {ts?.tempExtremes && ts.tempExtremes.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ts.tempExtremes.map((te, tei) => {
                    const m = te.match(/(TX|TN)(M?\d{2})\/(\d{4})Z/);
                    if (!m) return null;
                    return (
                      <div key={`te-${tei}`} style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, fontSize: 14, border: '1px solid var(--cx3-lcd-divider)' }}>
                        <span style={{ color: 'var(--cx3-lcd-amber)' }}>{m[1] === 'TX' ? 'Max' : 'Min'} </span>
                        <span style={{ color: 'var(--cx3-lcd-green)', fontWeight: 600 }}>{m[2].startsWith('M') ? `-${parseInt(m[2].slice(1), 10)}` : parseInt(m[2], 10)}°C</span>
                        <span style={{ color: 'var(--cx3-lcd-fg)', opacity: 0.5 }}> at {formatTafZulu(m[3])}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {tafBlock && !tafBlock.ok && (
            <div style={{ marginTop: 8 }}><div className="wx-raw-title">○ TAF</div><div className="wx-raw-error">ERR: {tafBlock.errMsg || 'FAIL'}</div></div>
          )}
          
          {renderLoadingFooter()}
          <div style={{ height: 12 }} />
        </div>
        
        {/* 하단 CLOSE 바 */}
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
  
  /** 미니 InfoCard */
  function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactNode {
    return (
      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 3, padding: '4px 6px', border: '1px solid var(--cx3-lcd-divider)' }}>
        <div style={{ fontSize: 13, color: 'var(--cx3-lcd-amber)' }}>{label}</div>
        <div style={{ fontSize: 15, color: 'var(--cx3-lcd-green)', fontWeight: 700 }}>{value || '--'}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--cx3-lcd-fg)', opacity: 0.5 }}>{sub}</div>}
      </div>
    );
  }
  
  /** Helper: 풍향 → 16방위 문자 */
  function degToCardinalLocal(deg: number): string {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }
  
  /** Helper: 로딩 푸터 */
  function renderLoadingFooter(): React.ReactNode {
    if (status === 'FETCHING' && blocks.length > 0) {
      return (
        <div style={{ marginTop: 6, paddingTop: 2, borderTop: '1px dashed var(--cx3-lcd-divider)' }}>
          <div className="cx3-loading-flash cx3-loading-center">·· LOADING ATIS/WX DATA ··</div>
        </div>
      );
    }
    if (status === 'FETCHING' && blocks.length === 0) {
      return (
        <div style={{ paddingTop: RAW_LINE_HEIGHT, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="cx3-loading-flash cx3-loading-center">·· LOADING ··</div>
          <div className="cx3-loading-flash cx3-loading-center">FETCHING {icao.toUpperCase()} {mode === 'NOTAM' ? 'NOTAM' : 'WX'}</div>
        </div>
      );
    }
    return null;
  }

  function renderRows(): React.ReactNode[] {
    const rows: React.ReactNode[] = [];

    if (inInput) {
      rows.push(...renderHeaderRows());
      const isLoading = status === 'FETCHING';
      const start = isLoading ? (WINDOW_SIZE - 2) : 2;
      for (let pos = 2; pos < start; pos++) {
        const idx = pos;
        rows.push(renderInputEmptyRows(idx));
      }
      if (isLoading) {
        rows.push(
          <div key="wx-loading-1" style={{
            position: 'relative', overflow: 'hidden',
            minHeight: 31, maxHeight: 31, flex: '0 0 auto',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--cx3-lcd-divider)',
          }}><div className="cx3-loading-flash cx3-loading-row">· LOADING ·</div></div>,
          <div key="wx-loading-2" style={{
            position: 'relative', overflow: 'hidden',
            minHeight: 31, maxHeight: 31, flex: '0 0 auto',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--cx3-lcd-divider)',
          }}><div className="cx3-loading-flash cx3-loading-row">PLEASE WAIT</div></div>
        );
      } else if (status === 'ERR') {
        rows.push(
          <div key="wx-err" style={{
            position: 'relative', overflow: 'hidden',
            minHeight: 31, maxHeight: 31, flex: '0 0 auto',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--cx3-lcd-divider)',
          }}>
            <div style={{ padding: '7px 10px', fontWeight: 700, color: '#ff6b6b' }}>
              ✕ ERR {statusMsg}
            </div>
          </div>
        );
        for (let pos = start + 1; pos < WINDOW_SIZE; pos++) {
          rows.push(renderInputEmptyRows(pos));
        }
      } else {
        for (let pos = start; pos < WINDOW_SIZE; pos++) {
          const idx = pos;
          rows.push(renderInputEmptyRows(idx));
        }
      }
      return rows;
    }

    // Display mode: 결과만 표시 — 첫 줄이 ATIS, WX/ICAO 헤더 없음
    if (mode === 'NOTAM') {
      rows.push(renderNotamFullscreen());
    } else {
      rows.push(renderRawViewer());
    }
    return rows;
  }

  return (
    <>
      <div className={inInput ? 'cx3-lcd-menu wx-dense' : 'cx3-lcd-menu'} style={{ height: '100%', minHeight: 0, flex: '1 1 auto', display: inDisplay ? 'flex' : undefined, flexDirection: inDisplay ? 'column' : undefined, justifyContent: inDisplay ? 'flex-start' : undefined, alignContent: inDisplay ? 'flex-start' : undefined, alignItems: inDisplay ? 'stretch' : undefined }}>
        {renderRows()}
      </div>
    </>
  );
}

function ageStr(ts: number): string {
  const diff = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diff <= 1) return 'NOW';
  if (diff < 60) return `${diff}M`;
  return `${Math.floor(diff / 60)}H${diff % 60}M`;
}
