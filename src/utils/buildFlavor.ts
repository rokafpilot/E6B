/**
 * 빌드 플레이버 (정식 / 트라이얼) 와 Trial 만료 제어
 * - VITE_BUILD_FLAVOR=trial → 트라이얼 버전 (배너 표시 + 만료 시 잠금)
 * - VITE_BUILD_FLAVOR=prod 또는 미설정 → 정식 버전 (모든 Trial 기능 비활성)
 */
export type BuildFlavor = 'prod' | 'trial';

export const APP_VERSION = '0.9';

/** Trial 만료일 (26SEP30 → 2026-09-30 23:59:59 로컬 시각) */
export const TRIAL_EXPIRE_RAW = '26OCT16';

export function getBuildFlavor(): BuildFlavor {
  const v = (import.meta.env.VITE_BUILD_FLAVOR || 'prod').toLowerCase();
  return v === 'trial' ? 'trial' : 'prod';
}

export function isTrialBuild(): boolean {
  return getBuildFlavor() === 'trial';
}

/**
 * "26SEP30" = YY(연) MMM(월) DD(일) → 2026-09-30 23:59:59.999
 */
export function parseAeroDate(raw: string): Date | null {
  const s = (raw || '').trim().toUpperCase();
  const m = /^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})$/.exec(s);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const mm = monthMap[m[2]];
  const dd = parseInt(m[3], 10);
  const year = 2000 + yy;
  const d = new Date(year, mm, dd, 23, 59, 59, 999);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function getTrialExpireDate(): Date | null {
  return parseAeroDate(TRIAL_EXPIRE_RAW);
}

/** 트라이얼 빌드이면서 만료일을 지났으면 true. 정식 빌드는 항상 false. */
export function isTrialExpired(now: Date = new Date()): boolean {
  if (!isTrialBuild()) return false;
  const exp = getTrialExpireDate();
  if (!exp) return false;
  return now.getTime() > exp.getTime();
}

/** 만료까지 남은 일수 (트라이얼 아닐 때 -1) */
export function daysUntilExpire(now: Date = new Date()): number {
  const exp = getTrialExpireDate();
  if (!exp) return -1;
  const ms = exp.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** LCD 상단 배너 문구 (트라이얼 빌드가 아니면 null) */
export function buildBannerText(): string | null {
  if (!isTrialBuild()) return null;
  return `SMART FLIGHTCAL ver ${APP_VERSION}  ·  TRIAL  ·  EXPIRES ${TRIAL_EXPIRE_RAW}`;
}
