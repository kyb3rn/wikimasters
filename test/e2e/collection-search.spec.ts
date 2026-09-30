import { expect, test, type Page } from '@playwright/test';
import { COLLECTION_HTML, entry } from './support/collection';
import { openSite, presetSettings } from './support/site';

const BUTTON = '.wm-collection-search';
const GEAR = 'button[aria-label="Paramètres WikiMasters"]';
const SWITCH = 'Recherche : Empêcher le rechargement automatique';
const BY_RARITY = ['Tour Eiffel', 'Arc de Triomphe'];
const BY_NAME = ['Arc de Triomphe', 'Tour Eiffel'];

const titles = (page: Page) => page.locator('#stage [class*="glow-"] h3');
/** Voile du site sur la grille pendant un chargement. */
const overlay = (page: Page) => page.locator('#stage div[aria-busy="true"]');
const domSyncs = (page: Page) => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
const collection = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __collection: { loads: number; staleRefresh: number; overlayShown: number } }).__collection,
  );

/**
 * Serveur imité : la liste dépend du tri. `requests` : listes et compteurs demandés, avec leurs filtres ;
 * `gate` retient les réponses de la liste tant qu'il n'est pas résolu.
 */
async function openCollection(page: Page) {
  const server = { requests: [] as string[], gate: undefined as Promise<void> | undefined };
  const lists: Record<string, ReturnType<typeof entry>[]> = {
    rarity: [entry('u1', 'Tour Eiffel', 'L'), entry('u2', 'Arc de Triomphe')],
    name: [entry('u2', 'Arc de Triomphe'), entry('u1', 'Tour Eiffel', 'L')],
  };
  await openSite(page, '/collection', {
    html: COLLECTION_HTML,
    handle: async (route, url) => {
      const params = url.searchParams;
      const filters = [params.get('sort'), params.get('tag_id') && `#${params.get('tag_id')}`].filter(Boolean).join(' ');
      if (url.pathname === '/api/my-collection') {
        server.requests.push(`liste ${filters} p${params.get('page')}`);
        await server.gate;
        const collection = lists[params.get('sort') ?? ''] ?? [];
        await route.fulfill({ json: { collection, total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        server.requests.push(`compteurs ${filters}`);
        // Trois pages : la pagination s'affiche.
        await route.fulfill({ json: { total: 120, rarityCounts: {}, tagOptions: [] } });
        return true;
      }
      return false;
    },
  });
  await expect(titles(page)).toHaveText(BY_RARITY);
  return server;
}

/** Choisit une valeur dans une liste déroulante du site. */
async function choose(page: Page, list: string, option: string) {
  await page.getByRole('button', { name: list }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('changer le tri ne recharge pas la liste : la loupe lance la recherche, roue jusqu’à la réponse', async ({ page }) => {
  const server = await openCollection(page);
  const button = page.locator(BUTTON);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  // Tout à droite des deux listes.
  const sort = await page.getByRole('button', { name: 'Trier la collection' }).boundingBox();
  const own = await button.boundingBox();
  expect(own && sort && own.x >= sort.x + sort.width).toBe(true);

  await choose(page, 'Trier la collection', 'Nom');
  await expect.poll(async () => (await collection(page)).loads).toBe(2);
  await expect(page.getByRole('button', { name: 'Trier la collection' })).toHaveText('Nom');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(button.locator('path').first()).toHaveAttribute('d', 'm21 21-4.34-4.34');
  await expect(titles(page)).toHaveText(BY_RARITY);
  // Une autre page chargerait les nouveaux filtres sans leurs compteurs.
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeDisabled();
  expect([...server.requests].sort()).toEqual(['compteurs rarity', 'liste rarity p0']);
  // Au repos (pagination verrouillée), le script ne réécrit plus la page.
  await page.waitForTimeout(300);
  const before = await domSyncs(page);
  await page.waitForTimeout(600);
  expect(await domSyncs(page)).toBe(before);

  let release = () => {};
  server.gate = new Promise((resolve) => (release = resolve));
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('svg.wm-spin')).toBeVisible();
  // Pendant la roue : désactivé, curseur « interdit ».
  await expect(button).toBeDisabled();
  expect(await button.evaluate((el) => getComputedStyle(el).cursor)).toBe('not-allowed');
  await expect(overlay(page)).toBeVisible();
  release();

  await expect(titles(page)).toHaveText(BY_NAME);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  await expect(button).toBeEnabled();
  await expect(overlay(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeEnabled();
  expect(server.requests.slice(2).sort()).toEqual(['compteurs name', 'liste name p0']);
  // Actualisation lue dans l'arbre React affiché, pas dans la version précédente notée sur le nœud.
  expect((await collection(page)).staleRefresh).toBe(0);
});

test('changer de liste ne fait pas clignoter la grille : la roue du site n’apparaît pas', async ({ page }) => {
  await openCollection(page);
  await choose(page, 'Trier la collection', 'Nom');
  await choose(page, 'Filtrer par étiquette', '#rare');
  await expect.poll(async () => (await collection(page)).loads).toBe(3);
  await page.waitForTimeout(100);
  expect((await collection(page)).overlayShown).toBe(0);
});

test('champ de recherche, listes et bouton à la même hauteur', async ({ page }) => {
  await openCollection(page);
  const height = async (locator: ReturnType<Page['locator']>) => Math.round((await locator.boundingBox())?.height ?? 0);
  const input = await height(page.getByPlaceholder('Rechercher par nom ou description'));
  expect(input).toBe(45);
  expect(await height(page.getByRole('button', { name: 'Filtrer par étiquette' }))).toBe(input);
  expect(await height(page.getByRole('button', { name: 'Trier la collection' }))).toBe(input);
  expect(await height(page.locator(BUTTON))).toBe(input);
});

test('le bouton recharge la liste affichée : même requête, même page', async ({ page }) => {
  const server = await openCollection(page);
  await page.locator(BUTTON).click();
  await expect.poll(() => server.requests.length).toBe(4);
  expect(server.requests.slice(2).sort()).toEqual(['compteurs rarity', 'liste rarity p0']);

  // Page 2 : le site ne redemande pas les compteurs.
  await page.getByRole('button', { name: 'Page suivante' }).first().click();
  await expect.poll(() => server.requests.length).toBe(5);
  await page.locator(BUTTON).click();
  await expect.poll(() => server.requests.length).toBe(6);
  expect(server.requests.slice(4)).toEqual(['liste rarity p1', 'liste rarity p1']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('plusieurs choix puis retour à ceux de la liste affichée : aucune requête, plus rien à chercher', async ({ page }) => {
  const server = await openCollection(page);
  await choose(page, 'Filtrer par étiquette', '#rare');
  await choose(page, 'Trier la collection', 'Nom');
  await expect.poll(async () => (await collection(page)).loads).toBe(3);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');

  await choose(page, 'Filtrer par étiquette', 'Toutes les étiquettes');
  await choose(page, 'Trier la collection', 'Rareté');
  await expect.poll(async () => (await collection(page)).loads).toBe(5);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeEnabled();
  expect(server.requests).toHaveLength(2);
});

test('désactivée : un changement de tri recharge la liste (après l’attente), sans bouton', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await choose(page, 'Trier la collection', 'Nom');
  await expect(titles(page)).toHaveText(BY_NAME);
  expect(server.requests.slice(2).sort()).toEqual(['compteurs name', 'liste name p0']);
});

test('paramètres : onglet Collection, option active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openCollection(page);
  await page.locator(`${GEAR}:visible`).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByRole('button', { name: 'Collection' }).click();
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Sélection', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: SWITCH });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await choose(page, 'Trier la collection', 'Nom');
  await expect(titles(page)).toHaveText(BY_NAME);
});
