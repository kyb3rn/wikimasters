import type { Page } from '@playwright/test';
import { openSite, sitePage } from './site';

/**
 * Imitation de /trades et de « Choisir un ami » (code du site, 30/09/2026) : « Nouvel échange » ouvre la fenêtre
 * (portail dans `body`) ; composant `{ currentUserId, onSelect, onClose }`, états amis, chargement, recherche ;
 * `GET /api/friends` à l'ouverture (réponse en erreur ou échec réseau : liste vide, comme sans ami) ; une ligne
 * `button` par ami (clé React = id : photo, pseudo, « Échanger → »). Choisir un ami ferme la fenêtre et affiche
 * `#chosen`. La page garde ses échanges dans un état (un échange en attente avec Bruno).
 */
const SCRIPT = `
(() => {
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const me = 'me';
  const trades = [
    { id: 't1', status: 'pending', initiator_id: me, recipient_id: 'b' },
    { id: 't2', status: 'declined', initiator_id: 'c', recipient_id: me },
  ];
  const tradesHook = { memoizedState: trades, queue: { dispatch() {} }, next: null };
  const pageFiber = { key: null, memoizedProps: {}, return: null, memoizedState: tradesHook };
  const main = document.querySelector('main');
  const open = el('button', 'px-4 py-2', 'Nouvel échange');
  open.id = 'new-trade';
  const chosen = el('p');
  chosen.id = 'chosen';
  main.append(open, chosen);

  open.onclick = () => {
    let friends = [], loading = true, query = '';
    const hooks = [
      { get memoizedState() { return friends; }, queue: { dispatch: (v) => { friends = v; render(); } } },
      { get memoizedState() { return loading; }, queue: { dispatch: (v) => { loading = v; render(); } } },
      { get memoizedState() { return query; }, queue: { dispatch: (v) => { query = v; render(); } } },
    ];
    hooks.forEach((hook, i) => { hook.next = hooks[i + 1] ?? null; });
    const close = () => overlay.remove();
    const props = { currentUserId: me, onSelect: (friend) => { close(); chosen.textContent = 'Échanger avec ' + friend.username; }, onClose: close };
    const picker = { key: null, memoizedProps: props, return: pageFiber, memoizedState: hooks[0] };
    const overlay = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    overlay.onclick = (event) => { if (event.target === overlay) close(); };
    const frame = el('div', 'w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border');
    const head = el('div', 'flex items-center justify-between p-5 border-b');
    const title = el('h2', 'text-lg font-bold', 'Choisir un ami');
    title['__reactFiber$test'] = { memoizedProps: {}, stateNode: title, return: picker };
    const x = el('button', 'p-1', '×');
    x.setAttribute('aria-label', 'Fermer');
    x.onclick = close;
    head.append(title, x);
    const list = el('div', 'flex-1 overflow-y-auto p-4 space-y-2');
    frame.append(head, list);
    overlay.append(frame);
    document.body.append(overlay);

    function render() {
      if (loading) { list.replaceChildren(el('div', 'flex items-center justify-center py-8', '…')); return; }
      if (friends.length === 0) { list.replaceChildren(el('p', 'text-sm', 'Aucun ami pour le moment.')); return; }
      list.replaceChildren(...friends.map((friend) => {
        const row = el('button', 'w-full flex items-center gap-3 p-3 rounded-xl');
        row['__reactFiber$test'] = { key: friend.id, memoizedProps: {}, stateNode: row, return: picker };
        const avatar = el('div', 'w-10 h-10 rounded-full');
        avatar.innerHTML = '<span class="site-avatar">' + friend.username.slice(0, 2).toUpperCase() + '</span>';
        row.append(avatar, el('span', 'font-medium text-sm flex-1', friend.username), el('span', 'text-xs', 'Échanger →'));
        row.onclick = () => props.onSelect(friend);
        return row;
      }));
    }
    render();
    (async () => {
      try {
        const response = await fetch('/api/friends');
        if (!response.ok) return;
        friends = (await response.json()).friendships.filter((f) => f.status === 'accepted').map((f) => {
          const other = f.requester_id === me ? f.addressee : f.requester;
          return { id: other.id, username: other.username, avatar_url: other.avatar_url, avatar_pos_x: other.avatar_pos_x, avatar_pos_y: other.avatar_pos_y };
        });
      } finally { loading = false; render(); }
    })();
  };
})();
`;

const HTML = sitePage('<h1>Échanges</h1>', SCRIPT);

const player = (id: string, username: string) => ({ id, username, avatar_url: null, avatar_pos_x: 50, avatar_pos_y: 50 });
const friendship = (id: string, other: ReturnType<typeof player>, created: string) => ({
  id: `f-${id}`,
  status: 'accepted',
  requester_id: 'me',
  addressee_id: other.id,
  requester: player('me', 'Moi'),
  addressee: other,
  created_at: created,
});

/** Aline (la plus récente), Bruno (échange en attente), Chloé (la plus ancienne), Zoé. */
const FRIENDS = {
  friendships: [
    friendship('a', player('a', 'Aline'), '2026-09-28T10:00:00Z'),
    friendship('b', player('b', 'Bruno'), '2026-09-10T10:00:00Z'),
    friendship('c', player('c', 'Chloé'), '2026-08-01T10:00:00Z'),
    friendship('z', player('z', 'Zoé'), '2026-09-15T10:00:00Z'),
  ],
  counts: { accepted: 4, incoming: 0, outgoing: 0 },
};

export interface PickerServer {
  /** Échec voulu des prochaines lectures des amis. */
  fail: 500 | 'network' | undefined;
}

/** Ouvre /trades imité ; « Nouvel échange » ouvre « Choisir un ami ». */
export async function openFriendPickerPage(page: Page): Promise<PickerServer> {
  const server: PickerServer = { fail: undefined };
  await openSite(page, '/trades', {
    html: HTML,
    handle: async (route, url) => {
      if (url.pathname !== '/api/friends') return false;
      if (server.fail === 'network') await route.abort('failed');
      else if (server.fail) await route.fulfill({ status: server.fail, json: { error: 'Erreur' } });
      else await route.fulfill({ json: FRIENDS });
      return true;
    },
  });
  return server;
}
