import React from 'react';
import { useCx3Router } from '../../context/Cx3RouterContext';
import FltMainMenu from '../flt/FltMainMenu';
import ConvMainMenu from '../conv/ConvMainMenu';
import UnitConvModeScreen from '../conv/UnitConvModeScreen';
import TimeZoneScreen from '../conv/TimeZoneScreen';
import MachTasConvScreen from '../conv/MachTasConvScreen';
import CurrencyConverterScreen from '../curr/CurrencyConverterScreen';
import CalcMainMenu from '../calc/CalcMainMenu';
import StandardCalcScreen from '../calc/StandardCalcScreen';
import TimeCalcScreen from '../calc/TimeCalcScreen';
import HOTCalculatorScreen from '../hot/HOTCalculatorScreen';
import HoldoverTimerScreen from '../hot/HoldoverTimerScreen';
import WxScreen from '../wx/WxScreen';
import DutyTimeCalculatorScreen from '../duty/DutyTimeCalculatorScreen';
import AirspeedScreen from '../flt/AirspeedScreen';
import FuelScreen from '../flt/FuelScreen';
import GroundSpeedScreen from '../flt/GroundSpeedScreen';
import ClimbDescScreen from '../flt/ClimbDescScreen';
import WindCompScreen from '../flt/WindCompScreen';
import TimeScreen from '../flt/TimeScreen';
import PresAltScreen from '../flt/PresAltScreen';
import DensityAltScreen from '../flt/DensityAltScreen';
import TODScreen from '../flt/TODScreen';
import RoDMachScreen from '../flt/RoDMachScreen';
import ReserveFuelScreen from '../flt/ReserveFuelScreen';
import FuelUpliftScreen from '../flt/FuelUpliftScreen';
import ColdTempScreen from '../flt/ColdTempScreen';
import StopwatchScreen from '../timer/StopwatchScreen';
import DictScreen from '../dict/DictScreen';
import Cx3Line from '../common/Cx3Line';

const ROOT_LABELS: Record<string, string> = {
  FLT: 'E6-B',
  CONV: 'CONV',
  CURR: 'CURR',
  CALC: 'CALC',
  HOT: 'HOT',
  DUTY: 'DUTY',
  WX: 'WX',
  DICT: 'DICT',
  TIMER: 'STOP WATCH',
};

export function rootLabelFor(root: string, fallback = 'E6-B'): string {
  return ROOT_LABELS[root] ?? fallback;
}

export default function Cx3Screen() {
  const { state, top } = useCx3Router();
  const key = `${top.root}|${top.subId}`;
  let body: React.ReactNode = null;

  if (top.root === 'FLT') {
    if (top.subId === 'FLT_MAIN') body = <FltMainMenu />;
    else if (top.subId === 'DENSALT') body = <DensityAltScreen />;
    else if (top.subId === 'DIST') body = <GroundSpeedScreen />;
    else if (top.subId === 'ENDUR' || top.subId === 'FUELCON' || top.subId.startsWith('FUEL__') || top.subId === 'FUEL') body = <FuelScreen />;
    else if (top.subId === 'PRESALT') body = <PresAltScreen />;
    else if (top.subId === 'ROD' || top.subId.startsWith('CLIMBDESC__')) body = <ClimbDescScreen />;
    else if (top.subId === 'RODMACH') body = <RoDMachScreen />;
    else if (top.subId === 'RESFUEL') body = <ReserveFuelScreen />;
    else if (top.subId === 'SPEED' || top.subId.startsWith('SPEED__') || top.subId.startsWith('AIRSPEED__')) body = <AirspeedScreen />;
    else if (top.subId === 'TIME') body = <TimeScreen />;
    else if (top.subId === 'TOD') body = <TODScreen />;
    else if (top.subId === 'WINDCOMP') body = <WindCompScreen />;
    else if (top.subId === 'FUELUPLIFT') body = <FuelUpliftScreen />;
    else if (top.subId === 'COLDTEMP') body = <ColdTempScreen />;
    else body = <PlaceholderLines title={top.title ?? top.subId} rootLabel="E6-B" />;
  } else if (top.root === 'CONV') {
    if (top.subId === 'CONV_MAIN') body = <ConvMainMenu />;
    else if (top.subId === 'SPEED' || top.subId === 'LENGTH' || top.subId === 'WEIGHT' ||
             top.subId === 'TEMP'  || top.subId === 'VOLUME' || top.subId === 'PRESSURE' ||
             top.subId === 'ANGLE' || top.subId === 'FUELFLOW' || top.subId === 'DENSITY') body = <UnitConvModeScreen />;
    else if (top.subId === 'MACHTAS') body = <MachTasConvScreen />;
    else if (top.subId === 'TZONE') body = <TimeZoneScreen />;
    else body = <ConvMainMenu />;
  } else if (top.root === 'CURR') {
    body = <CurrencyConverterScreen />;
  } else if (top.root === 'CALC' || top.root === 'DICT') {
    if (top.root === 'DICT') {
      body = <DictScreen />;
    } else {
      if (top.subId === 'CALC_MAIN') body = <CalcMainMenu />;
      else if (top.subId === 'STANDARD') body = <StandardCalcScreen mode="STANDARD" />;
      else if (top.subId === 'SCIENTIFIC') body = <StandardCalcScreen mode="SCIENTIFIC" />;
      else if (top.subId === 'TIME') body = <TimeCalcScreen />;
      else body = <CalcMainMenu />;
    }
  } else if (top.root === 'HOT') {
    if (top.subId === 'HOT_TIMER') body = <HoldoverTimerScreen />;
    else body = <HOTCalculatorScreen />;
  } else if (top.root === 'DUTY') {
    body = <DutyTimeCalculatorScreen />;
  } else if (top.root === 'WX') {
    body = <WxScreen />;
  } else if (top.root === 'TIMER') {
    body = <StopwatchScreen key={top.subId} initialMode={top.subId === 'COUNTDOWN' ? 'COUNTDOWN' : 'STOPWATCH'} />;
  } else {
    body = <FltMainMenu />;
  }

  void state;
  void key;
  return body ?? <FltMainMenu />;
}

function PlaceholderLines({ title, rootLabel = '' }: { title: string; rootLabel?: string }) {
  return (
    <div className="cx3-lcd-menu">
      <Cx3Line label={title} state="input" cursor valueDisplay="" />
      <Cx3Line label={`-- ${rootLabel} under construction`} state="unsolved" />
      <Cx3Line label="Input 1" state="unsolved" />
      <Cx3Line label="Input 2" state="unsolved" />
      <Cx3Line label="Output"  state="calc" valueDisplay="--" />
    </div>
  );
}
