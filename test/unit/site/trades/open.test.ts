import { describe, expect, it } from 'vitest';
import { locateTradeComposer } from '@/site/trades';

// Extraits du code du site (02/10/2026), raccourcis.
const COMPOSER =
  'e.s(["default",0,function({friendUsername:e,friendProfileId:t,preselectedFriendCard:l,preselectedFriendCards:d,' +
  'parentTradeId:u,preselectedMyCards:x=ee,preselectedMyWikibidous:m=0,preselectedFriendWikibidous:v=0,onClose:w,onSent:k}){let S=1}])';
const CARD_MODAL =
  'function M({card:r,onClose:l,onListed:s,userCardId:n}){let[o,i]=(0,a.useState)(null);return((0,a.useEffect)(()=>{e.A(422455).then(e=>{i(()=>e.default)})},[]),o)}' +
  'function $({friendUsername:r,friendProfileId:l,preselectedFriendCard:s,onClose:n}){let[o,i]=(0,a.useState)(null);' +
  'return((0,a.useEffect)(()=>{e.A(799047).then(e=>{i(()=>e.default)})},[]),o)?(0,t.jsx)(o,{friendUsername:r,friendProfileId:l})}';
// Page Amis : le composant importé, rendu en JSX (pas une définition).
const FRIENDS_PAGE = 'k&&(0,t.jsx)(j.default,{friendUsername:a,friendProfileId:e,onClose:()=>C(!1),onSent:()=>C(!1)})';
// Contre-offre de /trades : mêmes props passées, dont `parentTradeId`.
const COUNTER_OFFER =
  '(0,t.jsx)(f.default,{friendUsername:n,friendProfileId:i,parentTradeId:o.id,preselectedMyCards:c,onClose:()=>d(null),onSent:()=>{d(null),h()}})';

describe('locateTradeComposer', () => {
  it('le module du composant s’il est inscrit', () => {
    expect(locateTradeComposer([[1, CARD_MODAL], [273271, COMPOSER]])).toEqual({ module: 273271 });
  });

  it('sinon le chargeur de l’enveloppe « Proposer un échange » de la modale de carte, pas celui de sa mise en vente', () => {
    expect(locateTradeComposer([[5, 'rien'], [7, CARD_MODAL]])).toEqual({ loader: 799047 });
  });

  it('le composant utilisé ailleurs (page Amis, contre-offre) n’est ni l’un ni l’autre', () => {
    expect(locateTradeComposer([[2, FRIENDS_PAGE], [3, COUNTER_OFFER]])).toBeUndefined();
  });
});
