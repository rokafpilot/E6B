import { describe, it, expect } from 'vitest';
import {
  lookupHOT, lookupHOT4, findRangeIndex, HOT_PRECIP4, HOT_FLUIDS_DSHOT,
  HOT_PRECIP9_TO_IDX4, HOT_MRATIO3_FACTORS, HOT_VIS7_FACTORS, HOT_TOD2_FACTORS,
} from './holdoverTables';

const W16 = {
  ACTIVE_FROST: 0,
  FZ_FOG_MIST_ICE: 1,
  VLT_SNOW: 2,
  LT_SNOW: 3,
  MD_SNOW: 4,
  FZ_DRIZZLE: 5,
  LT_FZ_RAIN: 6,
  RAIN_COLDSOAK: 7,
  SN_FZFOG_VL: 8,
  SN_FZFOG_LT: 9,
  SN_FZFOG_MD: 10,
  MDSN_RAIN_VL: 11,
  MDSN_RAIN_LT: 12,
  MDSN_RAIN_MD: 13,
  HV_FZ_RAIN: 14,
  HV_SNOW: 15,
} as const;
const C3 = { PURE_100: 0, DILUTE_75: 1, DILUTE_50: 2 } as const;
const V11 = {
  L400: 0, L800: 1, L1200: 2, L1600: 3, L2000: 4, L2400: 5,
  L2800: 6, L3200: 7, L4000: 8, L4800: 9, VMC5600: 10,
} as const;
const T2 = { DAY: 0, NIGHT: 1 } as const;

describe('HOT FAA DSHOT E2E', () => {
  it('loads 50 final fluids (I 2 + II 13 + III 3 + IV 32 = 50)', () => {
    expect(HOT_FLUIDS_DSHOT.length).toBe(50);
    const types: Record<string, number> = {};
    HOT_FLUIDS_DSHOT.forEach(f => { types[f.type] = (types[f.type]||0) + 1; });
    expect(types).toEqual({ I: 2, II: 13, III: 3, IV: 32 });
  });

  it('[Kilfrost ABC-K Plus] 19번째 Type II Fluid 등록 검증', () => {
    const k = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Kilfrost ABC-K Plus');
    expect(k).toBeDefined();
    expect(k!.type).toBe('II');
    expect(k!.ranges.length).toBeGreaterThan(25);
    expect(k!.ranges[k!.ranges.length - 1].t).toBe(0);
  });

  it('Weather16 → IDX4 매핑: RAIN_COLDSOAK(7)=idx4=3 / FZ_FOG_MIST_ICE(1)=idx4=0', () => {
    expect(HOT_PRECIP9_TO_IDX4[W16.RAIN_COLDSOAK]).toBe(3);
    expect(HOT_PRECIP9_TO_IDX4[W16.FZ_FOG_MIST_ICE]).toBe(0);
    expect(HOT_PRECIP9_TO_IDX4[W16.VLT_SNOW]).toBe(0);
    expect(HOT_PRECIP9_TO_IDX4[W16.LT_SNOW]).toBe(1);
    expect(HOT_PRECIP9_TO_IDX4[W16.MD_SNOW]).toBe(2);
    expect(HOT_PRECIP9_TO_IDX4[W16.HV_SNOW]).toBe(3);
    expect(HOT_PRECIP9_TO_IDX4.length).toBe(16);
  });
  it('Factor 테이블 검증 MRATIO / VIS11 / TOD', () => {
    expect(HOT_MRATIO3_FACTORS[C3.PURE_100]).toBeCloseTo(1.0, 9);
    expect(HOT_MRATIO3_FACTORS[C3.DILUTE_75]).toBeCloseTo(0.75, 9);
    expect(HOT_MRATIO3_FACTORS[C3.DILUTE_50]).toBeCloseTo(0.50, 9);
    expect(HOT_VIS7_FACTORS[V11.L400]).toBeCloseTo(0.58, 9);
    expect(HOT_VIS7_FACTORS[V11.L800]).toBeCloseTo(0.64, 9);
    expect(HOT_VIS7_FACTORS[V11.L2400]).toBeCloseTo(0.82, 9);
    expect(HOT_VIS7_FACTORS[V11.VMC5600]).toBeCloseTo(1.0, 9);
    expect(HOT_TOD2_FACTORS[T2.DAY]).toBeCloseTo(1.0, 9);
    expect(HOT_TOD2_FACTORS[T2.NIGHT]).toBeCloseTo(0.85, 9);
  });

  it('[E2E ANCHOR] Gen IV @-10°C / LT_SNOW / M100 / VMC / Day → 91:00 (FAA DSHOT)', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    const ri = findRangeIndex(gen4.ranges, -10);
    expect(gen4.ranges[ri].t).toBe(-10);
    expect(lookupHOT(gen4, -10, W16.LT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBe('91:00');
  });
  it('Gen IV @0°C / VLT_SNOW / M100 / VMC / Day → 149:00', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBe('149:00');
  });
  it('[MRATIO Anchor] 149:00 × 0.75 → 111:45 · × 0.5 → 74:30', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.DILUTE_75, V11.VMC5600, T2.DAY)).toBe('111:45');
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.DILUTE_50, V11.VMC5600, T2.DAY)).toBe('74:30');
  });
  it('[VIS Anchor] 149:00 × ≤400m Cat IIIb 0.58 → 86:25', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.PURE_100, V11.L400, T2.DAY)).toBe('86:25');
  });
  it('[TOD Anchor] 149:00 × Night 0.85 → 126:38', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.PURE_100, V11.VMC5600, T2.NIGHT)).toBe('126:38');
  });
  it('[3중 Factor] 149 × 0.75 × 0.69(1200m) × 0.85 = 65.53875 → 65:32', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, 0, W16.VLT_SNOW, C3.DILUTE_75, V11.L1200, T2.NIGHT)).toBe('65:32');
  });

  it('findRangeIndex OAT -10.3 floor ≤ t=-10', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    const ri = findRangeIndex(gen4.ranges, -10.3);
    expect(gen4.ranges[ri].t).toBeLessThanOrEqual(-10);
  });
  it('Type I Aluminum sentinel ≥0°C returns t=99 row (75:00 = 75min)', () => {
    const alu = HOT_FLUIDS_DSHOT[0];
    expect(findRangeIndex(alu.ranges, 5) >= 0).toBe(true);
    expect(alu.ranges[findRangeIndex(alu.ranges, 5)].t).toBe(99);
    expect(lookupHOT4(alu, 5, HOT_PRECIP4.LIGHT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBe('75:00');
  });
  it('Type I @ -20°C falls back to t=-3 conservative (150:00 = 150min)', () => {
    const alu = HOT_FLUIDS_DSHOT[0];
    expect(alu.ranges[findRangeIndex(alu.ranges, -20)].t).toBe(-3);
    expect(lookupHOT4(alu, -20, HOT_PRECIP4.VERY_LIGHT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBe('150:00');
  });

  it('[LOUT] ABC-S Plus 최저온도 -24°C (FAA 2026-27 공지 반영)', () => {
    const abc = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Kilfrost ABC-S Plus')!;
    expect(abc).toBeDefined();
    const minT = Math.min(...abc.ranges.filter(r => r.t !== 99 && r.t !== -999).map(r => r.t));
    expect(minT).toBe(-24);
    // -24°C 경계: 값 존재 (LT_SNOW → '0:10' raw → '10:00' 총분)
    expect(findRangeIndex(abc.ranges, -24)).toBeGreaterThanOrEqual(0);
    expect(lookupHOT(abc, -24, W16.LT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBe('10:00');
  });
  it('[LOUT] ABC-S Plus @-25°C → LOUT 미만 → null (unavailable)', () => {
    const abc = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Kilfrost ABC-S Plus')!;
    expect(findRangeIndex(abc.ranges, -25)).toBe(-1);
    expect(lookupHOT(abc, -25, W16.LT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).toBeNull();
    expect(lookupHOT(abc, -25, W16.LT_SNOW, C3.PURE_100, V11.VMC5600, T2.DAY)).not.toBe('10:00');
  });
  it('Invalid indices → null (range validation · 16Weather / 11Vis)', () => {
    const gen4 = HOT_FLUIDS_DSHOT.find(f => f.brand === 'Generic Type IV')!;
    expect(lookupHOT(gen4, -10, -1, 0, 10, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 16, 0, 10, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, -1, 10, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, 3, 10, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, 0, -1, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, 0, 11, 0)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, 0, 10, -1)).toBeNull();
    expect(lookupHOT(gen4, -10, 3, 0, 10, 2)).toBeNull();
  });
});
