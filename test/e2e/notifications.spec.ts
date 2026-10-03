import { expect, test, type Page, type Route } from '@playwright/test';
import { fakeBellProvider } from './support/bell';
import { openFriendsPage } from './support/friends';
import { FAKE_JWT, letTimePass, openSite, presetSettings, rect, sitePage, SUPABASE } from './support/site';

const BELL = '.wm-root button[aria-label="Notifications"]';
const SITE_BELL = 'button[aria-label="Notifications"]:not(.wm-root *)';
const PANEL = '.wm-notifications-panel';
const DESKTOP_BOX = 'div.hidden.md\\:block';
const MOBILE_BAR = 'div.fixed.left-0.right-0';

const SOLD = {
  id: 's1',
  user_id: 'u',
  type: 'marketplace_auction_sold',
  data: { title: 'Vendue', card_title: 'Tourmaline', auction_id: 'a1' },
  read: false,
  created_at: '2026-09-30T10:00:00Z',
};
const SITE_LIST = [
  {
    id: 's2',
    user_id: 'u',
    type: 'marketplace_outbid',
    data: { title: 'Surenchéri', card_title: 'Opale', auction_id: 'a2' },
    read: false,
    created_at: '2026-09-30T12:00:00Z',
  },
  SOLD,
];

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

/** Réponse du faux serveur à une requête autre que `/api/notifications` ; faux : laissée aux réponses par défaut. */
type Handle = (route: Route, url: URL) => Promise<boolean>;

async function openWithBell(page: Page, list: readonly unknown[] = SITE_LIST, other?: Handle): Promise<unknown[]> {
  const patches: unknown[] = [];
  await page.addInitScript((local) => {
    if (!localStorage.getItem('wm-notifications-v1')) localStorage.setItem('wm-notifications-v1', local);
  }, JSON.stringify(LOCAL));
  await openSite(page, '/pulls', {
    html: sitePage('<h1>Paquets</h1>', fakeBellProvider(list)),
    handle: async (route, url) => {
      if (url.pathname !== '/api/notifications') return other ? other(route, url) : false;
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

test('une lecture vaut aussi dans les autres onglets, sans requête de leur part', async ({ page }) => {
  const other = await page.context().newPage();
  const otherPatches = await openWithBell(other);
  await openWithBell(page);
  const otherBell = other.locator(DESKTOP_BOX).locator(BELL);
  await expect(otherBell).toContainText('3');
  // Arrivée là-bas après le départ de la requête : le serveur l'a laissée non lue.
  await other.evaluate(() =>
    (window as unknown as { __push: (n: unknown) => void }).__push({
      id: 's3',
      user_id: 'u',
      type: 'friend_request',
      data: { requester_username: 'Léa' },
      read: false,
      created_at: '2099-01-01T00:00:00Z',
    }),
  );
  await expect(otherBell).toContainText('4');

  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await page.locator(PANEL).getByText('Votre carte « Tourmaline » a été vendue !').click();
  await page.waitForURL('**/marketplace/a1');
  await expect(otherBell).toContainText('3');

  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await page.locator(PANEL).getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(otherBell).toContainText('1');
  expect(otherPatches).toEqual([]);
  expect(await other.evaluate(() => (window as unknown as { __fetches: number }).__fetches)).toBe(0);
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

test('toast : « Voir » est un vrai lien, Ctrl+clic comme dans la liste (autre onglet, lue, toast fermé)', async ({ page }) => {
  const patches = await openWithBell(page);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await expect(bell).toContainText('3');
  await page.evaluate(() => {
    window.addEventListener('click', (event) => {
      (window as unknown as { __prevented: boolean }).__prevented = event.defaultPrevented;
      event.preventDefault();
    });
    (window as unknown as { __push: (n: unknown) => void }).__push({
      id: 's3',
      user_id: 'u',
      type: 'marketplace_auction_won',
      data: { title: 'Gagnée', card_title: 'Saphir', auction_id: 'a5' },
      read: false,
      created_at: '2026-09-30T13:00:00Z',
    });
  });
  const toast = page.locator('.wm-toaster[data-position="bottom-right"] .wm-toast');
  const link = toast.getByRole('link', { name: 'Voir' });
  await expect(link).toHaveAttribute('href', '/marketplace/a5');
  await expect(bell).toContainText('4');
  await link.click({ modifiers: ['ControlOrMeta'] });
  expect(await page.evaluate(() => (window as unknown as { __prevented: boolean }).__prevented)).toBe(false);
  await expect.poll(() => patches).toEqual([{ ids: ['s3'] }]);
  await expect(bell).toContainText('3');
  await expect(toast).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/pulls');
});

test('toast : clic simple sur « Voir », navigation du site et notification lue', async ({ page }) => {
  const patches = await openWithBell(page);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('3');
  await page.evaluate(() =>
    (window as unknown as { __push: (n: unknown) => void }).__push({
      id: 's3',
      user_id: 'u',
      type: 'marketplace_auction_won',
      data: { title: 'Gagnée', card_title: 'Saphir', auction_id: 'a5' },
      read: false,
      created_at: '2026-09-30T13:00:00Z',
    }),
  );
  await page.locator('.wm-toast').getByRole('link', { name: 'Voir' }).click();
  await page.waitForURL('**/marketplace/a5');
  expect(patches).toEqual([{ ids: ['s3'] }]);
});

test('filtres par type : cases à icône, plusieurs à la fois, gardés d’une ouverture à l’autre', async ({ page }) => {
  const unknown = { id: 's9', user_id: 'u', type: 'jamais_vu', data: { message: 'Nouveauté' }, read: true, created_at: '2026-09-30T09:00:00Z' };
  const patches = await openWithBell(page, [...SITE_LIST, unknown]);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await bell.click();
  const panel = page.locator(PANEL);
  const rows = panel.locator(':scope > div:last-child > *');
  await expect(rows).toHaveCount(4);

  const filters = panel.getByRole('group', { name: 'Types de notification' });
  const cases = filters.locator('button[aria-pressed]');
  await expect(cases).toHaveCount(8);
  expect(await cases.evaluateAll((buttons) => buttons.map((b) => [b.getAttribute('aria-label'), b.getAttribute('title'), b.querySelector('svg') !== null]))).toEqual(
    [
      'Messages',
      'Enchères gagnées et surenchères',
      'Mises en vente',
      'Cartes vendues',
      'Liste de souhaits',
      "Demandes d'ami",
      'Échanges',
      'Autres',
    ].map((name) => [name, name, true]),
  );

  // Pastille rouge des non lues de chaque catégorie, s'il y en a.
  const badges = () => cases.evaluateAll((buttons) => buttons.map((b) => b.querySelector('.wm-case-badge')?.textContent ?? ''));
  expect(await badges()).toEqual(['', '1', '1', '1', '', '', '', '']);

  const sold = filters.getByRole('button', { name: 'Cartes vendues' });
  await sold.click();
  await expect(sold).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Tourmaline');
  // Notification du script gardée d'avant les genres : reconnue à son titre.
  await filters.getByRole('button', { name: 'Mises en vente' }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Enchère publiée');
  // La pastille compte toujours toutes les non lues, et « Tout marquer comme lu » les lit toutes (choix de l'utilisateur).
  await expect(bell).toContainText('3');

  await page.keyboard.press('Escape');
  await bell.click();
  await expect(rows).toHaveCount(2);
  await expect(filters.getByRole('button', { name: 'Mises en vente' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('wm-notifications-filter-v1'))).toBe('["listings","sales"]');
  await panel.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(bell).not.toContainText(/\d/);
  expect(patches).toEqual([{}]);
  await expect.poll(badges).toEqual(['', '', '', '', '', '', '', '']);

  await filters.getByRole('button', { name: 'Afficher tous les types' }).click();
  await expect(rows).toHaveCount(4);
  await expect(cases.and(page.locator('[aria-pressed="true"]'))).toHaveCount(0);
  await filters.getByRole('button', { name: 'Autres' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Nouveauté');
  await filters.getByRole('button', { name: 'Autres' }).click();
  await filters.getByRole('button', { name: 'Messages' }).click();
  await expect(panel).toContainText('Aucune notification de ce type');
  await filters.getByRole('button', { name: 'Échanges' }).click();
  await expect(panel).toContainText('Aucune notification de ces types');
});

/** Carte de ma liste de souhaits mise en vente (texte du site, 01/10/2026). */
const WISHLIST_LISTED = {
  id: 'w1',
  user_id: 'u',
  type: 'marketplace_wishlist_listed',
  data: {
    title: 'Carte de votre liste de souhaits',
    message: "« Opale » de votre liste de souhaits vient d'être mise en vente.",
    card_id: 'c1',
    card_title: 'Opale',
    auction_id: 'a4',
  },
  read: false,
  created_at: '2026-09-30T12:00:00Z',
};

const BOOKMARK_PATH = 'M17 3a2 2 0 0 1 2 2v15';

interface WishServer {
  /** Requêtes à `wishlist_items` : méthode, adresse, corps. */
  readonly calls: { method: string; url: string; body: unknown }[];
  /** Réponse retenue jusqu'à `release()`. */
  hold: boolean;
  release: () => void;
  status: number;
}

/** Supabase imité, puis la session du site vue par le script (comme une requête du site). */
async function openWithWishlist(page: Page): Promise<{ server: WishServer; patches: unknown[] }> {
  const server: WishServer = { calls: [], hold: false, release: () => {}, status: 0 };
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname !== '/rest/v1/wishlist_items') return route.fulfill({ json: [] });
    const raw = request.postData();
    server.calls.push({ method: request.method(), url: decodeURIComponent(url.pathname + url.search), body: raw ? (JSON.parse(raw) as unknown) : undefined });
    if (server.hold) await new Promise<void>((resolve) => (server.release = resolve));
    if (server.status >= 400) return route.fulfill({ status: server.status, json: { code: 'XX', message: 'refus' } });
    return route.fulfill({ status: request.method() === 'DELETE' ? 204 : 201, body: '' });
  });
  const patches = await openWithBell(page, [WISHLIST_LISTED, SOLD]);
  await page.evaluate(
    ([base, jwt]) => fetch(`${base}/rest/v1/profiles?select=id`, { headers: { apikey: 'cle-publique', authorization: `Bearer ${jwt}` } }),
    [SUPABASE, FAKE_JWT],
  );
  server.calls.length = 0;
  return { server, patches };
}

test("liste de souhaits : son icône, et un bouton pour en retirer la carte (ou l'y remettre)", async ({ page }) => {
  const { server, patches } = await openWithWishlist(page);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const row = page.locator(PANEL).locator('.wm-notification-action-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Liste de souhaits');
  await expect(row.locator(`svg path[d^="${BOOKMARK_PATH}"]`).first()).toBeVisible();

  const wish = row.getByRole('button', { name: 'Retirer de la liste de souhaits' });
  await expect(wish).toHaveClass(/wm-button-standard/);
  await expect(wish).toHaveClass(/wm-solid/);
  server.hold = true;
  await wish.click();
  await expect(wish).toBeDisabled();
  await expect(wish).toHaveAttribute('aria-busy', 'true');
  expect(server.calls).toEqual([{ method: 'DELETE', url: '/rest/v1/wishlist_items?user_id=eq.u0&card_id=eq.c1', body: undefined }]);
  server.release();
  const add = row.getByRole('button', { name: 'Ajouter à la liste de souhaits' });
  await expect(add).toBeEnabled();
  await expect(add).not.toHaveClass(/wm-solid/);
  // La liste reste ouverte, la notification n'est pas lue pour autant.
  await expect(page.locator(PANEL)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pulls');
  expect(patches).toEqual([]);
  const removed = await page.evaluate(() => JSON.parse(localStorage.getItem('wm-wishlist-removed-v1') ?? '{}') as Record<string, number>);
  expect(Object.keys(removed)).toEqual(['c1']);

  server.hold = false;
  await add.click();
  await expect(row.getByRole('button', { name: 'Retirer de la liste de souhaits' })).toBeEnabled();
  expect(server.calls[1]).toEqual({ method: 'POST', url: '/rest/v1/wishlist_items', body: { user_id: 'u0', card_id: 'c1' } });

  // Retirée par le site lui-même (modale de carte) : le bouton suit.
  await page.evaluate(
    ([base, jwt]) =>
      fetch(`${base}/rest/v1/wishlist_items?user_id=eq.u0&card_id=eq.c1`, {
        method: 'DELETE',
        headers: { apikey: 'cle-publique', authorization: `Bearer ${jwt}` },
      }),
    [SUPABASE, FAKE_JWT],
  );
  await expect(row.getByRole('button', { name: 'Ajouter à la liste de souhaits' })).toBeVisible();

  // Le reste de la ligne ouvre l'enchère, comme les autres : son lien est étalé sous le texte.
  const link = row.getByRole('link', { name: /vient d'être mise en vente/ });
  await expect(link).toHaveAttribute('href', '/marketplace/a4');
  await link.click({ position: { x: 100, y: 16 } });
  await page.waitForURL('**/marketplace/a4');
  await expect.poll(() => patches).toEqual([{ ids: ['w1'] }]);
});

test('liste de souhaits : retrait refusé, message en toast et bouton inchangé', async ({ page }) => {
  const { server } = await openWithWishlist(page);
  server.status = 403;
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const wish = page.locator(PANEL).getByRole('button', { name: 'Retirer de la liste de souhaits' });
  await wish.click();
  const toast = page.locator('.wm-toast');
  await expect(toast).toContainText('Retrait impossible');
  await expect(toast).toContainText('Impossible de retirer la carte de la liste de souhaits (erreur 403).');
  await expect(wish).toBeEnabled();
});

test('liste de souhaits : retrait retenu au rechargement, oublié quand la carte est de nouveau notifiée', async ({ page }) => {
  const { server } = await openWithWishlist(page);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await bell.click();
  await page.locator(PANEL).getByRole('button', { name: 'Retirer de la liste de souhaits' }).click();
  await expect(page.locator(PANEL).getByRole('button', { name: 'Ajouter à la liste de souhaits' })).toBeEnabled();
  expect(server.calls).toHaveLength(1);

  // La notification, plus ancienne que le retrait, ne remet pas la carte dans la liste.
  await page.reload();
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await expect(page.locator(PANEL).getByRole('button', { name: 'Ajouter à la liste de souhaits' })).toBeVisible();

  // Nouvelle mise en vente notifiée : la carte a été remise dans la liste (ailleurs), les deux lignes le disent.
  await page.evaluate((listed) => {
    const fresh = { ...listed, id: 'w2', data: { ...listed.data, auction_id: 'a5' }, created_at: new Date(Date.now() + 5000).toISOString() };
    (window as unknown as { __push: (n: unknown) => void }).__push(fresh);
  }, WISHLIST_LISTED);
  const rows = page.locator(PANEL).locator('.wm-notification-action-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.getByRole('button', { name: 'Retirer de la liste de souhaits' })).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('wm-wishlist-removed-v1'))).toBe('{}');
});

/** Demande d'ami telle que le site la notifie (capture du 01/10/2026) : le joueur, pas l'id de l'amitié. */
const FRIEND_REQUEST = {
  id: 'fr1',
  user_id: 'u',
  type: 'friend_request',
  data: { title: "Nouvelle demande d'ami !", message: 'Léa souhaite devenir votre ami.', requester_id: 'u7', requester_username: 'Léa' },
  read: false,
  created_at: '2026-09-30T13:00:00Z',
};

const STATUS = '.wm-friend-request-status';
const STORED_REQUESTS = 'wm-friend-requests-v1';

const push = (page: Page, notification: unknown) =>
  page.evaluate((n) => (window as unknown as { __push: (n: unknown) => void }).__push(n), notification);

interface FriendsApi {
  /** Amitiés rendues par `GET /api/friends` (par défaut : la demande de Léa, en attente). */
  friendships: { id: string; status: string; requester_id: string; addressee_id: string }[];
  /** `GET /api/friends` reçus. */
  listed: number;
  /** `PATCH /api/friends/<id>` reçus. */
  readonly answered: { id: string; body: unknown }[];
  /** Réponse au `PATCH` retenue jusqu'à `release()`. */
  hold: boolean;
  release: () => void;
  status: number;
}

/** Routes des amitiés (et du profil de Léa), comme le site. */
function friendsApi(): { api: FriendsApi; handle: Handle } {
  const api: FriendsApi = {
    friendships: [{ id: 'r7', status: 'pending', requester_id: 'u7', addressee_id: 'u0' }],
    listed: 0,
    answered: [],
    hold: false,
    release: () => {},
    status: 200,
  };
  const handle: Handle = async (route, url) => {
    const method = route.request().method();
    if (url.pathname === '/api/friends' && method === 'GET') {
      api.listed++;
      await route.fulfill({ json: { friendships: api.friendships, counts: { accepted: 0, incoming: 1, outgoing: 0 } } });
      return true;
    }
    if (url.pathname === '/api/profile/L%C3%A9a') {
      await route.fulfill({ json: { profile: { id: 'u7', username: 'Léa', isOwn: false, isFriend: false, friendshipId: 'r7', pendingRequest: {} } } });
      return true;
    }
    const id = /^\/api\/friends\/([^/]+)$/.exec(url.pathname)?.[1];
    if (id === undefined || method !== 'PATCH') return false;
    api.answered.push({ id, body: route.request().postDataJSON() });
    if (api.hold) await new Promise<void>((resolve) => (api.release = resolve));
    if (api.status >= 400) await route.fulfill({ status: api.status, json: { error: 'Demande introuvable' } });
    else await route.fulfill({ json: { status: 'accepted' } });
    return true;
  };
  return { api, handle };
}

const storedRequests = (page: Page) => page.evaluate((key) => localStorage.getItem(key) ?? '', STORED_REQUESTS);

test("demande d'ami arrivée : Accepter / Refuser dans son toast ; Accepter lit l'amitié puis répond comme la page Amis", async ({ page }) => {
  const { api, handle } = friendsApi();
  const patches = await openWithBell(page, SITE_LIST, handle);
  const bell = page.locator(DESKTOP_BOX).locator(BELL);
  await expect(bell).toContainText('3');
  await push(page, FRIEND_REQUEST);
  const toast = page.locator('.wm-toaster[data-position="bottom-right"] .wm-toast');
  await expect(toast).toContainText("Demande d'ami");
  await expect(toast).toContainText('Léa veut être votre ami');
  await expect(toast.getByRole('link', { name: 'Voir' })).toHaveCount(0);
  await expect(bell).toContainText('4');

  const accept = toast.getByRole('button', { name: 'Accepter' });
  const decline = toast.getByRole('button', { name: 'Refuser' });
  await expect(accept).toHaveClass(/wm-button-standard/);
  await expect(accept).not.toHaveClass(/wm-solid/);
  api.hold = true;
  await accept.click();
  await expect(accept).toBeDisabled();
  await expect(accept).toHaveAttribute('aria-busy', 'true');
  await expect(decline).toBeDisabled();
  await expect(decline).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => api.answered).toEqual([{ id: 'r7', body: { action: 'accept' } }]);
  expect(api.listed).toBe(1);
  api.release();

  await expect(toast.locator(STATUS)).toHaveText('Demande acceptée');
  await expect(toast.getByRole('button', { name: /Accepter|Refuser/ })).toHaveCount(0);
  await expect.poll(() => patches).toEqual([{ ids: ['fr1'] }]);
  await expect(bell).toContainText('3');
  expect(JSON.parse(await storedRequests(page))).toEqual({
    fr1: { requesterId: 'u7', state: 'accepted', friendshipId: 'r7', at: expect.any(Number) as unknown },
  });
});

test("liste : boutons sur les seules demandes arrivées sous les yeux du script ; Refuser sans relecture si l'amitié est connue", async ({ page }) => {
  const { api, handle } = friendsApi();
  const old = {
    ...FRIEND_REQUEST,
    id: 'fr0',
    data: { ...FRIEND_REQUEST.data, requester_id: 'u6', requester_username: 'Max' },
    created_at: '2026-09-30T09:00:00Z',
  };
  const patches = await openWithBell(page, [...SITE_LIST, old], handle);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('4');
  await push(page, FRIEND_REQUEST);
  await expect(page.locator('.wm-toast')).toContainText('Léa veut être votre ami');
  // Amitiés lues par le site (page Amis, « Choisir un ami ») : l'id de la demande est retenu.
  await page.evaluate(() => fetch('/api/friends'));
  await expect.poll(() => storedRequests(page)).toContain('"friendshipId":"r7"');

  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const panel = page.locator(PANEL);
  const row = panel.locator('.wm-notification-action-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Léa veut être votre ami');
  // Déjà là au chargement : le script ne sait pas ce qu'il en est advenu.
  await expect(panel.getByRole('link', { name: /Max veut être votre ami/ })).toBeVisible();

  const decline = row.getByRole('button', { name: 'Refuser' });
  await expect(decline).toHaveClass(/wm-button-standard/);
  await decline.click();
  await expect(row.locator(STATUS)).toHaveText('Demande refusée');
  await expect(row.getByRole('button')).toHaveCount(0);
  expect(api.answered).toEqual([{ id: 'r7', body: { action: 'decline' } }]);
  expect(api.listed).toBe(1);
  await expect.poll(() => patches).toEqual([{ ids: ['fr1'] }]);
  await expect(panel).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pulls');
});

test("demande d'ami retenue d'une visite précédente : ses boutons reviennent au chargement", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ fr1: { requesterId: 'u7', state: 'pending', friendshipId: 'r7', at: 1 } }));
  }, STORED_REQUESTS);
  const { api, handle } = friendsApi();
  await openWithBell(page, [FRIEND_REQUEST, ...SITE_LIST], handle);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const row = page.locator(PANEL).locator('.wm-notification-action-row');
  await row.getByRole('button', { name: 'Accepter' }).click();
  await expect(row.locator(STATUS)).toHaveText('Demande acceptée');
  expect(api.answered).toEqual([{ id: 'r7', body: { action: 'accept' } }]);
  expect(api.listed).toBe(0);
});

test("demande d'ami : refus du site en toast, ses boutons reviennent", async ({ page }) => {
  const { api, handle } = friendsApi();
  api.status = 403;
  const patches = await openWithBell(page, SITE_LIST, handle);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('3');
  await push(page, FRIEND_REQUEST);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const row = page.locator(PANEL).locator('.wm-notification-action-row');
  await row.getByRole('button', { name: 'Accepter' }).click();
  const error = page.getByRole('alert');
  await expect(error).toContainText('Acceptation impossible');
  await expect(error).toContainText('Demande introuvable');
  await expect(row.getByRole('button', { name: 'Accepter' })).toBeEnabled();
  await expect(row.getByRole('button', { name: 'Refuser' })).toBeEnabled();
  expect(patches).toEqual([]);
});

test("demande d'ami plus en attente (annulée, traitée ailleurs) : dit au clic, aucune réponse envoyée", async ({ page }) => {
  const { api, handle } = friendsApi();
  api.friendships = [];
  await openWithBell(page, SITE_LIST, handle);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('3');
  await push(page, FRIEND_REQUEST);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  const row = page.locator(PANEL).locator('.wm-notification-action-row');
  await row.getByRole('button', { name: 'Accepter' }).click();
  await expect(page.getByRole('alert')).toContainText("Cette demande n'est plus en attente.");
  await expect(row.locator(STATUS)).toHaveText('Demande plus en attente');
  expect(api.listed).toBe(1);
  expect(api.answered).toEqual([]);
});

test("demande d'ami refusée depuis le profil du joueur : la notification suit", async ({ page }) => {
  const { api, handle } = friendsApi();
  await openWithBell(page, SITE_LIST, handle);
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('3');
  await push(page, FRIEND_REQUEST);
  await expect(page.locator('.wm-toast')).toContainText('Léa veut être votre ami');
  await page.evaluate(() => fetch('/api/profile/L%C3%A9a'));
  await expect.poll(() => storedRequests(page)).toContain('"friendshipId":"r7"');
  await page.evaluate(() =>
    fetch('/api/friends/r7', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline' }) }),
  );
  await expect(page.locator('.wm-toast').locator(STATUS)).toHaveText('Demande refusée');
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await expect(page.locator(PANEL).locator(STATUS)).toHaveText('Demande refusée');
  expect(api.answered).toHaveLength(1);
  expect(api.listed).toBe(0);
});

test("demande d'ami : la réponse donnée dans un onglet vaut dans les autres, sans requête de leur part", async ({ page }) => {
  const other = await page.context().newPage();
  const elsewhere = friendsApi();
  const otherPatches = await openWithBell(other, SITE_LIST, elsewhere.handle);
  await openWithBell(page, SITE_LIST, friendsApi().handle);
  for (const tab of [other, page]) {
    await expect(tab.locator(DESKTOP_BOX).locator(BELL)).toContainText('3');
    await push(tab, FRIEND_REQUEST);
  }
  await other.locator(DESKTOP_BOX).locator(BELL).click();
  const otherRow = other.locator(PANEL).locator('.wm-notification-action-row');
  await expect(otherRow.getByRole('button', { name: 'Accepter' })).toBeEnabled();
  // Déjà lue partout : la réponse ne passe pas par l'annonce d'une lecture, qui ferait relire la liste là-bas.
  await other.locator(PANEL).getByRole('button', { name: 'Tout marquer comme lu' }).click();
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).not.toContainText(/\d/);

  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await page.locator(PANEL).getByRole('button', { name: 'Accepter' }).click();
  await expect(otherRow.locator(STATUS)).toHaveText('Demande acceptée');
  expect(elsewhere.api.listed).toBe(0);
  expect(elsewhere.api.answered).toEqual([]);
  expect(otherPatches).toEqual([{}]);
});

test('liste de souhaits : un retrait fait dans un autre onglet change le bouton de sa liste ouverte', async ({ page }) => {
  const other = await page.context().newPage();
  await openWithWishlist(other);
  await openWithWishlist(page);
  await other.locator(DESKTOP_BOX).locator(BELL).click();
  await expect(other.locator(PANEL).getByRole('button', { name: 'Retirer de la liste de souhaits' })).toBeEnabled();
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await page.locator(PANEL).getByRole('button', { name: 'Retirer de la liste de souhaits' }).click();
  await expect(other.locator(PANEL).getByRole('button', { name: 'Ajouter à la liste de souhaits' })).toBeEnabled();
});

test("demande d'ami acceptée sur la page Amis ouverte : la page suit sans relecture", async ({ page }) => {
  const server = await openFriendsPage(page, { script: fakeBellProvider([SOLD]) });
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('1');
  await push(page, { ...FRIEND_REQUEST, data: { ...FRIEND_REQUEST.data, requester_username: 'Mastonin' } });
  await page.locator('.wm-toast').getByRole('button', { name: 'Accepter' }).click();
  await expect(page.locator('.wm-toast').locator(STATUS)).toHaveText('Demande acceptée');
  await expect(page.locator('[data-incoming="Mastonin"]')).toHaveCount(0);
  await expect(page.locator('[data-friend="Mastonin"]')).toHaveCount(1);
  await expect(page.locator('#friends-section > h2')).toHaveText('Amis (5)');
  await expect(page.locator('#incoming-section h2')).toHaveText('Demandes reçues (1)');
  expect(server.answered).toEqual([{ id: 'r1', action: 'accept' }]);
  // La lecture de l'id de l'amitié par le script, pas une relecture de la page.
  expect(server.listed).toBe(1);
});

test("page Amis : sa relecture servie sans réseau, faite d'avant la demande, ne la dit pas plus en attente", async ({ page }) => {
  const server = await openFriendsPage(page, { script: fakeBellProvider([SOLD]) });
  await expect(page.locator(DESKTOP_BOX).locator(BELL)).toContainText('1');
  await push(page, { ...FRIEND_REQUEST, data: { ...FRIEND_REQUEST.data, requester_id: 'u30', requester_username: 'Zed' } });
  await page.locator('[data-incoming="el_lokomotiv"]').getByRole('button', { name: 'Refuser' }).click();
  await expect(page.locator('[data-incoming="el_lokomotiv"]')).toHaveCount(0);
  expect(server.listed).toBe(0);
  await page.locator(DESKTOP_BOX).locator(BELL).click();
  await expect(page.locator(PANEL).locator('.wm-notification-action-row').getByRole('button', { name: 'Accepter' })).toBeEnabled();
});
