// ---------------------------------------------------------------------------
// FAA NMS API client — NOTAM 조회
//
// ⚠ faa-nms-api npm 패키지는 브라우저/APK에서 동작하지 않음:
//   1) Buffer.from() 사용 → 브라우저에 Buffer 없음
//   2) fetch 직접 호출 → FAA NMS API가 CORS 미지원 (OPTIONS 404)
// 따라서 아래처럼 직접 구현:
//   - OAuth: POST /v1/auth/token (client_id/client_secret form 방식)
//   - Transport: Capacitor Native HTTP(APK) → Vite dev proxy(localhost)
//     → 외부 CORS 프록시(웹 빌드 fallback)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Q-code 주제별 설명
const QCODE_SUBJECTS: Record<string, string> = {
  'MR': 'Runway', 'MT': 'Taxiway', 'MN': 'Apron', 'MA': 'Threshold',
  'FA': 'Aerodrome', 'FF': 'Fire fighting and rescue', 'FU': 'Fuel availability',
  'LA': 'Approach lighting system (ALS)', 'LE': 'Runway edge lights',
  'LP': 'Precision approach path indicator (PAPI)', 'IC': 'Instrument landing system (ILS)',
  'IL': 'Localizer (ILS)', 'NV': 'VOR', 'NB': 'Nondirectional radio beacon (NDB)',
  'ND': 'Distance measuring equipment (DME)', 'PI': 'Instrument approach procedure',
  'RR': 'Restricted area', 'RP': 'Prohibited area', 'WP': 'Parachute jumping exercise (PJE)',
  'OB': 'Obstacle'
};

// Q-code 상태별 설명
const QCODE_CONDITIONS: Record<string, string> = {
  'LC': 'Closed', 'LO': 'Operational', 'LU': 'Unserviceable', 'LA': 'Available',
  'LW': 'Work in progress', 'LS': 'Serviceability', 'IC': 'Closed to IFR operations',
  'LV': 'Closed to VFR operations', 'LT': 'Limited to…', 'AS': 'Unserviceable',
  'AO': 'Operational', 'AU': 'Not available', 'CA': 'Activated', 'CD': 'Deactivated',
  'CN': 'Cancelled', 'CH': 'Changed', 'CR': 'Temporarily replaced by…',
  'HW': 'Work in progress', 'HV': 'Work completed', 'HA': 'Braking action is…',
  'XX': 'Plain language'
};

// Q-code 파싱 함수
function decodeQcode(qcode: string): Array<{ code: string; desc: string }> {
  if (!qcode || !qcode.startsWith('Q') || qcode.length !== 5) {
    return [];
  }

  const subject = qcode.slice(1, 3);
  const condition = qcode.slice(3, 5);
  const results: Array<{ code: string; desc: string }> = [];

  if (QCODE_SUBJECTS[subject]) {
    results.push({ code: subject, desc: QCODE_SUBJECTS[subject] });
  }

  if (QCODE_CONDITIONS[condition]) {
    results.push({ code: condition, desc: QCODE_CONDITIONS[condition] });
  }

  return results;
}

export interface NotamEntry {
  /** FAA-assigned 16-digit NOTAM ID */
  nmsId: string;
  /** Core NOTAM text (e.g. "RWY 15R/33L CLSD") */
  text: string;
  /** ICAO formatted text (e.g. "(A)1073/26 NOTAMR...") */
  icaoFormattedText?: string;
  /** Raw GeoJSON properties (if any) */
  rawProperties?: Record<string, unknown>;
  classification?: string;
  feature?: string;
  /** Human-readable location (ICAO) */
  location?: string;
  /** Effective / expiration dates */
  effectiveStart?: string;
  effectiveEnd?: string;
  /** Q-code 분류 정보 */
  decodedQcodes?: Array<{ code: string; desc: string }>;
}

export interface NotamFetchResult {
  icao: string;
  entries: NotamEntry[];
  rawCount: number;
  fetchedAt: number;
}

export type NmsErrorKind = 'CONFIG' | 'AUTH' | 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'API';

export class NmsApiError extends Error {
  kind: NmsErrorKind;
  constructor(msg: string, kind: NmsErrorKind) {
    super(msg);
    this.name = 'NmsApiError';
    this.kind = kind;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NMS_HOSTS = {
  production: 'https://api-nms.aim.faa.gov',
  // FAA에서 제공하는 Test Environment (온보딩 이메일 안내 URL)
  staging: 'https://api-staging.cgifederal-aim.com',
} as const;

function endpoints(): { auth: string; api: string; isDevProxy: boolean; host: string } {
  // 강제로 staging 환경 사용 (production은 checklist 승인 후 변경)
  const environment = 'staging';
  const host = NMS_HOSTS.staging;

  const isNative = isCapacitorNative();

  if (isNative) {
    // Native(APK/iOS): CORS 제약 없음 → 실제 API URL 직접 사용
    const authPath = `${host}/v1/auth/token`;
    const apiPath = `${host}/nmsapi`;
    return { auth: authPath, api: apiPath, isDevProxy: false, host };
  }

  // Browser: CORS 회피를 위해 Vite dev proxy 경로 사용 (상대 경로)
  // 개발 서버에서 proxy 설정으로 `/nms-staging-*` 경로를 api-staging.cgifederal-aim.com으로 전달
  const authPath = environment === 'staging' ? '/nms-staging-auth/v1/auth/token' : '/nms-auth/v1/auth/token';
  const apiPath = environment === 'staging' ? '/nms-staging-api' : '/nmsapi';
  return { auth: authPath, api: apiPath, isDevProxy: true, host };
}

/** 프록시 경로로 요청 (상대 경로면 Vite dev server → 프록시, 절대 URL이면 직접) */
async function nmsRequest(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 15000,
): Promise<string> {
  const ep = endpoints();
  const isRelative = url.startsWith('/');
  const isNative = isCapacitorNative();

  // APK/iOS: Capacitor Native HTTP 사용 (WebView fetch는 CORS 차단)
  if (isNative) {
    const http = capHttp();
    if (http) {
      const fullUrl = isRelative ? `${ep.host}${url}` : url;
      // #region debug-point C:native-branch
      console.log('NOTAM API Request:', { 
        method, 
        url, 
        fullUrl, 
        host: ep.host, 
        body, 
        env: { 
          clientId: import.meta.env.VITE_NMS_API_CLIENT_ID?.length, 
          clientSecret: import.meta.env.VITE_NMS_API_CLIENT_SECRET?.length,
          environment: import.meta.env.VITE_NMS_API_ENVIRONMENT
        } 
      });
      dbgReport('C', 'notamApi:nmsRequest', '[DEBUG] native branch', { method, url, fullUrl, host: ep.host });
      // #endregion
      try {
        return await nativeRequest(method, fullUrl, headers, body, timeoutMs);
      } catch (e) {
        // Native HTTP 실패(예: 웹 브라우저에서 잘못 실행된 경우) → browser fallback
        console.warn('Native HTTP request failed, falling back to browser request:', e);
      }
    }
  }

  // isNative=false 또는 native 실패 후: ep.isDevProxy면 상대 경로(proxy) 사용
  if (ep.isDevProxy) {
    // 절대 URL을 proxy 상대 경로로 변환
    const proxyUrl = url.includes('/v1/auth/token') ? ep.auth
      : url.includes('/v1/notams') ? `${ep.api}/v1/notams?${url.split('?')[1] ?? ''}`
      : url;
    if (proxyUrl.startsWith('/')) {
      return browserRequest(method, proxyUrl, headers, body, timeoutMs);
    }
  }

  // 상대 경로 = Vite dev proxy 사용 (브라우저 → localhost → proxy)
  if (isRelative) {
    return browserRequest(method, url, headers, body, timeoutMs);
  }

  // 절대 URL = 직접 요청 → 실패 시 외부 CORS 프록시 fallback
  try {
    return await browserRequest(method, url, headers, body, timeoutMs);
  } catch (e) {
    if (e instanceof NmsApiError && e.kind === 'AUTH') throw e;
    if (method === 'GET' && !(e instanceof NmsApiError && e.kind === 'AUTH')) {
      return proxiedGet(url, headers, timeoutMs);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Cache (localStorage, 30min TTL — weatherApi.ts와 동일 패턴)
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'sfc-notam-v1-';
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(icao: string): string {
  return `${CACHE_PREFIX}${icao.toUpperCase()}`;
}

function readCache(icao: string): NotamFetchResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(icao));
    if (!raw) return null;
    const data: NotamFetchResult & { _cachedAt: number } = JSON.parse(raw);
    if (Date.now() - data._cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(icao));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(icao: string, data: NotamFetchResult): void {
  try {
    localStorage.setItem(
      cacheKey(icao),
      JSON.stringify({ ...data, _cachedAt: Date.now() }),
    );
  } catch {
    // storage full — ignore
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** FAA 에러 응답에서 사람이 읽을 수 있는 상세 메시지 추출 ({"ErrorCode":"...","Error":"ClientId is Invalid"}) */
function extractErrorDetail(text: string): string {
  try {
    const j = JSON.parse(text);
    return String(j?.Error || j?.error_description || j?.message || text.slice(0, 80));
  } catch {
    return text.slice(0, 80);
  }
}

// #region debug-point reporter
function dbgReport(hypothesisId: string, loc: string, msg: string, data: Record<string, unknown>): void {
  try {
    const host = window?.location?.hostname;
    const base = `http://${host && host !== 'localhost' ? host : '10.0.2.2'}:7777/event`;
    const payload = JSON.stringify({ sessionId: 'nms-auth-clientid-invalid', runId: 'pre', hypothesisId, location: loc, msg, data, ts: Date.now() });
    fetch(base, { method: 'POST', body: payload }).catch(() => {});
    console.log('[DEBUG]', hypothesisId, loc, msg, JSON.stringify(data));
  } catch { /* noop */ }
}
// #endregion

function isCapacitorNative(): boolean {
  try {
    const w = window as any;
    const Cap = w?.Capacitor;

    // Capacitor 환경이 아닌 경우 웹 브라우저로 판단
    if (!Cap) return false;

    // 공식 API: 네이티브 플랫폼 여부 (웹 브라우저에서는 항상 false)
    // 주의: Cap.Plugins는 어떤 키든 프록시 객체를 반환하므로 플러그인 존재 여부로 판단하면 안 됨
    if (typeof Cap.isNativePlatform === 'function') {
      return !!Cap.isNativePlatform();
    }

    // 폴백: getPlatform 확인
    if (typeof Cap.getPlatform === 'function') {
      const platform = Cap.getPlatform();
      return platform === 'android' || platform === 'ios';
    }

    return false;
  } catch {
    return false;
  }
}

function capHttp(): any | null {
  try {
    const w = window as any;
    const Cap = w?.Capacitor;
    const Http = Cap?.Plugins?.Http ?? Cap?.Plugins?.CapacitorHttp ?? w?.CapacitorHttp;
    if (Http && typeof Http.request === 'function') return Http;
    return null;
  } catch {
    return null;
  }
}

/** Capacitor Native HTTP 요청 (CORS 제약 없음 — APK 런타임용) */
async function nativeRequest(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 15000,
): Promise<string> {
  const Http = capHttp();
  if (!Http) throw new NmsApiError('Native HTTP unavailable', 'NETWORK');

  const isForm = headers['Content-Type']?.includes('x-www-form-urlencoded');
  let requestData: any = undefined;
  
  if (method === 'POST' && body) {
    if (isForm) {
      // x-www-form-urlencoded: Capacitor HTTP가 객체를 자동으로 인코딩하므로 객체로 변환
      const formData: Record<string, string> = {};
      const params = new URLSearchParams(body);
      params.forEach((value, key) => {
        formData[key] = value;
      });
      requestData = formData;
    } else {
      // 다른 타입(JSON 등): raw 문자열 그대로 전달
      requestData = body;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DEBUG: 전송 직전 body 내용을 에러 메시지에 포함
  const _debugBodyPreview = String((() => {
    try { return JSON.stringify(requestData); } catch { return String(requestData); }
  })()).slice(0, 300);
  // ═══════════════════════════════════════════════════════════

  console.log('Capacitor HTTP Request:', {
    url,
    method,
    headers,
    data: requestData,
    responseType: 'text',
    dataType: typeof requestData
  });
  
  let res: any;
  try {
    res = await Http.request({
      url,
      method,
      headers,
      data: requestData,
      responseType: 'json',
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
  } catch (e: any) {
    // CapacitorHttp native 에러(예: 'Failed to fetch')를 NmsApiError로 래핑하지 않으면
    // 상위 catch에서 'API' kind로 오분류됨 → NETWORK/TIMEOUT으로 분류
    const msg = e instanceof Error ? e.message : String(e ?? 'Native HTTP request failed');
    console.warn('Capacitor HTTP request failed:', msg);
    throw new NmsApiError(msg, 'NETWORK');
  }
  const status = Number(res?.status ?? 0);
  // Capacitor HTTP 응답: data가 객체일 경우 JSON.stringify로 변환
  const text = typeof res?.data === 'string' ? res.data
    : res?.data != null ? JSON.stringify(res.data)
    : '';
  if (status === 401 || status === 403) {
    // DEBUG: body 내용을 에러 메시지에 포함
    const debugInfo = `[body:${_debugBodyPreview}] [resp:${text.slice(0, 300)}]`;
    throw new NmsApiError(`AUTH ${extractErrorDetail(text)} ${debugInfo}`, 'AUTH');
  }
  if (status >= 400) {
    throw new NmsApiError(`HTTP ${status}: ${text.slice(0, 120)}`, 'HTTP');
  }
  return text;
}

/** 브라우저 fetch 요청 (개발서버 프록시 or 직접/외부프록시) */
async function browserRequest(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 15000,
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new NmsApiError(`AUTH ${extractErrorDetail(text)}`, 'AUTH');
    }
    if (!res.ok) {
      throw new NmsApiError(`HTTP ${res.status}: ${text.slice(0, 120)}`, 'HTTP');
    }
    return text;
  } catch (e) {
    if (e instanceof NmsApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new NmsApiError('Request timed out', 'TIMEOUT');
    }
    throw new NmsApiError(e instanceof Error ? e.message : String(e), 'NETWORK');
  } finally {
    clearTimeout(t);
  }
}

/** 외부 CORS 프록시로 GET (웹 빌드에서 직접 호출 실패 시 fallback) */
async function proxiedGet(url: string, headers: Record<string, string>, timeoutMs = 12000): Promise<string> {
  const proxies = [
    `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];
  let lastErr: unknown = null;
  for (const p of proxies) {
    try {
      return await browserRequest('GET', p, headers, undefined, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (e instanceof NmsApiError && e.kind === 'AUTH') throw e;
    }
  }
  throw lastErr instanceof NmsApiError
    ? lastErr
    : new NmsApiError('All proxies failed', 'NETWORK');
}



// ---------------------------------------------------------------------------
// OAuth token
// ---------------------------------------------------------------------------

interface TokenInfo {
  token: string;
  expiry: number;
}

let _token: TokenInfo | null = null;

function credentialsSafe(): { clientId?: string; clientSecret?: string; environment: string } {
  const clientId = import.meta.env.VITE_NMS_API_CLIENT_ID?.trim();
  const clientSecret = import.meta.env.VITE_NMS_API_CLIENT_SECRET?.trim();
  const environment = import.meta.env.VITE_NMS_API_ENVIRONMENT === 'staging' ? 'staging'
    : import.meta.env.VITE_NMS_API_ENVIRONMENT === 'fit' ? 'fit'
    : 'production';
  return { clientId, clientSecret, environment };
}

function credentials(): { clientId: string; clientSecret: string; environment: string } {
  const { clientId, clientSecret, environment } = credentialsSafe();
  if (!clientId || !clientSecret) {
    throw new NmsApiError(
      'NMS API credentials not configured (VITE_NMS_API_CLIENT_ID / VITE_NMS_API_CLIENT_SECRET)',
      'CONFIG',
    );
  }
  return { clientId, clientSecret, environment };
}

async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _token.expiry) return _token.token;

  const { clientId, clientSecret } = credentials();
  const ep = endpoints();
  console.log('NOTAM API Credentials:', { 
    clientId, 
    clientSecretLen: clientSecret.length, 
    environment: import.meta.env.VITE_NMS_API_ENVIRONMENT, 
    endpoint: ep.auth 
  });
  // #region debug-point A:credentials
  dbgReport('A', 'notamApi:getAccessToken', '[DEBUG] credentials', {
    clientIdMasked: `${String(clientId).slice(0, 6)}...`,
    secretLen: String(clientSecret).length,
    env: String(import.meta.env.VITE_NMS_API_ENVIRONMENT),
  });
  // #endregion

  // OAuth2 client_credentials — body에 client_id/client_secret 포함 방식
  // (Capacitor Native HTTP가 Basic Auth 헤더를 제대로 전송하지 못하는 경우가 있으므로
  //  body 파라미터 방식이 더 안정적)
  // Hardcoded body to test
  const body = 'grant_type=client_credentials&client_id=PY9Pg2ECulFl6Z6l3iGJMfZ8JgK2p5yNTJsrRw3B7BIdxRHR&client_secret=ik2kp7qITYS0lCH9xpihBJYQr7nM1y9TMcPa5P6iPfcpdBUcjlTKAgD4qdpXutHp';

  const text = await nmsRequest('POST', ep.auth, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  }, body);

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // DEBUG: 응답 본문 앞부분을 에러 메시지에 포함
    const preview = String(text).slice(0, 200);
    throw new NmsApiError(`Invalid token response [raw:${preview}]`, 'API');
  }
  // #region debug-point E:token-response
  dbgReport('E', 'notamApi:getAccessToken', '[DEBUG] token response', { raw: String(text).slice(0, 300), hasToken: !!data?.access_token });
  // #endregion
  if (!data?.access_token) {
    const msg = data?.Error || data?.error_description || data?.message || 'No access_token';
    throw new NmsApiError(String(msg), 'AUTH');
  }

  let rawToken = String(data.access_token);

  // FAA staging 서버가 token_type: "BearerToken"을 반환하는 경우,
  // access_token 값에 "Bearer " 프리픽스가 포함되어 있을 수 있음 → 제거
  if (rawToken.startsWith('Bearer ')) {
    rawToken = rawToken.slice('Bearer '.length);
  }

  const ttl = Number(data.expires_in ?? 3600);
  _token = {
    token: rawToken,
    expiry: Date.now() + Math.max(60, ttl - 60) * 1000,
  };
  return _token.token;
}

/**
 * NOTAM 본문/Q코드에서 feature 분류 추출 (WxScreen CONVU 필터와 대응)
 * RWY / TWY / APRON / NAV / COM / AIRSPACE / FDC / GEN
 */
export function deriveFeature(text: string, selectionCode = ''): string {
  const t = text.toUpperCase();
  const q = selectionCode.toUpperCase();
  // FDC (procedure amendment) — classification 우선
  if (/\bFDC\b|^\s*!?\s*FDC/.test(t)) return 'FDC';
  if (/\bRWY\b|\bRWYS\b|\bRUNWAY\b/.test(t)) return 'RWY';
  if (/\bTWY\b|\bTWYS\b|\bTAXIWAY\b|\bTAXIWAY\b/.test(t)) return 'TWY';
  if (/\bAPRON\b|\bSTAND\b|\bRAMP\b|\bBAY\b|\bGATE\b/.test(t)) return 'APRON';
  if (/\bILS\b|\bVOR\b|\bDME\b|\bNDB\b|\bNAV\b|\bLOC\b|\bGLIDESLOPE\b|\bGS\b|\bMARKER\b|\bTACAN\b|\bRNAV\b/.test(t)) return 'NAV';
  if (/\bCOM\b|\bFREQ\b|\bATIS\b|\bVHF\b|\bHF\b|\bCPDLC\b|\bRADIO\b|\bPHONE\b/.test(t)) return 'COM';
  if (/\bAIRSPACE\b|\bTFR\b|\bOBS\b|\bRESTRICTED\b|\bPROHIBITED\b|\bDANGER\b|\bCTA\b|\bCTZ\b|\bFIR\b|\bUIR\b|\bAIRways\b|\bSVC\b/.test(t)) return 'AIRSPACE';
  if (/^Q/.test(q)) return 'GEN';
  return 'GEN';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch NOTAMs for a given ICAO airport code.
 * - Caches in localStorage for 30 minutes.
 * - If `force` is true, bypasses cache.
 */
export async function fetchNotams(icao: string, force = false): Promise<NotamFetchResult> {
  const code = icao.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) {
    throw new NmsApiError(`Invalid ICAO code: "${icao}"`, 'HTTP');
  }

  if (!force) {
    const cached = readCache(code);
    if (cached) return cached;
  }

  try {
    const token = await getAccessToken();

    // 공식 cURL 예시 기준: location 필터만 사용 (radius는 위도/경도 geospatial 전용)
    const qs = new URLSearchParams({ location: code });
    const url = `${endpoints().api}/v1/notams?${qs.toString()}`;
    const text = await nmsRequest('GET', url, {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'nmsResponseFormat': 'GEOJSON',
    });
    const response = JSON.parse(text);

    // 실제 응답 구조 (staging 검증 완료):
    // { status: "Success", data: { geojson: [{ type: "Feature", properties: { coreNOTAMData: { notam: { id, series, number, text, classification, icaoLocation, effectiveStart, effectiveEnd, ... } } } }] } }
    const entries: NotamEntry[] = [];
    const features: any[] = response?.data?.geojson ?? [];
    for (const feature of features) {
      const props = feature?.properties ?? {};
      // NMS-API 실제 구조: coreNOTAMData.notam 에 필드 중첩 (flat 구조는 fallback)
      const n: any = props?.coreNOTAMData?.notam ?? props ?? {};

      const nmsId: string = n.id ?? props.nmsId ?? '';
      const notamText: string = n.text ?? props.text ?? '';
      if (!nmsId && !notamText) continue;

      // Q-code 추출 — API 응답의 selectionCode 필드 사용 (텍스트 내 Q-code 없음)
      const qcode = String(n.selectionCode ?? '').trim().toUpperCase();
      const decodedQcodes = decodeQcode(qcode);

      // ICAO formatted text 추출
      const icaoFormattedText = props?.coreNOTAMData?.notamTranslation?.find((t: any) => t.type === 'ICAO')?.formattedText;
      
      entries.push({
        nmsId: String(nmsId),
        text: String(notamText),
        icaoFormattedText: String(icaoFormattedText ?? ''),
        rawProperties: props,
        classification: n.classification ?? props.classification,
        feature: deriveFeature(String(notamText), String(n.selectionCode ?? '')),
        location: n.icaoLocation ?? n.location ?? props.location ?? code,
        effectiveStart: n.effectiveStart ?? props.effectiveEnd,
        decodedQcodes,
      });
    }

    const result: NotamFetchResult = {
      icao: code,
      entries,
      rawCount: features.length,
      fetchedAt: Date.now(),
    };
    writeCache(code, result);
    return result;
  } catch (err: any) {
    if (err instanceof NmsApiError) throw err;
    throw new NmsApiError(err?.message || 'Unknown API error', 'API');
  }
}

/**
 * Fetch a filtered subset — only NOTAMs matching a specific feature (e.g. RWY, TWY, NAV).
 */
export async function fetchNotamsByFeature(
  icao: string,
  feature: string,
  force = false,
): Promise<NotamEntry[]> {
  const full = await fetchNotams(icao, force);
  return full.entries.filter(e => {
    const feat = (e.feature ?? '').toUpperCase();
    return feat === feature.toUpperCase();
  });
}

/** Short human-readable label for an error (weatherApi.ts shortLabelOf 패턴) */
export function shortLabelOf(err: unknown): string {
  if (err instanceof NmsApiError) {
    switch (err.kind) {
      case 'CONFIG':  return 'CFG';
      case 'AUTH':    return 'AUTH';
      case 'TIMEOUT': return 'TIMEOUT';
      case 'NETWORK': return 'NETWORK';
      case 'HTTP':    return 'HTTP';
      case 'API':     return 'API';
    }
  }
  return 'FAIL';
}
