import { expect, test, type Page, type Route } from '@playwright/test';
import { openGlobalCollection } from './support/global-collection-list';
import { expectDomIdle, letTimePass, openSettings, presetSettings, rect, SUPABASE } from './support/site';

const faces = (page: Page) => page.locator('#grid [class*="glow-"]');
const toggle = (page: Page) => page.locator('.wm-selection-toggle');
const count = (page: Page) => page.locator('.wm-selection-count');
const actions = (page: Page) => page.locator('.wm-selection-actions');
const action = (page: Page, name: string | RegExp) => actions(page).getByRole('button', { name, exact: true });
const siteBar = (page: Page) => page.locator('body > div.fixed.bottom-4');

interface WishlistServer {
  /** Requêtes de la liste de souhaits : méthode, adresse décodée, corps. */
  readonly requests: { method: string; url: string; body: unknown }[];
  /** Les réponses attendent `release` tant qu'il est posé. */
  held: Promise<void> | undefined;
}

/**
 * Toutes les cartes imitée, trois cartes par page (`c-1`, `c-1-2`, `c-1-3`), Supabase imité pour la liste de
 * souhaits (`reply` : réponse sur mesure, sinon réussie).
 */
async function openCatalog(
  page: Page,
  { perPage = 3, wishlisted = [] as string[], reply }: { perPage?: number; wishlisted?: string[]; reply?: (route: Route) => Promise<void> } = {},
) {
  const wishes: WishlistServer = { requests: [], held: undefined };
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const raw = request.postData();
    wishes.requests.push({ method: request.method(), url: decodeURIComponent(url.pathname + url.search), body: raw ? (JSON.parse(raw) as unknown) : undefined });
    await wishes.held;
    if (reply) return reply(route);
    return route.fulfill({ status: request.method() === 'DELETE' ? 204 : 201, body: '' });
  });
  const server = await openGlobalCollection(page, { perPage, wishlisted });
  await expect(page.locator('#grid')).toBeAttached();
  await expect(faces(page)).toHaveCount(perPage);
  return { server, wishes };
}

function holdReplies(wishes: WishlistServer): () => void {
  let release = () => {};
  wishes.held = new Promise((resolve) => (release = resolve));
  return () => {
    wishes.held = undefined;
    release();
  };
}

async function select(page: Page, ...indexes: number[]) {
  await toggle(page).click();
  for (const index of indexes) await faces(page).nth(index).click();
}

test('le bouton du mode, à icône seule, au bout de la ligne des filtres, précédé du compte, comme dans la Collection', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  await openCatalog(page);
  await expect(toggle(page)).toBeVisible();
  // Celui du site, à côté du titre, est caché.
  await expect(page.getByRole('button', { name: 'Sélectionner', exact: true })).toBeHidden();
  await expect(toggle(page)).toHaveText('');
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Sélectionner des cartes');
  // Au bout de la ligne, calé à droite, sur la rangée du champ.
  const line = page.locator('main div.flex.flex-col.gap-3').first();
  const [lineBox, button, field] = await Promise.all([rect(line), rect(toggle(page)), rect(page.locator('main input[type="text"]'))]);
  expect(Math.abs(lineBox.x + lineBox.width - (button.x + button.width))).toBeLessThan(2);
  expect(Math.abs(button.y - field.y)).toBeLessThan(5);
  await expect(count(page)).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Quitter la sélection');
  await expect(count(page)).toHaveText('0sélectionnée');
  await faces(page).nth(0).click();
  await faces(page).nth(2).click();
  await expect(count(page)).toHaveText('2sélectionnées');
  // Le compte à gauche du bouton.
  const [counted, after] = await Promise.all([rect(count(page)), rect(toggle(page))]);
  expect(counted.x + counted.width).toBeLessThanOrEqual(after.x);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(count(page)).toHaveCount(0);
  await expect(actions(page)).toHaveCount(0);
  await expectDomIdle(page);
});

test('avec « Charger les prix », la sélection reste au bout de la ligne, après lui', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  await presetSettings(page, { features: { 'market-search': false, 'global-collection-load-prices': true }, values: {} });
  await openCatalog(page);
  const prices = page.locator('.wm-gc-load-prices button');
  await expect(prices).toBeVisible();
  await expect(toggle(page)).toBeVisible();
  const line = page.locator('main div.flex.flex-col.gap-3').first();
  const [lineBox, loader, button] = await Promise.all([rect(line), rect(prices), rect(toggle(page))]);
  expect(loader.x + loader.width).toBeLessThan(button.x);
  expect(Math.abs(lineBox.x + lineBox.width - (button.x + button.width))).toBeLessThan(2);
  expect(Math.abs(loader.y - button.y)).toBeLessThan(5);
  await expectDomIdle(page);
});

test('sans carte, le bouton est désactivé comme celui du site ; Ctrl ne fait rien', async ({ page }) => {
  await openCatalog(page, { perPage: 0 });
  await expect(toggle(page)).toBeDisabled();
  await page.keyboard.press('Control');
  await letTimePass(page, 200);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('barre du bas : seulement nos boutons, à l’allure de ceux de la Collection', async ({ page }) => {
  await openCatalog(page, { wishlisted: ['c-1-2'] });
  await toggle(page).click();
  await expect(actions(page)).toBeVisible();
  // Le compte et les boutons du site sont cachés.
  await expect(page.getByText('carte sélectionnée')).toBeHidden();
  await expect(siteBar(page).locator('button:not(.wm-root button)').first()).toBeHidden();
  const buttons = actions(page).getByRole('button');
  await expect(buttons).toHaveText([/^Sélectionner toute la page/, 'Retirer des souhaits (0)', 'Ajouter aux souhaits (0)']);
  const boxes = await Promise.all((await buttons.all()).map(rect));
  for (const box of boxes) expect(Math.round(box.height)).toBe(45);
  // Barre resserrée sur ses boutons (plus étroite que les 768 px du site), sur une rangée, centrée là où le site la place.
  const [bar, row, main] = await Promise.all([rect(siteBar(page)), rect(actions(page)), rect(page.locator('main'))]);
  expect(bar.width).toBeLessThan(768);
  expect(Math.round(bar.x + bar.width / 2)).toBe(Math.round(main.x + main.width / 2));
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
  expect(Math.round(row.x - bar.x)).toBe(Math.round(bar.x + bar.width - (row.x + row.width)));
  await expect(action(page, 'Ajouter aux souhaits (0)')).toBeDisabled();
  await expect(action(page, 'Retirer des souhaits (0)')).toBeDisabled();

  await action(page, 'Sélectionner toute la page').click();
  await expect(count(page)).toHaveText('3sélectionnées');
  await expect(action(page, 'Désélectionner la page')).toBeVisible();
  await expect(action(page, 'Ajouter aux souhaits (2)')).toBeEnabled();
  await expect(action(page, 'Retirer des souhaits (1)')).toBeEnabled();
  await action(page, 'Désélectionner la page').click();
  await expect(count(page)).toHaveText('0sélectionnée');
  await expectDomIdle(page);
});

/** Cartes grisées par la sélection : tampon sans texte, comme toute carte grisée. */
const greyed = (page: Page) => page.locator('[data-wm-stamp="global-collection-selection"]');

test('en sélection, toute carte non cochée est grisée, comme dans la Collection', async ({ page }) => {
  await openCatalog(page);
  await expect(greyed(page)).toHaveCount(0);
  await toggle(page).click();
  await expect(greyed(page)).toHaveCount(3);
  await faces(page).nth(1).click();
  await expect(faces(page).nth(0)).toHaveAttribute('data-wm-stamp', 'global-collection-selection');
  await expect(faces(page).nth(1)).not.toHaveAttribute('data-wm-stamp');
  await toggle(page).click();
  await expect(greyed(page)).toHaveCount(0);
});

test('au survol, la case à cocher et le signet de la liste de souhaits suivent les coins de la carte agrandie', async ({ page }) => {
  await openCatalog(page, { wishlisted: ['c-1'] });
  await toggle(page).click();
  const cell = faces(page).nth(0).locator('..');
  const box = cell.locator(':scope > span.right-1\\.5');
  const badge = cell.locator(':scope > span.left-1\\.5');
  await expect(box).toHaveCount(1);
  await expect(badge).toHaveCount(1);
  await faces(page).nth(0).hover();
  const expected = await cell.evaluate((element) => ({ top: 6 * 1.05 - 0.025 * element.clientHeight, side: 6 * 1.05 - 0.025 * element.clientWidth }));
  const corner = (locator: typeof box, side: 'left' | 'right') =>
    locator.evaluate((element, name) => [parseFloat(getComputedStyle(element).top), parseFloat(getComputedStyle(element)[name])], side);
  await expect.poll(() => corner(box, 'right')).toEqual([expect.closeTo(expected.top, 0), expect.closeTo(expected.side, 0)]);
  await expect.poll(() => corner(badge, 'left')).toEqual([expect.closeTo(expected.top, 0), expect.closeTo(expected.side, 0)]);
});

test('« Ajouter aux souhaits » : roue et désactivé pendant la requête du site, puis la sélection se ferme', async ({ page }) => {
  const { wishes } = await openCatalog(page, { wishlisted: ['c-1-3'] });
  await select(page, 0, 1, 2);
  const release = holdReplies(wishes);
  await action(page, 'Ajouter aux souhaits (2)').click();
  const adding = action(page, 'Ajouter aux souhaits (2)');
  await expect(adding).toHaveAttribute('aria-busy', 'true');
  await expect(adding).toBeDisabled();
  await expect(adding.locator('svg.wm-spin')).toHaveCount(1);
  // L'autre bouton de la liste n'a pas de roue (le site le désactive pendant la requête).
  await expect(action(page, 'Retirer des souhaits (1)')).toHaveAttribute('aria-busy', 'false');
  await expect(action(page, 'Retirer des souhaits (1)')).toBeDisabled();
  await expect.poll(() => wishes.requests).toEqual([
    {
      method: 'POST',
      url: '/rest/v1/wishlist_items?on_conflict=user_id,card_id',
      body: [
        { user_id: 'u0', card_id: 'c-1' },
        { user_id: 'u0', card_id: 'c-1-2' },
      ],
    },
  ]);
  release();
  await expect(actions(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#catalog-message')).toContainText('2 cartes ajoutées à ta liste de souhaits.');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('« Retirer des souhaits » : une requête pour toutes les cartes cochées qui y sont', async ({ page }) => {
  const { wishes } = await openCatalog(page, { wishlisted: ['c-1', 'c-1-3'] });
  await select(page, 0, 1, 2);
  await action(page, 'Retirer des souhaits (2)').click();
  await expect(actions(page)).toHaveCount(0);
  expect(wishes.requests.map(({ method, url }) => `${method} ${url}`)).toEqual(['DELETE /rest/v1/wishlist_items?user_id=eq.u0&card_id=in.(c-1,c-1-3)']);
  await expect(page.locator('#catalog-message')).toContainText('2 cartes retirées de ta liste de souhaits.');
});

test('refusée : le message du site en toast, son erreur cachée, le bouton de nouveau actif', async ({ page }) => {
  await openCatalog(page, { reply: (route) => route.fulfill({ status: 500, json: { message: 'erreur' } }) });
  await select(page, 1);
  await action(page, 'Ajouter aux souhaits (1)').click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Liste de souhaits');
  await expect(alert).toContainText("Impossible d'ajouter ces cartes à la liste de souhaits.");
  await expect(siteBar(page).locator('p.text-red-500')).toBeHidden();
  await expect(action(page, 'Ajouter aux souhaits (1)')).toBeEnabled();
  await expect(action(page, 'Ajouter aux souhaits (1)')).toHaveAttribute('aria-busy', 'false');
  // Une seule fois, même si le site garde son erreur affichée.
  await letTimePass(page, 300);
  await expect(alert).toHaveCount(1);
});

test('un appui sur Ctrl active la sélection, un autre la quitte', async ({ page }) => {
  await openCatalog(page);
  await page.keyboard.press('Control');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await faces(page).nth(0).click();
  await expect(count(page)).toHaveText('1sélectionnée');
  await page.keyboard.press('Control');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('paramètres : onglet Toutes les cartes, section Sélection, Ctrl actif par défaut, désactivé sur-le-champ', async ({ page }) => {
  await openCatalog(page);
  const dialog = await openSettings(page, 'Toutes les cartes');
  const option = dialog.getByRole('switch', { name: 'Sélection : Activer ou quitter la sélection avec Ctrl' });
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await option.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press('Control');
  await letTimePass(page, 200);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});
