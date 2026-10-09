import { expect, test, type Page, type Route } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage, SUPABASE } from './support/site';
import { SITE_MODULES, SITE_ROUTER } from './support/site-modules';

/**
 * Page /dms imitée (captures du 29/09/2026, code du 03/10/2026) : conversations dans l'état de la page (une ligne
 * chacune, redessinées quand il change), la conversation du site (module 284911, `{ peer, currentUserId, onClose }`)
 * importée par la page et rendue par elle au clic d'une ligne ; « Envoyer » fait `POST /api/chat/<ami>`. Modules du
 * site imités (`SITE_MODULES`) : la conversation y est inscrite, avec le code de la page qui la rend.
 */
const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6" id="page">
    <div class="animate-fade-in-up"><h1>Messages</h1><p>Toutes vos conversations</p></div>
    <div class="space-y-1 animate-fade-in-up" id="list"></div>
  </div>`,
  `${SITE_MODULES}
${SITE_ROUTER}
const session = { type: { $$typeof: Symbol.for('react.context') }, memoizedProps: { value: 'u0', children: null }, return: null };
window.chatOpenings = [];
window.listReads = 0;

function Conversation(props) {
  window.chatOpenings.push([props.peer.username, props.onClose === closeSiteChat ? 'page' : 'script']);
  window.chatProps = { peer: props.peer, currentUserId: props.currentUserId };
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm';
  overlay.innerHTML =
    '<div class="w-full sm:max-w-2xl lg:max-w-4xl h-[85vh] sm:h-[min(85vh,800px)] lg:h-[min(90vh,1000px)] flex flex-col card-frame rounded-t-2xl sm:rounded-2xl overflow-hidden">' +
      '<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">' +
        '<a class="hover:underline flex flex-1 min-w-0 items-center gap-3 rounded-lg text-inherit">' +
          '<div class="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden"><span></span></div>' +
          '<span class="min-w-0 font-semibold text-sm truncate"></span>' +
        '</a>' +
        '<button class="p-1.5 rounded-lg" aria-label="Fermer">x</button>' +
      '</div>' +
      '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"></div>' +
      '<div class="flex items-center gap-2"><input aria-label="Votre message"><button aria-label="Envoyer">Envoyer</button></div>' +
    '</div>';
  overlay.querySelector('span').textContent = props.peer.username.slice(0, 2);
  overlay.querySelector('span.font-semibold').textContent = props.peer.username;
  overlay.querySelector('a').setAttribute('href', '/profile/' + encodeURIComponent(props.peer.username));
  overlay.firstElementChild['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: props, return: session } };
  overlay.querySelector('[aria-label="Fermer"]').addEventListener('click', () => props.onClose());
  overlay.querySelector('[aria-label="Envoyer"]').addEventListener('click', async () => {
    const content = overlay.querySelector('input').value;
    const response = await fetch('/api/chat/' + props.peer.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const { message } = await response.json();
    const line = document.createElement('p');
    line.textContent = message.content;
    overlay.querySelector('.overflow-y-auto').append(line);
  });
  return overlay;
}
factories.set(284911, (e, m, exports) => { exports.default = Conversation; });
// La page /dms (son code, raccourci) : la conversation importée, rendue avec { peer, currentUserId, onClose }.
factories.set(500, function (e) { var t=e.i(1),l=e.i(284911); function x(){return (0,t.jsx)(l.default,{peer:$,currentUserId:T,onClose:U})} });

const conversation = (id, username, text) => ({ peer_id: id, peer_username: username, peer_avatar_url: null, peer_avatar_pos_x: 50, peer_avatar_pos_y: 50, last_message: text, last_message_at: '2026-09-29T16:26:38Z', unread_count: 0 });
let conversations = [conversation('u-alakazm', 'AlakazM', 'Salut'), conversation('u-poloz', 'Poloz30', 'Ah oui')];
let siteChat = null;
const pageFiber = kit.fiber(null, {}, session, {
  memoizedState: kit.hooks([[() => conversations, (value) => { conversations = value; renderList(); }], [() => null]])[0],
});
// Page reprise par React (hydratée) : un fiber sur ses nœuds.
kit.fiber(document.getElementById('page'), {}, pageFiber);
kit.fiber(document.querySelector('#page > div'), {}, pageFiber);

function closeSiteChat() {
  siteChat?.remove();
  siteChat = null;
  window.listReads++;
}
function openSiteChat(item) {
  if (siteChat) closeSiteChat();
  const peer = { id: item.peer_id, username: item.peer_username, avatar_url: item.peer_avatar_url, avatar_pos_x: item.peer_avatar_pos_x, avatar_pos_y: item.peer_avatar_pos_y };
  siteChat = Conversation({ peer, currentUserId: 'u0', onClose: closeSiteChat });
  document.body.append(siteChat);
}
function renderList() {
  document.getElementById('list').replaceChildren(...conversations.map((item) => {
    const row = kit.button('w-full flex items-center gap-3 p-3 rounded-xl text-left',
      '<div class="relative flex-shrink-0"><div class="w-11 h-11 rounded-full"><span></span></div></div>' +
      '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><p class="font-medium text-sm truncate"></p>' +
      '<span>18:26</span></div><p class="text-xs truncate mt-0.5"></p></div>',
      () => openSiteChat(item));
    row.querySelector('span').textContent = item.peer_username.slice(0, 2);
    row.querySelector('p.font-medium').textContent = item.peer_username;
    row.querySelector('p.text-xs').textContent = item.last_message;
    kit.fiber(row, {}, pageFiber);
    return row;
  }));
}
renderList();`,
).replace(
  '<main>',
  // Classes du site utiles aux mesures, sans poids (comme ses utilitaires Tailwind, en couche) : nos règles l'emportent.
  `<style>
  :where(.card-frame) { background: #161b22; }
  :where(.sm\\:max-w-md) { max-width: 28rem; width: 100%; }
  :where(.sm\\:h-\\[600px\\]) { height: 600px; }
  :where(.flex-1) { flex: 1; min-width: 0; }
  </style><main>`,
);

const player = (id: string, username: string) => ({ id, username, avatar_url: null, avatar_pos_x: 20, avatar_pos_y: 80 });
const friendship = (id: string, status: string, other: ReturnType<typeof player>, createdAt: string) => ({
  id,
  status,
  requester_id: 'u0',
  addressee_id: other.id,
  requester: player('u0', 'Moi'),
  addressee: other,
  created_at: createdAt,
});
const FRIENDS = {
  friendships: [
    friendship('f1', 'accepted', player('u-alakazm', 'AlakazM'), '2026-09-01T10:00:00Z'),
    friendship('f2', 'accepted', player('u-zoe', 'Zoé'), '2026-09-20T10:00:00Z'),
    friendship('f3', 'accepted', player('u-bruno', 'Bruno'), '2026-09-10T10:00:00Z'),
    friendship('f4', 'pending', player('u-chloe', 'Chloé'), '2026-09-25T10:00:00Z'),
  ],
  counts: { accepted: 3, incoming: 0, outgoing: 1 },
};

interface DmsOptions {
  readonly width?: number;
  /** Réponses de `GET /api/friends`, l'une après l'autre (la dernière ensuite) : un nombre est un statut d'erreur. */
  readonly friends?: readonly (number | object)[];
}

async function openDms(page: Page, { width = 1400, friends = [FRIENDS] }: DmsOptions = {}): Promise<{ sent: unknown[] }> {
  const sent: unknown[] = [];
  let reads = 0;
  await page.setViewportSize({ width, height: 800 });
  await page.route(`${SUPABASE}/**`, (route) => route.fulfill({ json: [] }));
  await openSite(page, '/dms', {
    html: HTML,
    handle: async (route: Route, url: URL) => {
      if (url.pathname === '/api/friends') {
        const answer = friends[Math.min(reads++, friends.length - 1)];
        await (typeof answer === 'number' ? route.fulfill({ status: answer, json: { error: 'Erreur' } }) : route.fulfill({ json: answer }));
        return true;
      }
      const peer = /^\/api\/chat\/([^/]+)$/.exec(url.pathname)?.[1];
      if (peer && route.request().method() === 'POST') {
        const { content } = route.request().postDataJSON() as { content: string };
        sent.push({ peer, content });
        await route.fulfill({
          json: {
            message: {
              id: `m${sent.length}`,
              sender_id: 'u0',
              recipient_id: peer,
              content,
              read: false,
              created_at: '2026-10-03T10:00:00.000000+00:00',
              sender: player('u0', 'Moi'),
            },
          },
        });
        return true;
      }
      return false;
    },
  });
  return { sent };
}

const header = (page: Page) => page.locator('#page > div').first();
const compose = (page: Page) => header(page).getByRole('button', { name: 'Nouveau message' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Nouveau message' });
const rows = (page: Page) => page.locator('#list > button');
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const chats = (page: Page) => page.locator('div.fixed.inset-0:has(> .card-frame > div.border-b)');
const chatName = (page: Page) => chats(page).locator('span.font-semibold');

const seen = (page: Page) =>
  page.evaluate(() => {
    const values = window as unknown as Record<string, unknown>;
    return { openings: values.chatOpenings, chat: values.chatProps, contexts: values.shownContexts, listReads: values.listReads };
  });

test('« Nouveau message » à droite du titre ; la fenêtre liste les amis (pas les demandes), par nom, avec « Message »', async ({ page }) => {
  await openDms(page);
  const button = compose(page);
  await expect(button).toBeVisible();
  const [box, title, line] = await Promise.all([rect(button), rect(header(page).locator('h1')), rect(header(page))]);
  expect(box.x).toBeGreaterThan(title.x + title.width);
  expect(Math.abs(line.x + line.width - (box.x + box.width))).toBeLessThan(1);
  expect(Math.abs(box.y + box.height / 2 - (line.y + line.height / 2))).toBeLessThan(2);

  await button.click();
  await expect(dialog(page)).toContainText('3 amis');
  await expect(dialog(page).locator('.wm-picker-name')).toHaveText(['AlakazM', 'Bruno', 'Zoé']);
  await expect(dialog(page).getByRole('button', { name: 'Écrire à Bruno' })).toHaveText('Message');
  await expect(dialog(page).getByRole('button', { name: 'Filtrer les amis' })).toHaveCount(0);
  await expect(dialog(page).getByRole('textbox', { name: 'Rechercher un ami' })).toBeFocused();

  await dialog(page).getByRole('textbox', { name: 'Rechercher un ami' }).fill('zoe');
  await expect(dialog(page).locator('.wm-picker-name')).toHaveText(['Zoé']);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('tri des amis : par nom ou par date d’amitié, le sens collé à droite de la liste', async ({ page }) => {
  await openDms(page);
  await compose(page).click();
  const names = dialog(page).locator('.wm-picker-name');
  const order = dialog(page).getByRole('button', { name: /^Sens du tri/ });
  await expect(names).toHaveText(['AlakazM', 'Bruno', 'Zoé']);
  await expect(order).toHaveAttribute('aria-label', 'Sens du tri : De A à Z');
  await order.click();
  await expect(names).toHaveText(['Zoé', 'Bruno', 'AlakazM']);

  // Un autre tri repart dans son sens habituel : les plus récents d'abord.
  await dialog(page).getByRole('button', { name: 'Trier les amis' }).click();
  await page.getByRole('option', { name: "Date d'amitié" }).click();
  await expect(order).toHaveAttribute('aria-label', 'Sens du tri : Des plus récents aux plus anciens');
  await expect(names).toHaveText(['Zoé', 'Bruno', 'AlakazM']);
  await order.click();
  await expect(names).toHaveText(['AlakazM', 'Bruno', 'Zoé']);

  // Collés : un seul trait entre la liste et le bouton du sens (mesures prises dans la même image).
  const [list, button] = await page.evaluate(() =>
    ['[aria-label="Trier les amis"]', '[aria-label^="Sens du tri"]'].map((selector) => {
      const element = document.querySelector(`[role="dialog"] button${selector}`);
      if (!element) throw new Error(`${selector} introuvable`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  if (!list || !button) throw new Error('mesures incomplètes');
  expect(button.x).toBeCloseTo(list.x + list.width - 1, 0);
  expect(button.y).toBeCloseTo(list.y, 0);
  expect(button.height).toBeCloseTo(list.height, 0);
});

test('ami déjà dans la liste : sa ligne, cliquée comme par l’utilisateur (la conversation du site)', async ({ page }) => {
  await openDms(page);
  await compose(page).click();
  await dialog(page).getByRole('button', { name: 'Écrire à AlakazM' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(chatName(page)).toHaveText('AlakazM');
  await expect(chats(page)).toHaveClass(/wm-dms-docked/);
  await expect(row(page, 'AlakazM')).toHaveClass(/wm-dms-active/);
  expect((await seen(page)).openings).toEqual([['AlakazM', 'page']]);
});

test('ami sans conversation : la sienne s’ouvre sur place, à droite ; après le premier message, elle entre en tête de la liste', async ({ page }) => {
  const { sent } = await openDms(page);
  await compose(page).click();
  await dialog(page).getByRole('button', { name: 'Écrire à Bruno' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(chatName(page)).toHaveText('Bruno');
  await expect(chats(page)).toHaveClass(/wm-dms-docked/);
  expect(await seen(page)).toMatchObject({
    openings: [['Bruno', 'script']],
    chat: { peer: { id: 'u-bruno', username: 'Bruno', avatar_url: null, avatar_pos_x: 20, avatar_pos_y: 80 }, currentUserId: 'u0' },
    contexts: ['u0'],
  });
  await expect(rows(page)).toHaveCount(2);

  await chats(page).getByRole('textbox', { name: 'Votre message' }).fill('Premier message');
  await chats(page).getByRole('button', { name: 'Envoyer' }).click();
  await expect(chats(page)).toContainText('Premier message');
  expect(sent).toEqual([{ peer: 'u-bruno', content: 'Premier message' }]);
  await expect(rows(page).locator('p.font-medium')).toHaveText(['Bruno', 'AlakazM', 'Poloz30']);
  await expect(rows(page).first()).toContainText('Premier message');
  await expect(row(page, 'Bruno')).toHaveClass(/wm-dms-active/);

  // Un deuxième message ne la rajoute pas.
  await chats(page).getByRole('button', { name: 'Envoyer' }).click();
  await expect.poll(() => sent.length).toBe(2);
  await expect(rows(page)).toHaveCount(3);

  // Une autre ligne : celle ouverte par le script se ferme, celle du site s'ouvre à sa place.
  await row(page, 'AlakazM').click();
  await expect(chatName(page)).toHaveText('AlakazM');
  await expect(chats(page)).toHaveCount(1);
  expect((await seen(page)).openings).toEqual([
    ['Bruno', 'script'],
    ['AlakazM', 'page'],
  ]);
});

test('une conversation affichée : fermée par le site d’abord, puis celle de l’ami choisi', async ({ page }) => {
  await openDms(page);
  await row(page, 'Poloz30').click();
  await expect(chatName(page)).toHaveText('Poloz30');
  await compose(page).click();
  await dialog(page).getByRole('button', { name: 'Écrire à Zoé' }).click();
  await expect(chatName(page)).toHaveText('Zoé');
  await expect(chats(page)).toHaveCount(1);
  expect(await seen(page)).toMatchObject({ openings: [['Poloz30', 'page'], ['Zoé', 'script']], listReads: 1 });
  await expect(page.locator('.wm-dms-active')).toHaveCount(0);
});

test('aucune conversation affichée : « Nouveau message » aussi sous « Choisissez une conversation. »', async ({ page }) => {
  await openDms(page);
  const panel = page.locator('.wm-dms-panel');
  await expect(panel).toContainText('Choisissez une conversation.');
  await panel.getByRole('button', { name: 'Nouveau message' }).click();
  await expect(dialog(page).locator('.wm-picker-name')).toHaveText(['AlakazM', 'Bruno', 'Zoé']);
  await dialog(page).getByRole('button', { name: 'Écrire à Zoé' }).click();
  await expect(chatName(page)).toHaveText('Zoé');
  await expect(chats(page)).toHaveClass(/wm-dms-docked/);
});

test('page étroite : le bouton au titre, la conversation en modale', async ({ page }) => {
  await openDms(page, { width: 800 });
  await expect(page.locator('.wm-dms-panel')).toHaveCount(0);
  await compose(page).click();
  await dialog(page).getByRole('button', { name: 'Écrire à Bruno' }).click();
  await expect(chatName(page)).toHaveText('Bruno');
  await expect(chats(page)).not.toHaveClass(/wm-dms-docked/);
});

test('amis en échec : « Réessayer » relit la liste', async ({ page }) => {
  await openDms(page, { friends: [500, FRIENDS] });
  await compose(page).click();
  await expect(dialog(page)).toContainText('Le chargement de vos amis a échoué.');
  await dialog(page).getByRole('button', { name: 'Réessayer' }).click();
  await expect(dialog(page).locator('.wm-picker-name')).toHaveText(['AlakazM', 'Bruno', 'Zoé']);
});

test('au repos : pas de boucle', async ({ page }) => {
  await openDms(page);
  await expect(compose(page)).toBeVisible();
  await expectDomIdle(page);
});
