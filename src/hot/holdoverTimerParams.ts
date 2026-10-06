/** HOT 계산 화면 → Holdover Timer 화면 간 파라미터 전달 싱글톤
 *  (Router state가 가벼워야 하므로, 복잡한 페이로드는 module-level 변수로 bypass)
 */
export interface HoldoverTimerParams {
  /** HOT holdover 시간 (분 단위, 소수점 허용 = 초 단위까지 포함 가능) */
  durationMinutes: number;
  /** 화면 진입 시각 (epoch ms). 기본 = Date.now() 로 자동 계산하지만 파라미터로 오버라이드 가능 */
  startedAtEpochMs?: number;
  /** 디버깅 / 레퍼런스용: 원래 LCD에 표시되던 holdover 문자열 (예: "126:38") */
  rawLabel?: string;
}

let _params: HoldoverTimerParams | null = null;

export function setHoldoverTimerParams(p: HoldoverTimerParams) {
  _params = { ...p, startedAtEpochMs: p.startedAtEpochMs ?? Date.now() };
}
export function consumeHoldoverTimerParams(): HoldoverTimerParams | null {
  const p = _params;
  return p ? { ...p } : null;
}
