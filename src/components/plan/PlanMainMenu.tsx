import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav } from '../../context/Cx3RouterContext';

export default function PlanMainMenu() {
  const items = ['Total Trip', 'Leg 1', 'Leg 2', 'Leg 3', '[ + Add Leg ]'];
  const { cursor } = useCx3Nav(items.length);
  return (
    <div className="cx3-lcd-menu">
      {items.map((t, i) => (
        <Cx3Line key={t} label={t} cursor={cursor === i} state={i === 0 ? 'calc' : i < 4 ? 'input' : 'unsolved'}
          valueDisplay={i === 0 ? '' : i < 4 ? '' : ''} />
      ))}
    </div>
  );
}
