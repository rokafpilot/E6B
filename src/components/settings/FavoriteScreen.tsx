import React from 'react';
import Cx3Line from '../common/Cx3Line';
import { useCx3Nav, useCx3OnEnter, useCx3Router } from '../../context/Cx3RouterContext';
import { useOnCx3Key, type Cx3KeyId } from '../../context/Cx3KeypadContext';
import { useCx3Settings } from '../../context/Cx3SettingsContext';

export default function FavoriteScreen() {
  const { data, setFavorite } = useCx3Settings();
  const { cursor, dispatch } = useCx3Nav(2);
  const { replaceTop, top } = useCx3Router();
  const currentSub = top.root === 'FLT' && top.subId !== 'FLT_MAIN' ? top.subId : data.favorite;

  useOnCx3Key((k: Cx3KeyId) => {
    if (k === 'BACK') { replaceTop('SET_MAIN', 'SET'); return 'stop'; }
    if (k === 'UP') { dispatch({ type: 'NAV', delta: -1 }); return 'stop'; }
    if (k === 'DN') { dispatch({ type: 'NAV', delta: 1 }); return 'stop'; }
    return undefined;
  }, [dispatch, replaceTop], 12);

  useCx3OnEnter(() => {
    if (cursor === 0 && currentSub) setFavorite(currentSub);
    if (cursor === 1) setFavorite(null);
  });

  return (
    <div className="cx3-lcd-menu">
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 0 })}>
        <Cx3Line label={`Save: ${currentSub ?? 'pick screen'}`}
          state={currentSub ? 'input' : 'unsolved'}
          cursor={cursor === 0}
          valueClass={data.favorite === currentSub ? 'green' : 'default'}
          valueDisplay={data.favorite === currentSub ? '●' : ''} />
      </div>
      <div onClick={() => dispatch({ type: 'SET_CURSOR', idx: 1 })}>
        <Cx3Line label={`Clear Favorite`}
          state={!data.favorite ? 'calc' : 'unsolved'}
          cursor={cursor === 1}
          valueClass={!data.favorite ? 'green' : 'dashes'}
          valueDisplay={!data.favorite ? '●' : ''} />
      </div>
    </div>
  );
}
