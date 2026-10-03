import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage, SUPABASE } from './support/site';
import { serveChunk, SITE_MODULES, SITE_ROUTER } from './support/site-modules';

/**
 * Page /dms imitée (captures du 29/09/2026) : une ligne par conversation, conversation en modale (portail dans
 * `body`) sous son composant `{ peer, currentUserId, onClose }` (état React), lui-même sous la session. Modules du
 * site et routeur imités (`SITE_MODULES`, `SITE_ROUTER`) : la fenêtre d'échange n'est pas dans la page, le
 * préchargement de la page Amis pose ses morceaux.
 */
const PEERS: Record<string, string> = { AlakazM: 'u-alakazm', Poloz30: 'u-poloz' };

const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6" id="page">
    <div class="animate-fade-in-up"><h1>Messages</h1><p>Toutes vos conversations</p></div>
    <div class="space-y-1 animate-fade-in-up" id="list">${Object.keys(PEERS)
      .map(
        (name) =>
          `<button class="w-full flex items-center gap-3 p-3 rounded-xl text-left"><div class="relative flex-shrink-0">` +
          `<div class="w-11 h-11 rounded-full"><span>${name.slice(0, 2)}</span></div></div><div class="flex-1 min-w-0">` +
          `<div class="flex items-center justify-between gap-2"><p class="font-medium text-sm truncate">${name}</p>` +
          `<span>18:26</span></div><p class="text-xs truncate mt-0.5">Salut</p></div></button>`,
      )
      .join('')}</div>
  </div>`,
  `${SITE_MODULES}
${SITE_ROUTER}
window.prefetchChunks = ['amis', 'echange'];
const PEERS = ${JSON.stringify(PEERS)};
const session = { type: { $$typeof: Symbol.for('react.context') }, memoizedProps: { value: 'u0', children: null }, return: null };
window.closeChat = () => document.getElementById('chat')?.remove();
window.openChat = (name, guild) => {
  window.closeChat();
  document.body.insertAdjacentHTML('beforeend',
    '<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" id="chat">' +
      '<div class="w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col card-frame rounded-t-2xl sm:rounded-2xl overflow-hidden' + (guild ? ' wm-guild-chat' : '') + '">' +
        '<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">' +
          '<div class="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden"><span>' + name.slice(0, 2) + '</span></div>' +
          '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + name + '</p></div>' +
          '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>' +
        '</div>' +
        '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"><p>Message de ' + name + '</p></div>' +
      '</div>' +
    '</div>');
  const chat = document.getElementById('chat');
  const peer = { id: PEERS[name], username: name, avatar_url: null };
  chat.firstElementChild['__reactFiber$test'] = {
    memoizedProps: {},
    return: { memoizedProps: { peer, currentUserId: 'u0', onClose: window.closeChat }, return: session },
  };
  chat.querySelector('button[aria-label="Fermer"]').addEventListener('click', window.closeChat);
};
document.getElementById('list').addEventListener('click', (event) => {
  const row = event.target.closest('button');
  if (row) window.openChat(row.querySelector('p').textContent);
});`,
).replace(
  '<main>',
  // Classes du site utiles aux mesures, sans poids (comme ses utilitaires Tailwind, en couche) : nos règles l'emportent.
  `<style>
  :where(.card-frame) { background: #161b22; }
  :where(.sm\\:max-w-md) { max-width: 28rem; width: 100%; }
  :where(.sm\\:h-\\[600px\\]) { height: 600px; }
  :where(#chat div.border-b) { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
  :where(#chat div.border-b > .w-9) { width: 36px; height: 36px; }
  :where(#chat .flex-1) { flex: 1; min-width: 0; }
  :where(#chat p) { margin: 0; }
  </style><main>`,
);

async function openDms(page: Page, width = 1400): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.route(`${SUPABASE}/**`, (route) => route.fulfill({ json: [] }));
  await openSite(page, '/dms', { html: HTML, handle: (route, url) => serveChunk(route, url) });
}

const row = (page: Page, name: string) => page.locator('#list button', { hasText: name });
const header = (page: Page) => page.locator('#chat div.border-b');
const trade = (page: Page) => header(page).getByRole('button', { name: 'Échanger' });
/** Pseudo de l'en-tête (lien vers son profil, posé par player-links). */
const pseudo = (page: Page, name: string) => header(page).getByRole('link', { name, exact: true });

/** Valeurs posées par les modules imités. */
const shown = (page: Page) =>
  page.evaluate(() => {
    const seen = window as unknown as Record<string, unknown>;
    return { trade: seen.tradeProps, contexts: seen.shownContexts, prefetched: seen.prefetched };
  });

test('conversation ouverte : « Échanger » au bout de l’en-tête, sur la ligne du pseudo ; la fenêtre d’échange du site s’ouvre sur place pour cet ami', async ({ page }) => {
  await openDms(page);
  await expect(page.getByRole('button', { name: 'Échanger' })).toHaveCount(0);
  await row(page, 'AlakazM').click();
  await expect(page.locator('#chat')).toHaveClass(/wm-dms-docked/);

  const button = trade(page);
  await expect(button).toBeVisible();
  const [line, name, box] = await Promise.all([rect(header(page)), rect(pseudo(page, 'AlakazM')), rect(button)]);
  expect(box.x).toBeGreaterThan(name.x);
  expect(line.x + line.width - (box.x + box.width)).toBeLessThanOrEqual(17);
  expect(Math.abs(box.y + box.height / 2 - (name.y + name.height / 2))).toBeLessThan(2);

  await button.click();
  await expect(page.locator('#trade-window h2')).toHaveText('Échanger avec AlakazM');
  await expect(button).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe('/dms');
  expect(await shown(page)).toEqual({
    trade: { friendUsername: 'AlakazM', friendProfileId: 'u-alakazm' },
    contexts: ['u0'],
    prefetched: [['/friends', { kind: 'full' }]],
  });
  await page.locator('#trade-cancel').click();
  await expect(page.locator('#trade-window')).toHaveCount(0);
  await expect(page.locator('#chat')).toBeVisible();

  // Autre conversation : l'échange avec cet autre ami, sans nouveau préchargement ; une offre envoyée ferme la fenêtre.
  await row(page, 'Poloz30').click();
  await expect(pseudo(page, 'Poloz30')).toBeVisible();
  await trade(page).click();
  await expect(page.locator('#trade-window h2')).toHaveText('Échanger avec Poloz30');
  expect(await shown(page)).toMatchObject({ trade: { friendProfileId: 'u-poloz' }, prefetched: [['/friends', { kind: 'full' }]] });
  await page.locator('#trade-send').click();
  await expect(page.locator('#trade-window')).toHaveCount(0);
});

test('conversation en modale (page étroite) : « Échanger » au bout de l’en-tête, avant la place gardée à la croix', async ({ page }) => {
  await openDms(page, 800);
  await row(page, 'AlakazM').click();
  const button = trade(page);
  await expect(button).toBeVisible();
  await expect(page.locator('#chat').getByRole('button', { name: 'Fermer' })).toBeVisible();
  // La croix du script est posée dans le coin par les classes du site (absentes ici) ; l'en-tête lui garde sa place.
  const room = await header(page).evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight));
  expect(room).toBeGreaterThan(40);
  const [line, box] = await Promise.all([rect(header(page)), rect(button)]);
  expect(Math.abs(line.x + line.width - room - (box.x + box.width))).toBeLessThan(1);
  await button.click();
  await expect(page.locator('#trade-window')).toBeVisible();
});

test('conversation de la guilde (à nous) : pas d’« Échanger »', async ({ page }) => {
  await openDms(page);
  await page.evaluate(() => (window as unknown as { openChat: (name: string, guild: boolean) => void }).openChat('Guilde', true));
  await expect(header(page)).toContainText('Guilde');
  await page.waitForTimeout(100);
  await expect(page.getByRole('button', { name: 'Échanger' })).toHaveCount(0);
});

test('« Échanger » sans les modules du site (le site a changé) : toast, le bouton revient', async ({ page }) => {
  await openDms(page);
  await row(page, 'AlakazM').click();
  await page.evaluate(() => Reflect.deleteProperty(window, 'TURBOPACK'));
  await trade(page).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Échanges');
  await expect(alert).toContainText("La fenêtre d'échange du site n'a pas pu s'ouvrir.");
  await expect(trade(page)).toBeEnabled();
});

test('au repos, conversation ouverte : pas de boucle', async ({ page }) => {
  await openDms(page);
  await row(page, 'AlakazM').click();
  await expect(trade(page)).toBeVisible();
  await expectDomIdle(page);
});
