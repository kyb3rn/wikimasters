import { expect, test, type Page } from '@playwright/test';
import { putMarketRecords, readMarketRecords } from './support/market-db';
import { CAROUSEL, openPulls, PACK, packFaces, type PullsOptions } from './support/pulls';
import { presetSettings, rect } from './support/site';

/**
 * Historique des mises en vente dans la modale de mise en vente (magasin `listings` de la base `wm-market`, carte
 * « Tour Eiffel » `c1`, exemplaire `u1` en C du paquet de test).
 */
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const HOUR = 3_600_000;
const AUCTION_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

interface Sale {
  /** Corps des `POST /api/marketplace` reçus. */
  readonly posted: unknown[];
}

/** Mise en vente au format du script. */
const attempt = (hoursAgo: number, price: number, minutes: number, rarity = 'C', more: object = {}) => ({
  at: Date.now() - hoursAgo * HOUR,
  price,
  minutes,
  rarity,
  shiny: false,
  auctionId: `old-${hoursAgo}`,
  ...more,
});

/** /pulls imité, historique `attempts` de « Tour Eiffel » en place, puis la mise en vente de la carte ouverte. */
async function openSale(
  page: Page,
  attempts: readonly object[] = [],
  options: { response?: { status: number; json: unknown }; pack?: PullsOptions['pack'] } = {},
): Promise<Sale> {
  const sale: Sale = { posted: [] };
  await openPulls(page, {
    ...(options.pack !== undefined && { pack: options.pack }),
    api: { '/api/marketplace/mine': { sellingCount: 2, maxConcurrentAuctions: 10 } },
    handle: async (route, url) => {
      if (url.pathname !== '/api/marketplace' || route.request().method() !== 'POST') return false;
      sale.posted.push(route.request().postDataJSON());
      await route.fulfill(options.response ?? { status: 201, json: { auction_id: AUCTION_ID } });
      return true;
    },
  });
  if (attempts.length > 0) await putMarketRecords(page, 'listings', [{ id: 'c1', title: 'Tour Eiffel', attempts }]);
  await page.click('#open');
  await packFaces(page).click();
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
  return sale;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mise en vente' });
const rows = (page: Page) => dialog(page).locator('.wm-sale-history-item');
const price = (page: Page) => dialog(page).getByLabel('Mise de départ');
const duration = (page: Page, label: string) => dialog(page).getByRole('radio', { name: label });

test('une mise en vente acceptée est notée : mise, durée, rareté de l’exemplaire, enchère', async ({ page }) => {
  const sale = await openSale(page);
  await expect(dialog(page)).toContainText('Jamais mise en vente.');
  await price(page).fill('25');
  await duration(page, '3 h').click();
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(sale.posted).toEqual([{ card_id: 'u1', base_amount: 25, duration_minutes: 180 }]);

  await expect
    .poll(() => readMarketRecords(page, 'listings'))
    .toEqual([
      {
        id: 'c1',
        title: 'Tour Eiffel',
        attempts: [{ at: expect.any(Number) as unknown, price: 25, minutes: 180, rarity: 'C', shiny: false, auctionId: AUCTION_ID }],
      },
    ]);
});

test('une mise en vente refusée par le site n’est pas notée', async ({ page }) => {
  await openSale(page, [], { response: { status: 400, json: { error: 'Mise de départ trop élevée' } } });
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog(page).getByRole('alert')).toHaveText('Mise de départ trop élevée');
  expect(await readMarketRecords(page, 'listings')).toEqual([]);
});

test('à l’ouverture : les 3 dernières, la dernière de la même rareté reprise (mise et durée)', async ({ page }) => {
  const sale = await openSale(page, [attempt(1, 300, 60, 'R'), attempt(2, 250, 180), attempt(72, 200, 10), attempt(120, 150, 30)]);
  await expect(price(page)).toHaveValue('250');
  await expect(duration(page, '3 h')).toHaveAttribute('aria-checked', 'true');

  await expect(dialog(page)).toContainText('Dernières mises en vente');
  await expect(rows(page)).toHaveCount(3);
  // La plus récente, dans une autre rareté : affichée avec son badge, pas reprise.
  await expect(rows(page).nth(0)).toContainText('il y a 1 h');
  await expect(rows(page).nth(0)).toContainText('R300');
  await expect(rows(page).nth(0).locator('[title="Mise en vente en Rare"]')).toHaveText('R');
  await expect(rows(page).nth(1)).toContainText('2503 h');
  await expect(rows(page).nth(1).locator('[title^="Mise en vente en"]')).toHaveCount(0);
  await expect(rows(page).nth(2)).toContainText('il y a 3 j');
  await expect(rows(page).nth(0).getByRole('link', { name: "Voir l'enchère" })).toHaveAttribute('href', '/marketplace/old-1');
  await expect(rows(page).nth(0).getByRole('link', { name: "Voir l'enchère" })).toHaveAttribute('target', '_blank');
  const showAll = dialog(page).getByRole('button', { name: 'Tout voir (4)' });
  await expect(showAll).toBeVisible();
  // Très petit bouton standard, qui finit au bord des liens vers les enchères, juste en dessous.
  await expect(showAll).toHaveClass(/wm-button-standard/);
  await expect(showAll).toHaveClass(/wm-button-xs/);
  const [showAllBox, linkBox] = [await rect(showAll), await rect(rows(page).nth(0).getByRole('link', { name: "Voir l'enchère" }))];
  expect(showAllBox.x + showAllBox.width).toBeCloseTo(linkBox.x + linkBox.width, 0);

  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect.poll(() => sale.posted).toEqual([{ card_id: 'u1', base_amount: 250, duration_minutes: 180 }]);
});

test('un clic sur une ligne reprend sa mise et sa durée', async ({ page }) => {
  await openSale(page, [attempt(2, 250, 180), attempt(72, 200, 10), attempt(96, 400, 720, 'SR')]);
  await expect(price(page)).toHaveValue('250');
  await rows(page).nth(1).locator('.wm-sale-history-row').click();
  await expect(price(page)).toHaveValue('200');
  await expect(duration(page, '10 min')).toHaveAttribute('aria-checked', 'true');
  // Même une mise en vente d'une autre rareté, à la main.
  await rows(page).nth(2).locator('.wm-sale-history-row').click();
  await expect(price(page)).toHaveValue('400');
  await expect(duration(page, '12 h')).toHaveAttribute('aria-checked', 'true');
  await expect(price(page)).toBeFocused();
});

test('seulement d’autres raretés : rien de repris, mise du site et durée par défaut', async ({ page }) => {
  await openSale(page, [attempt(1, 300, 60, 'R')]);
  await expect(rows(page)).toHaveCount(1);
  await expect(price(page)).toHaveValue('10');
  await expect(duration(page, '10 min')).toHaveAttribute('aria-checked', 'true');
  await expect(dialog(page).getByRole('button', { name: /^Tout voir/ })).toHaveCount(0);
});

test('L shiny : seule une mise en vente shiny est reprise', async ({ page }) => {
  const [first, ...others] = PACK.cards;
  const pack = { ...PACK, cards: [{ ...first, rarity: 'L', is_shiny: true }, ...others] };
  await openSale(page, [attempt(1, 5000, 60, 'L'), attempt(5, 29000, 720, 'L', { shiny: true })], { pack });
  await expect(price(page)).toHaveValue('29000');
  await expect(duration(page, '12 h')).toHaveAttribute('aria-checked', 'true');
  await expect(rows(page).nth(0).locator('[title="Mise en vente en Légendaire"]')).toHaveText('L');
  await expect(rows(page).nth(1).locator('[title^="Mise en vente en"]')).toHaveCount(0);
});

test('mises en vente de l’ancien wm-vente : reprises, essais non publiés ignorés', async ({ page }) => {
  const at = Date.now() - 4 * HOUR;
  await openSale(page, [
    { at, price: 180, duration: { secs: 1800, text: '30 min' }, rarity: 'C', ok: true, auctionId: 'x1' },
    { at: at + HOUR, price: 90, duration: { secs: 600, text: '10 min' }, rarity: 'C', ok: null, auctionId: null },
  ]);
  await expect(price(page)).toHaveValue('180');
  await expect(duration(page, '30 min')).toHaveAttribute('aria-checked', 'true');
  await expect(rows(page)).toHaveCount(1);
});

test('Tout voir : toutes les mises en vente, retrait en deux clics, un clic reprend', async ({ page }) => {
  await openSale(page, [attempt(1, 250, 180), attempt(2, 240, 60), attempt(3, 230, 30), attempt(4, 220, 10), attempt(5, 210, 360)]);
  await dialog(page).getByRole('button', { name: 'Tout voir (5)' }).click();
  const all = page.getByRole('dialog', { name: 'Tour Eiffel' });
  await expect(all).toContainText('5 mises en vente');
  const items = all.locator('.wm-sale-history-item');
  await expect(items).toHaveCount(5);

  // Échap ferme l'historique seul.
  await page.keyboard.press('Escape');
  await expect(all).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByRole('button', { name: 'Tout voir (5)' }).click();
  await items.nth(1).getByRole('button', { name: "Retirer de l'historique" }).click();
  const confirm = items.nth(1).getByRole('button', { name: 'Confirmer ?' });
  await expect(confirm).toBeDisabled();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(items).toHaveCount(4);
  await expect(all).toContainText('4 mises en vente');
  await expect(dialog(page).getByRole('button', { name: 'Tout voir (4)' })).toBeAttached();
  await expect
    .poll(async () => ((await readMarketRecords(page, 'listings')) as { attempts: { price: number }[] }[])[0]?.attempts.map((a) => a.price))
    .toEqual([250, 230, 220, 210]);

  await items.nth(3).locator('.wm-sale-history-row').click();
  await expect(all).toHaveCount(0);
  await expect(price(page)).toHaveValue('210');
  await expect(duration(page, '6 h')).toHaveAttribute('aria-checked', 'true');
});

test('réglage : historique masqué, rien de repris', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'auction-modal-layout': { showHistory: false } } });
  await openSale(page, [attempt(2, 250, 180)]);
  await expect(dialog(page)).toBeVisible();
  await expect(price(page)).toHaveValue('10');
  await expect(dialog(page)).not.toContainText('Dernières mises en vente');
});

test('réglage : reprise éteinte, l’historique reste', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'auction-modal-layout': { reuseLast: false } } });
  await openSale(page, [attempt(2, 250, 180)]);
  await expect(rows(page)).toHaveCount(1);
  await expect(price(page)).toHaveValue('10');
  await expect(duration(page, '10 min')).toHaveAttribute('aria-checked', 'true');
});
