import { expect, test, type Page } from '@playwright/test';
import { gridTitles as titles, rarityBox as box } from './support/lists';
import { openMarketplace } from './support/marketplace';
import { animationsDone, hold, letTimePass, openSettings, presetSettings, rect } from './support/site';

const BUTTON = '.wm-market-search';
const field = (page: Page) => page.locator('input[type="search"]');
/** Fin de l'apparition animée des filtres (sinon un clic attend qu'ils ne bougent plus, plus que le délai des filtres). */
const settled = (page: Page) => animationsDone(page.locator('.wm-market-filter-area'));

test('ligne des filtres comme la Collection : cases de rareté, tri puis bouton ; pastilles et « Rechercher » cachés', async ({ page }) => {
  await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await expect(page.locator('.wm-market-filter-line .wm-rarity-filter .wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(page.getByRole('button', { name: 'Rechercher' })).toBeHidden();
  await expect(page.locator('main .flex-wrap.gap-2 > button', { hasText: /^L$/ })).toBeHidden();
  await expect(field(page)).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
  await settled(page);
  const boxes = await Promise.all([field(page), box(page, 'L'), page.locator('select'), page.locator(BUTTON)].map(rect));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
  expect(new Set(boxes.map((b) => Math.round(b.y + b.height / 2))).size).toBe(1);
});

test('ligne des filtres collée à gauche comme la Collection : champ de 550 px au plus, 300 au moins, vide à droite', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await settled(page);
  const bounds = (selector: string) => rect(page.locator(selector).first());
  const line = await bounds('.wm-market-filter-line');
  expect(Math.round((await bounds('.wm-market-field-box')).width)).toBe(550);
  const button = await bounds(BUTTON);
  expect(line.x + line.width - (button.x + button.width)).toBeGreaterThan(300);

  // Fenêtre réduite : le champ rétrécit avec le vide, jamais sous 300 px, tout reste sur une rangée.
  await page.setViewportSize({ width: 1100, height: 800 });
  const field = await bounds('.wm-market-field-box');
  expect(Math.round(field.width)).toBeLessThan(550);
  expect(Math.round(field.width)).toBeGreaterThanOrEqual(300);
  const narrowButton = await bounds(BUTTON);
  expect(Math.abs(narrowButton.y + narrowButton.height / 2 - (field.y + field.height / 2))).toBeLessThan(3);
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

  const open = hold(server);
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

test('la croix qui vide la recherche ne relance rien, même juste après un F5 : la loupe lance la recherche vide', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await field(page).fill('tour');
  await field(page).press('Enter');
  await expect(titles(page)).toHaveText(['recent toutes «tour» p1']);
  await page.reload();
  await expect(titles(page)).toHaveText(['recent toutes «tour» p1']);
  await expect(field(page)).toHaveValue('tour');
  await letTimePass(page, 800);
  server.requests.length = 0;

  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(field(page)).toHaveValue('');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');
  await letTimePass(page, 300);
  await expect(titles(page)).toHaveText(['recent toutes «tour» p1']);
  expect(server.requests).toEqual([]);

  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('retour d’une annonce : la liste gardée par le site s’affiche sans requête, une rareté cochée ne recharge pas', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await page.evaluate(() =>
    sessionStorage.setItem(
      'marketplace_list_v3',
      JSON.stringify({
        activeTab: 'browse',
        browse: [{ id: 'k1', card: { id: 'c', wikipedia_title: 'gardée' } }],
        browseHasMore: true,
        nextBrowsePage: 3,
        search: 'tour',
        submittedSearch: 'tour',
        sort: 'price_asc',
        rarityFilter: ['UR'],
      }),
    ),
  );
  server.requests.length = 0;
  await page.reload();
  await expect(titles(page)).toHaveText(['gardée']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await settled(page);

  await box(page, 'L').click();
  await expect(box(page, 'L')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(page.getByRole('button', { name: 'Charger la suite' })).toBeDisabled();
  await letTimePass(page, 300);
  await expect(titles(page)).toHaveText(['gardée']);
  expect(server.requests).toEqual(['page=1&limit=1&mine=1']);

  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['price_asc L+UR «tour» p1']);
});

test('retour d’une annonce, rechargement automatique permis : le premier changement de filtre attend lui aussi', async ({ page }) => {
  await presetSettings(page, { features: { 'marketplace-search': false }, values: {} });
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await page.evaluate(() =>
    sessionStorage.setItem(
      'marketplace_list_v3',
      JSON.stringify({
        activeTab: 'browse',
        browse: [{ id: 'k1', card: { id: 'c', wikipedia_title: 'gardée' } }],
        browseHasMore: true,
        nextBrowsePage: 2,
        search: '',
        submittedSearch: '',
        sort: 'recent',
        rarityFilter: [],
      }),
    ),
  );
  await page.reload();
  await expect(titles(page)).toHaveText(['gardée']);
  await settled(page);
  server.requests.length = 0;

  await box(page, 'L').click();
  await letTimePass(page, 400);
  expect(server.requests).toEqual([]);
  await expect(titles(page)).toHaveText(['recent L p1']);
  expect(server.requests).toHaveLength(1);
});

test('la frappe ne lance rien : la loupe lance le texte du champ avec les choix', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  const button = page.locator(BUTTON);
  await settled(page);
  await box(page, 'UR').click();
  await field(page).pressSequentially('tour', { delay: 50 });
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await letTimePass(page, 1000);
  expect(server.requests).toEqual(['page=1&limit=50&sort=recent&mine=1']);
  await expect(page.getByRole('button', { name: 'Charger la suite' })).toBeDisabled();

  await button.click();
  await expect(titles(page)).toHaveText(['recent UR «tour» p1']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  expect(server.requests).toEqual(['page=1&limit=50&sort=recent&mine=1', 'page=1&limit=50&sort=recent&q=tour&rarity=UR']);
});

test('rechargement automatique permis : la recherche part seule après la frappe (700 ms sans frappe)', async ({ page }) => {
  await presetSettings(page, { features: { 'marketplace-search': false }, values: {} });
  const server = await openMarketplace(page);
  await expect(titles(page)).toHaveText(['recent toutes p1']);
  await field(page).pressSequentially('tour', { delay: 50 });
  await letTimePass(page, 300);
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
  await letTimePass(page, 800);
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
  const dialog = await openSettings(page, 'Marché');
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Historique des ventes', 'Prix moyen', 'Enchères terminées', 'Mises en direct', 'Limite des historiques', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: 'Recherche : Empêcher le rechargement automatique' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
});
