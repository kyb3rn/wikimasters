import { expect, test, type Page } from '@playwright/test';
import { entry, openCollection as openFakeCollection, titles } from './support/collection';
import { chooseOption, hold, letTimePass, presetSettings } from './support/site';

/** Voile du site sur la grille pendant un chargement. */
const overlay = (page: Page) => page.locator('#stage div[aria-busy="true"]');
const searchField = (page: Page) => page.getByPlaceholder('Rechercher par nom ou description');

/** Filtres d'une requête : « rarity #t1 "tour" R C ». */
const describe = (params: URLSearchParams) => {
  const tag = params.get('tag_id');
  const search = params.get('q');
  return [params.get('sort'), tag && `#${tag}`, search && `"${search}"`, ...params.getAll('rarity')].filter(Boolean).join(' ');
};

/**
 * Serveur imité : une carte par liste, titrée de ses filtres (« Carte rarity R C »). `requests` : listes et
 * compteurs reçus, avec leurs filtres.
 */
async function openCollection(page: Page) {
  const server = await openFakeCollection(page, {
    list: (params) => [entry('u1', `Carte ${describe(params)}`)],
    noteList: (params) => `liste ${describe(params)}`,
    noteStats: (params) => `compteurs ${describe(params)}`,
  });
  await expect(titles(page)).toHaveText(['Carte rarity']);
  await expect.poll(() => server.requests.length).toBe(2);
  return server;
}

/** Le chargement suivant : sa liste et ses compteurs, rien d'autre. */
async function expectNextLoad(server: { requests: string[] }, filters: string) {
  await expect.poll(() => server.requests.length).toBe(4);
  expect(server.requests.slice(2).sort()).toEqual([`compteurs ${filters}`, `liste ${filters}`]);
}

test('rechargement automatique permis : tri puis étiquette changés vite, un seul chargement après l’attente', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  const release = hold(server);
  await chooseOption(page, 'Trier la collection', 'Nom');
  await chooseOption(page, 'Filtrer par étiquette', '#rare');

  // Pendant l'attente : rien n'est parti, la grille reste telle quelle, sans le voile du site, même si React
  // réécrit les classes de <html>.
  await page.evaluate(() => document.documentElement.removeAttribute('class'));
  await letTimePass(page, 300);
  expect(server.requests).toHaveLength(2);
  await expect(titles(page)).toHaveText(['Carte rarity']);
  await expect(overlay(page)).toBeHidden();

  await expectNextLoad(server, 'name #t1');
  // La requête partie, le voile du site revient pendant le chargement.
  await expect(overlay(page)).toBeVisible();
  release();
  await expect(titles(page)).toHaveText(['Carte name #t1']);
  await expect(overlay(page)).toBeHidden();
  await letTimePass(page, 800);
  expect(server.requests).toHaveLength(4);
});

test('recherche, rechargement automatique permis : une frappe reprise pendant l’attente remplace la recherche précédente', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  await searchField(page).pressSequentially('tour');
  // Le site a fait sa requête (300 ms après la frappe), le script la retient encore.
  await letTimePass(page, 450);
  expect(server.requests).toHaveLength(2);
  await searchField(page).pressSequentially('e');

  await expectNextLoad(server, 'rarity "toure"');
  await expect(titles(page)).toHaveText(['Carte rarity "toure"']);
  await letTimePass(page, 800);
  expect(server.requests).toHaveLength(4);
});

test('pastilles de rareté : deux clics rapides, un seul chargement', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  await page.getByRole('button', { name: 'R', exact: true }).click();
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await letTimePass(page, 300);
  expect(server.requests).toHaveLength(2);
  await expectNextLoad(server, 'rarity R C');
  await expect(titles(page)).toHaveText(['Carte rarity R C']);
});

test('rechargement automatique empêché : listes et frappe retenues, la loupe lance le tout sans attente', async ({ page }) => {
  const server = await openCollection(page);
  await chooseOption(page, 'Trier la collection', 'Nom');
  await searchField(page).pressSequentially('tour');
  await letTimePass(page, 800);
  expect(server.requests).toHaveLength(2);
  await expect(titles(page)).toHaveText(['Carte rarity']);

  const start = Date.now();
  await page.locator('.wm-collection-search').click();
  await expectNextLoad(server, 'name "tour"');
  expect(Date.now() - start).toBeLessThan(600);
  await expect(titles(page)).toHaveText(['Carte name "tour"']);
});

test('actualisation (mêmes filtres) : aucune attente', async ({ page }) => {
  const server = await openCollection(page);
  const start = Date.now();
  await page.locator('.wm-collection-search').click();
  await expectNextLoad(server, 'rarity');
  expect(Date.now() - start).toBeLessThan(600);
});
