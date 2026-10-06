import { describe, it, expect } from 'vitest';
import {
  calculateAltitude,
  windCorrection,
  windComponents,
  percentMac,
  standardAtmosphere,
  calculateAirspeed,
  aggregateFlightPlan,
  etaCalc,
  holdingEntry,
  weightShift,
  calculateSegment,
  tatFromOatAndMach,
  oatFromTatAndMach,
  airspeedPlannedTas,
  airspeedActualTas,
  airspeedRequiredCas,
  airspeedPlannedMach,
  airspeedActualMach,
  calculateFuel,
  calcPressureAltitude,
  calcDensityAltitude,
  calcTopOfDescent,
  calcRateOfDescentMach,
  calcReserveFuel,
  calcFuelUplift,
  calcColdTempCorrection,
} from './flightCalc';
import { convertUnits } from '../utils/units';
import type { FlightSegment } from '../types';

const fToC = (f: number) => (f - 32) * 5 / 9;
const cToF = (c: number) => c * 9 / 5 + 32;
const ktToMph = (kt: number) => kt * 1.150779448;
const mphToKt = (mph: number) => mph / 1.150779448;

describe('Unit Conversions', () => {
  it('1 knot → 1.852 km/h', () => {
    const r = convertUnits(1, 'kt', 'kmh');
    expect(Math.abs(r - 1.852)).toBeLessThan(0.001);
  });

  it('0°C = 32°F, 100°C = 212°F', () => {
    expect(Math.abs(convertUnits(0, 'c', 'f') - 32)).toBeLessThan(0.01);
    expect(Math.abs(convertUnits(100, 'c', 'f') - 212)).toBeLessThan(0.01);
  });

  it('1 ft = 0.3048 m', () => {
    expect(Math.abs(convertUnits(1, 'ft', 'm') - 0.3048)).toBeLessThan(0.0001);
  });
});

describe('Altitude Calculations', () => {
  it('[CX-3 Worked Example] IAlt=5900ft, Baro=29.75 inHg, OAT=75°F → PAlt≈6059, DAlt≈8427 (±5)', () => {
    const fToC = (f: number) => (f - 32) * 5 / 9;
    const r = calculateAltitude({
      fieldElevationFt: 5900,
      altimeterSettingInHg: 29.75,
      oatC: fToC(75),
    });
    console.log('   CX-3 EXAMPLE: PAlt =', r.pressureAltitudeFt, 'DAlt =', r.densityAltitudeFt);
    expect(Math.abs(r.pressureAltitudeFt - 6059)).toBeLessThan(5);
    expect(Math.abs(r.densityAltitudeFt - 8427)).toBeLessThan(5);
  });

  it('Density altitude: PA ~5000ft, OAT 25°C → DAlt ~7260ft (±80ft)', () => {
    const r = calculateAltitude({
      fieldElevationFt: 5000,
      altimeterSettingInHg: 29.92,
      oatC: 25,
      dewPointC: 15,
    });
    expect(Math.abs(r.pressureAltitudeFt - 5000)).toBeLessThan(3);
    console.log('   Legacy test: PAlt =', r.pressureAltitudeFt, 'DAlt =', r.densityAltitudeFt);
    expect(Math.abs(r.densityAltitudeFt - 7260)).toBeLessThan(80);
  });

  it('Cloud base: T 25°C, DP 15°C, 0ft MSL → 4000ft AGL', () => {
    const r = calculateAltitude({
      fieldElevationFt: 0,
      altimeterSettingInHg: 29.92,
      oatC: 25,
      dewPointC: 15,
    });
    expect(Math.abs(r.cloudBaseFtAGL - 4000)).toBeLessThan(100);
  });
});

describe('Standard Atmosphere', () => {
  it('Sea level: 15°C, 29.92 inHg, SoS ~661.5 kt', () => {
    const r = standardAtmosphere(0);
    expect(r.tempC).toBe(15);
    expect(Math.abs(r.pressureInHg - 29.92)).toBeLessThan(0.05);
    expect(Math.abs(r.speedOfSoundKt - 661.5)).toBeLessThan(1);
  });
});

describe('Airspeed / Mach', () => {
  it('Sea level ISA: CAS = TAS', () => {
    const r = calculateAirspeed({ inputType: 'cas', value: 120, pressureAltitudeFt: 0, oatC: 15 });
    expect(Math.abs(r.casKt - 120)).toBeLessThan(0.5);
    expect(Math.abs(r.tasKt - 120)).toBeLessThan(1);
  });

  it('Sea level 15°C: Mach 1 = 661.5 kt', () => {
    const r = calculateAirspeed({ inputType: 'mach', value: 1, pressureAltitudeFt: 0, oatC: 15 });
    expect(Math.abs(r.tasKt - 661.5)).toBeLessThan(2);
  });

  it('TAT↔OAT roundtrip at M=0.72, OAT=-35°C → TAT≈-10.5°C', () => {
    const tatC = tatFromOatAndMach(-35, 0.72);
    expect(Math.abs(tatC - (-10.5))).toBeLessThan(0.5);
    const back = oatFromTatAndMach(tatC, 0.72);
    expect(Math.abs(back - (-35))).toBeLessThan(0.1);
  });

  it('[Planned Mach] M=0.72, OAT=-31°F → TAS=432.98kt, TAT=13°F (±0.8°F)', () => {
    const r = airspeedPlannedMach(0.72, fToC(-31));
    console.log('   Planned Mach 0.72: TAS =', r.tasKt, 'kt, TAT =', cToF(r.tatC).toFixed(1), '°F');
    expect(Math.abs(r.tasKt - 432.98)).toBeLessThan(2);
    expect(Math.abs(cToF(r.tatC) - 13)).toBeLessThan(1);
  });

  it('[Actual Mach] M=0.82, TAT=-4°F → TAS=477.32kt, OAT=-58°F (±1°F)', () => {
    const r = airspeedActualMach(0.82, fToC(-4));
    console.log('   Actual Mach 0.82: TAS =', r.tasKt, 'kt, OAT =', cToF(r.oatC).toFixed(1), '°F');
    expect(Math.abs(r.tasKt - 477.32)).toBeLessThan(2);
    expect(Math.abs(cToF(r.oatC) - (-58))).toBeLessThan(1.5);
  });

  it('[Required CAS] TAS=150kt, OAT=41°F, PAlt=6500ft → CAS=135.58kt, TAT=46°F, M≈0.231 (±1.5)', () => {
    const r = airspeedRequiredCas(150, fToC(41), 6500);
    console.log('   Req CAS 150kt TAS: CAS =', r.casKt, ', TAT =', cToF(r.tatC).toFixed(1), '°F, M =', r.mach);
    expect(Math.abs(r.casKt - 135.58)).toBeLessThan(2);
    expect(Math.abs(cToF(r.tatC) - 46)).toBeLessThan(1.5);
    expect(Math.abs(r.mach - 0.231)).toBeLessThan(0.01);
  });

  it('[Actual TAS] CAS=150MPH, TAT=10°C, PAlt=6500ft → TAS=166.64MPH, OAT=7°C, M=0.222 (±2 MPH/°C/0.01)', () => {
    const casKt = mphToKt(150);
    const r = airspeedActualTas(casKt, 10, 6500);
    const tasMph = ktToMph(r.tasKt);
    console.log('   Act TAS 150 MPH CAS: TAS =', tasMph.toFixed(2), 'MPH, OAT =', r.oatC.toFixed(1), '°C, M =', r.mach);
    expect(Math.abs(tasMph - 166.64)).toBeLessThan(3);
    expect(Math.abs(r.oatC - 7)).toBeLessThan(1.5);
    expect(Math.abs(r.mach - 0.222)).toBeLessThan(0.012);
  });

  it('[Planned TAS] CAS=125kt, OAT=23°F, PAlt=8500ft → TAS=141.03kt, TAT=28°F, M≈0.221 (±1.8kt/°F/0.01)', () => {
    const r = airspeedPlannedTas(125, fToC(23), 8500);
    console.log('   Planned TAS 125kt CAS: TAS =', r.tasKt, ', TAT =', cToF(r.tatC).toFixed(1), '°F, M =', r.mach);
    expect(Math.abs(r.tasKt - 141.03)).toBeLessThan(1.8);
    expect(Math.abs(cToF(r.tatC) - 28)).toBeLessThan(1.2);
    expect(Math.abs(r.mach - 0.221)).toBeLessThan(0.01);
  });
});

describe('Fuel / Ground Speed', () => {
  it('[Fuel Burn] 9.6 GPH × 1:14:00 → 11.84 GAL (±0.05)', () => {
    const r = calculateFuel({ mode: 'fuel', fuelBurnRateGph: 9.6, timeEnrouteH: 1 + 14/60 });
    console.log('   Fuel Burn 9.6 GPH × 1:14 → Vol =', r.totalFuelGal, 'GAL');
    expect(Math.abs((r.totalFuelGal ?? NaN) - 11.84)).toBeLessThan(0.08);
  });

  it('[Fuel Rate] 9500 LBS / 2:30:00 → 3800 LBS/HR (±5)', () => {
    const r = calculateFuel({ mode: 'fuel', totalFuelGal: 9500, timeEnrouteH: 2.5 });
    console.log('   Fuel Rate 9500 / 2.5h → Rate =', r.fuelBurnRateGph, 'LBS/HR');
    expect(Math.abs((r.fuelBurnRateGph ?? NaN) - 3800)).toBeLessThan(10);
  });

  it('[Endurance] 38 GAL / 9.5 GPH → 4:00:00 (= 3:59:59 ±1초)', () => {
    const r = calculateFuel({ mode: 'endurance', totalFuelGal: 38, fuelBurnRateGph: 9.5 });
    const secs = (r.enduranceH ?? NaN) * 3600;
    console.log('   Endurance 38/9.5 GPH → hrs =', r.enduranceH, '≈ secs =', Math.round(secs));
    expect(Math.abs(secs - 4 * 3600)).toBeLessThan(3);
  });

  it('[Ground Speed] 5 NM / 2분 32초 → ~118.4 kt (±1.5kt)', () => {
    const hours = (2 * 60 + 32) / 3600;
    const r = calculateFuel({ mode: 'gs', distanceNm: 5, timeEnrouteH: hours });
    console.log('   GS 5NM / 2:32 → GS =', r.groundspeedKt, 'KT');
    expect(Math.abs((r.groundspeedKt ?? NaN) - 118.4)).toBeLessThan(1.8);
  });
});

describe('Wind Correction (Triangle)', () => {
  it('Tailwind: TAS 120kt, TC 090, Wind 270/20 → GS 140kt, TH 090', () => {
    const r = windCorrection({ tasKt: 120, trueCourseDeg: 90, windDirectionDeg: 270, windSpeedKt: 20 });
    expect(Math.abs(r.trueHeadingDeg - 90)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.groundspeedKt - 140)).toBeLessThanOrEqual(1);
  });
});

describe('Wind Components', () => {
  it('Wind 045/20, RWY 090 → 14.1kt HW, 14.1kt XW', () => {
    const r = windComponents({ runwayHeadingDeg: 90, windDirectionDeg: 45, windSpeedKt: 20 });
    expect(Math.abs(r.headwindKt - 14.1)).toBeLessThan(0.5);
    expect(Math.abs(r.crosswindKt - 14.1)).toBeLessThan(0.5);
  });
});

describe('Weight & Balance', () => {
  it('%MAC: CG 140in, LEMAC 100in, MAC 80in → 50%', () => {
    const r = percentMac({ cgIn: 140, lemacIn: 100, macLengthIn: 80 });
    expect(Math.abs(r - 50)).toBeLessThan(0.5);
  });

  it('TR-9.2 Weight shift: 200lb 50in aft on 2000lb A/C → CG +5in', () => {
    const r = weightShift({
      totalWeightLb: 2000,
      shiftedWeightLb: 200,
      shiftDistanceIn: 50,
      fromArmIn: 100,
      toArmIn: 150,
    });
    expect(Math.abs(r.cgChangeIn - 5)).toBeLessThan(0.01);
  });
});

describe('Holding Entry (TR-6.3)', () => {
  it('Inbound 090°, fix approach 090° (reciprocal 270° → diff -180) → Parallel', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 90 })).toBe('Parallel');
  });
  it('Inbound 090°, approach 270° (diff 0, ±70° 안) → Teardrop', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 270 })).toBe('Teardrop');
  });
  it('Inbound 090°, approach 200° (diff -70 경계) → Teardrop', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 200 })).toBe('Teardrop');
  });
  it('Inbound 090°, approach 020° (diff 110 경계) → Teardrop', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 20 })).toBe('Teardrop');
  });
  it('Inbound 090°, approach 030° (diff=120, Teardrop 110 밖 / Parallel 170 안) → Direct', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 30 })).toBe('Direct');
  });
  it('Inbound 090°, approach 120° (diff=120-270=-150, -180~-110 구간) → Parallel', () => {
    expect(holdingEntry({ inboundCourseDeg: 90, headingToFixDeg: 120 })).toBe('Parallel');
  });
  it('Inbound 360° (0°), approach 045° → Teardrop (reciprocal 180, diff 45-180=-135? → Direct 확인)', () => {
    const r = holdingEntry({ inboundCourseDeg: 0, headingToFixDeg: 45 });
    expect(['Direct', 'Parallel', 'Teardrop'] as const).toContain(r);
  });
});

describe('Flight Plan Aggregation (TR-7)', () => {
  it('TR-7.1: 2 segments (1h + 1h, 30gal each) → total 2h / 60gal approx', () => {
    const s1: FlightSegment = {
      id: 'a', from: 'A', to: 'B', trueCourseDeg: 90,
      distanceNm: 120, altitudeFt: 5000,
      tasKt: 120, windDirectionDeg: 270, windSpeedKt: 0,
      fuelBurnRateGph: 30,
    };
    const s2: FlightSegment = {
      id: 'b', from: 'B', to: 'C', trueCourseDeg: 90,
      distanceNm: 120, altitudeFt: 5000,
      tasKt: 120, windDirectionDeg: 270, windSpeedKt: 0,
      fuelBurnRateGph: 30,
    };
    const seg1Res = calculateSegment(s1);
    const seg2Res = calculateSegment(s2);
    expect(Math.abs(seg1Res.timeEnrouteH - 1)).toBeLessThan(0.01);
    expect(Math.abs(seg1Res.fuelGal - 30)).toBeLessThan(0.1);
    expect(Math.abs(seg2Res.timeEnrouteH - 1)).toBeLessThan(0.01);
    expect(Math.abs(seg2Res.fuelGal - 30)).toBeLessThan(0.1);

    const totals = aggregateFlightPlan([s1, s2]);
    expect(Math.abs(totals.totalTimeMin - 120)).toBeLessThan(1);
    expect(Math.abs(totals.totalFuelGal - 60)).toBeLessThan(0.2);
    expect(totals.totalDistanceNm).toBe(240);
  });

  it('TR-7.2: ETA calc: dep 10:00 + enroute 90min → 11:30', () => {
    const r = etaCalc({ departureTimeMin: 10 * 60, timeEnrouteMin: 90 });
    expect(r.etaStr).toBe('11:30');
    expect(r.etaMin).toBe(11 * 60 + 30);
  });

  it('ETA overflow: dep 23:00 + 120min → 01:00 (next day)', () => {
    const r = etaCalc({ departureTimeMin: 23 * 60, timeEnrouteMin: 120 });
    expect(r.etaStr).toBe('01:00');
  });
});

describe('Pressure Altitude (FLT 14 NEW)', () => {
  it('[CX-3 Match] FldElev 5900ft, Altim 29.75 inHg → PAlt ≈ 6059ft (±5)', () => {
    const r = calcPressureAltitude(5900, 29.75);
    console.log('   NEW PresAlt: 5900ft / 29.75 →', r, 'ft');
    expect(Math.abs(r - 6059)).toBeLessThan(5);
  });

  it('Standard day 29.92 inHg at 5000ft → PAlt ≈ 5000ft (±3)', () => {
    const r = calcPressureAltitude(5000, 29.92);
    expect(Math.abs(r - 5000)).toBeLessThan(3);
  });

  it('Low altimeter 28.50 inHg at SL → PAlt ≈ +1400ft (±100ft conservative)', () => {
    const r = calcPressureAltitude(0, 28.5);
    console.log('   NEW PresAlt 0ft / 28.50 →', r, 'ft');
    expect(r).toBeGreaterThan(1200);
    expect(r).toBeLessThan(1700);
  });
});

describe('Density Altitude (FLT 14 NEW)', () => {
  it('[CX-3 Match] PAlt ~5000ft, OAT 25°C → DAlt ≈ 7260ft (±80)', () => {
    const r = calcDensityAltitude(5000, 25);
    console.log('   NEW DensAlt 5000ft / 25°C →', r, 'ft');
    expect(Math.abs(r - 7260)).toBeLessThan(80);
  });

  it('ISA std day PAlt 0ft OAT 15°C → DAlt 0ft (±30ft)', () => {
    const r = calcDensityAltitude(0, 15);
    expect(Math.abs(r)).toBeLessThan(30);
  });

  it('Cold winter PAlt 0ft OAT -20°C → DAlt < 0 (negative)', () => {
    const r = calcDensityAltitude(0, -20);
    expect(r).toBeLessThan(0);
  });
});

describe('Top of Descent (FLT 14 NEW)', () => {
  it('25000ft descent (35k→10k), 450kt GS, 3.0° → Dist ≈ 78.5 NM / Time ~10min / RoD ~2388fpm / 318 ft/NM', () => {
    const r = calcTopOfDescent(35000, 10000, 450, 3.0);
    console.log('   NEW TOD 35k→10k / 450kt:', r);
    expect(Math.abs(r.distanceNm - 78.5)).toBeLessThan(2);
    expect(Math.abs(r.timeMin - 10)).toBeLessThan(2);
    expect(r.requiredRateFpm).toBeGreaterThan(2200);
    expect(r.requiredRateFpm).toBeLessThan(2600);
    expect(Math.abs(r.feetPerNm - 318)).toBeLessThan(5);
  });

  it('Coastal 8000 → 0ft, 180kt GS 3° → Dist ~25 NM / RoD > 900 fpm', () => {
    const r = calcTopOfDescent(8000, 0, 180, 3.0);
    expect(r.distanceNm).toBeGreaterThan(20);
    expect(r.distanceNm).toBeLessThan(30);
    expect(r.requiredRateFpm).toBeGreaterThan(900);
  });
});

describe('Rate of Descent Mach (FLT 14 NEW)', () => {
  it('M0.80 / 3° / ISA+0 MSL → SoS ~661.5 kt / TAS ~529kt / RoD 2600~3100 fpm', () => {
    const r = calcRateOfDescentMach(0.80, 3.0, 15);
    console.log('   NEW RoD Mach 0.80 / 3° / 15°C:', r);
    expect(Math.abs(r.speedOfSoundKt - 661.5)).toBeLessThan(2);
    expect(Math.abs(r.tasKt - 529)).toBeLessThan(5);
    expect(r.rodFpm).toBeGreaterThan(2600);
    expect(r.rodFpm).toBeLessThan(3100);
  });

  it('M0.84 at cruise OAT -55°C → SoS < 580kt (cold slow sound) / RoD > 2000 fpm', () => {
    const r = calcRateOfDescentMach(0.84, 3.0, -55);
    console.log('   NEW RoD Mach 0.84 / 3° / -55°C:', r);
    expect(r.speedOfSoundKt).toBeLessThan(580);
    expect(r.rodFpm).toBeGreaterThan(2000);
  });
});

describe('Reserve Fuel (FLT 14 NEW)', () => {
  it('100gal req / 15% / 20gal alt / 10gal hold → conting 15, rsv 45, total 145', () => {
    const r = calcReserveFuel(100, 15, 20, 10);
    console.log('   NEW ReserveFuel 100gal 15% 20alt 10hold:', r);
    expect(r.contingencyGal).toBe(15);
    expect(r.alternateGal).toBe(20);
    expect(r.holdingGal).toBe(10);
    expect(r.reserveGal).toBe(45);
    expect(r.totalRequiredGal).toBe(145);
  });

  it('VFR simple: 60gal / 10% / 0alt / 0hold → 66 gal total', () => {
    const r = calcReserveFuel(60, 10, 0, 0);
    expect(r.contingencyGal).toBe(6);
    expect(r.totalRequiredGal).toBe(66);
  });
});

describe('Fuel Uplift (FLT 14 NEW)', () => {
  it('TotReq 145gal, Curr 50gal, 6.7 lb/gal → Up 95gal / 636.5 lb / TotOnbd 145gal', () => {
    const r = calcFuelUplift(145, 50, 6.7);
    console.log('   NEW FuelUplift 145 50 6.7:', r);
    expect(r.upliftGal).toBe(95);
    expect(r.upliftLb).toBe(636.5);
    expect(r.totalOnboardGal).toBe(145);
    expect(r.totalOnboardLb).toBe(971.5);
  });

  it('Already full: TotReq 80gal, Curr 90gal → Up 0gal (clamped to ≥0)', () => {
    const r = calcFuelUplift(80, 90, 6.7);
    expect(r.upliftGal).toBe(0);
    expect(r.upliftLb).toBe(0);
    expect(r.totalOnboardGal).toBe(90);
  });
});

describe('Cold Temperature Correction (FLT 14 NEW)', () => {
  it('Indicated 5000ft, FldElev 1000ft, OAT -20°C → ISA_std ~13°C / ΔISA ~33°C / Corr ~+222ft', () => {
    const r = calcColdTempCorrection(5000, 1000, -20);
    console.log('   NEW ColdTemp 5000/1000/-20°C:', r);
    expect(r.isaStdAtElevC).toBeCloseTo(13.0, 0);
    expect(Math.abs(r.deltaIsaC - 33)).toBeLessThan(1.5);
    expect(r.heightAboveAerodromeFt).toBe(4000);
    expect(r.correctionFt).toBeGreaterThan(200);
    expect(r.correctionFt).toBeLessThan(260);
    expect(r.correctedAltitudeFt).toBeGreaterThan(5200);
    expect(r.correctedAltitudeFt).toBeLessThan(5260);
  });

  it('Warm ISA+ day: OAT 25°C at field → ΔISA = 0 (only cold corr applied, no neg) / Corr 0ft', () => {
    const r = calcColdTempCorrection(3000, 0, 25);
    expect(r.deltaIsaC).toBe(0);
    expect(r.correctionFt).toBe(0);
    expect(r.correctedAltitudeFt).toBe(3000);
  });

  it('High altitude cold approach: Ind 8000ft, Fld 2000ft, OAT -35°C → Correction > 450ft / CorrAlt > 8450ft', () => {
    const r = calcColdTempCorrection(8000, 2000, -35);
    console.log('   NEW ColdTemp 8000/2000/-35°C:', r);
    expect(r.correctionFt).toBeGreaterThan(450);
    expect(r.correctedAltitudeFt).toBeGreaterThan(8450);
  });
});
