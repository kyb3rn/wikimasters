import { describe, expect, it } from 'vitest';
import { locateChatWindow } from '@/site/dms';

// Extraits du code du site (03/10/2026), raccourcis : pages qui rendent la conversation, importée par `X=e.i(<id>)`.
const DMS_PAGE =
  'e=>{"use strict";var t=e.i(843476),a=e.i(500932),r=e.i(102594),s=e.i(271645),l=e.i(284911),c=e.i(55084);' +
  'e.s(["default",0,function(){let j=$&&T&&(0,t.jsx)(l.default,{peer:$,currentUserId:T,onClose:U});return j}])}';
const FRIENDS_PAGE =
  'e=>{"use strict";var t=e.i(843476),g=e.i(284911),j=e.i(273271);function x(){return[N&&S&&(0,t.jsx)(g.default,' +
  '{peer:{id:e,username:a,avatar_url:n??null,avatar_pos_x:i,avatar_pos_y:o},currentUserId:S,onClose:()=>w(!1)}),' +
  'k&&(0,t.jsx)(j.default,{friendUsername:a,friendProfileId:e,onClose:()=>C(!1),onSent:()=>C(!1)})]}}';
// Fenêtre d'ajout d'ami de la page Amis : mêmes noms de props, pas la conversation.
const SEARCH = 'function k({onClose:e,onRequestSent:r,friendships:n,currentUserId:i}){let[o,l]=(0,s.useState)("")}';
const PEER_ALIAS = 'e=>{var $=e.i(284911);function f(){return(0,t.jsx)($.default,{peer:p,currentUserId:u,onClose:c})}}';

describe('locateChatWindow', () => {
  it('le module importé par une page qui rend la conversation (/dms, Amis)', () => {
    expect(locateChatWindow([[1, SEARCH], [469075, DMS_PAGE]])).toEqual({ module: 284911 });
    expect(locateChatWindow([[434129, FRIENDS_PAGE]])).toEqual({ module: 284911 });
  });

  it('import au nom d’un caractère spécial ($)', () => {
    expect(locateChatWindow([[2, PEER_ALIAS]])).toEqual({ module: 284911 });
  });

  it('aucune page qui la rend : rien', () => {
    expect(locateChatWindow([[1, SEARCH], [2, 'rien']])).toBeUndefined();
  });
});
