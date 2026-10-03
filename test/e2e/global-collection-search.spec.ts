import { expect, test, type Page } from '@playwright/test';
import { openGlobalCollection } from './support/global-collection-list';
import { gridTitles as titles, rarityBox as box } from './support/lists';
import { animationsDone, chooseOption, expectDomIdle, hold, letTimePass, openSettings, presetSettings, rect } from './support/site';

const BUTTON = '.wm-gc-search';
/** Fin de l'apparition animée des filtres (sinon un clic attend qu'ils ne bougent plus, plus que le délai des filtres). */
const settled = (page: Page) => animationsDone(page.locator('.wm-gc-filter-area'));
const chooseSort = (page: Page, option: string) => chooseOption(page, 'Trier les cartes', option);

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
      rect,
    ),
  );
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
  expect(new Set(boxes.map((b) => Math.round(b.y + b.height / 2))).size).toBe(1);
  // Au repos, le script ne réécrit plus la page.
  await expectDomIdle(page);
});

test('ligne des filtres collée à gauche comme la Collection : champ de 550 px au plus, 300 au moins, vide à droite', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await settled(page);
  const bounds = (selector: string) => rect(page.locator(selector).first());
  const line = await bounds('.wm-gc-filter-line');
  expect(Math.round((await bounds('.wm-gc-field-row')).width)).toBe(550);
  const button = await bounds(BUTTON);
  expect(line.x + line.width - (button.x + button.width)).toBeGreaterThan(300);

  // Fenêtre réduite : le champ rétrécit avec le vide, jamais sous 300 px, tout reste sur une rangée.
  await page.setViewportSize({ width: 1100, height: 800 });
  const field = await bounds('.wm-gc-field-row');
  expect(Math.round(field.width)).toBeLessThan(550);
  expect(Math.round(field.width)).toBeGreaterThanOrEqual(300);
  const narrowButton = await bounds(BUTTON);
  expect(Math.abs(narrowButton.y + narrowButton.height / 2 - (field.y + field.height / 2))).toBeLessThan(3);
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

  const open = hold(server);
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

test('la croix qui vide la recherche ne relance rien, même juste après un F5 : la loupe lance la recherche vide', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const field = page.locator('input[type="text"]');
  await field.fill('tour');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['rarity toutes «tour» p0']);
  await page.reload();
  await expect(titles(page)).toHaveText(['rarity toutes «tour» p0']);
  await expect(field).toHaveValue('tour');
  await letTimePass(page, 800);
  server.requests.length = 0;

  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(field).toHaveValue('');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Lancer la recherche');
  await letTimePass(page, 300);
  await expect(titles(page)).toHaveText(['rarity toutes «tour» p0']);
  expect(server.requests).toEqual([]);

  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
});

test('la frappe ne lance rien : la loupe lance le texte du champ avec les choix, Entrée aussitôt', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const button = page.locator(BUTTON);
  const field = page.locator('input[type="text"]');
  await settled(page);
  await box(page, 'L').click();
  await field.pressSequentially('tour', { delay: 50 });
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await letTimePass(page, 1000);
  expect(server.requests).toEqual(['page=0&sort=rarity']);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);

  await button.click();
  await expect(titles(page)).toHaveText(['rarity L «tour» p0']);
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');
  expect(server.requests).toEqual(['page=0&sort=rarity', 'page=0&q=tour&rarity=L&sort=rarity']);

  // Revenir au texte de la liste affichée : plus rien à chercher.
  await field.pressSequentially('x', { delay: 50 });
  await expect(button).toHaveAttribute('aria-label', 'Lancer la recherche');
  await field.press('Backspace');
  await expect(button).toHaveAttribute('aria-label', 'Recharger la liste');

  await field.fill('tour eiffel');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['rarity L «tour eiffel» p0']);
});

test('rechargement automatique permis : la recherche part seule après la frappe (700 ms sans frappe), Entrée aussitôt', async ({ page }) => {
  await presetSettings(page, { features: { 'global-collection-search': false }, values: {} });
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  const field = page.locator('input[type="text"]');
  await field.pressSequentially('tou', { delay: 50 });
  await letTimePass(page, 400);
  await field.pressSequentially('r', { delay: 50 });
  await letTimePass(page, 400);
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

/** Carte de la liste gardée par le script : son titre (les filtres) et son identifiant (rang de la requête). */
const keptCard = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('wm-global-collection-list-v1');
    if (!raw) return undefined;
    const kept = JSON.parse(raw) as { response: { body: string } };
    const card = (JSON.parse(kept.response.body) as { cards: { id: string; wikipedia_title: string }[] }).cards[0];
    return card && `${card.wikipedia_title} ${card.id}`;
  });

/** Choisit ATK, SR et la recherche « tour » : la dernière liste chargée. */
async function searchTourInSr(page: Page): Promise<void> {
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await chooseSort(page, 'ATK');
  await box(page, 'SR').click();
  await page.locator(BUTTON).click();
  await expect(titles(page)).toHaveText(['atk SR p0']);
  const field = page.locator('input[type="text"]');
  await field.fill('tour');
  await field.press('Enter');
  await expect(titles(page)).toHaveText(['atk SR «tour» p0']);
}

async function expectTourInSr(page: Page): Promise<void> {
  await expect(titles(page)).toHaveText(['atk SR «tour» p0']);
  await expect(page.getByRole('button', { name: 'Trier les cartes' })).toHaveText('ATK');
  await expect(box(page, 'SR')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[type="text"]')).toHaveValue('tour');
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
}

test('filtres retenus : à l’arrivée, la dernière recherche revient aussitôt, filtres et résultats, sans attendre le site', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await searchTourInSr(page);
  await expect.poll(() => keptCard(page)).toBe('atk SR «tour» p0 c-3');

  server.requests.length = 0;
  // Site qui ne répond plus : rien n'attend sa réponse.
  const release = hold(server);
  await page.reload();
  await expectTourInSr(page);
  await letTimePass(page, 800);
  expect(server.requests).toEqual([]);

  // La suite passe par le site, avec les filtres retenus.
  release();
  await page.getByRole('button', { name: 'Page suivante' }).click();
  await expect(titles(page)).toHaveText(['atk SR «tour» p1']);
  expect(server.requests).toEqual(['page=1&q=tour&rarity=SR&sort=atk']);
});

test('liste gardée même sans recherche ni filtre : la liste par défaut revient aussitôt, sans requête', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect.poll(() => keptCard(page)).toBe('rarity toutes p0 c-1');

  server.requests.length = 0;
  hold(server);
  await page.reload();
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect(page.locator(BUTTON)).toHaveAttribute('aria-label', 'Recharger la liste');
  await letTimePass(page, 800);
  expect(server.requests).toEqual([]);
});

test('liste gardée telle quelle jusqu’au prochain chargement : le bouton la recharge et la remplace', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await expect.poll(() => keptCard(page)).toBe('rarity toutes p0 c-1');
  await page.reload();
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await letTimePass(page, 800);
  expect(server.requests).toEqual(['page=0&sort=rarity']);

  await page.locator(BUTTON).click();
  await expect.poll(() => server.requests.length).toBe(2);
  await expect.poll(() => keptCard(page)).toBe('rarity toutes p0 c-2');
  // Une autre page ne remplace pas la liste gardée : à l'arrivée, on revient en page 1.
  await page.getByRole('button', { name: 'Page suivante' }).click();
  await expect(titles(page)).toHaveText(['rarity toutes p1']);
  await letTimePass(page, 300);
  expect(await keptCard(page)).toBe('rarity toutes p0 c-2');
});

test('filtres retenus sans liste gardée : la première liste part avec eux, puis elle est gardée', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await searchTourInSr(page);
  // Comme après la mise à jour du script : des filtres retenus, pas encore de liste.
  await page.evaluate(() => localStorage.removeItem('wm-global-collection-list-v1'));

  server.requests.length = 0;
  await page.reload();
  await expectTourInSr(page);
  await letTimePass(page, 800);
  expect(server.requests).toEqual(['page=0&q=tour&rarity=SR&sort=atk']);
  await expect.poll(() => keptCard(page)).toBe('atk SR «tour» p0 c-1');

  server.requests.length = 0;
  await page.reload();
  await expectTourInSr(page);
  await letTimePass(page, 800);
  expect(server.requests).toEqual([]);
});

test('liste gardée d’autres filtres que ceux retenus : ignorée, la première liste part avec les filtres retenus', async ({ page }) => {
  const server = await openGlobalCollection(page);
  await searchTourInSr(page);
  await page.evaluate(() => {
    const kept = JSON.parse(localStorage.getItem('wm-global-collection-list-v1') ?? '{}') as { filters: Record<string, unknown> };
    kept.filters = { ...kept.filters, sort: 'name' };
    localStorage.setItem('wm-global-collection-list-v1', JSON.stringify(kept));
  });

  server.requests.length = 0;
  await page.reload();
  await expectTourInSr(page);
  await letTimePass(page, 800);
  expect(server.requests).toEqual(['page=0&q=tour&rarity=SR&sort=atk']);
});

test('rechargement automatique permis : la liste gardée revient aussi quand le site affiche d’abord sa page de l’onglet', async ({ page }) => {
  await presetSettings(page, { features: { 'global-collection-search': false }, values: {} });
  const server = await openGlobalCollection(page);
  await expect(titles(page)).toHaveText(['rarity toutes p0']);
  await settled(page);
  await chooseSort(page, 'DEF');
  await box(page, 'C').click();
  await expect(titles(page)).toHaveText(['def C p0']);
  await expect.poll(() => keptCard(page)).toBe('def C p0 c-2');
  // Le site ne garde dans l'onglet que la liste par défaut : il l'affiche sans requête à l'arrivée.
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('gc_v11_') && key !== 'gc_v11_/api/cards?page=0&sort=rarity') sessionStorage.removeItem(key);
    }
  });

  server.requests.length = 0;
  hold(server);
  await page.reload();
  await expect(titles(page)).toHaveText(['def C p0']);
  await expect(page.getByRole('button', { name: 'Trier les cartes' })).toHaveText('DEF');
  await expect(box(page, 'C')).toHaveAttribute('aria-pressed', 'true');
  await letTimePass(page, 800);
  expect(server.requests).toEqual([]);
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
  const dialog = await openSettings(page, 'Toutes les cartes');
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Recherche', 'Apparence']);
  const toggle = dialog.getByRole('switch', { name: 'Recherche : Empêcher le rechargement automatique' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator(BUTTON)).toHaveCount(0);
});
