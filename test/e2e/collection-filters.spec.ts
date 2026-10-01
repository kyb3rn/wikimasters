import { expect, test, type Page } from '@playwright/test';
import { faces, openCollection } from './support/collection';
import { presetSettings, rect } from './support/site';

const FILTER = (page: Page) => page.getByRole('group', { name: 'Raretés' });
const SEARCH = '.wm-collection-search';

/** Serveur imité : `requests` garde les listes demandées avec leurs raretés. */
async function openOneCard(page: Page) {
  const server = await openCollection(page, { noteList: (params) => `liste ${params.getAll('rarity').join(',') || '-'} p${params.get('page')}` });
  await expect(faces(page)).toHaveCount(1);
  return server;
}

test('raretés en cases collées entre la recherche et les listes, à la hauteur des champs ; pastilles du site cachées', async ({ page }) => {
  await openOneCard(page);
  const filter = FILTER(page);
  await expect(filter.locator('.wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(filter).toHaveClass(/rounded-lg/);
  await expect(filter).toHaveClass(/overflow-hidden/);
  // Les pastilles du site restent dans la page (nos cases les cliquent), cachées.
  await expect(page.locator('#stage button[style*="--color-rarity-"]:not(.wm-rarity)').first()).toBeHidden();

  const [search, box, tag] = await Promise.all([
    rect(page.getByPlaceholder('Rechercher par nom ou description')),
    rect(filter),
    rect(page.getByRole('button', { name: 'Filtrer par étiquette' })),
  ]);
  expect(box.x).toBeGreaterThanOrEqual(search.x + search.width);
  expect(box.x + box.width).toBeLessThanOrEqual(tag.x);
  expect(Math.round(box.height)).toBe(Math.round(search.height));
});

test('cocher une rareté : couleur de la rareté, liste non rechargée ; la loupe la charge', async ({ page }) => {
  const server = await openOneCard(page);
  const rare = FILTER(page).getByRole('button', { name: 'R', exact: true });
  await expect(rare).toHaveAttribute('aria-pressed', 'false');
  await rare.click();
  await expect(rare).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Lancer la recherche');
  expect(server.requests).toEqual(['liste - p0']);

  await page.locator(SEARCH).click();
  await expect.poll(() => server.requests).toEqual(['liste - p0', 'liste R p0']);
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Recharger la liste');

  // Décochée : retour aux filtres affichés… qui sont maintenant ceux avec R : une recherche attend.
  await rare.click();
  await expect(rare).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(SEARCH)).toHaveAttribute('aria-label', 'Lancer la recherche');
  expect(server.requests).toHaveLength(2);
});

test('case cochée : bordure intérieure et lettres de la couleur de la rareté, sans fond ; survol : fond léger de cette couleur', async ({ page }) => {
  await openOneCard(page);
  await page.addStyleTag({ content: ':root { --color-rarity-r: rgb(10, 200, 30); }' });
  const rare = FILTER(page).getByRole('button', { name: 'R', exact: true });
  await expect(rare).toHaveCSS('box-shadow', 'none');
  await expect(rare).toHaveCSS('transition-property', 'color, background-color, box-shadow');

  await rare.hover();
  await expect(rare).toHaveCSS('background-color', /^(rgba\(10, 200, 30, 0\.15\)|color\(srgb 0\.0392\d* 0\.784\d* 0\.117\d* \/ 0\.15\))$/);

  await rare.click();
  await page.mouse.move(0, 0);
  await expect(rare).toHaveCSS('color', 'rgb(10, 200, 30)');
  await expect(rare).toHaveCSS('box-shadow', 'rgb(10, 200, 30) 0px 0px 0px 2px inset');
  await expect(rare).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('la croix décoche toutes les raretés (« Réinitialiser rareté » du site) ; inactive si rien n’est coché', async ({ page }) => {
  const server = await openOneCard(page);
  const filter = FILTER(page);
  const reset = filter.getByRole('button', { name: 'Décocher toutes les raretés' });
  await expect(reset).toBeDisabled();
  await filter.getByRole('button', { name: 'L', exact: true }).click();
  await filter.getByRole('button', { name: 'R', exact: true }).click();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(filter.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(reset).toBeDisabled();
  expect(server.requests).toEqual(['liste - p0']);
});

test('rechargement automatique permis : cocher une rareté charge la liste', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-search': false }, values: {} });
  const server = await openOneCard(page);
  await FILTER(page).getByRole('button', { name: 'L', exact: true }).click();
  await expect.poll(() => server.requests, { timeout: 5000 }).toEqual(['liste - p0', 'liste L p0']);
});
