import { expect, test, type Page } from '@playwright/test';
import { putMarketRecords } from './support/market-db';
import { CAROUSEL, openPulls, packFaces } from './support/pulls';
import { expectDomIdle, presetSettings } from './support/site';

/**
 * Prix souhaité dans la mise en vente (version de dev, page Revente) : carte « Tour Eiffel » `c1`, exemplaire en C du
 * paquet de test ; prix souhaités dans `wm-wished-prices-v1`, clé `<carte>:<rareté>[:shiny]`.
 */
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const KEY = 'wm-wished-prices-v1';

/** Prix souhaités posés avant le chargement. */
async function presetWished(page: Page, prices: Record<string, number>): Promise<void> {
  const stored = Object.fromEntries(Object.entries(prices).map(([key, price]) => [key, { price, at: 1, title: 'Tour Eiffel' }]));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify(stored)] as const);
}

/** Mise en vente de la carte du paquet ; `attempts` : ses mises en vente passées (historique). */
async function openSale(page: Page, attempts: readonly object[] = []): Promise<void> {
  await openPulls(page, { api: { '/api/marketplace/mine': { sellingCount: 2, maxConcurrentAuctions: 10 } } });
  if (attempts.length > 0) await putMarketRecords(page, 'listings', [{ id: 'c1', title: 'Tour Eiffel', attempts }]);
  await page.click('#open');
  await packFaces(page).click();
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mise en vente' });
const bid = (page: Page) => dialog(page).getByLabel('Mise de départ');
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, { price: number }>, KEY);

test('sans prix souhaité : la mise peut le devenir, enregistrée aussitôt sans fermer la fenêtre', async ({ page }) => {
  await openSale(page);
  await expect(bid(page)).toBeVisible();
  // Mise du site (10) : proposée.
  const save = dialog(page).getByRole('button', { name: 'Enregistrer comme prix souhaité' });
  await expect(save).toBeVisible();
  await bid(page).fill('');
  await expect(save).toHaveCount(0);
  await bid(page).fill('25');
  await save.click();
  expect((await stored(page))['c1:C']?.price).toBe(25);
  await expect(save).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: /Prix souhaité/ })).toContainText('25');
  await expect(dialog(page)).toBeVisible();
  await expectDomIdle(page);
});

test('avec un prix souhaité : un clic le reprend comme mise ; une autre mise propose de le mettre à jour', async ({ page }) => {
  await presetWished(page, { 'c1:C': 300, 'c1:UR': 900 });
  await openSale(page);
  const chip = dialog(page).getByRole('button', { name: /Prix souhaité/ });
  await expect(chip).toContainText('300');
  await chip.click();
  await expect(bid(page)).toHaveValue('300');
  await expect(dialog(page).getByRole('button', { name: /Mettre à jour/ })).toHaveCount(0);

  await bid(page).fill('250');
  const update = dialog(page).getByRole('button', { name: 'Mettre à jour le prix souhaité : 300 → 250' });
  await update.click();
  expect((await stored(page))['c1:C']?.price).toBe(250);
  // Une autre rareté garde le sien.
  expect((await stored(page))['c1:UR']?.price).toBe(900);
  await expect(update).toHaveCount(0);
  await expect(chip).toContainText('250');
});

test('réglage coupé : rien dans la mise en vente, et la mise du site', async ({ page }) => {
  await presetSettings(page, { features: { 'auction-wished-price': false }, values: {} });
  await presetWished(page, { 'c1:C': 300 });
  await openSale(page);
  await expect(bid(page)).toHaveValue('10');
  await expect(dialog(page).locator('.wm-sale-wished')).toHaveCount(0);
});

test('jamais mise en vente dans cette rareté : la mise part du prix souhaité, la durée reste celle par défaut', async ({ page }) => {
  await presetWished(page, { 'c1:C': 300 });
  // Mise en vente passée dans une autre rareté : pas reprise.
  await openSale(page, [{ at: Date.now() - 3_600_000, price: 25, minutes: 180, rarity: 'UR', shiny: false, auctionId: 'old' }]);
  await expect(bid(page)).toHaveValue('300');
  await expect(dialog(page).getByRole('radio', { name: '10 min' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog(page).getByRole('button', { name: /Mettre à jour|Enregistrer comme/ })).toHaveCount(0);
});

test('déjà mise en vente dans cette rareté : la dernière mise en vente reste reprise', async ({ page }) => {
  await presetWished(page, { 'c1:C': 300 });
  await openSale(page, [{ at: Date.now() - 3_600_000, price: 25, minutes: 180, rarity: 'C', shiny: false, auctionId: 'old' }]);
  await expect(bid(page)).toHaveValue('25');
  await expect(dialog(page).getByRole('button', { name: 'Mettre à jour le prix souhaité : 300 → 25' })).toBeVisible();
});
