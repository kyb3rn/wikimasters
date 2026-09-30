import { expect, test, type Page } from '@playwright/test';
import { openMarketplace } from './support/marketplace';
import { presetSettings } from './support/site';

const BUTTON = '.wm-market-search';
const titles = (page: Page) => page.locator('#grid h3');
const box = (page: Page, rarity: string) => page.locator('.wm-rarity-filter .wm-rarity', { hasText: new RegExp(`^${rarity}$`) });
const field = (page: Page) => page.locator('input[type="search"]');
/** Fin de l'apparition animée des filtres (sinon un clic attend qu'ils ne bougent plus, plus que le délai des filtres). */
const settled = (page: Page) =>
  page.locator('.wm-market-filter-area').evaluate((area) => Promise.all(area.getAnimations().map((animation) => animation.finished)));

test('ligne des filtres comme la Collection : cases de rareté, tri puis bouton ; pastilles et « Rechercher » cachés', async ({ page }) => {
  await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await expect(page.locator('.wm-market-filter-line .wm-rarity-filter .wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(page.getByRole('button', { name: 'Rechercher' })).toBeHidden();
  await expect(page.locator('main .flex-wrap.gap-2 > button', { hasText: /^L$/ })).toBeHidden();
  await expect(field(page)).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
  await settled(page);
  const boxes = await Promise.all([field(page), box(page, 'L'), page.locator('select'), page.locator(BUTTON)].map((locator) => locator.boundingBox()));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
  expect(new Set(boxes.map((b) => Math.round(b!.y + b!.height / 2))).size).toBe(1);
});

test('tri et raretés ne rechargent pas : la loupe lance la recherche ; « Charger la suite » verrouillé en attendant', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  const button = page.locator(BUTTON);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');

  await page.locator('select').selectOption('price_asc');
  await box(page, 'UR').click();
  await expect(box(page, 'UR')).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await expect(page.getByRole('button', { name: 'Charger la suite' })).toBeDisabled();
  expect(server.requests).toEqual(['page=1&limit=50&sort=recent&mine=1']);

  let open!: () => void;
  server.gate = new Promise((resolve) => (open = resolve));
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Chargement…');
  open();
  await expect(titles(page)).toHaveText(['price_asc UR p1']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  // L'actualisation du site : listes personnelles comprises.
  expect(server.requests.at(-1)).toBe('page=1&limit=50&sort=price_asc&mine=1&rarity=UR');

  await page.getByRole('button', { name: 'Charger la suite' }).click();
  await expect(titles(page)).toHaveText(['price_asc UR p1', 'price_asc UR p2']);
});

test('la recherche part seule après la frappe (700 ms sans frappe)', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await field(page).pressSequentially('tour', { delay: 50 });
  await page.waitForTimeout(300);
  expect(server.requests).toHaveLength(1);
  await expect(titles(page)).toHaveText(['recent toutes «tour» p1']);
  expect(server.requests).toEqual(['page=1&limit=50&sort=recent&mine=1', 'page=1&limit=50&sort=recent&q=tour']);
});

test('filtres retenus : à l’arrivée, la liste revient à la dernière recherche, sans charger la liste par défaut', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await page.locator('select').selectOption('ending_soon');
  await box(page, 'L').click();
  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['ending_soon L p1']);
  await field(page).fill('tour');
  await field(page).press('Enter');
  await expect(titles(page)).toHaveText(['ending_soon L «tour» p1']);

  server.requests.length = 0;
  await page.reload();
  await expect(titles(page)).toHaveText(['ending_soon L «tour» p1']);
  await expect(page.locator('select')).toHaveValue('ending_soon');
  await expect(box(page, 'L')).toHaveAttribute('aria-pressed', 'true');
  await expect(field(page)).toHaveValue('tour');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await page.waitForTimeout(800);
  expect(server.requests).toEqual(['page=1&limit=50&sort=ending_soon&mine=1&q=tour&rarity=L']);
});

test('rechargement automatique permis : un changement de tri charge la liste après l’attente, sans bouton', async ({ page }) => {
  await presetSettings(page, { features: { 'marketplace-search': false }, values: {} });
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await settled(page);
  await page.locator('select').selectOption('price_desc');
  await box(page, 'C').click();
  await expect(titles(page)).toHaveText(['price_desc C p1']);
  expect(server.requests).toEqual(['page=1&limit=50&sort=recent&mine=1', 'page=1&limit=50&sort=price_desc&rarity=C']);
});

test('paramètres : onglet Marché, option active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByRole('button', { name: 'Marché' }).click();
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Historique des ventes', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: 'Recherche : Empêcher le rechargement automatique' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
});
