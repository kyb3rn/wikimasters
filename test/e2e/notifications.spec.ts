import { expect, test, type Page } from '@playwright/test';
import { letTimePass, openSite, presetSettings, rect, sitePage } from './support/site';

const BELL = '.wm-root button[aria-label="Notifications"]';
const SITE_BELL = 'button[aria-label="Notifications"]:not(.wm-root *)';
const PANEL = '.wm-notifications-panel';
const DESKTOP_BOX = 'div.hidden.md\\:block';
const MOBILE_BAR = 'div.fixed.left-0.right-0';

/**
 * Cloche du site imitée : son état est celui d'un fournisseur React (liste, puis actions plus bas), lu par le
 * script sur le fiber de la cloche ; la pastille (texte de la cloche) suit le nombre de non lues, comme chez lui.
 */
const FAKE_PROVIDER = `
const state = {
  list: [
    { id: 's2', user_id: 'u', type: 'marketplace_outbid', data: { title: 'Surenchéri', card_title: 'Opale', auction_id: 'a2' }, read: false, created_at: '2026-09-30T12:00:00Z' },
    { id: 's1', user_id: 'u', type: 'marketplace_auction_sold', data: { title: 'Vendue', card_title: 'Tourmaline', auction_id: 'a1' }, read: false, created_at: '2026-09-30T10:00:00Z' },
  ],
};
window.__fetches = 0;
const bell = document.querySelector('button[aria-label="Notifications"]');
const rerender = () => {
  const unread = state.list.filter((n) => !n.read).length;
  bell.textContent = unread > 0 ? '🔔' + unread : '🔔';
};
const actions = {
  markAsRead(ids) { state.list = state.list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)); rerender(); },
  markAllAsRead() { state.list = state.list.map((n) => ({ ...n, read: true })); rerender(); },
  fetchNotifications() { window.__fetches++; },
};
const listFiber = { memoizedProps: { get value() { return state.list; } }, return: null };
const actionsFiber = { memoizedProps: { value: actions }, return: listFiber };
bell['__reactFiber$test'] = { memoizedProps: {}, stateNode: bell, return: actionsFiber };
window.__push = (n) => { state.list = [n, ...state.list]; rerender(); };
rerender();
`;

/** Notification du script gardée d'une visite précédente. */
const LOCAL = [
  {
    id: 'wm-1',
    title: 'Enchère publiée',
    message: '« Opale » est aux enchères.',
    variant: 'success',
    createdAt: Date.parse('2026-09-30T11:00:00Z'),
    read: false,
    href: '/marketplace/a3',
  },
];

async function openWithBell(page: Page): Promise<unknown[]> {
  const patches: unknown[] = [];
  await page.addInitScript((local) => {
    if (!localStorage.getItem('wm-notifications-v1')) localStorage.setItem('wm-notifications-v1', local);
  }, JSON.stringify(LOCAL));
  await openSite(page, '/pulls', {
    html: sitePage('<h1>Paquets</h1>', FAKE_PROVIDER),
    handle: async (route, url) => {
      if (url.pathname !== '/api/notifications') return false;
      if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
      await route.fulfill({ json: { success: true } });
      return true;
    },
  });
  return patches;
}

test("la cloche passe entre l'engrenage et le solde, celle du site est cachée", async ({ page }) => {
  await openWithBell(page);
  const box = page.locator(DESKTOP_BOX);
  await expect(box.locator(BELL)).toBeVisible();
  const order = await box.evaluate((node) =>
    [...node.children].map((child) => child.querySelector('button')?.getAttribute('aria-label') ?? child.getAttribute('aria-label')),
  );
  expect(order).toEqual(['Paramètres WikiMasters', 'Notifications', 'Ouvrir la boutique WikiBidous']);
  // Next.js rend lui-même <html> : React en réécrit la classe, la cloche du site doit rester cachée.
  await page.evaluate(() => {
    document.documentElement.className = 'h-full';
  });
  // Cachée dès le chargement, même là où elle serait affichée (barre mobile).
  await page.setViewportSize({ width: 400, height: 800 });
  await expect(page.locator(SITE_BELL)).toBeHidden();
  await expect(page.locator(MOBILE_BAR).locator(BELL)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  // Deux du site et une du script, non lues.
  await expect(box.locator(BELL)).toContainText('3');
});

test("chaque ligne montre l'âge de la notification, la date et l'heure au survol", async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T12:05:30Z'));
  await openWithBell(page);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const rows = page.locator(PANEL).locator(':scope > div:last-child > *');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Il y a 5 min');
  await expect(rows.nth(1)).toContainText('Il y a 1 h');
  await expect(rows.nth(2)).toContainText('Il y a 2 h');
  const date = rows.nth(0).locator('.wm-notification-date');
  await expect(date).toBeHidden();
  await rows.nth(0).hover();
  await expect(date).toBeVisible();
  await expect(date).toHaveText(/\(30 sept\., \d\d:\d\d\)/);
  await rows.nth(1).hover();
  await expect(date).toBeHidden();
});

test('la liste de 460 × 550 mêle site et script, « Tout marquer comme lu » les lit toutes', async ({ page }) => {
  const patches = await openWithBell(page);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  // React retire de <body> ce qu'on y a posé pendant le chargement : la liste n'y est montée qu'à l'ouverture.
  await expect(bell).toContainText('3');
  await page.evaluate(() => document.querySelectorAll('body > div.wm-root').forEach((node) => node.remove()));
  await bell.click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();
  const size = await rect(panel);
  expect(Math.round(size.width)).toBe(460);
  expect(Math.round(size.height)).toBe(550);
  // Relue à l'ouverture, comme le fait la cloche du site.
  expect(await page.evaluate(() => (window as unknown as { __fetches: number }).__fetches)).toBe(1);

  const rows = panel.locator(':scope > div:last-child > *');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Surenchéri');
  await expect(rows.nth(1)).toContainText('Enchère publiée');
  await expect(rows.nth(2)).toContainText('Votre carte « Tourmaline » a été vendue !');

  const markAll = panel.getByRole('button', { name: 'Tout marquer comme lu' });
  await expect(markAll).toHaveClass(/wm-button-standard/);
  await markAll.click();
  await expect(bell).not.toContainText(/\d/);
  await expect(markAll).toBeDisabled();
  expect(patches).toEqual([{}]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wm-notifications-v1') ?? '[]') as { read: boolean }[]);
  expect(stored.every((n) => n.read)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('une notification du site lue au clic ouvre sa page', async ({ page }) => {
  const patches = await openWithBell(page);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await page.locator(PANEL).getByText('Votre carte « Tourmaline » a été vendue !').click();
  await page.waitForURL('**/marketplace/a1');
  expect(patches).toEqual([{ ids: ['s1'] }]);
});

test('chaque nouvelle notification du site arrive aussi en toast, en bas à droite', async ({ page }) => {
  await openWithBell(page);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await expect(bell).toContainText('3');
  await page.evaluate(() =>
    (window as unknown as { __push: (n: unknown) => void }).__push({
      id: 's3',
      user_id: 'u',
      type: 'trade_offer',
      data: { title: 'Offre', initiator_username: 'Léa' },
      read: false,
      created_at: '2026-09-30T13:00:00Z',
    }),
  );
  const toast = page.locator('.wm-toaster[data-position="bottom-right"] .wm-toast');
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText("Offre d'échange");
  await expect(toast).toContainText('Léa vous propose un échange');
  await expect(bell).toContainText('4');
});

test("toasts coupés : la notification n'arrive que dans la liste", async ({ page }) => {
  await presetSettings(page, { features: {}, values: { notifications: { toasts: false } } });
  await openWithBell(page);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await expect(bell).toContainText('3');
  await page.evaluate(() =>
    (window as unknown as { __push: (n: unknown) => void }).__push({
      id: 's3',
      user_id: 'u',
      type: 'friend_request',
      data: { requester_username: 'Léa' },
      read: false,
      created_at: '2026-09-30T13:00:00Z',
    }),
  );
  await expect(bell).toContainText('4');
  await letTimePass(page, 700);
  await expect(page.locator('.wm-toast')).toHaveCount(0);
});

test('état du site illisible : sa cloche reprend la main après quelques secondes', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await openSite(page, '/pulls');
  const mobile = page.locator(MOBILE_BAR);
  await expect(mobile.locator(BELL)).toBeVisible();
  await expect(mobile.locator(SITE_BELL)).toBeHidden();
  await expect(mobile.locator(BELL)).toHaveCount(0, { timeout: 10_000 });
  await expect(mobile.locator(SITE_BELL)).toBeVisible();
});

test('Ctrl+clic : lien laissé au navigateur (nouvel onglet), la page reste, la notification est lue', async ({ page }) => {
  const patches = await openWithBell(page);
  // Un onglet ouvert par Ctrl+clic échappe aux routes du test (il irait au vrai site) : le clic est annulé après
  // notre code, qui ne doit pas l'avoir annulé lui-même.
  await page.evaluate(() => {
    window.addEventListener('click', (event) => {
      (window as unknown as { __prevented: boolean }).__prevented = event.defaultPrevented;
      event.preventDefault();
    });
  });
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const row = page.locator(PANEL).getByRole('link', { name: /Tourmaline/ });
  await expect(row).toHaveAttribute('href', '/marketplace/a1');
  await row.click({ modifiers: ['ControlOrMeta'] });
  expect(await page.evaluate(() => (window as unknown as { __prevented: boolean }).__prevented)).toBe(false);
  await expect.poll(() => patches).toEqual([{ ids: ['s1'] }]);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('2');
  await expect(page.locator(PANEL)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pulls');
});
