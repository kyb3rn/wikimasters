import { expect, test, type Page } from '@playwright/test';
import { openGlobalCollection } from './support/global-collection-list';
import { presetSettings } from './support/site';

const BUTTON = '.wm-gc-search';
const titles = (page: Page) => page.locator('#grid h3');
const box = (page: Page, rarity: string) => page.locator('.wm-rarity-filter .wm-rarity', { hasText: new RegExp(`^${rarity}$`) });
/** Fin de l'apparition animée des filtres (sinon un clic attend qu'ils ne bougent plus, plus que le délai des filtres). */
const settled = (page: Page) =>
  page.locator('.wm-gc-filter-area').evaluate((area) => Promise.all(area.getAnimations().map((animation) => animation.finished)));
const domSyncs = (page: Page) => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);

async function chooseSort(page: Page, option: string) {
  await page.getByRole('button', { name: 'Trier les cartes' }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('ligne des filtres comme la Collection : cases de rareté, liste de souhaits, tri puis bouton ; pastilles et « Rechercher » cachés', async ({
  page,
}) => {
  await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const line = page.locator('.wm-gc-filter-line');
  await expect(line.locator('.wm-rarity-filter .wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(line.getByRole('button', { name: 'Liste de souhaits' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Rechercher', exact: true })).toBeHidden();
  await expect(page.locator('main .flex-wrap.gap-2 > button', { hasText: 'Liste de souhaits' })).toBeHidden();
  await expect(page.locator('input[type="text"]')).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
  await settled(page);
  // Dans l'ordre : champ, raretés, liste de souhaits, tri, bouton de la recherche, sur une rangée.
  const boxes = await Promise.all(
    [page.locator('input[type="text"]'), box(page, 'L'), page.getByRole('button', { name: 'Liste de souhaits' }), page.getByRole('button', { name: 'Trier les cartes' }), page.locator(BUTTON)].map(
      (locator) => locator.boundingBox(),
    ),
  );
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
  expect(new Set(boxes.map((b) => Math.round(b!.y + b!.height / 2))).size).toBe(1);
  // Au repos, le script ne réécrit plus la page.
  await page.waitForTimeout(300);
  const before = await domSyncs(page);
  await page.waitForTimeout(600);
  expect(await domSyncs(page)).toBe(before);
});

test('tri, raretés et liste de souhaits ne rechargent pas : la loupe lance la recherche, roue jusqu’à la réponse', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const button = page.locator(BUTTON);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');

  await chooseSort(page, 'Nom');
  await box(page, 'L').click();
  await page.getByRole('button', { name: 'Liste de souhaits' }).click();
  await expect(box(page, 'L')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Liste de souhaits' })).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  // Une autre page chargerait les nouveaux filtres.
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  expect(server.requests).toEqual(['page=0&sort=rarity']);

  let open!: () => void;
  server.gate = new Promise((resolve) => (open = resolve));
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Chargement…');
  await expect(button).toBeDisabled();
  open();
  await expect(titles(page)).toHaveText(['name L ♥ p0']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  expect(server.requests).toEqual(['page=0&sort=rarity', 'page=0&rarity=L&sort=name&wishlist=1']);
});

test('revenir aux choix de la liste affichée : plus rien à chercher, même si le site garde la page', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await box(page, 'UR').click();
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');
  await box(page, 'UR').click();
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity']);
});

test('le bouton recharge la liste affichée, même page, sans la page gardée par le site', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await page.getByRole('button', { name: 'Page suivante' }).click();
  await expect(titles(page)).toHaveText(['rarity toutes p1']);
  await page.locator(BUTTON).click();
  await expect.poll(() => server.requests.length).toBe(3);
  expect(server.requests.at(-1)).toBe('page=1&sort=rarity');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('la recherche part seule après la frappe (700 ms sans frappe), Entrée aussitôt', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const field = page.locator('input[type="text"]');
  await field.pressSequentially('tou', { delay: 50 });
  await page.waitForTimeout(400);
  await field.pressSequentially('r', { delay: 50 });
  await page.waitForTimeout(400);
  expect(server.requests).toEqual(['page=0&sort=rarity']);
  await expect(titles(page)).toHaveText(['rarity toutes «tour» p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity', 'page=0&q=tour&sort=rarity']);
  // Sans total pendant une recherche : pas de dernière page.
  await expect(page.getByRole('button', { name: 'Dernière page' })).toBeDisabled();

  await field.fill('tour eiffel');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['rarity toutes «tour eiffel» p0']);
});

test('pendant une recherche, l’avertissement du site au-dessus des filtres est caché, pas ses compteurs', async ({ page }) => {
  await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const stats = page.locator('main .card-frame');
  await expect(stats).toBeVisible();
  const field = page.locator('input[type="text"]');
  await field.fill('tour');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['rarity toutes «tour» p0']);
  await expect(stats).toContainText('Recherche active');
  await expect(stats).toBeHidden();
  await field.fill('');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(stats).toContainText('L:');
  await expect(stats).toBeVisible();
});

test('pagination comme la Collection : barre du site cachée, dernière page d’un saut', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.getByRole('button', { name: '← Précédent' })).toBeHidden();
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pagination.getByRole('spinbutton', { name: 'Numéro de page' })).toHaveValue('1');
  await expect(pagination).toContainText('/ 3');
  await pagination.getByRole('button', { name: 'Dernière page' }).click();
  await expect(titles(page)).toHaveText(['rarity toutes p2']);
  await expect(pagination.getByRole('spinbutton', { name: 'Numéro de page' })).toHaveValue('3');
  expect(server.requests.at(-1)).toBe('page=2&sort=rarity');
});

test('filtres retenus : à l’arrivée, la liste revient à la dernière recherche, sans charger la liste par défaut', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await chooseSort(page, 'ATK');
  await box(page, 'SR').click();
  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['atk SR p0']);
  const field = page.locator('input[type="text"]');
  await field.fill('tour');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['atk SR «tour» p0']);

  server.requests.length = 0;
  await page.reload();
  await expect(titles(page)).toHaveText(['atk SR «tour» p0']);
  await expect(page.getByRole('button', { name: 'Trier les cartes' })).toHaveText('ATK');
  await expect(box(page, 'SR')).toHaveAttribute('aria-pressed', 'true');
  await expect(field).toHaveValue('tour');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await page.waitForTimeout(800);
  expect(server.requests).toEqual(['page=0&q=tour&rarity=SR&sort=atk']);
});

test('rechargement automatique permis : un changement de tri charge la liste après l’attente, sans bouton', async ({ page }) => {
  await presetSettings(page, { features: { 'global-collection-search': false }, values: {} });
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await settled(page);
  await chooseSort(page, 'DEF');
  await box(page, 'C').click();
  await expect(titles(page)).toHaveText(['def C p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity', 'page=0&rarity=C&sort=def']);
});

test('paramètres : onglet Toutes les cartes, option active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByRole('button', { name: 'Toutes les cartes' }).click();
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: 'Recherche : Empêcher le rechargement automatique' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
});
