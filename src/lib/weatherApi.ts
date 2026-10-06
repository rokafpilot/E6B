import { getAirportLocalObservedTime } from './airportTimezone';

const WX_CACHE_PREFIX = 'sfc-wx-v1-';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 캐시
const SL: Record<string, string> = { TIMEOUT: 'T/O', NETWORK: 'NET', CORS: 'CORS', HTTP_403: '403', HTTP_404: '404', HTTP_429: '429', HTTP_5XX: '5XX', HTTP_OTHER: 'HTTP', NO_DATA: 'NODATA', UNKNOWN: 'FAIL' };

export type WxErrorKind = 'TIMEOUT' | 'NETWORK' | 'CORS' | 'HTTP_403' | 'HTTP_404' | 'HTTP_429' | 'HTTP_5XX' | 'HTTP_OTHER' | 'NO_DATA' | 'UNKNOWN';

export const shortLabelOf = (e: any): string => SL[e?.kind] || (String(e?.message || 'FAIL').slice(0, 10));

export interface WxFetchResult {
  raw: string;
  fetchedAtMs: number;
  sourceUrl: string;
}

export class WxApiError extends Error {
  constructor(message: string, public readonly kind: WxErrorKind, public readonly src?: string) {
    super(message);
    this.name = 'WxApiError';
  }
}

function classifyError(e: any): WxErrorKind {
  if (!e) return 'UNKNOWN';
  const m = (String(e?.message || '') + ' ' + String(e?.name || '')).toLowerCase();
  if (/aborterror|timeout|timed out|abort/.test(m)) return 'TIMEOUT';
  if (/failed to fetch|networkerror|enotfound|econnrefused|ssl|certificate/.test(m)) return 'NETWORK';
  if (/cors|access-control-allow-origin/.test(m)) return 'CORS';
  const h = m.match(/http\s*(\d{3})/);
  if (h) {
    const c = Number(h[1]);
    if (c === 403) return 'HTTP_403';
    if (c === 404) return 'HTTP_404';
    if (c === 429) return 'HTTP_429';
    if (c >= 500) return 'HTTP_5XX';
    return 'HTTP_OTHER';
  }
  return 'UNKNOWN';
}

function normalizeIcao(code: string): string | null {
  const s = code.trim().toUpperCase().replace(/[_·\s]/g, '');
  if (/^[A-Z]{3,4}$/.test(s)) return s;
  return null;
}

function isCapacitorNative(): boolean {
  try {
    const w = window as any;
    const Cap = w?.Capacitor;
    if (!Cap) return false;
    if (typeof Cap?.isNative === 'boolean' && Cap.isNative) return true;
    if (typeof Cap?.isNativePlatform === 'boolean' && Cap.isNativePlatform) return true;
    if (typeof Cap?.getPlatform === 'function') {
      const p = Cap.getPlatform();
      if (p === 'android' || p === 'ios') return true;
    }
    const pl = Cap?.platform;
    if (pl && pl !== 'web') return true;
    const Http = Cap?.Plugins?.Http ?? Cap?.Plugins?.CapacitorHttp ?? w?.CapacitorHttp;
    return !!(Http && (Http.request || Http.get));
  } catch {
    return false;
  }
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) throw new WxApiError(`HTTP ${res.status}`, classifyError(new Error(`HTTP ${res.status}`)), url);
    return await res.text();
  } catch (e) {
    if (e instanceof WxApiError) throw e;
    const kind = classifyError(e);
    const msg = e instanceof Error ? e.message : String(e || 'Fetch error');
    throw new WxApiError(msg, kind, url);
  } finally {
    clearTimeout(t);
  }
}

const BAD_HTML = [/<title>\s*cloudflare/i, /error\s*10\d{2}\s*ray|checking\s*your\s*browser|challenges\.cloudflare/i];

function valid(t: string | undefined | null): boolean {
  if (!t) return false;
  const s = t.trim();
  if (s.length < 8) return false;
  if (/^(null|undefined|not\s*found|no\s+station|station\s+not\s+found|error\s*:|unknown\s+station)/i.test(s)) return false;
  if (/^\s*(<!doctype|<html|<head)/i.test(s)) return false;
  if (/^\s*</.test(s) && BAD_HTML.some(r => r.test(s))) return false;
  return true;
}

async function fetchDecoded(url: string, timeoutMs: number): Promise<string> {
  const raw = await fetchText(url, timeoutMs);
  if (!valid(raw)) throw new WxApiError('Empty or blocked', 'NO_DATA', url);
  return raw;
}

async function tryCapacitorNativeHttp(bareUrl: string, timeoutMs = 15000): Promise<{ text: string; used: string }> {
  try {
    const w = window as any;
    const Cap = w?.Capacitor;
    const Http = Cap?.Plugins?.Http ??
      Cap?.Plugins?.CapacitorHttp ??
      (w?.CapacitorHttp && { request: w.CapacitorHttp.request.bind(w.CapacitorHttp), get: w.CapacitorHttp.get.bind(w.CapacitorHttp) });
    if (!Http || (typeof Http.request !== 'function' && typeof Http.get !== 'function')) {
      throw new WxApiError('Native HTTP unavailable', 'NETWORK', bareUrl);
    }
    const opts: Record<string, unknown> = {
      url: bareUrl,
      method: 'GET',
      responseType: 'text',
      headers: { Accept: 'text/plain,*/*', 'User-Agent': 'SmartFlightCAL/1.0' },
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    };
    const res = typeof Http.request === 'function'
      ? await Http.request(opts)
      : await Http.get(opts);
    const status = Number(res?.status ?? 0);
    if (status >= 400) throw new WxApiError(`Native HTTP ${status}`, classifyError(new Error(`HTTP ${status}`)), bareUrl);
    let text = '';
    if (typeof res?.data === 'string') text = res.data;
    else if (res?.data != null) {
      try { text = String(res.data); } catch { text = ''; }
    }
    if (!valid(text)) throw new WxApiError('Native empty', 'NO_DATA', bareUrl);
    return { text, used: `capacitor+http:${bareUrl}` };
  } catch (e) {
    if (e instanceof WxApiError) throw e;
    const kind = classifyError(e);
    const msg = e instanceof Error ? e.message : String(e || 'Native HTTP error');
    throw new WxApiError(msg, kind, bareUrl);
  }
}

async function fetchWithCorsFallback(bareUrl: string): Promise<{ text: string; used: string }> {
  const native = isCapacitorNative();
  const direct = bareUrl;
  const proxyAll = [
    `https://cors.bridged.cc/${bareUrl}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(bareUrl)}`,
  ];

  // 브라우저 개발 환경 → Vite dev proxy 우선 사용 (CORS 우회)
  if (!native && import.meta.env.DEV && bareUrl.startsWith('https://aviationweather.gov')) {
    const proxyUrl = `/aviationweather${bareUrl.slice('https://aviationweather.gov'.length)}`;
    try {
      const text = await fetchDecoded(proxyUrl, 5000);
      return { text, used: proxyUrl };
    } catch {
      /* proxy 실패시 기존 파이프라인으로 fallback */
    }
  }

  if (native) {
    try {
      const nativeResult = await tryCapacitorNativeHttp(bareUrl, 8000);
      return nativeResult;
    } catch {
      /* Native 실패시 아래 Web + Proxy 파이프라인으로 fallback */
    }
  }

  const candidates: string[] = native
    ? [direct, ...proxyAll]
    : [...proxyAll, direct];
  const fastBatch = candidates.slice(0, 1);
  const fastRace = await (Promise as any).any(
    fastBatch.map(async (u: string) => {
      const text = await fetchDecoded(u, 5000);
      return { text, used: u };
    })
  ).catch(() => null as null);
  if (fastRace) return fastRace;

  let lastErr: unknown = null;
  const restBatch = candidates.slice(1);
  for (const url of restBatch) {
    try {
      const text = await fetchDecoded(url, 6000);
      return { text, used: url };
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr instanceof WxApiError) throw lastErr;
  if (lastErr instanceof Error) throw new WxApiError(lastErr.message, classifyError(lastErr));
  throw new WxApiError('All endpoints failed', 'UNKNOWN');
}

async function fetchFromMetarsEu(kind: 'METAR' | 'TAF', icao4: string): Promise<{ text: string; used: string } | null> {
  const path = kind === 'METAR' ? `metars/${icao4}` : `tafs/${icao4}`;
  const url = `https://metars.eu/api/${path}`;
  try {
    const raw = await fetchText(url, 10000);
    let j: any = null;
    try { j = JSON.parse(raw); } catch { return null; }
    const arr = Array.isArray(j) ? j : (j && typeof j === 'object') ? [j] : [];
    if (arr.length === 0) return null;
    const first = arr[0];
    const rawText = typeof first?.rawText === 'string' ? first.rawText : '';
    if (!valid(rawText)) return null;
    return { text: rawText, used: url };
  } catch {
    return null;
  }
}

function readCache(key: string, ttlMs: number = CACHE_TTL_MS): WxFetchResult | null {
  try {
    const raw = localStorage.getItem(WX_CACHE_PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as WxFetchResult;
    if (Date.now() - obj.fetchedAtMs > ttlMs) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeCache(key: string, val: WxFetchResult) {
  try {
    localStorage.setItem(WX_CACHE_PREFIX + key, JSON.stringify(val));
  } catch { /* ignore */ }
}

function firstLineStartingWith(text: string, prefixes: string[]): string {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const p of prefixes) {
    const hit = lines.find(l => l.toUpperCase().startsWith(p.toUpperCase()));
    if (hit) return hit;
  }
  return lines.join(' ').trim();
}

export async function fetchMetar(icaoRaw: string, force = false): Promise<WxFetchResult> {
  const icao = normalizeIcao(icaoRaw);
  if (!icao) throw new Error('4-letter ICAO required');
  const cacheKey = `metar-${icao}`;
  const cached = force ? null : readCache(cacheKey);
  if (cached) return cached;

  const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw&hours=2`;
  try {
    const { text, used } = await fetchWithCorsFallback(url);
    const raw = firstLineStartingWith(text, [icao, 'METAR', 'SPECI']);
    const result: WxFetchResult = { raw, fetchedAtMs: Date.now(), sourceUrl: used };
    writeCache(cacheKey, result);
    return result;
  } catch {
    const eu = await fetchFromMetarsEu('METAR', icao);
    if (eu) {
      const rawText = firstLineStartingWith(eu.text, [icao, 'METAR', 'SPECI']);
      const result: WxFetchResult = { raw: rawText, fetchedAtMs: Date.now(), sourceUrl: eu.used };
      writeCache(cacheKey, result);
      return result;
    }
    throw new WxApiError('All weather sources failed', 'UNKNOWN');
  }
}

export async function fetchTaf(icaoRaw: string, force = false): Promise<WxFetchResult> {
  const icao = normalizeIcao(icaoRaw);
  if (!icao) throw new Error('4-letter ICAO required');
  const cacheKey = `taf-${icao}`;
  const cached = force ? null : readCache(cacheKey);
  if (cached) return cached;

  const url = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`;
  try {
    const { text, used } = await fetchWithCorsFallback(url);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const s = lines.findIndex(l => l.toUpperCase().startsWith('TAF') || l.toUpperCase().startsWith(icao));
    const joined = (s >= 0 ? lines.slice(s) : lines).join(' ').replace(/\s+/g, ' ').trim();
    const result: WxFetchResult = { raw: joined, fetchedAtMs: Date.now(), sourceUrl: used };
    writeCache(cacheKey, result);
    return result;
  } catch {
    const eu = await fetchFromMetarsEu('TAF', icao);
    if (eu) {
      const lines = eu.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const s = lines.findIndex(l => l.toUpperCase().startsWith('TAF') || l.toUpperCase().startsWith(icao));
      const joined = (s >= 0 ? lines.slice(s) : lines).join(' ').replace(/\s+/g, ' ').trim();
      const result: WxFetchResult = { raw: joined, fetchedAtMs: Date.now(), sourceUrl: eu.used };
      writeCache(cacheKey, result);
      return result;
    }
    throw new WxApiError('All weather sources failed', 'UNKNOWN');
  }
}

export interface MetarSummary {
  raw: string;
  station: string;
  timestamp: string;
  obsTime?: number;
  lat?: number;
  lon?: number;
  localTimestamp?: string;
  kstTimestamp?: string;
  windDir: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windUnit: string;
  windVar: string;
  visibility: string;
  weather: string[];
  clouds: string[];
  temp: number | null;
  dewPoint: number | null;
  qnh: number | null;
  humidity: number | null;
  flightCategory: string;
}

export interface TafGroup {
  type: string;
  /** TAF 시각: DDHHMM (일자+시+분). FM220400 → 220400 */
  fromTime: string;
  toTime: string;
  windDir: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windVRB?: boolean;
  visibility: string;
  clouds: string[];
  weather: string[];
  rawText: string;
}

export interface TafSummary {
  raw: string;
  station: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  groups: TafGroup[];
  tempExtremes: string[];
}

function degToCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatVisibility(v: number | null | undefined, unit = 'M'): string {
  if (v == null) return '';
  const u = (unit || 'M').toUpperCase();
  if (u === 'SM' || u === 'MI') return `${v} SM`;
  if (v >= 10000) return '10 km or more';
  if (v >= 1000) return `${(v / 1000).toFixed(1)} km`;
  return `${v} m`;
}

function formatFeet(ft: number): string {
  return `${ft.toLocaleString('en-US')} ft`;
}

function formatCloudLayer(c: string): string {
  const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?/i);
  if (!m) return c;
  const typeMap: Record<string, string> = {
    'FEW': 'Few', 'SCT': 'Scattered', 'BKN': 'Broken', 'OVC': 'Overcast', 'VV': 'Vertical vis',
  };
  const type = typeMap[m[1].toUpperCase()] || m[1];
  const alt = parseInt(m[2], 10) * 100;
  const conv = m[3] ? ` ${m[3].toUpperCase()}` : '';
  return `${type} at ${formatFeet(alt)}${conv}`;
}

/** TAF 시각 DDHH 또는 DDHHMM → `22/04:00Z` (일/시:분). FM·유효기간은 시각이 아니라 일자+시각. */
export function formatTafZulu(code: string): string {
  const s = String(code || '').replace(/\D/g, '');
  if (s.length >= 6) return `${s.slice(0, 2)}/${s.slice(2, 4)}:${s.slice(4, 6)}Z`;
  if (s.length === 4) return `${s.slice(0, 2)}/${s.slice(2, 4)}:00Z`;
  if (s.length === 2) return `${s}:00Z`;
  return code || '';
}

function unixToTafDdhhmm(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}${hh}${mm}`;
}

function ddhhToDdhhmm(ddhh: string, endOfHour = false): string {
  const s = ddhh.replace(/\D/g, '');
  if (s.length >= 6) return s.slice(0, 6);
  if (s.length !== 4) return s;
  let dd = parseInt(s.slice(0, 2), 10);
  let hh = parseInt(s.slice(2, 4), 10);
  // 2124 = 21일 24시 → 22일 00시
  if (hh >= 24) {
    dd += Math.floor(hh / 24);
    hh = hh % 24;
    if (dd > 31) dd -= 31;
  }
  if (endOfHour && hh === 0 && s.slice(2, 4) === '24') {
    return `${String(dd).padStart(2, '0')}0000`;
  }
  return `${String(dd).padStart(2, '0')}${String(hh).padStart(2, '0')}00`;
}

function parseTafVisToken(tok: string): string | null {
  if (!tok) return null;
  if (tok === 'CAVOK' || tok === '9999') return '10 km or more';
  const psm = tok.match(/^P(\d+(?:\/\d+)?)SM$/i);
  if (psm) return `>${psm[1]} SM`;
  const msm = tok.match(/^M(\d+(?:\/\d+)?)SM$/i);
  if (msm) return `<${msm[1]} SM`;
  const frac = tok.match(/^(\d+)\s+(\d+\/\d+)SM$/i);
  if (frac) return `${frac[1]} ${frac[2]} SM`;
  const sm = tok.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)SM$/i);
  if (sm) return `${sm[1]} SM`;
  if (/^\d{4}$/.test(tok)) {
    const m = parseInt(tok, 10);
    if (m >= 9999) return '10 km or more';
    if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} km`;
    return `${m} m`;
  }
  return null;
}

function parseTafWindToken(tok: string): { dir: number | null; spd: number | null; gust: number | null; vrb: boolean } | null {
  const m = tok.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/i);
  if (!m) return null;
  const vrb = m[1].toUpperCase() === 'VRB';
  return {
    dir: vrb ? null : parseInt(m[1], 10),
    spd: parseInt(m[2], 10),
    gust: m[3] ? parseInt(m[3], 10) : null,
    vrb,
  };
}

function parseTafWxToken(tok: string): string | null {
  if (/^(FEW|SCT|BKN|OVC|VV|SKC|CLR|NSC|NCD|CAVOK)/i.test(tok)) return null;
  if (/^(VRB|\d{3})\d{2,3}/.test(tok)) return null;
  if (/(SM|KT|MPS|KMH)$/i.test(tok)) return null;
  if (/^\d{4}$/.test(tok)) return null;
  if (/^(FM|BECMG|TEMPO|PROB|TX|TN|AMD|COR|TAF)/i.test(tok)) return null;
  if (/^[+-]?(VC|RE)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS|UP)$/i.test(tok)) {
    return tok;
  }
  return null;
}

function parseTafGroupBody(tokens: string[]): Pick<TafGroup, 'windDir' | 'windSpeed' | 'windGust' | 'windVRB' | 'visibility' | 'clouds' | 'weather'> {
  let windDir: number | null = null;
  let windSpeed: number | null = null;
  let windGust: number | null = null;
  let windVRB = false;
  let visibility = '';
  const clouds: string[] = [];
  const weather: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const wnd = parseTafWindToken(tok);
    if (wnd) {
      windDir = wnd.dir;
      windSpeed = wnd.spd;
      windGust = wnd.gust;
      windVRB = wnd.vrb;
      continue;
    }
    if (/^\d+$/.test(tok) && i + 1 < tokens.length && /SM$/i.test(tokens[i + 1])) {
      visibility = `${tok} ${tokens[i + 1].replace(/SM$/i, ' SM')}`;
      i++;
      continue;
    }
    const vis = parseTafVisToken(tok);
    if (vis) {
      visibility = vis;
      continue;
    }
    const cld = formatCloudLayer(tok);
    if (cld !== tok && /^(FEW|SCT|BKN|OVC|VV)/i.test(tok)) {
      clouds.push(cld);
      continue;
    }
    const wx = parseTafWxToken(tok);
    if (wx) weather.push(wx);
  }
  return { windDir, windSpeed, windGust, windVRB, visibility, clouds, weather };
}

/**
 * ICAO TAF 원문 해석.
 * - 유효기간 `2100/2206` = 21일 00Z → 22일 06Z (시:분이 아님)
 * - FM `FM220400` = 22일 04:00Z 부터 (22:04가 아님)
 */
export function parseTafRaw(raw0: string): TafSummary | null {
  if (!raw0) return null;
  const raw = raw0.replace(/\n/g, ' ').replace(/=+\s*$/, '').replace(/\s+/g, ' ').trim();
  const tokens = raw.split(' ').filter(Boolean);
  let i = 0;
  if (tokens[i] === 'TAF') i++;
  if (tokens[i] === 'AMD' || tokens[i] === 'COR') i++;
  const station = /^[A-Z]{4}$/.test(tokens[i] || '') ? tokens[i++] : '';
  let issueTime = '';
  if (/^\d{6}Z$/.test(tokens[i] || '')) {
    issueTime = tokens[i].slice(0, 6);
    i++;
  }
  let validFrom = '';
  let validTo = '';
  const vl = tokens[i]?.match(/^(\d{4})\/(\d{4})$/);
  if (vl) {
    validFrom = ddhhToDdhhmm(vl[1]);
    validTo = ddhhToDdhhmm(vl[2]);
    i++;
  }

  type Seg = { type: string; from: string; to: string; body: string[] };
  const segs: Seg[] = [];
  let cur: Seg = { type: 'Initial', from: validFrom, to: validTo, body: [] };

  const flush = () => {
    if (cur.body.length || cur.type === 'Initial') segs.push(cur);
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'RMK') break;
    const fm = t.match(/^FM(\d{6})$/);
    if (fm) {
      flush();
      cur = { type: 'FM', from: fm[1], to: validTo, body: [] };
      i++;
      continue;
    }
    if (t === 'BECMG' || t === 'TEMPO' || /^PROB\d{2}$/.test(t)) {
      let type = t;
      let j = i + 1;
      if (/^PROB\d{2}$/.test(t) && (tokens[j] === 'TEMPO' || tokens[j] === 'BECMG')) {
        type = `${t} ${tokens[j]}`;
        j++;
      }
      const per = tokens[j]?.match(/^(\d{4})\/(\d{4})$/);
      flush();
      if (per) {
        cur = { type, from: ddhhToDdhhmm(per[1]), to: ddhhToDdhhmm(per[2]), body: [] };
        i = j + 1;
      } else {
        cur = { type, from: validFrom, to: validTo, body: [] };
        i = j;
      }
      continue;
    }
    if (/^TX|^TN/.test(t)) {
      i++;
      continue;
    }
    cur.body.push(t);
    i++;
  }
  flush();

  for (let s = 0; s < segs.length; s++) {
    if (segs[s].type === 'FM' || segs[s].type === 'Initial') {
      const nxt = segs.slice(s + 1).find(x => x.type === 'FM' || x.type === 'Initial');
      segs[s].to = nxt ? nxt.from : validTo;
    }
  }

  const groups: TafGroup[] = segs.map(seg => {
    const body = parseTafGroupBody(seg.body);
    return {
      type: seg.type,
      fromTime: seg.from,
      toTime: seg.to,
      ...body,
      rawText: `${seg.type} ${formatTafZulu(seg.from)} → ${formatTafZulu(seg.to)}`.trim(),
    };
  });

  const tempExtremes: string[] = [];
  const tx = raw.match(/(TX|TN)M?\d{2}\/\d{4}Z/g);
  if (tx) tempExtremes.push(...tx);

  return {
    raw,
    station,
    issueTime,
    validFrom,
    validTo,
    groups,
    tempExtremes,
  };
}

function calcFlightCategory(vis: number | null, clouds: string[], ceiling: number | null): string {
  if (vis == null && clouds.length === 0) return 'VFR';
  const hasOvcast = clouds.some(c => /^(OVC|BKN|VV)/.test(c));
  let ceilingFt = ceiling;
  if (ceilingFt == null && hasOvcast) {
    for (const c of clouds) {
      const m = c.match(/^(OVC|BKN|VV)(\d+)/);
      if (m) { ceilingFt = parseInt(m[2]) * 100; break; }
    }
  }
  const visKm = vis != null ? vis / 1000 : 999;
  if (visKm >= 8 && (ceilingFt == null || ceilingFt >= 3000)) return 'VFR';
  if (visKm >= 5 && (ceilingFt == null || ceilingFt >= 1000)) return 'MVFR';
  if (visKm >= 1.6 && (ceilingFt == null || ceilingFt >= 500)) return 'IFR';
  return 'LIFR';
}

export function parseMetarJson(metarJson: any): MetarSummary | null {
  if (!metarJson) return null;
  const w = metarJson.wind || {};
  const vis = metarJson.visibility || {};
  const t = metarJson.temperature || {};
  const clouds: string[] = (metarJson.clouds || []).map((c: any) => {
    const type = c.type || '';
    const h = c.height || '';
    const mod = c.modifier ? c.modifier : '';
    return `${type}${h}${mod}`.trim();
  });
  const weather: string[] = (metarJson.weather || []).map((w: any) => w.text || w || '');
  const visVal = vis.distance ?? null;

  let humidity: number | null = null;
  if (t.temp != null && t.dewPoint != null) {
    const tc = t.temp;
    const td = t.dewPoint;
    const es = 6.112 * Math.exp((17.62 * tc) / (243.12 + tc));
    const e = 6.112 * Math.exp((17.62 * td) / (243.12 + td));
    humidity = Math.round((e / es) * 100);
    if (humidity > 100) humidity = 100;
  }

  const ceiling = null;
  const flightCat = calcFlightCategory(visVal, clouds, ceiling);

  return {
    raw: metarJson.rawText || '',
    station: metarJson.station || '',
    timestamp: metarJson.timestamp || '',
    windDir: w.direction ?? null,
    windSpeed: w.speed ?? null,
    windGust: w.gust ?? null,
    windUnit: w.unit || 'KT',
    windVar: metarJson.tokens?.find((t: any) => t.type === 'WIND_VARIABLE')?.text || '',
    visibility: formatVisibility(visVal, vis.unit),
    weather,
    clouds: clouds.map(formatCloudLayer),
    temp: t.temp ?? null,
    dewPoint: t.dewPoint ?? null,
    qnh: metarJson.qnh ?? null,
    humidity,
    flightCategory: flightCat,
  };
}

export function parseTafJson(tafJson: any): TafSummary | null {
  if (!tafJson) return null;
  const fromRaw = parseTafRaw(tafJson.rawText || tafJson.rawTAF || '');
  if (fromRaw && fromRaw.groups.length) return fromRaw;
  const groups: TafGroup[] = (tafJson.groups || []).map((g: any) => {
    const w = g.wind || {};
    const vis = g.visibility || {};
    const clouds: string[] = (g.clouds || []).map((c: any) => {
      const type = c.type || '';
      const h = c.height || '';
      const mod = c.modifier ? c.modifier : '';
      return `${type}${h}${mod}`.trim();
    });
    return {
      type: g.type || '',
      fromTime: g.fromTime || '',
      toTime: g.toTime || '',
      windDir: w.direction ?? null,
      windSpeed: w.speed ?? null,
      windGust: w.gust ?? null,
      visibility: formatVisibility(vis.distance ?? null, vis.unit),
      clouds: clouds.map(formatCloudLayer),
      weather: (g.weather || []).map((w: any) => w.text || w || ''),
      rawText: g.rawText || '',
    };
  });

  const tempExtremes: string[] = [];
  const tokens = tafJson.tokens || [];
  for (const t of tokens) {
    if (t.type === 'TEMP_EXTREME') tempExtremes.push(t.text);
  }

  return {
    raw: tafJson.rawText || '',
    station: tafJson.station || '',
    issueTime: tafJson.issueTime || '',
    validFrom: tafJson.validFrom || '',
    validTo: tafJson.validTo || '',
    groups,
    tempExtremes,
  };
}

function parseMetarTimestamp(raw: string): string {
  const match = raw.match(/(\d{2})(\d{2})Z/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }
  return '';
}

function parseMetarWindDir(raw: string): number | null {
  const match = raw.match(/(\d{3})(\d{2,3})KT/);
  return match ? parseInt(match[1]) : null;
}

function parseMetarWindSpeed(raw: string): number | null {
  const match = raw.match(/(\d{3})(\d{2,3})KT/);
  return match ? parseInt(match[2]) : null;
}

function parseMetarWindGust(raw: string): number | null {
  const match = raw.match(/G(\d{2,3})KT/);
  return match ? parseInt(match[1]) : null;
}

function parseMetarWindVar(raw: string): string {
  const match = raw.match(/(\d{3})V(\d{3})/);
  return match ? `${match[1]}V${match[2]}` : '';
}

function parseMetarVisibility(raw: string): string {
  if (raw.includes('CAVOK')) return '10 km or more';
  const match = raw.match(/(\d+)(\s|SM|KM)/);
  if (match) {
    const vis = parseInt(match[1]);
    if (vis >= 10) return '10 km or more';
    if (vis >= 1) return `${vis} km`;
  }
  return '';
}

function parseMetarWeather(raw: string): string[] {
  const match = raw.match(/\s([A-Z]{2,3}(?:\s|$))/);
  return match ? [match[1].trim()] : [];
}

function parseMetarClouds(raw: string): string[] {
  const matches = raw.match(/(FEW|SCT|BKN|OVC|VV)(\d{3})/g);
  if (!matches) return [];
  return matches.map(m => {
    const type = m.slice(0, 3);
    const height = parseInt(m.slice(3));
    return `${type} at ${height * 100} ft`;
  });
}

function parseMetarTemp(raw: string): number | null {
  const match = raw.match(/(\d{2})\/(\d{2})/);
  return match ? parseInt(match[1]) : null;
}

function parseMetarDewPoint(raw: string): number | null {
  const match = raw.match(/(\d{2})\/(\d{2})/);
  return match ? parseInt(match[2]) : null;
}

function parseMetarQNH(raw: string): number | null {
  const match = raw.match(/Q(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

function calcHumidity(temp: number | null, dew: number | null): number | null {
  if (temp == null || dew == null) return null;
  const tc = temp;
  const td = dew;
  const es = 6.112 * Math.exp((17.62 * tc) / (243.12 + tc));
  const e = 6.112 * Math.exp((17.62 * td) / (243.12 + td));
  const rh = Math.round((e / es) * 100);
  return rh > 100 ? 100 : rh;
}

function calcFlightCategoryFromRaw(raw: string): string {
  if (raw.includes('CAVOK')) return 'VFR';
  if (raw.includes('VFR')) return 'VFR';
  if (raw.includes('MVFR')) return 'MVFR';
  if (raw.includes('IFR')) return 'IFR';
  return 'VFR';
}

export async function fetchMetarSummary(icao: string): Promise<MetarSummary | null> {
  try {
    // aviationweather.gov JSON API 사용
    const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
    const { text } = await fetchWithCorsFallback(url);
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const metar = data[0];
    
    // Clouds 파싱
    const clouds: string[] = [];
    if (metar.cover === 'CAVOK') {
      // CAVOK는 구름 정보 없음
    } else if (metar.cover && metar.cover !== 'NSC') {
      clouds.push(`${metar.cover} at ${(metar.clouds?.[0]?.base || 0) * 100} ft`);
    } else if (metar.clouds && metar.clouds.length > 0) {
      metar.clouds.forEach((c: any) => {
        if (c.cover && c.cover !== 'NSC' && c.base) {
          clouds.push(`${c.cover} at ${c.base * 100} ft`);
        }
      });
    }
    
    // Visibility 파싱
    let visibility = '';
    if (metar.visib === '6+') {
      visibility = '10 km or more';
    } else if (metar.visib) {
      const visNum = parseFloat(metar.visib);
      if (!isNaN(visNum)) {
        if (visNum >= 10) {
          visibility = '10 km or more';
        } else {
          visibility = `${visNum} km`;
        }
      }
    }
    
    // Wind variable 파싱
    let windVar = '';
    // METAR JSON에는 wind variable이 직접 제공되지 않으므로 rawOb에서 파싱
    if (metar.rawOb) {
      const varMatch = metar.rawOb.match(/(\d{3})V(\d{3})/);
      if (varMatch) {
        windVar = `${varMatch[1]}V${varMatch[2]}`;
      }
    }
    
    // Timestamp 파싱 (obsTime: Unix timestamp)
    let timestamp = '';
    let kstTimestamp = '';
    let localTimestamp = '';
    const stationIcao = metar.icaoId || icao.toUpperCase();
    if (metar.obsTime) {
      const date = new Date(metar.obsTime * 1000);
      
      // UTC 시간
      const utcHh = String(date.getUTCHours()).padStart(2, '0');
      const utcMm = String(date.getUTCMinutes()).padStart(2, '0');
      timestamp = `${utcHh}${utcMm}`;
      
      // KST 시간 (UTC+9 - 하위 호환)
      const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const kstHh = String(kstDate.getUTCHours()).padStart(2, '0');
      const kstMm = String(kstDate.getUTCMinutes()).padStart(2, '0');
      kstTimestamp = `${kstHh}${kstMm}`;

      // 공항 로컬 시각 계산
      const loc = getAirportLocalObservedTime(stationIcao, metar.obsTime, metar.lon);
      localTimestamp = loc.fullStr;
    } else if (metar.rawOb) {
      const tmMatch = metar.rawOb.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
      if (tmMatch) {
        timestamp = `${tmMatch[2]}${tmMatch[3]}`;
        const loc = getAirportLocalObservedTime(stationIcao, timestamp, metar.lon);
        localTimestamp = loc.fullStr;
      }
    }
    
    const result: MetarSummary = {
      raw: metar.rawOb || '',
      station: stationIcao,
      timestamp,
      obsTime: metar.obsTime,
      lat: metar.lat,
      lon: metar.lon,
      localTimestamp,
      kstTimestamp,
      windDir: metar.wdir ?? null,
      windSpeed: metar.wspd ?? null,
      windGust: null, // JSON API에 gust 정보 없음
      windUnit: 'KT',
      windVar,
      visibility,
      weather: [], // JSON API에 weather 정보 없음
      clouds,
      temp: metar.temp ?? null,
      dewPoint: metar.dewp ?? null,
      qnh: metar.altim ?? null,
      humidity: calcHumidity(metar.temp ?? null, metar.dewp ?? null),
      flightCategory: metar.fltCat || 'VFR',
    };
    
    return result;
  } catch {
    try {
      // Fallback: metars.eu JSON API
      const raw = await fetchText(`https://metars.eu/api/metars/${icao}`, 8000);
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : [j];
      if (arr.length === 0) return null;
      return parseMetarJson(arr[0]);
    } catch {
      return null;
    }
  }
}

export async function fetchTafSummary(icao: string): Promise<TafSummary | null> {
  try {
    // aviationweather.gov JSON API 사용
    const url = `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`;
    const { text } = await fetchWithCorsFallback(url);
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const taf = data[0];
    const fromRaw = parseTafRaw(taf.rawTAF || '');
    if (fromRaw && fromRaw.groups.length) {
      fromRaw.station = taf.icaoId || fromRaw.station || icao.toUpperCase();
      return fromRaw;
    }

    const groups: TafGroup[] = [];
    if (taf.fcsts && Array.isArray(taf.fcsts)) {
      taf.fcsts.forEach((fcst: any) => {
        const fromTime = unixToTafDdhhmm(fcst.timeFrom);
        const toTime = unixToTafDdhhmm(fcst.timeTo);
        const clouds: string[] = [];
        if (fcst.clouds && Array.isArray(fcst.clouds)) {
          fcst.clouds.forEach((c: any) => {
            if (c.cover && c.cover !== 'NSC' && c.base != null) {
              const hundreds = c.base >= 1000 ? Math.round(c.base / 100) : c.base;
              clouds.push(formatCloudLayer(`${c.cover}${String(hundreds).padStart(3, '0')}`));
            }
          });
        }
        let visibility = '';
        if (fcst.visib === '6+' || fcst.visib === 'P6SM') {
          visibility = '>6 SM';
        } else if (fcst.visib) {
          const visNum = parseFloat(fcst.visib);
          if (!isNaN(visNum)) visibility = visNum >= 6 ? `>${visNum} SM` : `${visNum} SM`;
        }
        groups.push({
          type: fcst.fcstChange || 'Initial',
          fromTime,
          toTime,
          windDir: fcst.wdir === 'VRB' || fcst.wdir == null ? null : fcst.wdir,
          windSpeed: fcst.wspd ?? null,
          windGust: fcst.wgst ?? null,
          windVRB: fcst.wdir === 'VRB',
          visibility,
          clouds,
          weather: [],
          rawText: `${fcst.fcstChange || 'Initial'} ${formatTafZulu(fromTime)} → ${formatTafZulu(toTime)}`,
        });
      });
    }

    return {
      raw: taf.rawTAF || '',
      station: taf.icaoId || icao.toUpperCase(),
      issueTime: taf.issueTime ? unixToTafDdhhmm(Math.floor(new Date(taf.issueTime).getTime() / 1000)) : '',
      validFrom: taf.validTimeFrom ? unixToTafDdhhmm(taf.validTimeFrom) : '',
      validTo: taf.validTimeTo ? unixToTafDdhhmm(taf.validTimeTo) : '',
      groups,
      tempExtremes: (taf.rawTAF || '').match(/(TX|TN)M?\d{2}\/\d{4}Z/g) || [],
    };
  } catch {
    try {
      // Fallback: metars.eu JSON API
      const raw = await fetchText(`https://metars.eu/api/tafs/${icao}`, 8000);
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : [j];
      if (arr.length === 0) return null;
      return parseTafJson(arr[0]);
    } catch {
      return null;
    }
  }
}

const ATIS_CACHE_TTL_MS = 5 * 60 * 1000;

function parseDatisFromClowd(jsonText: string): string | null {
  try {
    const j = JSON.parse(jsonText);
    const arr = Array.isArray(j) ? j : [];
    const parts: string[] = [];
    for (const item of arr) {
      const t = typeof item?.datis === 'string' ? item.datis.trim() : '';
      if (t) parts.push(t);
    }
    return parts.length ? parts.join('\n') : null;
  } catch {
    return null;
  }
}

function parseAtisGuruMd(md: string): string | null {
  if (/no\s+ATIS\s+available/i.test(md)) return null;
  const out: string[] = [];
  let buf: string[] = [];
  let mode: 'idle' | 'want' | 'in_text' = 'idle';
  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    buf = [];
    if (text) out.push(text);
  };
  for (const ln0 of md.split(/\r?\n/)) {
    const ln = ln0.trim();
    if (!ln) continue;
    const h = ln.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!h) {
      if (mode === 'want' || mode === 'in_text') { buf.push(ln); mode = 'in_text'; }
      continue;
    }
    const title = h[1].trim();
    if (/^D-ATIS\s+for/i.test(title) || /^Live\s+digital\s+ATIS/i.test(title)) continue;
    if (/atis/i.test(title)) {
      flush();
      mode = 'want';
      continue;
    }
    if (mode === 'want') continue;
    flush();
    mode = 'idle';
  }
  flush();
  if (out.length === 0) return null;
  const okText = out.some(t => /^(METAR|SPECI)?\s*[A-Z]{4}\s+(ARR|DEP)?\s*ATIS/i.test(t) || /ATIS\s+[A-Z]\s+\d{4}Z/i.test(t));
  if (!okText) return null;
  return out.join('\n');
}

interface ParsedAtis {
  raw: string;
  issueTime?: string;
  runway?: string;
  expires?: string;
}

export function parseAtisDetails(raw: string): ParsedAtis {
  const result: ParsedAtis = { raw };
  
  const issueMatch = raw.match(/(\d{4})Z/i);
  if (issueMatch) {
    const hh = issueMatch[1].slice(0, 2);
    const mm = issueMatch[1].slice(2);
    result.issueTime = `${hh}:${mm}:00`;
  }
  
  const runwayMatch = raw.match(/RWY(\d{1,2}[RLC]?)/i);
  if (runwayMatch) {
    result.runway = `RWY${runwayMatch[1]}`;
  }
  
  return result;
}

export function calcTimeDiff(t1: string, t2: string): string {
  const [h1, m1, s1] = t1.split(':').map(Number);
  const [h2, m2, s2] = t2.split(':').map(Number);
  
  const total1 = h1 * 3600 + m1 * 60 + s1;
  const total2 = h2 * 3600 + m2 * 60 + s2;
  
  const diff = Math.abs(total2 - total1);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export async function fetchAtis(icaoRaw: string): Promise<WxFetchResult> {
  const icao = normalizeIcao(icaoRaw);
  if (!icao) throw new Error('4-letter ICAO required');
  const cacheKey = `atis-${icao}`;
  const cached = readCache(cacheKey, ATIS_CACHE_TTL_MS);
  if (cached) return cached;

  const cb = Math.floor(Date.now() / 60000);
  const { text: md } = await fetchWithCorsFallback(`https://r.jina.ai/https://atis.guru/atis/${icao}?cb=${cb}`);
  const parsed = parseAtisGuruMd(md);
  if (!parsed) throw new WxApiError('No ATIS available', 'NO_DATA', 'atis.guru');
  const result: WxFetchResult = { raw: parsed, fetchedAtMs: Date.now(), sourceUrl: 'atis.guru (via r.jina.ai)' };
  writeCache(cacheKey, result);
  return result;
}
