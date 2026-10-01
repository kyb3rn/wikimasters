import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { expectDomIdle, FAKE_JWT, letTimePass, openSite, sitePage, SUPABASE } from './support/site';

/**
 * /dms imité (comme dms-layout.spec) : liste des conversations, conversation du site en modale ; la page fait une
 * requête Supabase au chargement (session du site, joueur u0). Chat de guilde : `GET` / `POST /api/guilds/chat`,
 * appartenance lue dans Supabase (`guild_members`, `guilds`), canal `guild-chat:g1` sur un faux serveur temps réel.
 */
const NAMES = ['AlakazM', 'Poloz30'];

const LAYOUT = `<style>
body { display: flex; height: 100vh; padding: 0 !important; box-sizing: border-box; }
#sidebar { width: 200px; flex: none; }
main { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; }
.md\\:p-6 { padding: 24px; } .space-y-6 > * + * { margin-top: 24px; }
.card-frame { background: #161b22; border: 1px solid #30363d; border-radius: 16px; }
.sm\\:max-w-md { max-width: 28rem; width: 100%; } .sm\\:h-\\[600px\\] { height: 600px; }
.overflow-y-auto { overflow-y: auto; } .flex-1 { flex: 1; } .min-w-0 { min-width: 0; } .w-full { width: 100%; }
</style><div id="sidebar"></div>`;

const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6" id="page">
    <div class="animate-fade-in-up"><h1>Messages</h1><p>Toutes vos conversations</p></div>
    <div class="space-y-1 animate-fade-in-up" id="list"></div>
  </div>`,
  `const NAMES = ${JSON.stringify(NAMES)};
  const list = document.getElementById('list');
  for (const name of NAMES) {
    list.insertAdjacentHTML('beforeend',
      '<button class="w-full flex items-center gap-3 p-3 rounded-xl text-left">' +
        '<div class="relative flex-shrink-0"><div class="w-11 h-11 rounded-full"><span>' + name.slice(0, 2) + '</span></div></div>' +
        '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2">' +
          '<p class="font-medium text-sm truncate">' + name + '</p><span>18:26</span></div>' +
          '<p class="text-xs truncate mt-0.5">Salut</p></div>' +
      '</button>');
  }
  window.closeChat = () => document.getElementById('chat')?.remove();
  window.openChat = (name) => {
    window.closeChat();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" id="chat">' +
        '<div class="w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col card-frame overflow-hidden">' +
          '<div class="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">' +
            '<div class="w-9 h-9 rounded-full overflow-hidden"><span>' + name.slice(0, 2) + '</span></div>' +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + name + '</p></div>' +
            '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"></svg></button>' +
          '</div>' +
          '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"><p>Message de ' + name + '</p></div>' +
        '</div>' +
      '</div>');
    document.querySelector('#chat button[aria-label="Fermer"]').addEventListener('click', window.closeChat);
  };
  list.addEventListener('click', (event) => {
    const row = event.target.closest('button.text-left');
    if (row && list.contains(row) && row.closest('.wm-root') === null) window.openChat(row.querySelector('p').textContent);
  });
  fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', {
    headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' },
  });`,
).replace('<main>', `${LAYOUT}<main>`);

const at = (minute: number, second = 0) => `2026-10-01T10:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+00:00`;
const kerv = { id: 'u1', username: 'Kerv_7', avatar_url: null, avatar_pos_x: 50, avatar_pos_y: 50 };
const MESSAGES = [
  { id: 'e1', guild_id: 'g1', sender_id: null, content: 'Kerv_7 a rejoint la guilde. Dites bonjour !', type: 'event', created_at: at(0) },
  { id: 'k1', guild_id: 'g1', sender_id: 'u1', content: 'salut les bebou', type: 'message', created_at: at(1), sender: kerv },
  { id: 'k2', guild_id: 'g1', sender_id: 'u1', content: 'ça va ?', type: 'message', created_at: at(1, 30), sender: kerv },
  { id: 'm1', guild_id: 'g1', sender_id: 'u0', content: 'oui !', type: 'message', created_at: at(2), sender: { ...kerv, id: 'u0', username: 'Moi' } },
];

interface Server {
  /** Requêtes Supabase de l'appartenance (`guild_members`). */
  memberships: number;
  sent: unknown[];
  socket: WebSocketRoute | undefined;
  joined: Promise<void>;
}

async function openDms(page: Page, options: { guild?: boolean } = {}): Promise<Server> {
  let markJoined = () => {};
  const server: Server = { memberships: 0, sent: [], socket: undefined, joined: new Promise((resolve) => (markJoined = resolve)) };
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/rest/v1/guild_members') {
      server.memberships++;
      return route.fulfill({ json: options.guild === false ? [] : [{ guild_id: 'g1' }] });
    }
    if (url.pathname === '/rest/v1/guilds') return route.fulfill({ json: [{ id: 'g1', name: 'Zguegito' }] });
    if (url.pathname === '/rest/v1/profiles' && url.searchParams.get('id') === 'eq.u2') {
      return route.fulfill({ json: [{ id: 'u2', username: 'Nouveau', avatar_url: null, avatar_pos_x: 50, avatar_pos_y: 50 }] });
    }
    return route.fulfill({ json: [] });
  });
  await page.routeWebSocket(`wss://x.supabase.co/**`, (ws) => {
    server.socket = ws;
    ws.onMessage((data) => {
      const [joinRef, ref, topic, event] = JSON.parse(String(data)) as [string, string, string, string];
      if (event !== 'phx_join') return;
      ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]));
      markJoined();
    });
  });
  await openSite(page, '/dms', {
    html: HTML,
    handle: async (route, url) => {
      if (url.pathname !== '/api/guilds/chat') return false;
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { content: string };
        server.sent.push(body);
        await route.fulfill({
          json: { message: { id: `s${server.sent.length}`, guild_id: 'g1', sender_id: 'u0', content: body.content, type: 'message', created_at: at(2, 20) } },
        });
        return true;
      }
      await route.fulfill({ json: { messages: MESSAGES } });
      return true;
    },
  });
  return server;
}

const guildRow = (page: Page) => page.getByRole('button', { name: /Zguegito/ });
const guildChat = (page: Page) => page.getByRole('dialog', { name: 'Chat de Zguegito' });
const row = (page: Page, id: string) => page.locator(`[data-wm-id="${id}"]`);

function realtimeInsert(server: Server, record: Record<string, unknown>): void {
  server.socket?.send(
    JSON.stringify([null, null, 'realtime:guild-chat:g1', 'postgres_changes', { data: { table: 'guild_messages', type: 'INSERT', record }, ids: [1] }]),
  );
}

test('dans une guilde : son chat épinglé en tête de /dms, messages groupés avec le pseudo au-dessus', async ({ page }) => {
  await openDms(page);

  // En tête de la liste, avant les conversations, puis un trait.
  await expect(guildRow(page)).toBeVisible();
  const order = await page.locator('#list').evaluate((list) =>
    [...list.querySelectorAll('button')].map((button) => button.querySelector('p')?.textContent),
  );
  expect(order).toEqual(['Zguegito', ...NAMES]);
  await expect(page.locator('#list [role="separator"]')).toHaveCount(1);

  await guildRow(page).click();
  const chat = guildChat(page);
  await expect(chat).toBeVisible();
  await expect(guildRow(page)).toHaveAttribute('aria-current', 'true');
  // Posée à droite de la liste par dms-layout, comme une conversation du site.
  await expect(page.locator('.wm-dms-docked')).toHaveCount(1);

  await expect(chat.getByText('Kerv_7 a rejoint la guilde. Dites bonjour !')).toBeVisible();
  // k1 et k2 (30 s d'écart) groupés : pseudo au premier seulement, photo au dernier.
  await expect(row(page, 'k1').locator('div.mb-0\\.5')).toBeVisible();
  await expect(row(page, 'k2').locator('div.mb-0\\.5')).toBeHidden();
  await expect(row(page, 'k1')).toHaveClass(/wm-dm-next/);
  const spacer = await row(page, 'k1').locator('div.mb-0\\.5 > div.h-8').evaluate((element) => element.getBoundingClientRect().height);
  expect(spacer).toBe(0);
  // Pseudo et photo mènent au profil de l'auteur.
  await expect(row(page, 'k1').getByRole('link', { name: 'Kerv_7', exact: true })).toHaveAttribute('href', '/profile/Kerv_7');
  await expect(row(page, 'k2').getByRole('link', { name: 'Profil de Kerv_7' })).toHaveAttribute('href', '/profile/Kerv_7');
  // Mes messages : à droite, sans pseudo ni photo.
  await expect(row(page, 'm1').locator('div.flex-row-reverse')).toHaveCount(1);
  await expect(row(page, 'm1').locator('div.mb-0\\.5')).toHaveCount(0);

  // Au repos, le script ne resynchronise plus la page.
  await expectDomIdle(page);
});

test('envoyer, puis recevoir par le temps réel (auteur connu ou lu dans Supabase)', async ({ page }) => {
  const server = await openDms(page);
  await guildRow(page).click();
  const chat = guildChat(page);
  const input = chat.getByPlaceholder('Message à la guilde…');
  await expect(input).toBeEnabled();
  await server.joined;

  await input.fill('Coucou');
  await input.press('Enter');
  await expect(row(page, 's1')).toContainText('Coucou');
  expect(server.sent).toEqual([{ content: 'Coucou' }]);
  await expect(input).toHaveValue('');

  // Ligne du temps réel sans auteur : celui déjà connu.
  realtimeInsert(server, { id: 'k3', guild_id: 'g1', sender_id: 'u1', content: 'bien vu', type: 'message', created_at: at(3) });
  await expect(row(page, 'k3')).toHaveAttribute('data-wm-name', 'Kerv_7');
  // Auteur inconnu : lu dans Supabase.
  realtimeInsert(server, { id: 'n1', guild_id: 'g1', sender_id: 'u2', content: 'hello', type: 'message', created_at: at(4) });
  await expect(row(page, 'n1').getByRole('link', { name: 'Nouveau', exact: true })).toBeVisible();
  await expect(row(page, 'n1').getByRole('link', { name: 'Profil de Nouveau' })).toHaveAttribute('href', '/profile/Nouveau');
  await expect(page.getByRole('link', { name: 'Profil de Zguegito' })).toHaveCount(0);
});

test('passer d’une conversation du site au chat de guilde, et inversement', async ({ page }) => {
  await openDms(page);
  await page.locator('#list button', { hasText: 'AlakazM' }).click();
  await expect(page.locator('#chat')).toBeVisible();

  await guildRow(page).click();
  await expect(page.locator('#chat')).toHaveCount(0);
  await expect(guildChat(page)).toBeVisible();

  await page.locator('#list button', { hasText: 'Poloz30' }).click();
  await expect(guildChat(page)).toHaveCount(0);
  await expect(page.locator('#chat')).toContainText('Poloz30');
  await expect(guildRow(page)).not.toHaveAttribute('aria-current', 'true');
});

test('sans guilde : rien ; l’appartenance est retenue (pas de nouvelle lecture avant 4 h)', async ({ page }) => {
  const server = await openDms(page, { guild: false });
  await expect.poll(() => server.memberships).toBe(1);
  await letTimePass(page, 300);
  await expect(guildRow(page)).toHaveCount(0);

  await page.reload();
  await letTimePass(page, 500);
  expect(server.memberships).toBe(1);
  await expect(guildRow(page)).toHaveCount(0);
});

test('/guild : onglet Chat caché, l’Accueil à sa place ; la guilde vue là est retenue', async ({ page }) => {
  const GUILD = sitePage(
    `<div class="flex-1 flex flex-col gap-4">
      <div class="flex items-center justify-between"><div><h1>Zguegito</h1></div>
        <div class="flex items-center gap-2"><span>53 membres</span><button>+ Inviter</button></div></div>
      <div class="flex gap-1 bg-[var(--color-surface-light)] rounded-xl p-1 flex-shrink-0 overflow-x-auto" id="tabs"></div>
      <p id="content"></p>
    </div>`,
    `const TABS = [['home', 'house', 'Accueil'], ['chat', 'message-circle', 'Chat'], ['members', 'users', 'Membres (53)']];
    let current = new URLSearchParams(location.search).get('tab') ?? 'home';
    const render = () => {
      document.getElementById('tabs').innerHTML = TABS.map(([id, icon, label]) =>
        '<button type="button" data-tab="' + id + '" class="flex-1 min-w-[4.5rem] py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ' +
        (id === current ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]' : 'text-[var(--color-foreground)]/50') + '">' +
        '<span class="inline-flex items-center justify-center gap-1.5"><svg class="lucide lucide-' + icon + ' size-4"></svg>' + label + '</span></button>').join('');
      document.getElementById('content').textContent = current;
    };
    document.getElementById('tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('button[data-tab]');
      if (tab) { current = tab.dataset.tab; render(); }
    });
    render();
    fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', { headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' } })
      .then(() => fetch('/api/guilds'));`,
  );
  let memberships = 0;
  await page.route(`${SUPABASE}/**`, (route) => {
    if (new URL(route.request().url()).pathname === '/rest/v1/guild_members') memberships++;
    return route.fulfill({ json: [] });
  });
  await openSite(page, '/guild?tab=chat', {
    html: GUILD,
    handle: async (route, url) => {
      if (url.pathname !== '/dms' || route.request().resourceType() !== 'document') return false;
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: HTML });
      return true;
    },
    api: { '/api/guilds': { guild: { id: 'g9', name: 'Autre guilde', description: '' }, membership: { role: 'member' }, member_count: 53 } },
  });

  await expect(page.locator('#content')).toHaveText('home');
  await expect(page.locator('#tabs button[data-tab="chat"]')).toBeHidden();
  await expect(page.locator('#tabs button[data-tab="members"]')).toBeVisible();

  // La guilde lue dans la réponse du site sert sur /dms, sans requête Supabase.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wm-guild-v1') ?? '')).toContain('Autre guilde');
  await page.goto('https://www.wiki-masters.com/dms');
  await expect(page.getByRole('button', { name: /Autre guilde/ })).toBeVisible();
  expect(memberships).toBe(0);
});
