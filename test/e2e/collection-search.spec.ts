import { expect, test, type Locator, type Page } from '@playwright/test';
import { entry, openCollection as openFakeCollection, titles } from './support/collection';
import { chooseOption, expectDomIdle, hold, letTimePass, openSettings, presetSettings, rect } from './support/site';

const BUTTON = '.wm-collection-search';
const SWITCH = 'Recherche : Empêcher le rechargement automatique';
const BY_RARITY = ['Tour Eiffel', 'Arc de Triomphe'];
const BY_NAME = ['Arc de Triomphe', 'Tour Eiffel'];

/** Voile du site sur la grille pendant un chargement. */
const overlay = (page: Page) => page.locator('#stage div[aria-busy="true"]');
const collection = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __collection: { loads: number; staleRefresh: number; overlayShown: number } }).__collection,
  );

/** Serveur imité : la liste dépend du tri. `requests` : listes et compteurs demandés, avec leurs filtres. */
async function openCollection(page: Page) {
  const lists: Record<string, ReturnType<typeof entry>[]> = {
    rarity: [entry('u1', 'Tour Eiffel', 'L'), entry('u2', 'Arc de Triomphe')],
    name: [entry('u2', 'Arc de Triomphe'), entry('u1', 'Tour Eiffel', 'L')],
  };
  const describe = (params: URLSearchParams) => {
    const search = params.get('q');
    return [params.get('sort'), params.get('tag_id') && `#${params.get('tag_id')}`, search && `"${search}"`].filter(Boolean).join(' ');
  };
  const server = await openFakeCollection(page, {
    list: (params) => lists[params.get('sort') ?? ''] ?? [],
    // Trois pages : la pagination s'affiche.
    total: 120,
    noteList: (params) => `liste ${describe(params)} p${params.get('page')}`,
    noteStats: (params) => `compteurs ${describe(params)}`,
  });
  await expect(titles(page)).toHaveText(BY_RARITY);
  return server;
}

test('changer le tri ne recharge pas la liste : la loupe lance la recherche, roue jusqu’à la réponse', async ({ page }) => {
  const server = await openCollection(page);
  const button = page.locator(BUTTON);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  // Tout à droite des deux listes.
  const sort = await rect(page.getByRole('button', { name: 'Trier la collection' }));
  expect((await rect(button)).x).toBeGreaterThanOrEqual(sort.x + sort.width);

  await chooseOption(page, 'Trier la collection', 'Nom');
  await expect.poll(async () => (await collection(page)).loads).toBe(2);
  await expect(page.getByRole('button', { name: 'Trier la collection' })).toHaveText('Nom');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await expect(button.locator('path').first()).toHaveAttribute('d', 'm21 21-4.34-4.34');
  await expect(titles(page)).toHaveText(BY_RARITY);
  // Une autre page chargerait les nouveaux filtres sans leurs compteurs.
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeDisabled();
  expect([...server.requests].sort()).toEqual(['compteurs rarity', 'liste rarity p0']);
  // Au repos (pagination verrouillée), le script ne réécrit plus la page.
  await expectDomIdle(page);

  const release = hold(server);
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
  await chooseOption(page, 'Trier la collection', 'Nom');
  await chooseOption(page, 'Filtrer par étiquette', '#rare');
  await expect.poll(async () => (await collection(page)).loads).toBe(3);
  await letTimePass(page, 100);
  expect((await collection(page)).overlayShown).toBe(0);
});

test('champ de recherche, listes et bouton à la même hauteur', async ({ page }) => {
  await openCollection(page);
  const height = async (locator: Locator) => Math.round((await rect(locator)).height);
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
  await chooseOption(page, 'Filtrer par étiquette', '#rare');
  await chooseOption(page, 'Trier la collection', 'Nom');
  await expect.poll(async () => (await collection(page)).loads).toBe(3);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');

  await chooseOption(page, 'Filtrer par étiquette', 'Toutes les étiquettes');
  await chooseOption(page, 'Trier la collection', 'Rareté');
  await expect.poll(async () => (await collection(page)).loads).toBe(5);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeEnabled();
  expect(server.requests).toHaveLength(2);
});

test('la frappe ne lance rien : Entrée ou la loupe lancent la recherche tapée', async ({ page }) => {
  const server = await openCollection(page);
  const field = page.getByPlaceholder('Rechercher par nom ou description');
  const button = page.locator(BUTTON);
  await field.pressSequentially('tour');
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  // Le site demande « tour » 300 ms après la frappe : la liste affichée lui est resservie.
  await expect.poll(async () => (await collection(page)).loads).toBe(2);
  await letTimePass(page, 500);
  expect(server.requests).toHaveLength(2);
  await expect(titles(page)).toHaveText(BY_RARITY);
  await expect(page.getByRole('button', { name: 'Page suivante' }).first()).toBeDisabled();

  await field.press('Enter');
  await expect.poll(() => server.requests.length).toBe(4);
  expect(server.requests.slice(2).sort()).toEqual(['compteurs rarity "tour"', 'liste rarity "tour" p0']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');

  // Entrée juste après la frappe : la recherche que le site lance part, sans l'attente du script, une seule fois.
  await field.fill('arc');
  await field.press('Enter');
  await expect.poll(() => server.requests.length, { timeout: 650 }).toBe(6);
  expect(server.requests.slice(4).sort()).toEqual(['compteurs rarity "arc"', 'liste rarity "arc" p0']);
  await letTimePass(page, 800);
  expect(server.requests).toHaveLength(6);

  // La loupe aussi, même juste après la frappe.
  await field.fill('eiffel');
  await button.click();
  await expect.poll(() => server.requests.length).toBe(8);
  expect(server.requests.slice(6).sort()).toEqual(['compteurs rarity "eiffel"', 'liste rarity "eiffel" p0']);
  await letTimePass(page, 800);
  expect(server.requests).toHaveLength(8);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('désactivée : un changement de tri recharge la liste (après l’attente), sans bouton', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openCollection(page);
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await chooseOption(page, 'Trier la collection', 'Nom');
  await expect(titles(page)).toHaveText(BY_NAME);
  expect(server.requests.slice(2).sort()).toEqual(['compteurs name', 'liste name p0']);
});

test('paramètres : onglet Collection, option active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openCollection(page);
  const dialog = await openSettings(page, 'Collection');
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Sélection', 'Prix moyen', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: SWITCH });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await chooseOption(page, 'Trier la collection', 'Nom');
  await expect(titles(page)).toHaveText(BY_NAME);
});
