import { describe, expect, it } from 'vitest';
import { locateCardModal } from '@/site/cards';

// Début du composant du site (code du 03/10/2026), raccourci.
const MODAL =
  '515678,e=>{"use strict";function M({card:r,onClose:l,onListed:s,userCardId:n}){}' +
  'e.s(["default",0,function({card:r,starred:u,count:m,onClose:R,onToggleStar:I,userCardId:E,tags:A=[],tagsCatalog:T,' +
  'tagsReadOnly:L,onTagsChange:P,friendUsername:F,friendProfileId:W,friendOfferPending:q,ownOfferPending:D,onCollectionChange:O}){}])}';

describe('modale de carte du site parmi les modules de la page', () => {
  it('reconnue à ses paramètres', () => {
    expect(locateCardModal([[1, 'function x(){}'], [515678, MODAL]])).toEqual({ module: 515678 });
  });

  it('pas l’enveloppe de la mise aux enchères, ni un module sans elle', () => {
    expect(locateCardModal([[2, 'function M({card:r,onClose:l,onListed:s,userCardId:n}){}']])).toBeUndefined();
    expect(locateCardModal([[3, MODAL.replace('onCollectionChange:O', 'autre:O')]])).toBeUndefined();
  });
});
