import { expect, test, type Locator, type Page } from '@playwright/test';
import { entry, openCollection, titles } from './support/collection';
import { chooseOption, expectDomIdle, hold, letTimePass, rect } from './support/site';

const bars = (page: Page) => page.getByRole('navigation', { name: 'Pagination' });
const button = (bar: Locator, name: 'Première page' | 'Page précédente' | 'Page suivante' | 'Dernière page') =>
  bar.getByRole('button', { name, exact: true });
const pageInput = (bar: Locator) => bar.getByRole('spinbutton', { name: 'Numéro de page' });
const collection = (page: Page) =>
  page.evaluate(() => (window as unknown as { __collection: { staleSetPage: number } }).__collection);
/** Boutons « Suivant → » du site, cachés. */
const siteNext = (page: Page) => page.locator('#stage button', { hasText: 'Suivant →' });

/**
 * Serveur imité : `total` exemplaires (50 par page), deux cartes par page (« Carte 1 A »…). `requests` :
 * pages demandées.
 */
async function openPages(page: Page, total = 120) {
  const server = await openCollection(page, {
    total,
    list: (params) => {
      const index = Number(params.get('page'));
      return [entry(`p${index}a`, `Carte ${index + 1} A`), entry(`p${index}b`, `Carte ${index + 1} B`)];
    },
    noteList: (params) => params.get('page') ?? '',
  });
  await expect(titles(page)).toHaveText(['Carte 1 A', 'Carte 1 B']);
  if (total > 50) await expect(bars(page)).toHaveCount(2);
  return server;
}

async function expectPage(page: Page, number: number, total: number) {
  for (const bar of await bars(page).all()) {
    await expect(pageInput(bar)).toHaveValue(String(number));
    await expect(bar).toContainText(`/ ${total}`);
  }
}

test('les deux barres du site sont remplacées : |< < Page 1 / 3 > >|, à la hauteur des champs', async ({ page }) => {
  await openPages(page);
  await expect(siteNext(page)).toHaveCount(2);
  for (const site of await siteNext(page).all()) await expect(site).toBeHidden();
  await expectPage(page, 1, 3);

  const [top, bottom] = await bars(page).all();
  if (!top || !bottom) throw new Error('deux barres attendues');
  // Au-dessus et au-dessous de la grille.
  const grid = await rect(titles(page).first());
  const topBox = await rect(top);
  const bottomBox = await rect(bottom);
  expect(topBox.y + topBox.height).toBeLessThanOrEqual(grid.y);
  expect(bottomBox.y).toBeGreaterThanOrEqual(grid.y + grid.height);

  await expect(button(top, 'Première page')).toBeDisabled();
  await expect(button(top, 'Page précédente')).toBeDisabled();
  await expect(button(top, 'Page suivante')).toBeEnabled();
  await expect(button(top, 'Dernière page')).toBeEnabled();
  for (const control of [button(top, 'Première page'), button(top, 'Dernière page'), pageInput(top)]) {
    expect(Math.round((await rect(control)).height)).toBe(45);
  }
  expect(Math.round((await rect(button(top, 'Dernière page'))).width)).toBe(45);
});

test('page suivante : roue sur le bouton cliqué, tout désactivé jusqu’à la réponse', async ({ page }) => {
  const server = await openPages(page);
  const [top, bottom] = await bars(page).all();
  if (!top || !bottom) throw new Error('deux barres attendues');
  const release = hold(server);
  await button(bottom, 'Page suivante').click();

  await expect(button(bottom, 'Page suivante')).toHaveAttribute('aria-busy', 'true');
  await expect(button(bottom, 'Page suivante').locator('svg.wm-spin')).toBeVisible();
  await expect(button(top, 'Page suivante').locator('svg.wm-spin')).toHaveCount(0);
  for (const bar of [top, bottom]) {
    await expect(button(bar, 'Page suivante')).toBeDisabled();
    await expect(button(bar, 'Dernière page')).toBeDisabled();
    await expect(pageInput(bar)).toBeDisabled();
  }
  expect(await button(bottom, 'Page suivante').evaluate((el) => getComputedStyle(el).cursor)).toBe('not-allowed');
  await expectPage(page, 2, 3);
  release();

  await expect(titles(page)).toHaveText(['Carte 2 A', 'Carte 2 B']);
  await expect(button(bottom, 'Page suivante')).toHaveAttribute('aria-busy', 'false');
  await expect(button(bottom, 'Page suivante')).toBeEnabled();
  await expect(button(top, 'Première page')).toBeEnabled();
  await expectPage(page, 2, 3);
  expect(server.requests).toEqual(['0', '1']);
});

test('clics rapides : la page visée s’affiche aussitôt, une seule requête ; revenir en arrière annule', async ({ page }) => {
  const server = await openPages(page, 220);
  const top = bars(page).first();
  for (let i = 0; i < 3; i++) await button(top, 'Page suivante').click();
  await expect(pageInput(top)).toHaveValue('4');
  await expect(titles(page)).toHaveText(['Carte 4 A', 'Carte 4 B']);
  expect(server.requests).toEqual(['0', '3']);

  await button(top, 'Page suivante').click();
  await button(top, 'Page précédente').click();
  await letTimePass(page, 500);
  await expectPage(page, 4, 5);
  expect(server.requests).toEqual(['0', '3']);
});

test('dernière et première page : saut direct, dans l’arbre React affiché', async ({ page }) => {
  const server = await openPages(page);
  const top = bars(page).first();
  await button(top, 'Dernière page').click();
  await expect(titles(page)).toHaveText(['Carte 3 A', 'Carte 3 B']);
  await expectPage(page, 3, 3);
  await expect(button(top, 'Page suivante')).toBeDisabled();
  await expect(button(top, 'Dernière page')).toBeDisabled();

  await button(top, 'Page précédente').click();
  await expect(titles(page)).toHaveText(['Carte 2 A', 'Carte 2 B']);
  await button(top, 'Première page').click();
  await expect(titles(page)).toHaveText(['Carte 1 A', 'Carte 1 B']);
  await expectPage(page, 1, 3);
  expect(server.requests).toEqual(['0', '2', '1', '0']);
  expect((await collection(page)).staleSetPage).toBe(0);
});

test('numéro saisi : Entrée ou sortie du champ, borné aux pages ; Échap annule', async ({ page }) => {
  const server = await openPages(page);
  const input = pageInput(bars(page).first());

  await input.fill('2');
  await input.press('Enter');
  await expect(titles(page)).toHaveText(['Carte 2 A', 'Carte 2 B']);

  await input.fill('99');
  await input.press('Enter');
  await expect(titles(page)).toHaveText(['Carte 3 A', 'Carte 3 B']);
  await expectPage(page, 3, 3);

  await input.fill('1');
  await input.press('Escape');
  await expect(input).toHaveValue('3');
  await input.fill('');
  await input.blur();
  await expect(input).toHaveValue('3');
  await input.fill('3');
  await input.press('Enter');
  expect(server.requests).toEqual(['0', '1', '2']);

  // Sortie du champ : la saisie est prise.
  await input.fill('1');
  await input.blur();
  await expect(titles(page)).toHaveText(['Carte 1 A', 'Carte 1 B']);
  expect(server.requests).toEqual(['0', '1', '2', '0']);
});

test('recherche en attente : pagination verrouillée, avec la raison', async ({ page }) => {
  await openPages(page);
  await chooseOption(page, 'Trier la collection', 'Nom');
  const top = bars(page).first();
  await expect(button(top, 'Page suivante')).toBeDisabled();
  await expect(button(top, 'Page suivante')).toHaveAttribute('title', "Lancez d'abord la recherche");
  await expect(pageInput(top)).toBeDisabled();

  await page.locator('.wm-collection-search').click();
  await expect(button(top, 'Page suivante')).toBeEnabled();
  await expect(button(top, 'Page suivante')).toHaveAttribute('title', 'Page suivante');
});

test('nouveau total arrivé après la liste : « / n » suit le site (texte seul)', async ({ page }) => {
  const server = await openPages(page);
  server.total = 220;
  let release = () => {};
  server.statsGate = new Promise((resolve) => (release = resolve));
  await page.locator('.wm-collection-search').click();
  await expect.poll(() => server.requests).toEqual(['0', '0']);
  await expect(page.locator('.wm-collection-search')).toHaveAttribute('aria-label', 'Recharger la liste');
  await expectPage(page, 1, 3);
  release();
  await expectPage(page, 1, 5);
});

test('une seule page : ni la pagination du site ni la nôtre', async ({ page }) => {
  await openPages(page, 40);
  await letTimePass(page, 100);
  await expect(bars(page)).toHaveCount(0);
  await expect(siteNext(page)).toHaveCount(0);
});

test('au repos, le script ne réécrit plus la page', async ({ page }) => {
  await openPages(page);
  await button(bars(page).first(), 'Page suivante').click();
  await expect(titles(page)).toHaveText(['Carte 2 A', 'Carte 2 B']);
  await expectDomIdle(page);
});
