import { expect, test, type Page } from '@playwright/test';
import { COLLECTION_HTML, entry } from './support/collection';
import { openSite, presetSettings } from './support/site';

const titles = (page: Page) => page.locator('#stage [class*="glow-"] h3');
/** Voile du site sur la grille pendant un chargement. */
const overlay = (page: Page) => page.locator('#stage div[aria-busy="true"]');
const searchField = (page: Page) => page.getByPlaceholder('Rechercher par nom ou description');

/**
 * Serveur imité : une carte par liste, titrée de ses filtres (« Carte rarity R C »). `requests` : listes et
 * compteurs reçus, avec leurs filtres ; `gate` retient les réponses de la liste tant qu'il n'est pas résolu.
 */
async function openCollection(page: Page) {
  const server = { requests: [] as string[], gate: undefined as Promise<void> | undefined };
  await openSite(page, '/collection', {
    html: COLLECTION_HTML,
    handle: async (route, url) => {
      const params = url.searchParams;
      const tag = params.get('tag_id');
      const search = params.get('q');
      const filters = [params.get('sort'), tag && `#${tag}`, search && `"${search}"`, ...params.getAll('rarity')].filter(Boolean).join(' ');
      if (url.pathname === '/api/my-collection') {
        server.requests.push(`liste ${filters}`);
        await server.gate;
        const collection = [entry('u1', `Carte ${filters}`)];
        await route.fulfill({ json: { collection, total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        server.requests.push(`compteurs ${filters}`);
        await route.fulfill({ json: { total: 1, rarityCounts: {}, tagOptions: [] } });
        return true;
      }
      return false;
    },
  });
  await expect(titles(page)).toHaveText(['Carte rarity']);
  await expect.poll(() => server.requests.length).toBe(2);
  return server;
}

/** Retient les réponses de la liste ; la fonction rendue les libère. */
function hold(server: { gate: Promise<void> | undefined }): () => void {
  let release = () => {};
  server.gate = new Promise((resolve) => (release = resolve));
  return release;
}

async function choose(page: Page, list: string, option: string) {
  await page.getByRole('button', { name: list }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
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
  await choose(page, 'Trier la collection', 'Nom');
  await choose(page, 'Filtrer par étiquette', '#rare');

  // Pendant l'attente : rien n'est parti, la grille reste telle quelle, sans le voile du site.
  await page.waitForTimeout(300);
  expect(server.requests).toHaveLength(2);
  await expect(titles(page)).toHaveText(['Carte rarity']);
  await expect(overlay(page)).toBeHidden();

  await expectNextLoad(server, 'name #t1');
  // La requête partie, le voile du site revient pendant le chargement.
  await expect(overlay(page)).toBeVisible();
  release();
  await expect(titles(page)).toHaveText(['Carte name #t1']);
  await expect(overlay(page)).toBeHidden();
  await page.waitForTimeout(800);
  expect(server.requests).toHaveLength(4);
});

test('recherche : une frappe reprise pendant l’attente remplace la recherche précédente', async ({ page }) => {
  const server = await openCollection(page);
  await searchField(page).pressSequentially('tour');
  // Le site a fait sa requête (300 ms après la frappe), le script la retient encore.
  await page.waitForTimeout(450);
  expect(server.requests).toHaveLength(2);
  await searchField(page).pressSequentially('e');

  await expectNextLoad(server, 'rarity "toure"');
  await expect(titles(page)).toHaveText(['Carte rarity "toure"']);
  await page.waitForTimeout(800);
  expect(server.requests).toHaveLength(4);
});

test('pastilles de rareté : deux clics rapides, un seul chargement', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  await page.getByRole('button', { name: 'R', exact: true }).click();
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await page.waitForTimeout(300);
  expect(server.requests).toHaveLength(2);
  await expectNextLoad(server, 'rarity R C');
  await expect(titles(page)).toHaveText(['Carte rarity R C']);
});

test('rechargement automatique empêché : les listes restent retenues, la recherche part après l’attente', async ({ page }) => {
  const server = await openCollection(page);
  await choose(page, 'Trier la collection', 'Nom');
  await page.waitForTimeout(800);
  expect(server.requests).toHaveLength(2);

  await searchField(page).pressSequentially('tour');
  await expectNextLoad(server, 'name "tour"');
  await expect(titles(page)).toHaveText(['Carte name "tour"']);
});

test('actualisation (mêmes filtres) : aucune attente', async ({ page }) => {
  const server = await openCollection(page);
  const start = Date.now();
  await page.locator('.wm-collection-search').click();
  await expectNextLoad(server, 'rarity');
  expect(Date.now() - start).toBeLessThan(600);
});
