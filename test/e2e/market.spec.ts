import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openCard, packFaces } from './support/pulls';
import { letTimePass, presetSettings } from './support/site';

test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Ventes de « Tour Eiffel » (C sur la carte du paquet) : 4 en C, 2 en R. */
const SALES = {
  wikipedia_title: 'Tour Eiffel',
  sales: [
    { id: 's1', final_price: 40, settled_at: ago(50), rarity: 'R' },
    { id: 's2', final_price: 10, settled_at: ago(20), rarity: 'C' },
    { id: 's3', final_price: 14, settled_at: ago(10), rarity: 'C' },
    { id: 's4', final_price: 60, settled_at: ago(8), rarity: 'R' },
    { id: 's5', final_price: 12, settled_at: ago(5), rarity: 'C' },
    { id: 's6', final_price: 20, settled_at: ago(1), rarity: 'C' },
  ],
  recent: [],
};

interface SalesServer {
  /** Demandes de ventes reçues. */
  count: number;
  status: number;
  /** Retient la réponse jusqu'à `release()`. */
  hold: boolean;
  release: () => void;
}

async function openCardModal(page: Page, server: SalesServer) {
  let waiting: (() => void)[] = [];
  server.release = () => {
    for (const go of waiting) go();
    waiting = [];
  };
  await openCard(page, {
    handle: async (route, url) => {
      if (!url.pathname.endsWith('/sales')) return false;
      server.count++;
      if (server.hold) await new Promise<void>((resolve) => waiting.push(resolve));
      await route.fulfill(server.status === 200 ? { json: SALES } : { status: server.status, json: { error: 'Erreur serveur' } });
      return true;
    },
  });
  return page.locator('#card-modal');
}

const newServer = (): SalesServer => ({ count: 0, status: 200, hold: false, release: () => {} });
const history = (page: Page) => page.getByRole('dialog', { name: 'Tour Eiffel' });

test('« Marché » ouvre l’historique des ventes par-dessus la modale de carte ; Échap ne ferme que lui', async ({ page }) => {
  const server = newServer();
  const card = await openCardModal(page, server);
  await card.getByRole('button', { name: 'Marché' }).click();

  const dialog = history(page);
  await expect(dialog).toBeVisible();
  // Sous-titre : nombre de ventes en gras, date des données ; rareté en badge devant le titre.
  await expect(dialog.locator('.wm-modal-subtitle')).toHaveText(/^6 ventes · données du /);
  await expect(dialog.locator('.wm-modal-subtitle b')).toHaveText('6');
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('CTour Eiffel');
  await expect(dialog.locator('h2 > span')).toHaveAttribute('title', 'Rareté actuelle : Commune');
  // Au-dessus de la modale de carte : c'est lui qui reçoit le clic au centre de l'écran.
  const onTop = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('[role="dialog"]')?.getAttribute('aria-label'));
  expect(onTop).toBe('Tour Eiffel');
  expect(server.count).toBe(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();
});

test('rareté de la carte par défaut ; les bascules choisissent les ventes des tuiles et du graphique', async ({ page }) => {
  const card = await openCardModal(page, newServer());
  await card.getByRole('button', { name: 'Marché' }).click();
  const dialog = history(page);
  const sales = dialog.locator('.wm-market-tile').first();

  await expect(sales).toContainText('4');
  await expect(dialog.locator('.wm-market-point')).toHaveCount(4);
  // Rareté et chiffres séparés par une espace insécable, puis « · ».
  await expect(dialog.getByRole('button', { name: /^C.·.4 ventes/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: /^R.·.2 ventes/ })).toHaveAttribute('aria-pressed', 'false');

  await dialog.getByRole('button', { name: 'Toutes' }).click();
  await expect(sales).toContainText('6');
  await expect(dialog.locator('.wm-market-point')).toHaveCount(6);

  // La dernière rareté allumée ne s'éteint pas.
  await dialog.getByRole('button', { name: /^C.·/ }).click();
  await dialog.getByRole('button', { name: /^R.·/ }).click();
  await expect(dialog.getByRole('button', { name: /^R.·/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.wm-market-point')).toHaveCount(2);
});

test('les ventes restent en cache (même après un rechargement) ; « Actualiser » les redemande, roue pendant la requête', async ({ page }) => {
  const server = newServer();
  let card = await openCardModal(page, server);
  await card.getByRole('button', { name: 'Marché' }).click();
  await expect(history(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await card.getByRole('button', { name: 'Marché' }).click();
  await expect(history(page)).toBeVisible();
  expect(server.count).toBe(1);

  await page.reload();
  await page.click('#open');
  await packFaces(page).click();
  card = page.locator('#card-modal');
  await card.getByRole('button', { name: 'Marché' }).click();
  await expect(history(page)).toBeVisible();
  expect(server.count).toBe(1);

  server.hold = true;
  const refresh = history(page).getByRole('button', { name: 'Actualiser' });
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh.locator('.wm-spin')).toBeVisible();
  server.release();
  await expect(refresh).toBeEnabled();
  expect(server.count).toBe(2);
});

test('pendant le chargement, « Marché » est désactivé avec une roue ; échec sans cache : toast, pas de modale', async ({ page }) => {
  const server = newServer();
  server.hold = true;
  server.status = 500;
  const card = await openCardModal(page, server);
  const market = card.getByRole('button', { name: 'Marché' });
  await market.click();
  await expect(market).toBeDisabled();
  await expect(market.locator('.wm-spin')).toBeVisible();
  server.release();

  await expect(page.getByText('Erreur serveur')).toBeVisible();
  await expect(page.getByText('Marché indisponible')).toBeVisible();
  await expect(market).toBeEnabled();
  await expect(history(page)).toHaveCount(0);
});

test('les moyennes mobiles suivent l’interrupteur, retenu dans les réglages', async ({ page }) => {
  const card = await openCardModal(page, newServer());
  await card.getByRole('button', { name: 'Marché' }).click();
  const dialog = history(page);
  const averages = dialog.locator('.wm-market-average').first();
  await expect(averages).toBeVisible();

  await dialog.getByRole('switch', { name: 'Afficher les moyennes mobiles' }).click();
  await expect(averages).toBeHidden();
  const saved = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('wm-settings-v1') ?? '{}') as { values?: { market?: { movingAverages?: boolean } } };
    return stored.values?.market?.movingAverages;
  });
  expect(saved).toBe(false);

  // Maj maintenue : les moyennes reviennent, les ventes s'estompent.
  await dialog.locator('.wm-market-chart').hover();
  await page.keyboard.down('Shift');
  await expect(averages).toBeVisible();
  await expect(dialog.locator('.wm-market-chart')).toHaveAttribute('data-dim', 'true');
  await page.keyboard.up('Shift');
  await expect(averages).toBeHidden();
});

/** Libellés des graduations de dates du graphique. */
const dateLabels = (page: Page) =>
  history(page).locator('.wm-market-chart text[text-anchor="start"]').first().textContent();
const dayLabel = (page: Page, daysAgo: number) =>
  page.evaluate((days) => new Date(Date.now() - days * 86_400_000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), daysAgo);

test('R : les 30 derniers jours (vue de départ) ; A : toutes les ventes', async ({ page }) => {
  const card = await openCardModal(page, newServer());
  await card.getByRole('button', { name: 'Marché' }).click();
  await history(page).getByRole('button', { name: 'Toutes' }).click();
  const title = history(page).locator('.wm-market-title');
  await expect(title).toHaveText('Historique complet');
  await expect(title).toHaveAttribute('title', /R : les 30 derniers jours\. A : toutes les ventes\./);

  const recent = await dayLabel(page, 30);
  expect(await dateLabels(page)).toBe(recent);
  await page.keyboard.press('a');
  await expect.poll(() => dateLabels(page)).toBe(await dayLabel(page, 50));
  await page.keyboard.press('r');
  await expect.poll(() => dateLabels(page)).toBe(recent);
});

test('touche A désactivée dans les réglages : sans effet, absente de l’aide', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { market: { allKey: false } } });
  const card = await openCardModal(page, newServer());
  await card.getByRole('button', { name: 'Marché' }).click();
  await history(page).getByRole('button', { name: 'Toutes' }).click();
  const title = history(page).locator('.wm-market-title');
  await expect(title).toHaveAttribute('title', /R : les 30 derniers jours/);
  await expect(title).not.toHaveAttribute('title', /A : toutes les ventes/);

  const recent = await dayLabel(page, 30);
  await page.keyboard.press('a');
  await letTimePass(page, 200);
  expect(await dateLabels(page)).toBe(recent);
});

test('compte non PRO : « Marché » avec le badge PRO ouvre l’offre du site, retenu au rechargement ; historique une fois PRO', async ({ page }) => {
  const server = newServer();
  const announce = (pro: boolean) =>
    page.evaluate((detail) => window.dispatchEvent(new CustomEvent('wikimasters:is-pro-changed', { detail })), pro);
  let card = await openCardModal(page, server);
  await announce(false);
  let market = card.getByRole('button', { name: 'Marché' });
  await expect(market).toBeEnabled();
  await expect(market).toHaveAttribute('title', 'Historique des ventes de la carte (PRO)');
  await expect(market.locator('svg.lucide-sparkles, span.bg-violet-600')).toHaveCount(1);

  // Offre : notre modale, sans requête de ventes ; « Débloquer » la ferme et ouvre l'abonnement du site.
  await page.evaluate(() => {
    const win = window as unknown as { __upgrades: number };
    win.__upgrades = 0;
    window.addEventListener('wikimasters:open-pro-upgrade', () => win.__upgrades++);
  });
  await market.click();
  const offer = page.getByRole('dialog', { name: 'Vue du marché' });
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('Vue du marché PRO');
  await expect(offer).toContainText('Découvre l’historique des ventes de « Tour Eiffel »');
  await offer.getByRole('button', { name: 'Débloquer avec WikiMasters PRO' }).click();
  await expect(offer).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __upgrades: number }).__upgrades)).toBe(1);
  expect(server.count).toBe(0);

  await page.reload();
  await page.click('#open');
  await packFaces(page).click();
  card = page.locator('#card-modal');
  market = card.getByRole('button', { name: 'Marché' });
  await expect(market.locator('span.bg-violet-600')).toHaveCount(1);

  await announce(true);
  await expect(market.locator('span.bg-violet-600')).toHaveCount(0);
  await market.click();
  await expect(history(page)).toBeVisible();
  expect(server.count).toBe(1);
});
