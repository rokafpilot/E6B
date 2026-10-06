/**
 * 공항 ICAO 코드 기반 로컬 타임존 및 로컬 관측 시각 계산 유틸
 */

// 미국 주요 공항 타임존 매핑 (다중 타임존 국가의 메이저 공항)
const US_MAJOR_AIRPORTS: Record<string, string> = {
  // Eastern Time (America/New_York)
  KJFK: 'America/New_York', KEWR: 'America/New_York', KLGA: 'America/New_York',
  KBOS: 'America/New_York', KIAD: 'America/New_York', KDCA: 'America/New_York',
  KBWI: 'America/New_York', KMIA: 'America/New_York', KMCO: 'America/New_York',
  KFLL: 'America/New_York', KATL: 'America/New_York', KCLT: 'America/New_York',
  KPHL: 'America/New_York', KDTW: 'America/New_York', KPIT: 'America/New_York',
  KRSW: 'America/New_York', KTPA: 'America/New_York', KJAX: 'America/New_York',
  KRDU: 'America/New_York', KCHS: 'America/New_York', KRIC: 'America/New_York',
  KBTV: 'America/New_York', KBDL: 'America/New_York', KPVD: 'America/New_York',
  KBUF: 'America/New_York', KROC: 'America/New_York', KSYR: 'America/New_York',
  KPWM: 'America/New_York', KCAE: 'America/New_York', KILM: 'America/New_York',
  KMYR: 'America/New_York', KSAV: 'America/New_York', KTLH: 'America/New_York',
  KCLE: 'America/New_York', KCMH: 'America/New_York', KCVG: 'America/New_York',
  KIND: 'America/Indiana/Indianapolis',

  // Central Time (America/Chicago)
  KORD: 'America/Chicago', KMDW: 'America/Chicago', KDFW: 'America/Chicago',
  KDAL: 'America/Chicago', KIAH: 'America/Chicago', KHOU: 'America/Chicago',
  KMSP: 'America/Chicago', KSTL: 'America/Chicago', KMCI: 'America/Chicago',
  KBNA: 'America/Chicago', KMEM: 'America/Chicago', KMSY: 'America/Chicago',
  KAUS: 'America/Chicago', KSAT: 'America/Chicago', KOKC: 'America/Chicago',
  KTUL: 'America/Chicago', KMKE: 'America/Chicago', KDSM: 'America/Chicago',
  KOMA: 'America/Chicago', KLIT: 'America/Chicago', KJAN: 'America/Chicago',
  KBTR: 'America/Chicago', KSHV: 'America/Chicago', KHSV: 'America/Chicago',
  KMOB: 'America/Chicago', KICT: 'America/Chicago', KFSD: 'America/Chicago',
  KBIS: 'America/Chicago', KFAR: 'America/Chicago', KPNS: 'America/Chicago',

  // Mountain Time (America/Denver)
  KDEN: 'America/Denver', KSLC: 'America/Denver', KABQ: 'America/Denver',
  KCOS: 'America/Denver', KBOI: 'America/Denver', KBZN: 'America/Denver',
  KELP: 'America/Denver', KGTF: 'America/Denver', KBIL: 'America/Denver',
  KGJT: 'America/Denver', KEGE: 'America/Denver', KASE: 'America/Denver',
  KHDN: 'America/Denver', KJAC: 'America/Denver', KCPR: 'America/Denver',
  KHLN: 'America/Denver', KMSO: 'America/Denver',

  // Arizona Mountain Standard Time - No DST (America/Phoenix)
  KPHX: 'America/Phoenix', KTUS: 'America/Phoenix', KFLG: 'America/Phoenix',
  KAZA: 'America/Phoenix', KYUM: 'America/Phoenix', KPRC: 'America/Phoenix',

  // Pacific Time (America/Los_Angeles)
  KLAX: 'America/Los_Angeles', KSFO: 'America/Los_Angeles', KSAN: 'America/Los_Angeles',
  KSEA: 'America/Los_Angeles', KPDX: 'America/Los_Angeles', KLAS: 'America/Los_Angeles',
  KOAK: 'America/Los_Angeles', KSJC: 'America/Los_Angeles', KSMF: 'America/Los_Angeles',
  KSNA: 'America/Los_Angeles', KONT: 'America/Los_Angeles', KBUR: 'America/Los_Angeles',
  KPSP: 'America/Los_Angeles', KGEG: 'America/Los_Angeles', KRNO: 'America/Los_Angeles',
  KFAT: 'America/Los_Angeles', KSTS: 'America/Los_Angeles', KMRY: 'America/Los_Angeles',
  KBLI: 'America/Los_Angeles', KPSC: 'America/Los_Angeles', KYKM: 'America/Los_Angeles',
  KPAE: 'America/Los_Angeles',
};

// 캐나다 주요 공항
const CANADA_MAJOR_AIRPORTS: Record<string, string> = {
  CYVR: 'America/Vancouver', CYXX: 'America/Vancouver', CYYJ: 'America/Vancouver',
  CYLW: 'America/Vancouver', CYXS: 'America/Vancouver',
  CYYC: 'America/Edmonton', CYEG: 'America/Edmonton', CYQL: 'America/Edmonton',
  CYQR: 'America/Regina', CYXE: 'America/Regina',
  CYWG: 'America/Winnipeg', CYBR: 'America/Winnipeg',
  CYYZ: 'America/Toronto', CYOW: 'America/Toronto', CYUL: 'America/Toronto',
  CYQB: 'America/Toronto', CYXU: 'America/Toronto', CYHM: 'America/Toronto',
  CYHZ: 'America/Halifax', CYQM: 'America/Halifax', CYFC: 'America/Halifax',
  CYYT: 'America/St_Johns', CYQX: 'America/St_Johns',
};

// 호주 주요 공항
const AUSTRALIA_MAJOR_AIRPORTS: Record<string, string> = {
  YSSY: 'Australia/Sydney', YMML: 'Australia/Melbourne', YSCB: 'Australia/Sydney',
  YBBN: 'Australia/Brisbane', YBCS: 'Australia/Brisbane', YBHM: 'Australia/Brisbane',
  YPPH: 'Australia/Perth', YPEA: 'Australia/Perth',
  YPAD: 'Australia/Adelaide',
  YPDN: 'Australia/Darwin', YBAS: 'Australia/Darwin',
  YMHB: 'Australia/Hobart',
};

// 2글자 또는 특수 ICAO Prefix 기반 국가/지역 매핑
const ICAO_PREFIX_TIMEZONE: Record<string, string> = {
  // 대한민국
  RK: 'Asia/Seoul',
  // 일본
  RJ: 'Asia/Tokyo', RO: 'Asia/Tokyo',
  // 대만, 홍콩, 마카오
  RC: 'Asia/Taipei',
  VH: 'Asia/Hong_Kong',
  VM: 'Asia/Macau',
  // 북한, 몽골
  ZK: 'Asia/Pyongyang',
  ZM: 'Asia/Ulaanbaatar',
  // 필리핀
  RP: 'Asia/Manila',
  // 동남아시아
  VV: 'Asia/Ho_Chi_Minh',
  VT: 'Asia/Bangkok',
  VD: 'Asia/Phnom_Penh',
  VL: 'Asia/Vientiane',
  VY: 'Asia/Yangon',
  WM: 'Asia/Kuala_Lumpur', WB: 'Asia/Kuala_Lumpur',
  WS: 'Asia/Singapore',
  WN: 'Asia/Brunei',
  WI: 'Asia/Jakarta', WR: 'Asia/Makassar', WA: 'Asia/Makassar',
  // 남아시아
  VA: 'Asia/Kolkata', VE: 'Asia/Kolkata', VI: 'Asia/Kolkata', VO: 'Asia/Kolkata',
  VC: 'Asia/Colombo',
  VG: 'Asia/Dhaka',
  OP: 'Asia/Karachi',
  VN: 'Asia/Kathmandu',
  VR: 'Indian/Maldives',
  // 중동
  OM: 'Asia/Dubai',
  OT: 'Asia/Qatar',
  OB: 'Asia/Bahrain',
  OK: 'Asia/Kuwait',
  OE: 'Asia/Riyadh',
  OO: 'Asia/Muscat',
  LL: 'Asia/Jerusalem',
  OJ: 'Asia/Amman',
  OL: 'Asia/Beirut',
  OS: 'Asia/Damascus',
  OR: 'Asia/Baghdad',
  OI: 'Asia/Tehran',
  LT: 'Europe/Istanbul',
  OA: 'Asia/Kabul',
  // 중앙아시아 / 캅카스
  UA: 'Asia/Almaty',
  UT: 'Asia/Tashkent',
  UB: 'Asia/Baku',
  UG: 'Asia/Tbilisi',
  UD: 'Asia/Yerevan',
  // 유럽 서부/중부/북부
  EG: 'Europe/London',
  EI: 'Europe/Dublin',
  LF: 'Europe/Paris',
  ED: 'Europe/Berlin', ET: 'Europe/Berlin',
  EH: 'Europe/Amsterdam',
  EB: 'Europe/Brussels',
  EL: 'Europe/Luxembourg',
  LS: 'Europe/Zurich',
  LO: 'Europe/Vienna',
  LI: 'Europe/Rome',
  LE: 'Europe/Madrid',
  LP: 'Europe/Lisbon',
  LG: 'Europe/Athens',
  LC: 'Asia/Nicosia',
  LK: 'Europe/Prague',
  EP: 'Europe/Warsaw',
  LH: 'Europe/Budapest',
  EK: 'Europe/Copenhagen',
  EN: 'Europe/Oslo',
  ES: 'Europe/Stockholm',
  EF: 'Europe/Helsinki',
  EE: 'Europe/Tallinn',
  EV: 'Europe/Riga',
  EY: 'Europe/Vilnius',
  LR: 'Europe/Bucharest',
  LB: 'Europe/Sofia',
  LD: 'Europe/Zagreb',
  LY: 'Europe/Belgrade',
  LZ: 'Europe/Bratislava',
  LJ: 'Europe/Ljubljana',
  LQ: 'Europe/Sarajevo',
  LA: 'Europe/Tirana',
  BI: 'Atlantic/Reykjavik',
  // 러시아 (서부/수도권)
  UU: 'Europe/Moscow', UL: 'Europe/Moscow', UR: 'Europe/Moscow',
  // 미국 태평양 영토 및 주
  PA: 'America/Anchorage', // 알래스카
  PH: 'Pacific/Honolulu',  // 하와이
  PG: 'Pacific/Guam',      // 괌/사이판
  TJ: 'America/Puerto_Rico', // 푸에르토리코
  TI: 'America/Virgin',    // 버진아일랜드
  // 멕시코 & 중남미
  MM: 'America/Mexico_City',
  SB: 'America/Sao_Paulo', SD: 'America/Sao_Paulo',
  SN: 'America/Sao_Paulo', SS: 'America/Sao_Paulo', SW: 'America/Sao_Paulo',
  SA: 'America/Buenos_Aires',
  SC: 'America/Santiago',
  SK: 'America/Bogota',
  SP: 'America/Lima',
  SV: 'America/Caracas',
  SU: 'America/Montevideo',
  SG: 'America/Asuncion',
  SL: 'America/La_Paz',
  SE: 'America/Guayaquil',
  MP: 'America/Panama',
  MG: 'America/Guatemala',
  MS: 'America/El_Salvador',
  MN: 'America/Managua',
  MH: 'America/Tegucigalpa',
  MR: 'America/Costa_Rica',
  MD: 'America/Santo_Domingo',
  MU: 'America/Havana',
  MK: 'America/Jamaica',
  MY: 'America/Nassau',
  // 아프리카
  HE: 'Africa/Cairo',
  FA: 'Africa/Johannesburg',
  HK: 'Africa/Nairobi',
  HA: 'Africa/Addis_Ababa',
  DN: 'Africa/Lagos',
  GM: 'Africa/Casablanca',
  DT: 'Africa/Tunis',
  DA: 'Africa/Algiers',
  // 오세아니아
  NZ: 'Pacific/Auckland',
  NF: 'Pacific/Fiji',
  NW: 'Pacific/Noumea',
  AY: 'Pacific/Port_Moresby',
};

// 타임존 IANA ID에 따른 친숙한 표준 약어 매핑 (Intl이 GMT+9 등으로 돌려줄 때 대체)
const TZ_ABBR_FALLBACKS: Record<string, string> = {
  'Asia/Seoul': 'KST',
  'Asia/Tokyo': 'JST',
  'Asia/Pyongyang': 'KST',
  'Asia/Taipei': 'CST',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Macau': 'CST',
  'Asia/Shanghai': 'CST',
  'Asia/Singapore': 'SGT',
  'Asia/Kuala_Lumpur': 'MYT',
  'Asia/Manila': 'PHT',
  'Asia/Bangkok': 'ICT',
  'Asia/Ho_Chi_Minh': 'ICT',
  'Asia/Phnom_Penh': 'ICT',
  'Asia/Vientiane': 'ICT',
  'Asia/Jakarta': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
  'Asia/Dubai': 'GST',
  'Asia/Muscat': 'GST',
  'Asia/Qatar': 'AST',
  'Asia/Bahrain': 'AST',
  'Asia/Kuwait': 'AST',
  'Asia/Riyadh': 'AST',
  'Asia/Kolkata': 'IST',
  'Asia/Colombo': 'IST',
  'Asia/Kathmandu': 'NPT',
  'Asia/Dhaka': 'BST',
  'Asia/Karachi': 'PKT',
  'Europe/Istanbul': 'TRT',
  'Europe/Moscow': 'MSK',
  'Pacific/Guam': 'ChST',
  'Pacific/Honolulu': 'HST',
  'America/Phoenix': 'MST',
  'America/Bogota': 'COT',
  'America/Lima': 'PET',
  'America/Buenos_Aires': 'ART',
  'America/Sao_Paulo': 'BRT',
  'Africa/Cairo': 'EET',
  'Africa/Johannesburg': 'SAST',
};

/**
 * 공항 ICAO 코드 및 선택적 경도/위도를 통해 IANA Timezone 문자열 판정
 */
export function getAirportTimeZone(icaoRaw: string, lon?: number): string {
  const icao = (icaoRaw || '').toUpperCase().trim();
  if (!icao) return 'UTC';

  // 1. 미국 개별 주요 공항 체크
  if (US_MAJOR_AIRPORTS[icao]) {
    return US_MAJOR_AIRPORTS[icao];
  }

  // 2. 캐나다 개별 주요 공항 체크
  if (CANADA_MAJOR_AIRPORTS[icao]) {
    return CANADA_MAJOR_AIRPORTS[icao];
  }

  // 3. 호주 개별 주요 공항 체크
  if (AUSTRALIA_MAJOR_AIRPORTS[icao]) {
    return AUSTRALIA_MAJOR_AIRPORTS[icao];
  }

  // 4. 중국 (Z로 시작하는 4자리 ICAO: ZBAA, ZSPD, ZGGG 등 중국 전역 베이징 표준시)
  if (icao.startsWith('Z') && icao.length === 4 && icao[1] !== 'K' && icao[1] !== 'M') {
    return 'Asia/Shanghai';
  }

  // 5. ICAO 2문자 Prefix 체크
  const pfx2 = icao.slice(0, 2);
  if (ICAO_PREFIX_TIMEZONE[pfx2]) {
    return ICAO_PREFIX_TIMEZONE[pfx2];
  }

  // 6. 미국 본토 기타 공항 (K***) — 경도(lon) 기반 판정
  if (icao.startsWith('K') && icao.length === 4) {
    if (typeof lon === 'number' && !isNaN(lon)) {
      if (lon <= -114.5) return 'America/Los_Angeles'; // Pacific
      if (lon <= -102.5) return 'America/Denver';      // Mountain
      if (lon <= -85.5)  return 'America/Chicago';     // Central
      return 'America/New_York';                       // Eastern
    }
    // 경도 정보가 없으면 일반적 기본값은 Eastern
    return 'America/New_York';
  }

  // 7. 캐나다 기타 공항 (C***) — 경도(lon) 기반 판정
  if (icao.startsWith('C') && icao.length === 4) {
    if (typeof lon === 'number' && !isNaN(lon)) {
      if (lon <= -114.5) return 'America/Vancouver';
      if (lon <= -102.5) return 'America/Edmonton';
      if (lon <= -85.5)  return 'America/Winnipeg';
      if (lon <= -68.0)  return 'America/Toronto';
      return 'America/Halifax';
    }
    return 'America/Toronto';
  }

  // 8. 호주 기타 공항 (Y***)
  if (icao.startsWith('Y') && icao.length === 4) {
    if (typeof lon === 'number' && !isNaN(lon)) {
      if (lon < 129.0) return 'Australia/Perth';
      if (lon < 138.0) return 'Australia/Darwin';
      if (lon < 141.0) return 'Australia/Adelaide';
      return 'Australia/Sydney';
    }
    return 'Australia/Sydney';
  }

  // 9. 유럽 일반 (E*** 또는 L***)
  if (icao.startsWith('E')) return 'Europe/Berlin';
  if (icao.startsWith('L')) return 'Europe/Rome';

  // 10. 경도(lon) 기반 일반 fallback
  if (typeof lon === 'number' && !isNaN(lon)) {
    const rawOffset = Math.round(lon / 15);
    const clampedOffset = Math.max(-12, Math.min(14, rawOffset));
    // Etc/GMT-X 는 Etc/GMT 규격상 부호가 반대(+9는 GMT-9)이므로 명시적 오프셋 문자열 처리
    return clampedOffset >= 0 ? `Etc/GMT-${clampedOffset}` : `Etc/GMT+${Math.abs(clampedOffset)}`;
  }

  return 'UTC';
}

/**
 * 주어진 시각(Unix 초 또는 Date 또는 UTC HHMM)과 ICAO 코드를 기반으로
 * 해당 공항의 로컬 시각 문자열(예: "07:56 EDT", "20:56 KST")을 생성합니다.
 */
export function getAirportLocalObservedTime(
  icao: string,
  timeInput?: number | Date | string | null,
  lon?: number
): { localTimeStr: string; tzAbbr: string; fullStr: string } {
  const timeZone = getAirportTimeZone(icao, lon);

  // Date 객체 생성
  let date: Date;
  if (typeof timeInput === 'number') {
    date = new Date(timeInput * 1000);
  } else if (timeInput instanceof Date) {
    date = timeInput;
  } else if (typeof timeInput === 'string' && /^\d{4}$/.test(timeInput)) {
    // "1156" (UTC HHMM) 형식
    const now = new Date();
    const hh = parseInt(timeInput.slice(0, 2), 10);
    const mm = parseInt(timeInput.slice(2, 4), 10);
    date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, 0));
  } else {
    date = new Date();
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    let hh = '00';
    let mm = '00';
    let rawTz = '';

    for (const p of parts) {
      if (p.type === 'hour') hh = p.value;
      else if (p.type === 'minute') mm = p.value;
      else if (p.type === 'timeZoneName') rawTz = p.value;
    }

    // rawTz가 "GMT+9" 형식이거나 없으면 친숙한 약어 사전 확인
    let tzAbbr = rawTz;
    if ((!tzAbbr || tzAbbr.startsWith('GMT') || tzAbbr.startsWith('UTC')) && TZ_ABBR_FALLBACKS[timeZone]) {
      tzAbbr = TZ_ABBR_FALLBACKS[timeZone];
    } else if (!tzAbbr) {
      tzAbbr = 'LCL';
    }

    const localTimeStr = `${hh}:${mm}`;
    const fullStr = `${localTimeStr} ${tzAbbr}`;

    return { localTimeStr, tzAbbr, fullStr };
  } catch {
    // Fallback: UTC
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return { localTimeStr: `${hh}:${mm}`, tzAbbr: 'UTC', fullStr: `${hh}:${mm} UTC` };
  }
}
