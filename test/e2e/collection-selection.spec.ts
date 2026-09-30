import { expect, test, type Page } from '@playwright/test';
import { openSelectionPage } from './support/collection';

const faces = (page: Page) => page.locator('#stage [class*="glow-"]');
const toggle = (page: Page) => page.locator('.wm-selection-toggle');
const actions = (page: Page) => page.locator('.wm-selection-actions');
const action = (page: Page, name: string | RegExp) => actions(page).getByRole('button', { name, exact: true });
const loads = (page: Page) => page.evaluate(() => (window as unknown as { __collection: { loads: number } }).__collection.loads);

async function select(page: Page, ...indexes: number[]) {
  await toggle(page).click();
  for (const index of indexes) await faces(page).nth(index).click();
}

test('le bouton du mode, à icône seule, passe au bout de la ligne des filtres, précédé du compte', async ({ page }) => {
  await openSelectionPage(page);
  await expect(toggle(page)).toBeVisible();
  // Celui du site, à côté du titre, est caché.
  await expect(page.getByRole('button', { name: 'Sélectionner', exact: true })).toBeHidden();
  await expect(toggle(page)).toHaveText('');
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Sélectionner des cartes');
  const last = await page.evaluate(() => {
    const line = document.querySelector('button[aria-label="Filtrer par étiquette"]')?.parentElement?.parentElement?.parentElement;
    return line?.lastElementChild?.contains(document.querySelector('.wm-selection-toggle')) ?? false;
  });
  expect(last).toBe(true);
  await expect(page.locator('.wm-selection-count')).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Quitter la sélection');
  await expect(page.locator('.wm-selection-count')).toHaveText('0sélectionnée');
  await faces(page).nth(0).click();
  await faces(page).nth(2).click();
  await expect(page.locator('.wm-selection-count')).toHaveText('2sélectionnées');

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.wm-selection-count')).toHaveCount(0);
  await expect(actions(page)).toHaveCount(0);
});

test('barre du bas : seulement les boutons, à l’allure des actions de la modale de carte', async ({ page }) => {
  await openSelectionPage(page);
  await toggle(page).click();
  await expect(actions(page)).toBeVisible();
  // Le compte et les boutons du site sont cachés.
  await expect(page.getByText('carte sélectionnée')).toBeHidden();
  await expect(page.locator('body > div.fixed.bottom-4 button:not(.wm-root button)').first()).toBeHidden();
  const buttons = actions(page).getByRole('button');
  await expect(buttons).toHaveText([/^Sélectionner toute la page/, 'Étiqueter', 'Désétiqueter', /^Défausser tout/]);
  await expect(action(page, 'Sélectionner toute la page')).toBeVisible();
  // Largeur selon le texte, hauteur des champs.
  const boxes = await Promise.all((await buttons.all()).map(async (button) => (await button.boundingBox()) ?? { width: 0, height: 0 }));
  expect(new Set(boxes.map((box) => Math.round(box.width))).size).toBe(4);
  // Boutons standard moyens : hauteur des champs.
  for (const box of boxes) expect(Math.round(box.height)).toBe(45);
  // Barre resserrée sur ses boutons, autant de marge des deux côtés, centrée là où le site la place
  // (le faux site : 900 px de large depuis le bord gauche, centre à 450 px).
  const bar = (await page.locator('body > div.fixed.bottom-4').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const row = (await actions(page).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  expect(bar.width).toBeLessThan(900);
  expect(Math.round(bar.x + bar.width / 2)).toBe(450);
  expect(Math.round(row.x - bar.x)).toBe(Math.round(bar.x + bar.width - (row.x + row.width)));
  await expect(action(page, 'Défausser tout')).toHaveClass(/wm-tone-danger/);
  await expect(action(page, 'Étiqueter')).toBeDisabled();
  await expect(action(page, 'Défausser tout')).toBeDisabled();

  await action(page, 'Sélectionner toute la page').click();
  await expect(page.locator('.wm-selection-count')).toHaveText('3sélectionnées');
  await expect(action(page, 'Désélectionner la page')).toBeVisible();
  await expect(action(page, 'Étiqueter')).toBeEnabled();
  await action(page, 'Désélectionner la page').click();
  await expect(page.locator('.wm-selection-count')).toHaveText('0sélectionnée');
});

test('en sélection, toute carte non cochée est grisée (face entière), même quand aucune ne l’est', async ({ page }) => {
  await openSelectionPage(page);
  await expect(page.locator('.wm-selection-dim')).toHaveCount(0);
  await toggle(page).click();
  await expect(faces(page).nth(0)).toHaveClass(/wm-selection-dim/);
  await expect(faces(page).nth(1)).toHaveClass(/wm-selection-dim/);
  await expect(faces(page).nth(2)).toHaveClass(/wm-selection-dim/);
  // Toute la face (image comprise) : filtre sur la face ; la case à cocher, à côté, ne l'est pas.
  expect(await faces(page).nth(0).evaluate((face) => getComputedStyle(face).filter)).toContain('grayscale(1)');
  await faces(page).nth(1).click();
  await expect(faces(page).nth(0)).toHaveClass(/wm-selection-dim/);
  await expect(faces(page).nth(1)).not.toHaveClass(/wm-selection-dim/);
  await expect(faces(page).nth(2)).toHaveClass(/wm-selection-dim/);
  await toggle(page).click();
  await expect(page.locator('.wm-selection-dim')).toHaveCount(0);
});

test('pendant un chargement, le voile du site déborde de la grille : l’anneau des cartes cochées reste dessous', async ({ page }) => {
  await openSelectionPage(page);
  await select(page, 0);
  const veil = page.locator('#stage div.absolute.inset-0.z-20[aria-busy="true"]');
  await veil.evaluate((element) => {
    (element as HTMLElement).hidden = false;
  });
  const [grid, cover] = await Promise.all([
    veil.locator('..').boundingBox(),
    veil.boundingBox(),
  ]);
  expect(grid && cover && Math.round(grid.x - cover.x)).toBe(12);
  expect(grid && cover && Math.round(cover.y + cover.height - (grid.y + grid.height))).toBe(12);
});

test('le bouton du mode est là dès la liste, sans attendre les compteurs (le site, lui, les attend)', async ({ page }) => {
  let release: () => void = () => {};
  const stats = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openSelectionPage(page, { beforeStats: () => stats });
  await expect(faces(page)).toHaveCount(3);
  await expect(page.locator('main h1 + button')).toHaveCount(0);
  await expect(toggle(page)).toBeVisible();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await faces(page).nth(0).click();
  await expect(page.locator('.wm-selection-count')).toHaveText('1sélectionnée');
  await expect(action(page, 'Étiqueter')).toBeEnabled();

  // Compteurs reçus : le bouton du site arrive (caché), le nôtre reste dans le même état.
  release();
  await expect(page.locator('main h1 + button')).toHaveCount(1);
  await expect(page.locator('main h1 + button')).toBeHidden();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(actions(page)).toHaveCount(0);
});

test('ligne des filtres en deux côtés : recherche de 550 px au plus, 300 au moins, sélection tout à droite', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  await openSelectionPage(page);
  const search = page.locator('#stage input[type="text"]').first();
  await expect(search).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
  await expect(toggle(page)).toBeVisible();
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const line = async () => box('#stage div.flex.flex-col.gap-3');
  const lists = async () => box('#stage div.flex.w-full.min-w-0.flex-row');

  expect(Math.round((await box('#stage input[type="text"]')).width)).toBe(550);
  const wide = await line();
  const button = await box('.wm-selection-toggle');
  expect(Math.round(button.x + button.width)).toBe(Math.round(wide.x + wide.width));
  const listsBox = await lists();
  expect(button.x - (listsBox.x + listsBox.width)).toBeGreaterThan(400);

  // Fenêtre réduite : le champ rétrécit avec l'écart, jamais sous 300 px.
  await page.setViewportSize({ width: 1340, height: 800 });
  const narrow = Math.round((await box('#stage input[type="text"]')).width);
  expect(narrow).toBeLessThan(550);
  expect(narrow).toBeGreaterThanOrEqual(300);
  const row = await box('#stage input[type="text"]');
  expect(Math.abs((await box('.wm-selection-toggle')).y - row.y)).toBeLessThan(5);

  // Trop étroit pour les deux côtés : la sélection passe sur sa propre rangée, à droite, sans déborder.
  await page.setViewportSize({ width: 1000, height: 800 });
  const field = await box('#stage input[type="text"]');
  const moved = await box('.wm-selection-toggle');
  expect(moved.y).toBeGreaterThan(field.y + field.height);
  const small = await line();
  expect(Math.round(moved.x + moved.width)).toBe(Math.round(small.x + small.width));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('« Défausser tout » demande un second clic, puis la confirmation du site est cachée et acceptée', async ({ page }) => {
  const server = await openSelectionPage(page);
  await select(page, 0, 1);
  const before = await loads(page);

  await action(page, 'Défausser tout').click();
  // Premier clic : « Confirmer ? », inactif un instant, rien n'est envoyé.
  const confirm = action(page, 'Confirmer ?');
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(page.locator('#bulk-discard')).toHaveCount(0);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect.poll(() => server.discards).toEqual([['u1', 'u2']]);
  await expect(page.locator('#bulk-discard')).toBeHidden();
  await expect.poll(() => loads(page)).toBeGreaterThan(before);
  await expect(page.locator('#bulk-discard')).toHaveCount(0);
  await expect(action(page, 'Défausser tout')).toBeDisabled();
});

test('après « Défausser tout », les cartes restent tamponnées « Défaussée », sans rechargement, et ne se cochent plus', async ({ page }) => {
  const server = await openSelectionPage(page);
  await select(page, 0, 1);
  await action(page, 'Défausser tout').click();
  await action(page, 'Confirmer ?').click({ timeout: 3000 });
  await expect.poll(() => server.discards).toEqual([['u1', 'u2']]);

  // La liste rechargée par le site est celle déjà affichée : les trois cartes restent.
  await expect(page.locator('.wm-stamp')).toHaveCount(2);
  await expect(faces(page)).toHaveCount(3);
  await expect(faces(page).nth(0).locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(faces(page).nth(1).locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(faces(page).nth(2).locator('.wm-stamp')).toHaveCount(0);
  await expect(page.locator('.wm-selection-count')).toHaveText('0sélectionnée');

  // Une carte défaussée ne se coche plus, même par « Sélectionner toute la page ».
  await faces(page).nth(0).click();
  await expect(page.locator('.wm-selection-count')).toHaveText('0sélectionnée');
  await action(page, 'Sélectionner toute la page').click();
  await expect(page.locator('.wm-selection-count')).toHaveText('1sélectionnée');
  const marks = page.locator('#stage div.pointer-events-none.absolute.inset-0');
  await expect(marks.nth(0)).not.toHaveClass(/ring-4/);
  await expect(marks.nth(1)).not.toHaveClass(/ring-4/);
  await expect(marks.nth(2)).toHaveClass(/ring-4/);
  await page.waitForTimeout(700);
  await expect(page.locator('.wm-selection-count')).toHaveText('1sélectionnée');
});

test('« Confirmer ? » revient à « Défausser tout » sans second clic', async ({ page }) => {
  const server = await openSelectionPage(page);
  await select(page, 0);
  await action(page, 'Défausser tout').click();
  await expect(action(page, 'Confirmer ?')).toBeEnabled();
  await expect(action(page, 'Défausser tout')).toBeEnabled({ timeout: 5000 });
  expect(server.discards).toEqual([]);
});

test('défausse refusée : message du site en toast, sa confirmation refermée', async ({ page }) => {
  const server = await openSelectionPage(page, {
    bulkDiscard: (route) => route.fulfill({ status: 429, json: { error: 'Trop de défausses, réessaie plus tard' } }),
  });
  await select(page, 2);
  await action(page, 'Défausser tout').click();
  await action(page, 'Confirmer ?').click({ timeout: 3000 });

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Défausse impossible');
  await expect(alert).toContainText('Trop de défausses, réessaie plus tard');
  await expect(page.locator('#bulk-discard')).toHaveCount(0);
  await expect(page.locator('body > div.fixed.bottom-4 p.text-red-500')).toBeHidden();
  expect(server.discards).toEqual([['u3']]);
  await expect(action(page, 'Défausser tout')).toBeEnabled();
});
