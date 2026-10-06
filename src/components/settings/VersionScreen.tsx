import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';

export default function VersionScreen() {
  const { replaceTop } = useCx3Router();
  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    return undefined;
  }, [replaceTop], 12);

  return (
    <div className="cx3-lcd-menu">
      <Cx3Line label={'Product'} state={'unsolved'} valueClass={'green'} valueDisplay={'FlightCal'} />
      <Cx3Line label={'Edition'} state={'unsolved'} valueClass={'green'} valueDisplay={'CX-3 Style E6B + HOT'} />
      <Cx3Line label={'Version'} state={'unsolved'} valueClass={'default'} valueDisplay={'1.0.0'} />
      <Cx3Line label={'Build'} state={'unsolved'} valueClass={'default'} valueDisplay={'2026.09.09'} />
      <Cx3Line label={'© FlightCal'} state={'unsolved'} valueClass={'dashes'} />
    </div>
  );
}
