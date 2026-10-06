// ---------------------------------------------------------------------------
// Smart FlightCAL - 실시간 환율 유틸 (조종사 해외 출장/체류용 최적화 12종 통화)
//  소스 1순위:  https://open.er-api.com/v6/latest/USD  (무료, API키 불필요, 160+ 통화)
//  소스 2순위:  https://open.exchangerate-api.com/v6/latest/USD  (동일 소스, 백업)
//  특징:        localStorage 영구 저장 + TTL 24h + 오프라인 상태서도 "저장된 환율"로 상시 사용 가능
//               TTL 만료돼도 fetch 실패하면 저장된 값 그대로 재사용 (defaultOfflineRates 마지막 수단)
// ---------------------------------------------------------------------------

export type CurrencyCode =
  | 'KRW' | 'USD' | 'JPY' | 'EUR' | 'CNY' | 'GBP'
  | 'SGD' | 'HKD' | 'THB' | 'AED' | 'CAD' | 'AUD'
  | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK'
  | 'HUF' | 'RON' | 'BRL' | 'MXN' | 'ARS' | 'CLP'
  | 'COP' | 'PEN' | 'INR' | 'IDR' | 'MYR' | 'VND'
  | 'PHP' | 'ZAR' | 'RUB' | 'TRY' | 'SAR' | 'OMR';

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;       // 한국어 명칭 (기장님 한국어 소스 우선)
  symbol: string;     // 단위 기호
  region: string;     // 주요 지역 (공항)
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'KRW', name: '대한민국 원',     symbol: '₩',  region: '' },
  { code: 'USD', name: '미국 달러',       symbol: '$',  region: '' },
  { code: 'JPY', name: '일본 엔',         symbol: '¥',  region: '' },
  { code: 'EUR', name: '유로',            symbol: '€',  region: '' },
  { code: 'CNY', name: '중국 위안',       symbol: '¥',  region: '' },
  { code: 'GBP', name: '영국 파운드',     symbol: '£',  region: '' },
  { code: 'SGD', name: '싱가포르 달러',   symbol: 'S$', region: '' },
  { code: 'HKD', name: '홍콩 달러',       symbol: 'HK$',region: '' },
  { code: 'THB', name: '태국 바트',       symbol: '฿',  region: '' },
  { code: 'AED', name: 'UAE 디르함',      symbol: 'د.إ',region: '' },
  { code: 'CAD', name: '캐나다 달러',     symbol: 'C$', region: '' },
  { code: 'AUD', name: '호주 달러',       symbol: 'A$', region: '' },
  { code: 'CHF', name: '스위스 프랑',     symbol: 'Fr', region: '' },
  { code: 'SEK', name: '스웨덴 크로나',   symbol: 'kr', region: '' },
  { code: 'NOK', name: '노르웨이 크로나', symbol: 'kr', region: '' },
  { code: 'DKK', name: '덴마크 크로네',   symbol: 'kr', region: '' },
  { code: 'PLN', name: '폴란드 즈롤티',   symbol: 'zł', region: '' },
  { code: 'CZK', name: '체코 코루나',     symbol: 'Kč', region: '' },
  { code: 'HUF', name: '헝가리 포린트',   symbol: 'Ft', region: '' },
  { code: 'RON', name: '루마니아 레우',   symbol: 'lei',region: '' },
  { code: 'BRL', name: '브라질 레알',     symbol: 'R$', region: '' },
  { code: 'MXN', name: '멕시코 페소',     symbol: 'M$', region: '' },
  { code: 'ARS', name: '아르헨티나 페소', symbol: '$',  region: '' },
  { code: 'CLP', name: '칠레 페소',       symbol: '$',  region: '' },
  { code: 'COP', name: '콜롬비아 페소',   symbol: '$',  region: '' },
  { code: 'PEN', name: '페루 솔',         symbol: 'S/', region: '' },
  { code: 'INR', name: '인도 루피',       symbol: '₹',  region: '' },
  { code: 'IDR', name: '인도네시아 루피아',symbol: 'Rp', region: '' },
  { code: 'MYR', name: '말레이시아 링기트',symbol: 'RM', region: '' },
  { code: 'VND', name: '베트남 동',       symbol: '₫',  region: '' },
  { code: 'PHP', name: '필리핀 페소',     symbol: '₱',  region: '' },
  { code: 'ZAR', name: '남아프리카 렌드', symbol: 'R',  region: '' },
  { code: 'RUB', name: '러시아 루블',     symbol: '₽',  region: '' },
  { code: 'TRY', name: '터키 리라',       symbol: '₺',  region: '' },
  { code: 'SAR', name: '사우디 리얄',     symbol: 'ر.س',region: '' },
  { code: 'OMR', name: '오만 라이알',     symbol: 'ر.ع.',region: '' },
];

export const CURRENCY_CODES: CurrencyCode[] = CURRENCIES.map(c => c.code);

const PRIMARY_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_ENDPOINT = 'https://open.exchangerate-api.com/v6/latest/USD';
const FRESH_TTL_MS = 24 * 60 * 60 * 1000; // 신선: 24시간 이내 데이터 (LIVE / XX분 전 표시)
const STORAGE_KEY = 'sfc-fx-rates-v1';

interface RateCacheBase {
  base: 'USD';
  updatedAt: number;   // epoch ms
  rates: Partial<Record<CurrencyCode, number>>;
  kind?: 'live' | 'stored' | 'default';
}
export type RateCache = RateCacheBase;

let _cache: RateCache | null = null;
let _lastSuccess: RateCache | null = null;
let _pending: Promise<RateCache> | null = null;

function now(): number { return Date.now(); }

function readFromStore(): RateCache | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const obj = JSON.parse(s) as RateCache;
    if (obj && obj.rates && typeof obj.updatedAt === 'number') {
      obj.kind = (now() - obj.updatedAt) <= FRESH_TTL_MS ? 'live' : 'stored';
      return obj;
    }
  } catch { /* ignore */ }
  return null;
}

function writeToStore(r: RateCache) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

/** TTL 유효한 값만 return (LIVE / XX분 전 표시용) */
function readFreshCache(): RateCache | null {
  if (_cache && _cache.kind === 'live' && (now() - _cache.updatedAt) <= FRESH_TTL_MS) return _cache;
  const obj = readFromStore();
  if (obj && (now() - obj.updatedAt) <= FRESH_TTL_MS) {
    _cache = obj;
    _lastSuccess = obj;
    return obj;
  }
  return null;
}

/** TTL 만료돼도 상관없이 localStorage 저장된 값을 최대한 가져옴 (오프라인 최종 fallback) */
function readAnyStored(): RateCache | null {
  if (_lastSuccess) return _lastSuccess;
  if (_cache) return _cache;
  return readFromStore();
}

function setInternal(r: RateCache, markKind?: 'live' | 'stored' | 'default') {
  r.kind = markKind ?? (((now() - r.updatedAt) <= FRESH_TTL_MS) ? 'live' : 'stored');
  _cache = r;
  _lastSuccess = r;
  if (r.kind !== 'default') {
    writeToStore(r);
    recordHistory(r);
  }
}

function filterRates(ratesUsd: Record<string, number>): Partial<Record<CurrencyCode, number>> {
  const out: Partial<Record<CurrencyCode, number>> = {};
  CURRENCIES.forEach(c => {
    const v = ratesUsd[c.code];
    if (typeof v === 'number' && isFinite(v) && v > 0) out[c.code] = v;
  });
  return out;
}

async function fetchFrom(endpoint: string): Promise<RateCache | null> {
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json() as any;
    const r = (j && j.rates) as (Record<string, number> | undefined);
    if (!r) return null;
    return {
      base: 'USD',
      updatedAt: now(),
      rates: filterRates(r),
      kind: 'live',
    };
  } catch {
    return null;
  }
}

/**
 * 환율 로드 우선순위
 *  1. 메모리 캐시 + 24h Fresh → 즉시 반환
 *  2. 네트워크 fetch (PRIMARY → FALLBACK) → 성공하면 localStorage에 영구 저장
 *  3. fetch 실패 → localStorage 저장된 값 TTL 무시하고 재사용 (오프라인 환경 정상 계속 사용)
 *  4. 저장된 값 전혀 없을 때만 → 내장 defaultOfflineRates (최후 수단)
 */
export async function loadRates(force = false): Promise<RateCache> {
  if (!force) {
    const hit = readFreshCache();
    if (hit) return hit;
  }
  if (_pending) return _pending;
  _pending = (async () => {
    try {
      const net = await fetchFrom(PRIMARY_ENDPOINT) ?? await fetchFrom(FALLBACK_ENDPOINT);
      if (net) {
        setInternal(net, 'live');
        return net;
      }
      // fetch 실패 → localStorage 저장된 값 TTL 무시하고 반환 (조종사 오프라인 환경 우선)
      const stored = readAnyStored();
      if (stored) {
        stored.kind = 'stored';
        _cache = stored;
        _lastSuccess = stored;
        return stored;
      }
      // 완전 처음이면서 오프라인 → 내장 default 2026-09-08 값
      const df: RateCache = {
        base: 'USD',
        updatedAt: now(),
        rates: defaultOfflineRates(),
        kind: 'default',
      };
      _cache = df;
      return df;
    } finally {
      _pending = null;
    }
  })();
  return _pending;
}

export function defaultOfflineRates(): Partial<Record<CurrencyCode, number>> {
  // -------------------------------------------------------------------------
  // [출처 · 2026-09-08 KST 13:00 구글 파이낸스 종가 기준 보수값]
  //  · 기내 모드 / 오프라인 / API 장애 시 최후 수단으로만 사용
  //  · 한 번이라도 네트워크 정상 연결시 localStorage의 LIVE/STORED 값이 우선 사용됨
  //  · 기장님께서 특정 기준일 (예: 매월 1일 한국은행 고시 환율) 으로 고정 원하시면
  //    아래 값을 교체하거나 구글시트/한은 API 연결 방식으로 변경 가능
  // -------------------------------------------------------------------------
  return {
    USD: 1,
    KRW: 1385,
    JPY: 152,
    EUR: 0.925,
    CNY: 7.25,
    GBP: 0.785,
    SGD: 1.35,
    HKD: 7.805,
    THB: 36.35,
    AED: 3.6725,
    CAD: 1.37,
    AUD: 1.515,
    CHF: 0.885,
    SEK: 10.55,
    NOK: 10.75,
    DKK: 6.85,
    PLN: 4.05,
    CZK: 23.35,
    HUF: 355,
    RON: 4.65,
    BRL: 5.25,
    MXN: 17.25,
    ARS: 1250,
    CLP: 930,
    COP: 4050,
    PEN: 3.85,
    INR: 83.5,
    IDR: 15250,
    MYR: 4.75,
    VND: 24850,
    PHP: 56.5,
    ZAR: 18.75,
    RUB: 98.5,
    TRY: 30.5,
    SAR: 3.75,
    OMR: 0.385,
  };
}

/** sync로 즉시 스냅샷 얻기 (fetch 안함) → 오프라인 상태에서도 즉시 계산 가능 */
export function latestSnapshot(): RateCache {
  if (_lastSuccess) return _lastSuccess;
  if (_cache) return _cache;
  const s = readAnyStored();
  if (s) { _lastSuccess = s; _cache = s; return s; }
  return { base: 'USD', updatedAt: 0, rates: defaultOfflineRates(), kind: 'default' };
}

export function ratesStatus(snap: RateCache): { text: string; tier: 'live' | 'stored' | 'default' } {
  if (snap.kind === 'default') return { text: 'DEFAULT · 내장', tier: 'default' };
  if (!snap.updatedAt) return { text: 'DEFAULT · 내장', tier: 'default' };
  const diff = now() - snap.updatedAt;
  if (snap.kind === 'stored' || diff > FRESH_TTL_MS) {
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const age = d > 0 ? `${d}D ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
    return { text: `OFFLINE · 저장됨 ${age}`, tier: 'stored' };
  }
  const m = Math.floor(diff / 60000);
  if (m < 1) return { text: 'LIVE', tier: 'live' };
  if (m < 60) return { text: `${m}m ago`, tier: 'live' };
  const h = Math.floor(m / 60);
  return { text: `${h}h ${m % 60}m ago`, tier: 'live' };
}

/**
 * 환율 변환 — USD를 기준(1)으로 저장된 rates를 통해 from → to 계산
 * @param amount   입력 금액
 * @param fromCode 변환 전 통화
 * @param toCode   변환 후 통화
 * @param snap     (optional) 미리 로드한 RateCache 스냅샷, 없으면 최신 캐시 사용
 */
export function convertCurrency(
  amount: number,
  fromCode: CurrencyCode,
  toCode: CurrencyCode,
  snap?: RateCache,
): number {
  if (!isFinite(amount)) return NaN;
  const s = snap ?? latestSnapshot();
  const r = s.rates;
  if (fromCode === toCode) return amount;
  const f = r[fromCode];
  const t = r[toCode];
  if (typeof f !== 'number' || typeof t !== 'number' || f <= 0 || t <= 0) return NaN;
  return (amount / f) * t;
}

export function currencyInfo(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
}

export function codeIdx(code: CurrencyCode): number {
  const i = CURRENCY_CODES.indexOf(code);
  return i >= 0 ? i : 0;
}

export function formatCurrency(amount: number, info: CurrencyInfo, maxDp = 2): string {
  if (!isFinite(amount)) return '--';
  const zeroDp: CurrencyCode[] = ['KRW', 'JPY', 'THB', 'AED', 'CNY', 'VND', 'IDR', 'ARS', 'CLP', 'COP', 'HUF'];
  const dp = zeroDp.includes(info.code) ? 0 : maxDp;
  const rounded = Math.round(amount * Math.pow(10, dp)) / Math.pow(10, dp);
  const parts = rounded.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const num = parts.join('.');
  const rightSymbol: CurrencyCode[] = ['AED', 'SAR', 'OMR'];
  if (rightSymbol.includes(info.code)) return `${num} ${info.symbol}`;
  return `${info.symbol}${num}`;
}

// ---------------------------------------------------------------------------
// 환율 추이 그래프용 데이터
//  1순위: https://api.frankfurter.dev/v1/{start}..{end}?from=USD&to=KRW
//         (ECB 일별 고시 · API키 불필요 · CORS 허용 · AED는 미지원 = 404)
//  2순위: 앱이 환율을 새로 받을 때마다 localStorage에 누적한 기록 (오프라인/API 실패 시)
// ---------------------------------------------------------------------------

export interface RatePoint { t: number; v: number }

const HISTORY_KEY = 'sfc-fx-history-v1';
const HISTORY_MAX = 600;

interface HistoryEntry { t: number; rates: Partial<Record<CurrencyCode, number>> }

function readHistory(): HistoryEntry[] {
  try {
    const s = localStorage.getItem(HISTORY_KEY);
    if (!s) return [];
    const arr = JSON.parse(s) as HistoryEntry[];
    return Array.isArray(arr) ? arr.filter(e => e && typeof e.t === 'number' && e.rates) : [];
  } catch { return []; }
}

/** 네트워크로 새 환율을 받을 때마다 로컬 이력에 누적 (그래프 오프라인 폴백용) */
function recordHistory(snap: RateCache) {
  try {
    const list = readHistory();
    if (list.some(e => e.t === snap.updatedAt)) return;
    list.push({ t: snap.updatedAt, rates: snap.rates });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-HISTORY_MAX)));
  } catch { /* ignore */ }
}

/** 앱이 누적한 기록만으로 만든 환율 추이 */
export function localRateSeries(from: CurrencyCode, to: CurrencyCode): RatePoint[] {
  const points: RatePoint[] = [];
  readHistory().forEach(e => {
    const f = e.rates[from];
    const t = e.rates[to];
    if (typeof f === 'number' && typeof t === 'number' && f > 0) points.push({ t: e.t, v: t / f });
  });
  return points.sort((a, b) => a.t - b.t);
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 최근 N일 일별 환율 추이 — 네트워크 실패(오프라인 등) 시 앱 누적 기록으로 폴백 */
export async function loadRateHistory(
  from: CurrencyCode,
  to: CurrencyCode,
  days = 30,
): Promise<{ points: RatePoint[]; source: 'live' | 'local' }> {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const url = `https://api.frankfurter.dev/v1/${isoDay(start)}..${isoDay(end)}?from=${from}&to=${to}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json() as { rates?: Record<string, Record<string, number>> };
      const points = Object.entries(j.rates ?? {})
        .map(([day, values]) => ({ t: Date.parse(`${day}T00:00:00`), v: values?.[to] }))
        .filter((p): p is RatePoint => typeof p.v === 'number' && isFinite(p.v) && !Number.isNaN(p.t))
        .sort((a, b) => a.t - b.t);
      if (points.length >= 2) return { points, source: 'live' };
    }
  } catch { /* 오프라인 → 로컬 기록 폴백 */ }
  return { points: localRateSeries(from, to), source: 'local' };
}
