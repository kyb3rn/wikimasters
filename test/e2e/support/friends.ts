import type { Page, Route } from '@playwright/test';
import { openSite, sitePage } from './site';

/**
 * Page Amis relevée sur le site (captures du 29/09/2026, code du 30/09/2026), données inventées. Le faux site
 * n'a pas Tailwind : un peu de CSS remplace ce qui compte pour la mise en page (cadre de la recherche, croix
 * d'effacement, textes masqués). La page se redessine depuis ses états (amitiés, compteurs), notés comme ceux
 * de React : page (états) > div > section > ligne (props `friendId`, `username`, clé = id de l'amitié) > div.
 */
export interface FakeFriendship {
  readonly id: string;
  readonly status: 'accepted' | 'pending';
  readonly requester_id: string;
  readonly addressee_id: string;
  readonly requester?: { readonly id: string; readonly username: string };
  readonly addressee?: { readonly id: string; readonly username: string };
}

const friend = (id: string, userId: string, username: string): FakeFriendship => ({
  id,
  status: 'accepted',
  requester_id: 'me',
  addressee_id: userId,
  addressee: { id: userId, username },
});

export const FRIENDSHIPS: readonly FakeFriendship[] = [
  friend('f1', 'u1', 'aelonka'),
  { id: 'f2', status: 'accepted', requester_id: 'u2', addressee_id: 'me', requester: { id: 'u2', username: 'Poloz30' } },
  friend('f3', 'u3', 'Norband'),
  friend('f4', 'u4', 'AlakazM'),
  { id: 's1', status: 'pending', requester_id: 'me', addressee_id: 'u9', addressee: { id: 'u9', username: 'Goatman!' } },
  { id: 's2', status: 'pending', requester_id: 'me', addressee_id: 'u10', addressee: { id: 'u10', username: 'Igor39360' } },
  { id: 's3', status: 'pending', requester_id: 'me', addressee_id: 'u11', addressee: { id: 'u11', username: 'h3art4lxx' } },
  { id: 'r1', status: 'pending', requester_id: 'u7', addressee_id: 'me', requester: { id: 'u7', username: 'Mastonin' } },
  { id: 'r2', status: 'pending', requester_id: 'u8', addressee_id: 'me', requester: { id: 'u8', username: 'el_lokomotiv' } },
];

const CSS = `
.absolute { position: absolute; } .right-2 { right: .5rem; } .top-1\\/2 { top: 50%; transform: translateY(-50%); }
.w-full { width: 100%; } .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
#friend-list-search { box-sizing: border-box; height: 45px; padding: 0 40px 0 16px; }
@media (min-width: 640px) { .sm\\:inline { display: inline; } }
`;

const PAGE = `
<style>${CSS}</style>
<div id="friends-page" class="flex-1 p-4 md:p-6 space-y-6">
  <div class="flex items-center justify-between animate-fade-in-up">
    <h1 class="text-2xl md:text-3xl font-bold">Amis</h1>
    <div id="site-header-actions" class="flex items-center gap-2">
      <button id="site-invite" type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"><svg class="lucide lucide-link2 lucide-link-2 size-4"></svg>Inviter</button>
      <button id="site-add" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"><span>+</span> Rechercher un joueur</button>
    </div>
  </div>
  <div id="incoming-section" class="space-y-3 animate-fade-in-up">
    <div class="flex items-center justify-between gap-3"><h2 class="text-sm font-semibold uppercase tracking-wide">Demandes reçues (0)</h2><button type="button">Tout accepter</button></div>
  </div>
  <div id="friends-section" class="space-y-3 animate-fade-in-up">
    <h2 class="text-sm font-semibold uppercase tracking-wide">Amis (0)</h2>
    <div class="relative">
      <label for="friend-list-search" class="sr-only">Rechercher un ami</label>
      <input id="friend-list-search" placeholder="Rechercher un ami…" autocomplete="off" class="w-full rounded-lg border px-4 py-2.5 pr-10 text-sm" type="text" value="">
      <button id="site-clear" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full" aria-label="Effacer la recherche">×</button>
    </div>
  </div>
  <div id="sent-section" class="space-y-3 animate-fade-in-up">
    <h2 class="text-sm font-semibold uppercase tracking-wide">Demandes envoyées (0)</h2>
  </div>
</div>`;

const SCRIPT = `
const state = window.__friends = { friendships: __INITIAL__, counts: null, clicks: { invite: 0, add: 0, message: [], trade: [] } };
const count = (status) => state.friendships.filter((f) => f.status === status).length;
const incoming = (f) => f.status === 'pending' && f.addressee_id === 'me';
const outgoing = (f) => f.status === 'pending' && f.requester_id === 'me';
state.counts = { accepted: count('accepted'), incoming: state.friendships.filter(incoming).length, outgoing: state.friendships.filter(outgoing).length };
const other = (f) => (f.requester_id === 'me' ? f.addressee : f.requester);
const page = document.getElementById('friends-page');
const section = document.getElementById('friends-section');
const sent = document.getElementById('sent-section');
const received = document.getElementById('incoming-section');

// États de la page, notés comme ceux de React (liste chaînée de hooks avec \`queue.dispatch\`).
const hooks = [
  { memoizedState: state.friendships, queue: { dispatch: (value) => { state.friendships = value; hooks[0].memoizedState = value; render(); } } },
  { memoizedState: state.counts, queue: { dispatch: (value) => { state.counts = value; hooks[1].memoizedState = value; render(); } } },
  { memoizedState: true, queue: { dispatch() {} } },
];
hooks.forEach((hook, i) => { hook.next = hooks[i + 1] ?? null; });
const pageFiber = { memoizedProps: {}, return: null, memoizedState: hooks[0] };
const divFiber = { memoizedProps: {}, return: pageFiber, stateNode: page };
const sectionFiber = { memoizedProps: {}, return: divFiber, stateNode: section };
section['__reactFiber$test'] = sectionFiber;

async function load() {
  const response = await fetch('/api/friends');
  if (!response.ok) return;
  const body = await response.json();
  hooks[0].queue.dispatch(body.friendships);
  hooks[1].queue.dispatch(body.counts);
}

document.getElementById('site-invite').addEventListener('click', (event) => {
  state.clicks.invite++;
  const button = event.currentTarget;
  button.innerHTML = '<svg class="lucide lucide-check size-4"></svg>Copié !';
  setTimeout(() => { button.innerHTML = '<svg class="lucide lucide-link2 lucide-link-2 size-4"></svg>Inviter'; }, 2000);
});
document.getElementById('site-add').addEventListener('click', () => { state.clicks.add++; });

function friendRow(f) {
  const user = other(f);
  const row = document.createElement('div');
  row.className = 'flex items-center gap-3 p-3 rounded-xl';
  row.dataset.friend = user.username;
  row.innerHTML =
    '<a class="flex min-w-0 flex-1 items-center gap-3" href="/profile/' + user.username + '"><div class="flex h-10 w-10"><span>' +
    user.username.slice(0, 2).toUpperCase() + '</span></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">' +
    user.username + '</p></div></a>' +
    '<div class="-mx-1 flex max-w-[100%] flex-shrink-0 items-center gap-2 px-1">' +
    '<span class="relative inline-flex h-8 w-11 shrink-0 items-center justify-center"><button type="button" class="site-message" title="Envoyer un message"><svg class="lucide lucide-message-circle size-3.5"></svg><span class="hidden sm:inline">Message</span></button></span>' +
    '<span class="relative inline-flex h-8 w-11 shrink-0 items-center justify-center"><button type="button" class="site-trade" title="Proposer un échange"><svg class="lucide lucide-handshake size-3.5"></svg><span class="hidden sm:inline">Échanger</span></button></span>' +
    '</div>';
  // Le site rend la fenêtre de conversation juste après la ligne, en \`fixed\`.
  row.querySelector('.site-message').addEventListener('click', () => {
    state.clicks.message.push(user.username);
    const dm = document.createElement('div');
    dm.className = 'fixed inset-0 z-50 site-dm';
    row.after(dm);
  });
  row.querySelector('.site-trade').addEventListener('click', () => { state.clicks.trade.push(user.username); });
  row['__reactFiber$test'] = { memoizedProps: {}, stateNode: row, return: { memoizedProps: { friendId: user.id, username: user.username }, key: f.id, return: sectionFiber } };
  return row;
}

function incomingRow(f) {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-3 p-3 rounded-xl';
  row.dataset.incoming = f.requester.username;
  row.innerHTML = '<div class="w-10 h-10"><span>' + f.requester.username.slice(0, 2).toUpperCase() + '</span></div><p class="flex-1">' +
    f.requester.username + '</p><div class="flex gap-2"><button>Accepter</button><button>Refuser</button></div>';
  return row;
}

function sentRow(f) {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-3 p-3 rounded-xl';
  row.dataset.request = f.addressee.username;
  row.innerHTML = '<div class="w-10 h-10"><span>' + f.addressee.username.slice(0, 2).toUpperCase() + '</span></div><p class="flex-1">' +
    f.addressee.username + '</p><span class="text-xs">En attente</span><button class="text-xs site-cancel">Annuler</button>';
  row.querySelector('button').addEventListener('click', async () => {
    await fetch('/api/friends/' + f.id, { method: 'DELETE' });
    await load();
  });
  return row;
}

const rows = new Map();
function render() {
  section.querySelector('h2').textContent = 'Amis (' + state.counts.accepted + ')';
  sent.querySelector('h2').textContent = 'Demandes envoyées (' + state.counts.outgoing + ')';
  received.querySelector('h2').textContent = 'Demandes reçues (' + state.counts.incoming + ')';
  const shown = new Set();
  for (const f of state.friendships) {
    shown.add(f.id);
    if (rows.has(f.id)) continue;
    const row = f.status === 'accepted' ? friendRow(f) : incoming(f) ? incomingRow(f) : sentRow(f);
    (f.status === 'accepted' ? section : incoming(f) ? received : sent).append(row);
    rows.set(f.id, row);
  }
  for (const [id, row] of rows) {
    if (shown.has(id)) continue;
    row.remove();
    rows.delete(id);
  }
}
render();
window.__loadedAt = Math.random();
`;

export interface FriendsServer {
  /** Amitiés du serveur (retirées par `DELETE /api/friends/<id>`). */
  readonly friendships: FakeFriendship[];
  /** Requêtes `DELETE /api/friends/<id>` reçues (ids). */
  readonly deleted: string[];
}

/**
 * Ouvre la page Amis. `remove` répond à la place du serveur à `DELETE /api/friends/<id>` (par défaut : retrait,
 * `{ success: true }`).
 */
export async function openFriendsPage(
  page: Page,
  options: { remove?: (route: Route, id: string) => Promise<void> } = {},
): Promise<FriendsServer> {
  const server: FriendsServer = { friendships: [...FRIENDSHIPS], deleted: [] };
  await openSite(page, '/friends', {
    html: sitePage(PAGE, SCRIPT.replace('__INITIAL__', JSON.stringify(FRIENDSHIPS))),
    handle: async (route, url) => {
      const method = route.request().method();
      const match = /^\/api\/friends\/([^/]+)$/.exec(url.pathname);
      if (match && method === 'DELETE') {
        const id = match[1] ?? '';
        server.deleted.push(id);
        if (options.remove) return options.remove(route, id).then(() => true);
        const index = server.friendships.findIndex((f) => f.id === id);
        if (index >= 0) server.friendships.splice(index, 1);
        await route.fulfill({ json: { success: true } });
        return true;
      }
      if (url.pathname === '/api/friends' && method === 'GET') {
        const count = (test: (f: FakeFriendship) => boolean) => server.friendships.filter(test).length;
        const counts = {
          accepted: count((f) => f.status === 'accepted'),
          incoming: count((f) => f.status === 'pending' && f.addressee_id === 'me'),
          outgoing: count((f) => f.status === 'pending' && f.requester_id === 'me'),
        };
        await route.fulfill({ json: { friendships: server.friendships, counts } });
        return true;
      }
      return false;
    },
  });
  return server;
}
