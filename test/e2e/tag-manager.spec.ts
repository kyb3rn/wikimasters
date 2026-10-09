import { expect, test, type Page } from '@playwright/test';
import { faces, openCollection, tagManagerMarkup, type ManagedTag } from './support/collection';
import { chooseOption, expectDomIdle, nextFrame, openSite, rect, sitePage } from './support/site';

const LONG = 'Monuments historiques de la région parisienne et d’ailleurs, à revoir un jour';

/** Classes du site utiles à la mise en page, en couche comme sur le site (Tailwind v4). */
const TAILWIND = `<style>
@layer utilities {
  *, ::before, ::after { box-sizing: border-box; }
  .max-w-lg { max-width: 32rem; } .max-h-\\[90vh\\] { max-height: 90vh; } .w-full { width: 100%; }
  .overflow-hidden { overflow: hidden; } .min-h-0 { min-height: 0; } .flex-1 { flex: 1 1 0%; } .overflow-y-auto { overflow-y: auto; }
  .p-4 { padding: 1rem; } .p-3 { padding: .75rem; } .min-w-0 { min-width: 0; } .ml-auto { margin-left: auto; } .shrink-0 { flex-shrink: 0; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .space-y-2 > * + * { margin-top: .5rem; }
  .text-sm { font-size: .875rem; line-height: 1.25rem; } .size-2\\.5 { width: .625rem; height: .625rem; }
  .px-2 { padding-inline: .5rem; } .py-1 { padding-block: .25rem; } .inline-flex { display: inline-flex; }
}
</style>`;

/** Fenêtre « Gérer les étiquettes » seule, avec `rows` étiquettes. */
function longManagerPage(rows: number): string {
  const tags: ManagedTag[] = [
    { name: LONG, count: 12, color: '#e3b341' },
    { name: 'sport', count: 1, color: '#60a5fa' },
    ...Array.from({ length: rows - 2 }, (_, i) => ({ name: `étiquette ${i}`, count: i + 2, color: '#e3b341' })),
  ];
  return sitePage(`${TAILWIND}${tagManagerMarkup(tags)}`);
}

const frame = (page: Page) => page.locator('.card-frame-solid');

async function openManager(page: Page, rows: number, height: number) {
  await page.setViewportSize({ width: 1280, height });
  await openSite(page, '/collection', { html: longManagerPage(rows) });
  await expect(frame(page)).toHaveClass(/wm-tag-manager/);
}

test('fenêtre 20 % plus large (614 px), au plus 900 px de haut, 90 % de l’écran sur un petit écran', async ({ page }) => {
  await openManager(page, 40, 1200);
  // Arrondi : l'animation d'entrée du cadre laisse des fractions de pixel.
  const size = async () => {
    const { width, height } = await rect(frame(page));
    return [Math.round(width), Math.round(height)];
  };
  expect(await size()).toEqual([614, 900]);

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect.poll(size).toEqual([614, 630]);
});

test('« n cartes » sur une ligne, collé aux boutons quand le nom est long (le nom est tronqué)', async ({ page }) => {
  await openManager(page, 3, 900);
  const long = page.locator('.card-frame-solid div.min-w-0', { hasText: LONG });
  const count = long.locator('span').nth(2);
  await expect(count).toHaveText('12 cartes');
  await expect(count).toHaveCSS('white-space', 'nowrap');

  const [name, counted, colour] = await Promise.all([
    long.locator('span.truncate').evaluate((el) => el.scrollWidth > el.clientWidth),
    rect(count),
    rect(long.getByRole('button', { name: 'Couleur' })),
  ]);
  expect(name).toBe(true);
  // Une seule ligne (hauteur de ligne de text-xs : 16 px), puis l'écart de la rangée (gap-2 : 8 px) avant « Couleur ».
  expect(counted.height).toBe(16);
  expect(Math.round(colour.x - (counted.x + counted.width))).toBe(8);
});

/** Fenêtre seule, étiquettes de la Collection imitée : égypte (3 cartes, rouge), rare (0, bleue), sport (12, verte). */
async function openTags(page: Page) {
  await openSite(page, '/collection', { html: sitePage(`${TAILWIND}${tagManagerMarkup()}`) });
  await expect(frame(page)).toHaveClass(/wm-tag-manager/);
  await expect(search(page)).toBeVisible();
}

const search = (page: Page) => page.getByRole('textbox', { name: 'Rechercher une étiquette' });
const NO_MATCH = 'Aucune étiquette ne correspond.';

/** Noms des étiquettes affichées, de haut en bas. */
const shownNames = (page: Page) =>
  frame(page)
    .locator('div.rounded-xl')
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.getClientRects().length > 0)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map((row) => row.querySelector('span.truncate')?.textContent ?? ''),
    );

test('filtres entre la création et la liste ; recherche pendant la frappe, sans accents ni casse', async ({ page }) => {
  await openTags(page);
  const [create, field, list] = await Promise.all([
    rect(page.getByPlaceholder('Nouvelle étiquette…')),
    rect(search(page)),
    rect(frame(page).locator('.overflow-y-auto')),
  ]);
  expect(field.y).toBeGreaterThan(create.y + create.height);
  expect(list.y).toBeGreaterThan(field.y + field.height);
  expect(await shownNames(page)).toEqual(['égypte', 'rare', 'sport']);

  await search(page).pressSequentially('EGY');
  await expect.poll(() => shownNames(page)).toEqual(['égypte']);
  await search(page).fill('zzz');
  await expect.poll(() => shownNames(page)).toEqual([]);
  await expect(frame(page).getByText(NO_MATCH)).toBeVisible();
  await search(page).fill('');
  await expect.poll(() => shownNames(page)).toEqual(['égypte', 'rare', 'sport']);
  await expect(frame(page).getByText(NO_MATCH)).toHaveCount(0);
});

test('par nombre de cartes et par famille de couleurs, cumulés', async ({ page }) => {
  await openTags(page);
  await chooseOption(page, 'Filtrer par nombre de cartes', 'Sans carte');
  await expect.poll(() => shownNames(page)).toEqual(['rare']);
  await chooseOption(page, 'Filtrer par nombre de cartes', 'Avec des cartes');
  await expect.poll(() => shownNames(page)).toEqual(['égypte', 'sport']);

  await page.getByRole('button', { name: 'Filtrer par couleur' }).click();
  await expect(page.getByRole('option')).toHaveText(['Toutes les couleurs', 'Rouges (1)', 'Verts (1)', 'Bleus (1)']);
  await page.getByRole('option', { name: 'Verts (1)' }).click();
  await expect.poll(() => shownNames(page)).toEqual(['sport']);
  await chooseOption(page, 'Filtrer par couleur', 'Bleus (1)');
  await expect.poll(() => shownNames(page)).toEqual([]);
  await expect(frame(page).getByText(NO_MATCH)).toBeVisible();
});

test('tri par nombre de cartes, par couleur, dans les deux sens ; par nom : l’ordre du site, sans rang posé', async ({ page }) => {
  await openTags(page);
  await chooseOption(page, 'Trier les étiquettes', 'Nombre de cartes');
  await expect.poll(() => shownNames(page)).toEqual(['sport', 'égypte', 'rare']);
  await page.getByRole('button', { name: /^Sens du tri/ }).click();
  await expect.poll(() => shownNames(page)).toEqual(['rare', 'égypte', 'sport']);

  await chooseOption(page, 'Trier les étiquettes', 'Couleur');
  await expect.poll(() => shownNames(page)).toEqual(['égypte', 'sport', 'rare']);

  await chooseOption(page, 'Trier les étiquettes', 'Nom');
  await expect.poll(() => shownNames(page)).toEqual(['égypte', 'rare', 'sport']);
  const ranks = await frame(page).locator('div.rounded-xl').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).style.getPropertyValue('--wm-tag-order')));
  expect(ranks).toEqual(['', '', '']);
});

test('au repos avec des filtres actifs', async ({ page }) => {
  await openTags(page);
  await search(page).fill('r');
  await chooseOption(page, 'Trier les étiquettes', 'Nombre de cartes');
  await expect.poll(() => shownNames(page)).toEqual(['sport', 'rare']);
  await expectDomIdle(page);
});

test('pas prise pour une modale de carte : aucun bouton « Marché » dans ses lignes', async ({ page }) => {
  await openTags(page);
  await expectDomIdle(page);
  await nextFrame(page);
  // Ses « Supprimer » ont l'icône de la défausse (capture du 06/10 : « Marché » posé dans la première ligne).
  await expect(frame(page).locator('.wm-market-button')).toHaveCount(0);
});

const GEAR = (page: Page) => page.getByRole('button', { name: 'Gérer les étiquettes', exact: true });
const TAG_LIST = (page: Page) => page.getByRole('button', { name: 'Filtrer par étiquette' });

/** Page Collection imitée : `requests` garde les listes demandées. */
async function openOneCard(page: Page) {
  const server = await openCollection(page, { noteList: (params) => `liste ${params.get('tag_id') ?? '-'}` });
  await expect(faces(page)).toHaveCount(1);
  return server;
}

const manageOpened = (page: Page) => page.evaluate(() => (window as unknown as { __collection: { manageOpened: number } }).__collection.manageOpened);

test('engrenage carré collé à droite de la liste des étiquettes ; l’option « Gérer les étiquettes… » quitte la liste', async ({ page }) => {
  await openOneCard(page);
  await expect(GEAR(page)).toBeVisible();
  const [list, gear] = await Promise.all([rect(TAG_LIST(page)), rect(GEAR(page))]);
  expect(Math.round(gear.x)).toBe(Math.round(list.x + list.width));
  expect(Math.round(gear.height)).toBe(Math.round(list.height));
  expect(Math.round(gear.width)).toBe(Math.round(gear.height));

  await TAG_LIST(page).click();
  await expect(page.getByRole('option')).toHaveText(['Toutes les étiquettes', 'Sans étiquette', '#rare']);
  await expect(page.getByRole('option', { name: 'Gérer les étiquettes…', includeHidden: true })).toBeHidden();
});

test('l’engrenage ouvre la fenêtre du site sans changer de filtre ni recharger ; le menu ouvert se referme', async ({ page }) => {
  const server = await openOneCard(page);
  await TAG_LIST(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();

  await GEAR(page).click();
  await expect(page.getByRole('heading', { name: 'Gérer les étiquettes' })).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(TAG_LIST(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(TAG_LIST(page)).toHaveText('Toutes les étiquettes');
  expect(await manageOpened(page)).toBe(1);
  expect(server.requests).toEqual(['liste -']);
});

test('chaque ouverture de la fenêtre repart sans filtre', async ({ page }) => {
  await openOneCard(page);
  await GEAR(page).click();
  await search(page).fill('egy');
  await chooseOption(page, 'Trier les étiquettes', 'Nombre de cartes');
  await expect.poll(() => shownNames(page)).toEqual(['égypte']);

  await frame(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(frame(page)).toHaveCount(0);
  await GEAR(page).click();
  await expect(search(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Trier les étiquettes' })).toHaveText('Nom');
  await expect.poll(() => shownNames(page)).toEqual(['égypte', 'rare', 'sport']);
});
