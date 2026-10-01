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

const FRIENDSHIPS: readonly FakeFriendship[] = [
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
    <div class="flex items-center justify-between gap-3"><h2 class="text-sm font-semibold uppercase tracking-wide">Demandes reçues (0)</h2><button id="site-accept-all" type="button" class="site-accept-all"><svg class="lucide lucide-check-check size-3.5"></svg>Tout accepter</button></div>
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

const { fiber, hooks } = kit;
const states = hooks([
  [() => state.friendships, (value) => { state.friendships = value; render(); }],
  [() => state.counts, (value) => { state.counts = value; render(); }],
  [() => true],
]);
const pageFiber = fiber(null, {}, null, { memoizedState: states[0] });
const sectionFiber = fiber(section, {}, fiber(null, {}, pageFiber, { stateNode: page }));

async function load() {
  const response = await fetch('/api/friends');
  if (!response.ok) return;
  const body = await response.json();
  states[0].queue.dispatch(body.friendships);
  states[1].queue.dispatch(body.counts);
}

document.getElementById('site-invite').addEventListener('click', (event) => {
  state.clicks.invite++;
  const button = event.currentTarget;
  button.innerHTML = '<svg class="lucide lucide-check size-4"></svg>Copié !';
  setTimeout(() => { button.innerHTML = '<svg class="lucide lucide-link2 lucide-link-2 size-4"></svg>Inviter'; }, 2000);
});
document.getElementById('site-add').addEventListener('click', () => { state.clicks.add++; });

// « Ajouter » de la fenêtre « Rechercher un joueur » : recherche, demande, puis relecture sans lire la réponse.
state.sendRequest = async (query, userId) => {
  await fetch('/api/friends/search?q=' + encodeURIComponent(query));
  await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addressee_id: userId }) });
  await load();
};

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
  fiber(row, {}, fiber(null, { friendId: user.id, username: user.username }, sectionFiber, { key: f.id }));
  return row;
}

// Accepter / Refuser : la requête, puis la relecture, sans état « en cours » ni lecture de la réponse (comme le site).
function incomingRow(f) {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-3 p-3 rounded-xl incoming-row';
  row.dataset.incoming = f.requester.username;
  row.innerHTML = '<div class="w-10 h-10"><span>' + f.requester.username.slice(0, 2).toUpperCase() + '</span></div><p class="flex-1">' +
    f.requester.username + '</p><div class="flex gap-2">' +
    '<button class="site-accept"><span class="inline-flex items-center gap-1"><svg class="lucide lucide-check size-3.5"></svg>Accepter</span></button>' +
    '<button class="site-decline"><span class="inline-flex items-center gap-1"><svg class="lucide lucide-x size-3.5"></svg>Refuser</span></button></div>';
  const answer = (action) => async () => {
    await fetch('/api/friends/' + f.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    await load();
  };
  row.querySelector('.site-accept').addEventListener('click', answer('accept'));
  row.querySelector('.site-decline').addEventListener('click', answer('decline'));
  return row;
}

const acceptAll = document.getElementById('site-accept-all');
acceptAll.addEventListener('click', async () => {
  acceptAll.disabled = true;
  acceptAll.lastChild.textContent = 'Acceptation…';
  try {
    await fetch('/api/friends/accept-all', { method: 'POST' });
    await load();
  } finally {
    acceptAll.disabled = false;
    acceptAll.lastChild.textContent = 'Tout accepter';
  }
});

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
    // Une demande acceptée change de section : nouvelle ligne.
    const key = f.id + ':' + f.status;
    shown.add(key);
    if (rows.has(key)) continue;
    const row = f.status === 'accepted' ? friendRow(f) : incoming(f) ? incomingRow(f) : sentRow(f);
    (f.status === 'accepted' ? section : incoming(f) ? received : sent).append(row);
    rows.set(key, row);
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
  /** Réponses aux demandes reçues (`PATCH /api/friends/<id>`), dans l'ordre. */
  readonly answered: { readonly id: string; readonly action: string }[];
  /** Nombre de `GET /api/friends` reçus (la page a ses amitiés dès le départ, sans les lire). */
  listed: number;
}

/** Joueurs trouvés par la recherche (`GET /api/friends/search`). */
const PLAYERS = [{ id: 'u20', username: 'Zorglub', avatar_url: null, avatar_pos_x: 50, avatar_pos_y: 50 }];

type Handler = (route: Route, id: string) => Promise<void>;

/**
 * Ouvre la page Amis. Réponses à la place du serveur : `remove` à `DELETE /api/friends/<id>` (par défaut : retrait,
 * `{ success: true }`), `answer` à `PATCH /api/friends/<id>` (par défaut : acceptée ou retirée), `acceptAll` à
 * `POST /api/friends/accept-all` (par défaut : toutes acceptées), `send` à `POST /api/friends` (par défaut : 201,
 * l'amitié créée). La page n'a pas de fenêtre « Rechercher un joueur » : `__friends.sendRequest(q, id)` fait ce
 * que fait son « Ajouter ».
 */
export async function openFriendsPage(
  page: Page,
  options: { remove?: Handler; answer?: Handler; acceptAll?: (route: Route) => Promise<void>; send?: (route: Route) => Promise<void> } = {},
): Promise<FriendsServer> {
  const server: FriendsServer = { friendships: [...FRIENDSHIPS], deleted: [], answered: [], listed: 0 };
  const incoming = (f: FakeFriendship) => f.status === 'pending' && f.addressee_id === 'me';
  const accept = (f: FakeFriendship): FakeFriendship => ({ ...f, status: 'accepted' });
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
      if (url.pathname === '/api/friends/accept-all' && method === 'POST') {
        if (options.acceptAll) return options.acceptAll(route).then(() => true);
        server.friendships.splice(0, Infinity, ...server.friendships.map((f) => (incoming(f) ? accept(f) : f)));
        await route.fulfill({ json: { success: true } });
        return true;
      }
      if (url.pathname === '/api/friends/search' && method === 'GET') {
        await route.fulfill({ json: { users: PLAYERS } });
        return true;
      }
      // Comme le site : l'amitié créée, sans les joueurs.
      if (url.pathname === '/api/friends' && method === 'POST') {
        if (options.send) return options.send(route).then(() => true);
        const body: unknown = route.request().postDataJSON();
        const addressee = typeof body === 'object' && body !== null && 'addressee_id' in body ? String(body.addressee_id) : '';
        const created = { id: `s-${addressee}`, status: 'pending' as const, requester_id: 'me', addressee_id: addressee };
        const player = PLAYERS.find((p) => p.id === addressee);
        server.friendships.push({ ...created, ...(player && { addressee: player }) });
        await route.fulfill({ status: 201, json: { friendship: created } });
        return true;
      }
      if (match && method === 'PATCH') {
        const id = match[1] ?? '';
        const body: unknown = route.request().postDataJSON();
        const action = typeof body === 'object' && body !== null && 'action' in body ? String(body.action) : '';
        server.answered.push({ id, action });
        if (options.answer) return options.answer(route, id).then(() => true);
        const index = server.friendships.findIndex((f) => f.id === id);
        const found = server.friendships[index];
        if (found && action === 'accept') server.friendships[index] = accept(found);
        else if (found) server.friendships.splice(index, 1);
        await route.fulfill({ json: { status: action === 'accept' ? 'accepted' : 'declined' } });
        return true;
      }
      if (url.pathname === '/api/friends' && method === 'GET') {
        server.listed++;
        const count = (test: (f: FakeFriendship) => boolean) => server.friendships.filter(test).length;
        const counts = {
          accepted: count((f) => f.status === 'accepted'),
          incoming: count(incoming),
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
