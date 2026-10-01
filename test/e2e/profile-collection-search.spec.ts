import { expect, test, type Page } from '@playwright/test';
import { gridTitles as titles, rarityBox as box } from './support/lists';
import { openFriendCollection } from './support/profile-collection';
import { chooseOption, expectDomIdle, hold, letTimePass, openSettings, presetSettings, rect } from './support/site';

const BUTTON = '.wm-pc-search';
const field = (page: Page) => page.locator('main input[type="text"]');

test('ligne des filtres comme la Collection : champ, cases de rareté, étiquette, tri puis bouton ; pastilles cachées', async ({ page }) => {
  await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const line = page.locator('.wm-pc-filter-line');
  await expect(line.locator('.wm-rarity-filter .wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(page.locator('main .flex-wrap.gap-2 > button', { hasText: /^L$/ })).toBeHidden();
  await expect(field(page)).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
  const boxes = await Promise.all(
    [
      field(page),
      box(page, 'L'),
      page.getByRole('button', { name: 'Filtrer par étiquette' }),
      page.getByRole('button', { name: 'Trier la collection' }),
      page.locator(BUTTON),
    ].map(rect),
  );
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
  expect(new Set(boxes.map((b) => Math.round(b.y + b.height / 2))).size).toBe(1);
  // Au repos, le script ne réécrit plus la page.
  await expectDomIdle(page);
});

test('sans étiquettes chez l’ami : champ, cases, tri et bouton, toujours sur une ligne', async ({ page }) => {
  await openFriendCollection(page, { tags: false });
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.getByRole('button', { name: 'Filtrer par étiquette' })).toHaveCount(0);
  const boxes = await Promise.all([field(page), box(page, 'C'), page.getByRole('button', { name: 'Trier la collection' }), page.locator(BUTTON)].map(rect));
  expect(new Set(boxes.map((b) => Math.round(b.y + b.height / 2))).size).toBe(1);
});

test('tri, étiquette et raretés ne rechargent pas : la loupe lance la recherche, roue jusqu’à la réponse', async ({ page }) => {
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const button = page.locator(BUTTON);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');

  await chooseOption(page, 'Trier la collection', 'Nom');
  await chooseOption(page, 'Filtrer par étiquette', '#rouge');
  await box(page, 'L').click();
  await expect(box(page, 'L')).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1']);

  const open = hold(server);
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Chargement…');
  await expect(button).toBeDisabled();
  open();
  await expect(titles(page)).toHaveText(['name L #t1 p0']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1', 'page=0&sort=name&stats=1&rarity=L&tag_id=t1&pending=1']);
});

test('la frappe ne lance rien : Entrée lance la recherche tapée', async ({ page }) => {
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await field(page).pressSequentially('spo', { delay: 50 });
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');
  await letTimePass(page, 1000);
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1']);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();

  await field(page).press('Enter');
  await expect(titles(page)).toHaveText(['rarity toutes «spo» p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1', 'page=0&sort=rarity&stats=1&q=spo&pending=1']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('rechargement automatique permis : la recherche part 700 ms après la dernière frappe ; une recherche remplacée n’efface pas la grille', async ({
  page,
}) => {
  await presetSettings(page, { features: { 'profile-collection-search': false }, values: {} });
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await field(page).pressSequentially('sp', { delay: 50 });
  // Le site a demandé « sp » (300 ms après la frappe), le script la retient encore.
  await letTimePass(page, 500);
  await field(page).pressSequentially('o', { delay: 50 });
  await letTimePass(page, 500);
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1']);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.locator('main div.py-4 .animate-spin')).toBeHidden();
  await expect(titles(page)).toHaveText(['rarity toutes «spo» p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1', 'page=0&sort=rarity&stats=1&q=spo&pending=1']);
  await expect(page.getByText('Le chargement de la collection a échoué')).toHaveCount(0);
});

test('grille vide : la recherche suivante part sans l’attente du script (sa roue remplacerait les filtres)', async ({ page }) => {
  await presetSettings(page, { features: { 'profile-collection-search': false }, values: {} });
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await field(page).fill('zzz');
  // Le site dit « Collection vide. » : sa recherche remet le total à 0.
  await expect(page.getByText('Collection vide.')).toBeVisible();
  await field(page).fill('spo');
  // 300 ms d'attente du site seulement (700 ms avec celle du script).
  await expect.poll(() => server.requests.at(-1), { timeout: 550 }).toBe('page=0&sort=rarity&stats=1&q=spo&pending=1');
  await expect(titles(page)).toHaveText(['rarity toutes «spo» p0']);
});

test('revenir sur l’onglet : la nouvelle page part de ses filtres par défaut, chargés sans rien retenir', async ({ page }) => {
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await box(page, 'SR').click();
  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['rarity SR p0']);

  await page.getByRole('button', { name: 'Vitrine', exact: true }).click();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(box(page, 'SR')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  expect(server.requests.at(-1)).toBe('page=0&sort=rarity&stats=1&pending=1');
});

test('pagination comme la Collection : barre du site cachée, dernière page d’un saut', async ({ page }) => {
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.getByRole('button', { name: '← Précédent' })).toBeHidden();
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pagination.getByRole('spinbutton', { name: 'Numéro de page' })).toHaveValue('1');
  await expect(pagination).toContainText('/ 3');
  await pagination.getByRole('button', { name: 'Dernière page' }).click();
  await expect(titles(page)).toHaveText(['rarity toutes p2']);
  await expect(pagination.getByRole('spinbutton', { name: 'Numéro de page' })).toHaveValue('3');
  expect(server.requests.at(-1)).toBe('page=2&sort=rarity&stats=0&pending=1');
});

test('rechargement automatique permis : un changement de tri charge la liste après l’attente, sans bouton', async ({ page }) => {
  await presetSettings(page, { features: { 'profile-collection-search': false }, values: {} });
  const server = await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await chooseOption(page, 'Trier la collection', "Date d'ajout");
  await box(page, 'C').click();
  await expect(titles(page)).toHaveText(['added C p0']);
  expect(server.requests).toEqual(['page=0&sort=rarity&stats=1&pending=1', 'page=0&sort=added&stats=1&rarity=C&pending=1']);
});

test('paramètres : onglet Profil, option active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openFriendCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const dialog = await openSettings(page, 'Profil');
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: 'Recherche : Empêcher le rechargement automatique' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
});
