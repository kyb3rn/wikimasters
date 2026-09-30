import { expect, test, type Page } from '@playwright/test';
import { COLLECTION_HTML, entry } from './support/collection';
import { openSite, presetSettings } from './support/site';

const KEY = 'wm-collection-filters-v1';
const SEARCH = '.wm-collection-search';

/** Filtres d'une requête en une chaîne : tri|étiquette|recherche|raretés. */
const describe = (params: URLSearchParams) =>
  [
    params.get('sort'),
    params.get('tag_id') ?? (params.get('untagged') ? 'untagged' : '-'),
    params.get('q') ?? '-',
    params.getAll('rarity').sort().join(',') || '-',
  ].join('|');

/** Serveur imité : la liste renvoyée porte ses filtres pour titre ; `requests` : listes et compteurs demandés. */
async function openCollection(page: Page) {
  const server = { requests: [] as string[] };
  await openSite(page, '/collection', {
    html: COLLECTION_HTML,
    handle: async (route, url) => {
      const params = url.searchParams;
      if (url.pathname === '/api/my-collection') {
        server.requests.push(`liste ${describe(params)} p${params.get('page')}`);
        await route.fulfill({ json: { collection: [entry('u1', describe(params))], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        server.requests.push(`compteurs ${describe(params)}`);
        await route.fulfill({ json: { total: 1, rarityCounts: {}, tagOptions: [] } });
        return true;
      }
      return false;
    },
  });
  return server;
}

const title = (page: Page) => page.locator('#stage [class*="glow-"] h3');
const pressed = (page: Page) => page.getByRole('group', { name: 'Raretés' }).locator('[aria-pressed="true"]');

async function saveFilters(page: Page, filters: { sort: string; tag: string; search: string; rarities: string }) {
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('wm-test-filters')) {
      sessionStorage.setItem('wm-test-filters', '1');
      localStorage.setItem(key, value);
    }
  }, [KEY, JSON.stringify(filters)] as const);
}

async function choose(page: Page, list: string, option: string) {
  await page.getByRole('button', { name: list }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('à l’arrivée, la requête par défaut ne part pas : filtres retenus chargés, contrôles remis, rien d’autre', async ({ page }) => {
  await saveFilters(page, { sort: 'name', tag: 't1', search: 'tour', rarities: 'L,R' });
  const server = await openCollection(page);

  await expect(title(page)).toHaveText('name|t1|tour|L,R');
  await expect(page.getByRole('button', { name: 'Trier la collection' })).toHaveText('Nom');
  await expect(page.getByRole('button', { name: 'Filtrer par étiquette' })).toHaveText('#rare');
  await expect(page.getByPlaceholder('Rechercher par nom ou description')).toHaveValue('tour');
  await expect(pressed(page)).toHaveText(['L', 'R']);
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Recharger la liste');

  // La recherche du champ part 300 ms après : laisser passer, puis rien de plus que le chargement restauré.
  await page.waitForTimeout(800);
  expect([...server.requests].sort()).toEqual(['compteurs name|t1|tour|L,R', 'liste name|t1|tour|L,R p0']);
  await expect(title(page)).toHaveText('name|t1|tour|L,R');
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('la dernière liste chargée est retenue d’une visite à l’autre, pas un choix non lancé', async ({ page }) => {
  const server = await openCollection(page);
  await expect(title(page)).toHaveText('rarity|-|-|-');

  await choose(page, 'Trier la collection', 'Nom');
  await page.locator(SEARCH).click();
  await expect(title(page)).toHaveText('name|-|-|-');
  // Choix retenu par la recherche manuelle, jamais chargé : pas mémorisé.
  await choose(page, 'Trier la collection', "Date d'ajout");
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Lancer la recherche');

  server.requests.length = 0;
  await page.reload();
  await expect(title(page)).toHaveText('name|-|-|-');
  await expect(page.getByRole('button', { name: 'Trier la collection' })).toHaveText('Nom');
  await page.waitForTimeout(500);
  expect([...server.requests].sort()).toEqual(['compteurs name|-|-|-', 'liste name|-|-|- p0']);
});

test('rechargement automatique permis : même retour aux filtres retenus à l’arrivée', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  await saveFilters(page, { sort: 'added', tag: 'untagged', search: '', rarities: 'SR' });
  const server = await openCollection(page);

  await expect(title(page)).toHaveText('added|untagged|-|SR');
  await expect(page.getByRole('button', { name: 'Filtrer par étiquette' })).toHaveText('Sans étiquette');
  await expect(pressed(page)).toHaveText(['SR']);
  await page.waitForTimeout(1000);
  expect([...server.requests].sort()).toEqual(['compteurs added|untagged|-|SR', 'liste added|untagged|-|SR p0']);

  // Ensuite, un changement recharge comme d'habitude, et devient les filtres retenus.
  await choose(page, 'Trier la collection', 'Nom');
  await expect(title(page)).toHaveText('name|untagged|-|SR');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown, KEY)).toEqual({
    sort: 'name',
    tag: 'untagged',
    search: '',
    rarities: 'SR',
  });
});
