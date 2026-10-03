import type { Route } from '@playwright/test';
import { FAKE_JWT, SUPABASE } from './site';

/**
 * Modules du site imités d'après Turbopack (code du 03/10/2026), pour le script d'un faux site : registre
 * `TURBOPACK` (`[chemin, id, fabrique, …]` inscrit sans remplacer, `[chemin, { runtimeModuleIds }]` lance après une
 * tâche), contexte des modules (`i`, `A`, `M`, `c`), React (1) et react-dom/client (2) instanciés. Une racine rendue
 * déroule les fournisseurs de contexte (valeurs dans `window.shownContexts`), appelle le composant, qui rend un élément
 * du DOM, et le pose dans `body` (un nouveau rendu remplace le précédent) ; `unmount` le retire (`window.shownUnmounts`
 * les compte). `factories`, `instantiate`
 * et `createElement` restent à la portée du script qui suit.
 */
export const SITE_MODULES = `
const factories = new Map();
const cache = {};
const proto = { M: factories, c: cache, i: (id) => instantiate(id).exports, A(id) { return instantiate(id).exports(this.i); } };
function instantiate(id) {
  const key = String(id);
  if (cache[key]) return cache[key];
  const module = { exports: {} };
  cache[key] = module;
  factories.get(id)(Object.create(proto), module, module.exports);
  return module;
}
window.TURBOPACK = {
  push(chunk) {
    if (chunk.length === 2) return void Promise.resolve().then(() => chunk[1].runtimeModuleIds.forEach(instantiate));
    for (let i = 1; i < chunk.length; i += 2) if (!factories.has(chunk[i])) factories.set(chunk[i], chunk[i + 1]);
  },
};
const createElement = (type, props, child) => ({ type, props: { ...props, children: child } });
factories.set(1, (e, m) => { m.exports = { createElement, createContext() {}, useState() {} }; });
factories.set(2, (e, m) => {
  m.exports = {
    hydrateRoot() {},
    createRoot() {
      let shown;
      return {
        render(element) {
          window.shownContexts = [];
          while (typeof element.type !== 'function') {
            window.shownContexts.push(element.props.value);
            element = element.props.children;
          }
          const next = element.type(element.props);
          if (shown?.isConnected) shown.replaceWith(next);
          else document.body.append(next);
          shown = next;
        },
        unmount() { shown?.remove(); window.shownUnmounts = (window.shownUnmounts ?? 0) + 1; },
      };
    },
  };
});
instantiate(1);
instantiate(2);`;

/**
 * Routeur de Next.js imité, fourni par un contexte au-dessus de `<main>`. `prefetch(page, options)` est noté dans
 * `window.prefetched` et pose, comme React lisant la réponse d'un préchargement complet, les morceaux de code
 * `window.prefetchChunks` dans `<head>` (`serveChunk` les sert). Et une requête à Supabase, d'où le script tire le
 * joueur connecté (u0).
 */
export const SITE_ROUTER = `
window.prefetched = [];
window.prefetchChunks = [];
const router = {
  push() {},
  replace() {},
  prefetch(href, options) {
    window.prefetched.push([href, options]);
    for (const name of window.prefetchChunks) {
      const script = document.createElement('script');
      script.src = '/_next/static/chunks/' + name + '.js?dpl=test';
      document.head.append(script);
    }
  },
};
document.querySelector('main')['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: { value: router, children: null }, return: null } };
fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', { headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' } });`;

/** Morceaux de la page Amis (code du 03/10/2026, raccourci), qui importe la conversation et la fenêtre d'échange. */
export const FRIENDS_CHUNKS: Readonly<Record<string, string>> = {
  // La page : la conversation (284911) rendue avec `{ peer, currentUserId, onClose }`.
  amis: `TURBOPACK.push(['static/chunks/amis.js', 434129, function (e) {
    var t=e.i(1),g=e.i(284911),j=e.i(273271);
    function x(){return N&&S&&(0,t.jsx)(g.default,{peer:{id:e,username:a,avatar_url:n??null},currentUserId:S,onClose:()=>w(!1)})}
  }]);`,
  // La conversation (#chat-window, « Fermer » appelle `onClose`).
  conversation: `TURBOPACK.push(['static/chunks/conversation.js', 284911, (e, m, exports) => {
    exports.default = (props) => {
      window.chatProps = { peer: props.peer, currentUserId: props.currentUserId };
      const root = document.createElement('div');
      root.id = 'chat-window';
      root.innerHTML = '<p>Conversation avec ' + props.peer.username + '</p><button id="chat-close">Fermer</button>';
      root.querySelector('#chat-close').addEventListener('click', () => props.onClose());
      return root;
    };
  }]);`,
  // La fenêtre d'échange (#trade-window, « Annuler » appelle `onClose`, « Envoyer » `onSent`).
  echange: `TURBOPACK.push(['static/chunks/echange.js', 273271, (e, m, exports) => {
    exports.default = function ({friendUsername:u,friendProfileId:i,preselectedFriendCard:l,parentTradeId:p,onClose:c,onSent:s}) {
      window.tradeProps = { friendUsername: u, friendProfileId: i };
      const root = document.createElement('div');
      root.id = 'trade-window';
      root.innerHTML = '<h2>Échanger avec <span>' + u + '</span></h2><button id="trade-cancel">Annuler</button><button id="trade-send">Envoyer</button>';
      root.querySelector('#trade-cancel').addEventListener('click', () => c());
      root.querySelector('#trade-send').addEventListener('click', () => s());
      return root;
    };
  }]);`,
  // Un autre morceau de la page, sans rapport.
  autre: `TURBOPACK.push(['static/chunks/autre.js', 999, () => {}]);`,
};

/** Morceau de code demandé : servi une fois la promesse tenue, ou en échec (404). */
export type ChunkGate = (name: string) => Promise<'ok' | 'failed'>;

/** Sert un morceau de `FRIENDS_CHUNKS` (`/_next/static/chunks/<nom>.js`) ; faux pour toute autre adresse. */
export async function serveChunk(route: Route, url: URL, gate?: ChunkGate): Promise<boolean> {
  const name = /^\/_next\/static\/chunks\/(\w+)\.js$/.exec(url.pathname)?.[1];
  const body = name === undefined ? undefined : FRIENDS_CHUNKS[name];
  if (!name || !body) return false;
  if ((await gate?.(name)) === 'failed') await route.fulfill({ status: 404, body: '' });
  else await route.fulfill({ contentType: 'text/javascript', body });
  return true;
}
