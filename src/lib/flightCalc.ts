import { convertUnits } from '../utils/units';
import type { FlightSegment } from '../types';

export function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

export function toDeg(rad: number): number {
  return rad * 180 / Math.PI;
}

export function normalizeHeading(h: number): number {
  let r = h % 360;
  if (r < 0) r += 360;
  return r;
}

const ISA_SL_T_K = 288.15;
const ISA_SL_P_INHG = 29.92126;
const ISA_LAPSE_K_PER_FT = 0.0019812;
const ISA_G_OVER_LR = 5.25588;
const ISA_LR_OVER_GMLR = 0.234969;
const ISA_T0_OVER_L_FT = 145442.0;
const ISA_PA_EXP = 0.190284;

export interface AltitudeResult {
  pressureAltitudeFt: number;
  densityAltitudeFt: number;
  cloudBaseFtAGL: number;
  cloudBaseFtMSL: number;
  standardTempC: number;
}

export function calculateAltitude(params: {
  fieldElevationFt: number;
  altimeterSettingInHg: number;
  oatC: number;
  dewPointC?: number;
}): AltitudeResult {
  const { fieldElevationFt, altimeterSettingInHg, oatC, dewPointC = oatC } = params;

  const pressRatio = Math.pow(altimeterSettingInHg / ISA_SL_P_INHG, ISA_PA_EXP);
  const pressAltOffsetFt = ISA_T0_OVER_L_FT * (1 - pressRatio);
  const pressureAltitudeFt = fieldElevationFt + pressAltOffsetFt;

  const standardTempAtFieldElevC = 15 - (fieldElevationFt / 1000) * 2;

  const paTempRatio = 1 - (ISA_LAPSE_K_PER_FT * pressureAltitudeFt) / ISA_SL_T_K;
  const delta = Math.pow(Math.max(paTempRatio, 0), ISA_G_OVER_LR);
  const oatK = oatC + 273.15;
  const theta = oatK / ISA_SL_T_K;
  const sigma = delta / theta;
  const densityAltitudeFt = sigma > 0
    ? ISA_T0_OVER_L_FT * (1 - Math.pow(sigma, ISA_LR_OVER_GMLR))
    : pressureAltitudeFt;

  const spread = oatC - dewPointC;
  const cloudBaseFtAGL = (spread / 2.5) * 1000;
  const cloudBaseFtMSL = fieldElevationFt + cloudBaseFtAGL;

  return {
    pressureAltitudeFt: Math.round(pressureAltitudeFt),
    densityAltitudeFt: Math.round(densityAltitudeFt),
    cloudBaseFtAGL: Math.round(cloudBaseFtAGL),
    cloudBaseFtMSL: Math.round(cloudBaseFtMSL),
    standardTempC: Math.round(standardTempAtFieldElevC * 10) / 10,
  };
}

export interface StandardAtmosphereResult {
  tempC: number;
  pressureInHg: number;
  densityAltitudeFt: number;
  speedOfSoundKt: number;
}

export function standardAtmosphere(pressureAltitudeFt: number): StandardAtmosphereResult {
  const h = pressureAltitudeFt;
  if (h <= 36089) {
    const tempC = 15 - 0.0019812 * h;
    const pressureRatio = Math.pow((288.15 - 0.0019812 * h) / 288.15, 5.25588);
    const pressureInHg = 29.9213 * pressureRatio;
    const densityRatio = pressureRatio * 288.15 / (288.15 - 0.0019812 * h);
    const densityAltitudeFt = h;
    const speedOfSoundKt = 661.4786 * Math.sqrt((273.15 + tempC) / 288.15);
    return {
      tempC: Math.round(tempC * 10) / 10,
      pressureInHg: Math.round(pressureInHg * 100) / 100,
      densityAltitudeFt: Math.round(densityAltitudeFt),
      speedOfSoundKt: Math.round(speedOfSoundKt * 10) / 10,
    };
  }
  const tempC = -56.5;
  const tropoPressureRatio = Math.pow(0.75187, 5.25588);
  const deltaH = h - 36089;
  const pressureRatio = tropoPressureRatio * Math.exp(-deltaH / 20806);
  const pressureInHg = 29.9213 * pressureRatio;
  const speedOfSoundKt = 573.574;
  return {
    tempC,
    pressureInHg: Math.round(pressureInHg * 100) / 100,
    densityAltitudeFt: Math.round(h + (1 - 1 / (pressureRatio * (273.15 + tempC) / 288.15)) * 0),
    speedOfSoundKt: Math.round(speedOfSoundKt * 10) / 10,
  };
}

export interface AirspeedResult {
  casKt: number;
  tasKt: number;
  mach: number;
  speedOfSoundKt: number;
}

export function calculateAirspeed(params: {
  inputType: 'cas' | 'tas' | 'mach';
  value: number;
  pressureAltitudeFt: number;
  oatC: number;
}): AirspeedResult {
  const { inputType, value, pressureAltitudeFt, oatC } = params;
  const isa = standardAtmosphere(pressureAltitudeFt);
  const sosKt = 661.4786 * Math.sqrt((273.15 + oatC) / 288.15);
  const pRatio = isa.pressureInHg / 29.9213;
  const sigma = pRatio * 288.15 / (273.15 + oatC);
  let casKt = 0, tasKt = 0, mach = 0;

  if (inputType === 'cas') {
    casKt = value;
    tasKt = casKt / Math.sqrt(sigma);
    mach = tasKt / sosKt;
  } else if (inputType === 'tas') {
    tasKt = value;
    casKt = tasKt * Math.sqrt(sigma);
    mach = tasKt / sosKt;
  } else {
    mach = value;
    tasKt = mach * sosKt;
    casKt = tasKt * Math.sqrt(sigma);
  }

  return {
    casKt: Math.round(casKt * 10) / 10,
    tasKt: Math.round(tasKt * 10) / 10,
    mach: Math.round(mach * 1000) / 1000,
    speedOfSoundKt: Math.round(sosKt * 10) / 10,
  };
}

export function tatFromOatAndMach(oatC: number, mach: number, kFactor = 1.0): number {
  const oatK = 273.15 + oatC;
  const gamma = 1.4;
  const ratio = 1 + ((gamma - 1) / 2) * kFactor * mach * mach;
  const tatK = oatK * ratio;
  return tatK - 273.15;
}

export function oatFromTatAndMach(tatC: number, mach: number, kFactor = 1.0): number {
  const tatK = 273.15 + tatC;
  const gamma = 1.4;
  const ratio = 1 + ((gamma - 1) / 2) * kFactor * mach * mach;
  const oatK = tatK / ratio;
  return oatK - 273.15;
}

export interface Airspeed5Result {
  casKt: number;
  tasKt: number;
  mach: number;
  oatC: number;
  tatC: number;
  sosKt: number;
}

export function airspeedPlannedTas(casKt: number, oatC: number, pAltFt: number): Airspeed5Result {
  const r = calculateAirspeed({ inputType: 'cas', value: casKt, pressureAltitudeFt: pAltFt, oatC });
  const tatC = tatFromOatAndMach(oatC, r.mach);
  return {
    casKt: r.casKt, tasKt: r.tasKt, mach: r.mach,
    oatC: Math.round(oatC * 100) / 100,
    tatC: Math.round(tatC * 100) / 100,
    sosKt: r.speedOfSoundKt,
  };
}

export function airspeedRequiredCas(tasKt: number, oatC: number, pAltFt: number): Airspeed5Result {
  const r = calculateAirspeed({ inputType: 'tas', value: tasKt, pressureAltitudeFt: pAltFt, oatC });
  const tatC = tatFromOatAndMach(oatC, r.mach);
  return {
    casKt: r.casKt, tasKt: r.tasKt, mach: r.mach,
    oatC: Math.round(oatC * 100) / 100,
    tatC: Math.round(tatC * 100) / 100,
    sosKt: r.speedOfSoundKt,
  };
}

export function airspeedPlannedMach(mach: number, oatC: number): Airspeed5Result {
  const sosKt = 661.4786 * Math.sqrt((273.15 + oatC) / 288.15);
  const tasKt = mach * sosKt;
  const tatC = tatFromOatAndMach(oatC, mach);
  return {
    casKt: 0, tasKt: Math.round(tasKt * 100) / 100, mach: Math.round(mach * 1000) / 1000,
    oatC: Math.round(oatC * 100) / 100,
    tatC: Math.round(tatC * 100) / 100,
    sosKt: Math.round(sosKt * 10) / 10,
  };
}

export function airspeedActualMach(mach: number, tatC: number): Airspeed5Result {
  const oatC = oatFromTatAndMach(tatC, mach);
  const sosKt = 661.4786 * Math.sqrt((273.15 + oatC) / 288.15);
  const tasKt = mach * sosKt;
  return {
    casKt: 0, tasKt: Math.round(tasKt * 100) / 100, mach: Math.round(mach * 1000) / 1000,
    oatC: Math.round(oatC * 100) / 100,
    tatC: Math.round(tatC * 100) / 100,
    sosKt: Math.round(sosKt * 10) / 10,
  };
}

export function airspeedActualTas(casKt: number, tatC: number, pAltFt: number): Airspeed5Result {
  let oatGuess = tatC;
  for (let i = 0; i < 20; i++) {
    const r = calculateAirspeed({ inputType: 'cas', value: casKt, pressureAltitudeFt: pAltFt, oatC: oatGuess });
    const tatCalc = tatFromOatAndMach(oatGuess, r.mach);
    const err = tatC - tatCalc;
    if (Math.abs(err) < 1e-4) break;
    oatGuess += err;
  }
  const final = calculateAirspeed({ inputType: 'cas', value: casKt, pressureAltitudeFt: pAltFt, oatC: oatGuess });
  const tatFinal = tatFromOatAndMach(oatGuess, final.mach);
  return {
    casKt: final.casKt, tasKt: final.tasKt, mach: final.mach,
    oatC: Math.round(oatGuess * 100) / 100,
    tatC: Math.round(tatFinal * 100) / 100,
    sosKt: final.speedOfSoundKt,
  };
}

export interface WindCorrectionResult {
  trueHeadingDeg: number;
  groundspeedKt: number;
  windCorrectionAngleDeg: number;
  drift: 'L' | 'R';
}

export function windCorrection(params: {
  tasKt: number;
  trueCourseDeg: number;
  windDirectionDeg: number;
  windSpeedKt: number;
}): WindCorrectionResult {
  const { tasKt, trueCourseDeg, windDirectionDeg, windSpeedKt } = params;
  const tc = toRad(trueCourseDeg);
  const wd = toRad(windDirectionDeg);
  const angle = wd - tc;
  const crosswind = windSpeedKt * Math.sin(angle);
  const headwindComponent = windSpeedKt * Math.cos(angle);
  const wca = Math.asin(crosswind / tasKt);
  const thRad = tc + wca;
  const gs = tasKt * Math.cos(wca) - headwindComponent;
  const wcaDeg = toDeg(wca);
  const drift: 'L' | 'R' = wcaDeg <= 0 ? 'L' : 'R';
  return {
    trueHeadingDeg: Math.round(normalizeHeading(toDeg(thRad))),
    groundspeedKt: Math.round(gs),
    windCorrectionAngleDeg: Math.round(wcaDeg * 10) / 10,
    drift,
  };
}

export interface WindComponentsResult {
  headwindKt: number;
  tailwindKt: number;
  crosswindKt: number;
  crosswindSide: 'L' | 'R';
}

export function windComponents(params: {
  runwayHeadingDeg: number;
  windDirectionDeg: number;
  windSpeedKt: number;
}): WindComponentsResult {
  const { runwayHeadingDeg, windDirectionDeg, windSpeedKt } = params;
  const diff = toRad(windDirectionDeg - runwayHeadingDeg);
  const hw = windSpeedKt * Math.cos(diff);
  const xw = windSpeedKt * Math.sin(diff);
  return {
    headwindKt: Math.max(0, Math.round(hw * 10) / 10),
    tailwindKt: Math.max(0, Math.round(-hw * 10) / 10),
    crosswindKt: Math.round(Math.abs(xw) * 10) / 10,
    crosswindSide: xw >= 0 ? 'R' : 'L',
  };
}

export interface FuelResult {
  totalFuelGal: number;
  fuelBurnRateGph: number;
  timeEnrouteH: number;
  timeEnrouteStr: string;
  groundspeedKt: number;
  distanceNm: number;
  enduranceH: number;
  enduranceStr: string;
}

export const FUEL_LB_PER_GAL_DEFAULT = 6.7;
export function galToLb(gal: number, lbPerGal = FUEL_LB_PER_GAL_DEFAULT): number { return gal * lbPerGal; }
export function lbToGal(lb: number, lbPerGal = FUEL_LB_PER_GAL_DEFAULT): number { return lbPerGal > 0 ? lb / lbPerGal : 0; }
export function gphToLbph(gph: number, lbPerGal = FUEL_LB_PER_GAL_DEFAULT): number { return gph * lbPerGal; }
export function lbphToGph(lbph: number, lbPerGal = FUEL_LB_PER_GAL_DEFAULT): number { return lbPerGal > 0 ? lbph / lbPerGal : 0; }

function fmtTime(hours: number): string {
  const sign = hours < 0 ? '-' : '';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

export function calculateFuel(params: {
  mode: 'fuel' | 'endurance' | 'gs' | 'distance' | 'time';
  groundspeedKt?: number;
  distanceNm?: number;
  timeEnrouteH?: number;
  fuelBurnRateGph?: number;
  totalFuelGal?: number;
}): Partial<FuelResult> {
  const result: Partial<FuelResult> = {};

  if (params.groundspeedKt != null) result.groundspeedKt = params.groundspeedKt;
  if (params.distanceNm != null) result.distanceNm = params.distanceNm;
  if (params.timeEnrouteH != null) {
    result.timeEnrouteH = params.timeEnrouteH;
    result.timeEnrouteStr = fmtTime(params.timeEnrouteH);
  }
  if (params.fuelBurnRateGph != null) result.fuelBurnRateGph = params.fuelBurnRateGph;
  if (params.totalFuelGal != null) result.totalFuelGal = params.totalFuelGal;

  if (result.groundspeedKt && result.distanceNm && result.timeEnrouteH == null) {
    result.timeEnrouteH = result.distanceNm / result.groundspeedKt;
    result.timeEnrouteStr = fmtTime(result.timeEnrouteH);
  }
  if (result.distanceNm && result.timeEnrouteH && result.groundspeedKt == null) {
    result.groundspeedKt = Math.round(result.distanceNm / result.timeEnrouteH * 10) / 10;
  }
  if (result.groundspeedKt && result.timeEnrouteH && result.distanceNm == null) {
    result.distanceNm = Math.round(result.groundspeedKt * result.timeEnrouteH * 10) / 10;
  }
  if (result.fuelBurnRateGph && result.timeEnrouteH && result.totalFuelGal == null) {
    result.totalFuelGal = Math.round(result.fuelBurnRateGph * result.timeEnrouteH * 10) / 10;
  }
  if (result.totalFuelGal && result.timeEnrouteH && result.fuelBurnRateGph == null) {
    result.fuelBurnRateGph = Math.round(result.totalFuelGal / result.timeEnrouteH * 10) / 10;
  }
  if (result.totalFuelGal && result.fuelBurnRateGph) {
    result.enduranceH = result.totalFuelGal / result.fuelBurnRateGph;
    result.enduranceStr = fmtTime(result.enduranceH);
  }
  return result;
}

export function glideDistance(params: {
  glideRatio: number;
  altitudeLossFt: number;
}): { distanceFt: number; distanceNm: number; glideAngleDeg: number } {
  const { glideRatio, altitudeLossFt } = params;
  const distanceFt = glideRatio * altitudeLossFt;
  const distanceNm = convertUnits(distanceFt, 'ft', 'nm');
  const glideAngleDeg = Math.atan(1 / glideRatio) * 180 / Math.PI;
  return {
    distanceFt: Math.round(distanceFt),
    distanceNm: Math.round(distanceNm * 100) / 100,
    glideAngleDeg: Math.round(glideAngleDeg * 10) / 10,
  };
}

export function climbDescent(params: {
  rateFpm: number;
  altitudeChangeFt: number;
  tasKt: number;
  fuelBurnRateGph?: number;
}): { timeMin: number; timeStr: string; distanceNm: number; fuelGal?: number } {
  const { rateFpm, altitudeChangeFt, tasKt, fuelBurnRateGph } = params;
  const timeMin = rateFpm > 0 ? altitudeChangeFt / rateFpm : 0;
  const timeH = timeMin / 60;
  const distanceNm = Math.round(tasKt * timeH * 10) / 10;
  const fuelGal = fuelBurnRateGph != null ? Math.round(fuelBurnRateGph * timeH * 10) / 10 : undefined;
  return {
    timeMin: Math.round(timeMin),
    timeStr: `${Math.floor(timeMin / 60)}:${String(timeMin % 60).padStart(2, '0')}`,
    distanceNm,
    fuelGal,
  };
}

export function etaCalc(params: {
  departureTimeMin: number;
  timeEnrouteMin: number;
}): { etaMin: number; etaStr: string } {
  const etaMin = (params.departureTimeMin + params.timeEnrouteMin) % 1440;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return {
    etaMin,
    etaStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}

export type HoldingEntry = 'Direct' | 'Parallel' | 'Teardrop' | 'No-Wind (Sector)';

export function holdingEntry(params: {
  inboundCourseDeg: number;
  headingToFixDeg: number;
}): HoldingEntry {
  const ic = normalizeHeading(params.inboundCourseDeg);
  const rec = normalizeHeading(ic + 180);
  const hdg = normalizeHeading(params.headingToFixDeg);
  let diff = hdg - rec;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  if (diff >= -70 && diff <= 110) return 'Teardrop';
  if (diff <= -110 || (diff >= 170 && diff <= 180) || (diff >= -180 && diff <= -170)) return 'Parallel';
  return 'Direct';
}

export function weightShift(params: {
  totalWeightLb: number;
  shiftedWeightLb: number;
  shiftDistanceIn: number;
  fromArmIn: number;
  toArmIn: number;
}): { cgChangeIn: number; newCgIn: number | null; initialCgIn?: number; initialMoment?: number } {
  const shiftDir = params.toArmIn - params.fromArmIn;
  const signedDistance = shiftDir >= 0 ? params.shiftDistanceIn : -params.shiftDistanceIn;
  const cgChangeIn = (params.shiftedWeightLb * signedDistance) / params.totalWeightLb;
  return {
    cgChangeIn: Math.round(cgChangeIn * 1000) / 1000,
    newCgIn: null,
  };
}

export function percentMac(params: {
  cgIn: number;
  lemacIn: number;
  macLengthIn: number;
}): number {
  if (params.macLengthIn <= 0) return 0;
  return Math.round((((params.cgIn - params.lemacIn) / params.macLengthIn) * 100) * 10) / 10;
}

export interface CompassHeadingResult {
  trueHeadingDeg: number;
  magneticHeadingDeg: number;
  compassHeadingDeg: number;
  variationDeg: number;
  deviationDeg: number;
}

export function compassHeading(params: {
  mode: 'TH_TO_CH' | 'CH_TO_TH';
  trueHeadingDeg?: number;
  magneticHeadingDeg?: number;
  compassHeadingDeg?: number;
  variationDeg: number;
  deviationDeg: number;
}): CompassHeadingResult {
  const { mode, variationDeg: v, deviationDeg: d } = params;
  let th = params.trueHeadingDeg ?? NaN;
  let mh = params.magneticHeadingDeg ?? NaN;
  let ch = params.compassHeadingDeg ?? NaN;
  if (mode === 'TH_TO_CH') {
    if (!isFinite(th)) th = NaN;
    mh = normalizeHeading(th - v);
    ch = normalizeHeading(mh - d);
  } else {
    if (!isFinite(ch)) ch = NaN;
    mh = normalizeHeading(ch + d);
    th = normalizeHeading(mh + v);
  }
  return {
    trueHeadingDeg: isFinite(th) ? Math.round(th) : NaN,
    magneticHeadingDeg: isFinite(mh) ? Math.round(mh) : NaN,
    compassHeadingDeg: isFinite(ch) ? Math.round(ch) : NaN,
    variationDeg: v,
    deviationDeg: d,
  };
}

export type VorToFrom = 'TO' | 'FROM' | 'ABEA';

export function vorToFrom(params: {
  vorRadialDeg: number;
  courseDeg: number;
}): { status: VorToFrom; interceptDeg: number } {
  const rad = normalizeHeading(params.vorRadialDeg);
  const crs = normalizeHeading(params.courseDeg);
  const recRad = normalizeHeading(rad + 180);
  let diff = crs - recRad;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  const absDiff = Math.abs(diff);
  let status: VorToFrom;
  if (absDiff <= 70 || absDiff >= 110) {
    if (Math.abs(normalizeHeading(crs - rad) - 180) > 90) {
      status = 'FROM';
    } else {
      status = 'TO';
    }
  } else {
    status = 'ABEA';
  }
  const radialDiff = Math.abs(normalizeHeading(crs - rad));
  const toDiff = Math.abs(normalizeHeading(crs - recRad));
  const intercept = Math.min(radialDiff, toDiff) <= 90
    ? Math.round(Math.min(radialDiff, toDiff))
    : Math.round(180 - Math.min(radialDiff, toDiff));
  return { status, interceptDeg: intercept };
}

export interface RhumbLineResult {
  distanceNm: number;
  trackAngleDeg: number;
}

export function rhumbLine(params: {
  lat1Deg: number; lon1Deg: number;
  lat2Deg: number; lon2Deg: number;
}): RhumbLineResult {
  const { lat1Deg: la1, lon1Deg: lo1, lat2Deg: la2, lon2Deg: lo2 } = params;
  const lat1 = toRad(la1), lat2 = toRad(la2);
  let dLon = toRad(lo2 - lo1);
  if (dLon > Math.PI) dLon -= 2 * Math.PI;
  if (dLon < -Math.PI) dLon += 2 * Math.PI;
  const dLat = lat2 - lat1;
  const dLatMin = (la2 - la1) * 60;
  const dLonMin = (lo2 - lo1) * 60;
  const avgLat = (lat1 + lat2) / 2;
  const dep = dLonMin * Math.cos(avgLat);
  const dist = Math.sqrt(dLatMin * dLatMin + dep * dep);
  let tc = Math.atan2(dep, dLatMin);
  if (tc < 0) tc += 2 * Math.PI;
  const tcDeg = toDeg(tc);
  return {
    distanceNm: Math.round(dist * 10) / 10,
    trackAngleDeg: Math.round(tcDeg),
  };
}

export interface SegmentCalcResult {
  trueHeadingDeg: number;
  groundspeedKt: number;
  windCorrectionAngleDeg: number;
  drift: 'L' | 'R';
  timeEnrouteH: number;
  timeEnrouteMin: number;
  timeEnrouteStr: string;
  fuelGal: number;
}

export function calculateSegment(seg: FlightSegment): SegmentCalcResult {
  const wc = windCorrection({
    tasKt: seg.tasKt,
    trueCourseDeg: seg.trueCourseDeg,
    windDirectionDeg: seg.windDirectionDeg,
    windSpeedKt: seg.windSpeedKt,
  });
  const gs = Math.max(1, wc.groundspeedKt);
  const timeH = seg.distanceNm / gs;
  const timeMin = timeH * 60;
  const fuel = seg.fuelBurnRateGph * timeH;
  return {
    trueHeadingDeg: wc.trueHeadingDeg,
    groundspeedKt: wc.groundspeedKt,
    windCorrectionAngleDeg: wc.windCorrectionAngleDeg,
    drift: wc.drift,
    timeEnrouteH: Math.round(timeH * 10000) / 10000,
    timeEnrouteMin: Math.round(timeMin * 10) / 10,
    timeEnrouteStr: fmtTime(timeH),
    fuelGal: Math.round(fuel * 10) / 10,
  };
}

export interface FlightPlanTotals {
  totalDistanceNm: number;
  totalTimeH: number;
  totalTimeMin: number;
  totalTimeStr: string;
  totalFuelGal: number;
  avgGroundspeedKt: number;
}

export function aggregateFlightPlan(segments: FlightSegment[]): FlightPlanTotals {
  let totalDist = 0;
  let totalTimeH = 0;
  let totalFuel = 0;
  for (const s of segments) {
    const r = calculateSegment(s);
    totalDist += s.distanceNm;
    totalTimeH += r.timeEnrouteH;
    totalFuel += r.fuelGal;
  }
  const avgGs = totalTimeH > 0 ? totalDist / totalTimeH : 0;
  return {
    totalDistanceNm: Math.round(totalDist * 10) / 10,
    totalTimeH: Math.round(totalTimeH * 10000) / 10000,
    totalTimeMin: Math.round(totalTimeH * 60 * 10) / 10,
    totalTimeStr: fmtTime(totalTimeH),
    totalFuelGal: Math.round(totalFuel * 10) / 10,
    avgGroundspeedKt: Math.round(avgGs * 10) / 10,
  };
}

/* ===== 14 FLT NEW functions (7종 추가: Density Alt, Pres Alt, TOD, RoD Mach, Reserve Fuel, Fuel Uplift, Cold Temp Corr) ===== */

export function calcPressureAltitude(fieldElevationFt: number, altimeterSettingInHg: number): number {
  const pressRatio = Math.pow(Math.max(altimeterSettingInHg, 0.1) / ISA_SL_P_INHG, ISA_PA_EXP);
  return Math.round(fieldElevationFt + ISA_T0_OVER_L_FT * (1 - pressRatio));
}

export function calcDensityAltitude(pressureAltitudeFt: number, oatC: number): number {
  const paTempRatio = 1 - (ISA_LAPSE_K_PER_FT * pressureAltitudeFt) / ISA_SL_T_K;
  const delta = Math.pow(Math.max(paTempRatio, 0), ISA_G_OVER_LR);
  const oatK = oatC + 273.15;
  const theta = oatK / ISA_SL_T_K;
  const sigma = delta / theta;
  const densityAltitudeFt = sigma > 0
    ? ISA_T0_OVER_L_FT * (1 - Math.pow(sigma, ISA_LR_OVER_GMLR))
    : pressureAltitudeFt;
  return Math.round(densityAltitudeFt);
}

/* Top of Descent (TOD): 고도변화 ft ÷ gradient(ft/NM) → NM 전.
   Standard gradient 318 ft/NM = 3.0° path angle (tan(3°) × 6076.12). 기장님 통상 3° 사용. */
export function calcTopOfDescent(altitudeFt: number, targetAltitudeFt: number, groundspeedKt: number, pathAngleDeg = 3.0) {
  const ftPerNm = Math.tan(toRad(pathAngleDeg)) * 6076.12;
  const deltaAltFt = Math.max(altitudeFt - targetAltitudeFt, 0);
  const distanceNm = ftPerNm > 0 ? deltaAltFt / ftPerNm : 0;
  const timeMin = groundspeedKt > 0 ? (distanceNm / groundspeedKt) * 60 : 0;
  const requiredFpm = groundspeedKt > 0 ? (deltaAltFt / (distanceNm / groundspeedKt)) / 60 : 0;
  return {
    distanceNm: Math.round(distanceNm * 10) / 10,
    timeMin: Math.round(timeMin),
    timeStr: `${Math.floor(timeMin / 60)}:${String(timeMin % 60).padStart(2, '0')}`,
    requiredRateFpm: Math.round(requiredFpm),
    feetPerNm: Math.round(ftPerNm),
  };
}

/* Rate of Descent from Mach number.
   SI 단위 기반: SoS m/s = sqrt(γ·R·T_K). γ=1.4, R_air=287 J/kg·K.
   RoD (fpm) = TAS_ft/s × sin(γ_path) × 60. Standard 3° γ. */
export function calcRateOfDescentMach(mach: number, pathAngleDeg = 3.0, oatC = 15) {
  const tempK = 273.15 + oatC;
  const sosMs = Math.sqrt(1.4 * 287 * tempK);          // m/s
  const sosKt = sosMs * 1.94384;                        // 1 m/s = 1.94384 kt
  const tasKt = mach * sosKt;
  const tasFtS = tasKt * 1.68781;                       // 1 kt = 1.68781 ft/s
  const rodFpm = tasFtS * Math.sin(toRad(pathAngleDeg)) * 60;
  const ftPerNm = Math.tan(toRad(pathAngleDeg)) * 6076.12;  // 동일 gradient, TOD와 단위 일치
  return {
    rodFpm: Math.round(rodFpm),
    tasKt: Math.round(tasKt * 10) / 10,
    speedOfSoundKt: Math.round(sosKt * 10) / 10,
    ftPerNm: Math.round(ftPerNm),
  };
}

export function calcReserveFuel(requiredFuelGal: number, reservePercent = 15, alternateFuelGal = 0, holdingFuelGal = 0) {
  const contingency = requiredFuelGal * (reservePercent / 100);
  const reserveGal = contingency + alternateFuelGal + holdingFuelGal;
  return {
    contingencyGal: Math.round(contingency * 10) / 10,
    alternateGal: Math.round(alternateFuelGal * 10) / 10,
    holdingGal: Math.round(holdingFuelGal * 10) / 10,
    reserveGal: Math.round(reserveGal * 10) / 10,
    totalRequiredGal: Math.round((requiredFuelGal + reserveGal) * 10) / 10,
  };
}

export function calcFuelUplift(totalRequiredGal: number, currentFuelGal: number, fuelDensityLbGal = 6.7) {
  const upliftGal = Math.max(totalRequiredGal - currentFuelGal, 0);
  return {
    upliftGal: Math.round(upliftGal * 10) / 10,
    upliftLb: Math.round(upliftGal * fuelDensityLbGal * 10) / 10,
    totalOnboardGal: Math.round((currentFuelGal + upliftGal) * 10) / 10,
    totalOnboardLb: Math.round((currentFuelGal + upliftGal) * fuelDensityLbGal * 10) / 10,
  };
}

/* ICAO Cold Temperature Correction.
   Correction (ft) = ISA standard temp at elevation (°C) - Actual OAT (°C) × 0.0012 × corrected height
   Simplified FAA formula: Corr Ft = ΔISA°C × 1.68 × H(ft) / 1000,  ΔISA = (ISA_at_elev_C) - (actual_OAT_C) */
export function calcColdTempCorrection(indicatedAltitudeFt: number, fieldElevationFt: number, oatC: number) {
  const isaStdAtElevC = 15 - (fieldElevationFt / 1000) * 1.9812;
  const deltaIsaC = Math.max(isaStdAtElevC - oatC, 0);  // cold correction only applies if OAT < ISA
  const heightAboveAirportFt = Math.max(indicatedAltitudeFt - fieldElevationFt, 0);
  const correctionFt = deltaIsaC * 1.68 * (heightAboveAirportFt / 1000);
  return {
    isaStdAtElevC: Math.round(isaStdAtElevC * 10) / 10,
    deltaIsaC: Math.round(deltaIsaC * 10) / 10,
    heightAboveAerodromeFt: Math.round(heightAboveAirportFt),
    correctionFt: Math.round(correctionFt),
    correctedAltitudeFt: Math.round(indicatedAltitudeFt + correctionFt),
  };
}
