import { expect, test, type Page } from '@playwright/test';
import { entry, FAKE_JWT, openSelectionPage } from './support/collection';

const faces = (page: Page) => page.locator('#stage [class*="glow-"]');
const modal = (page: Page) => page.locator('#bulk-tags');
const input = (page: Page) => modal(page).locator('input[type="text"]');
const option = (page: Page, name: string) => modal(page).locator('.max-h-64 > button', { hasText: name });
const chips = (page: Page) => modal(page).locator('.wm-root span.rounded-full');
const submit = (page: Page) => modal(page).locator('.wm-root button.wm-button-wide');
const counter = (page: Page, key: 'loads' | 'siteTagActions') =>
  page.evaluate((name) => (window as unknown as { __collection: Record<string, number> }).__collection[name] ?? 0, key);
const writes = (server: { supabase: { method: string; url: string }[] }) =>
  server.supabase.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.url}`);

/** États de la page imitée : exemplaires affichés, compteurs des étiquettes, catalogue. */
const pageState = (page: Page) =>
  page.evaluate(() => {
    const hooks = (window as unknown as { __collection: { page: Record<string, { memoizedState: unknown }> } }).__collection.page;
    return { tagOptions: hooks.tagOptions?.memoizedState, catalog: hooks.catalog?.memoizedState };
  });
const faceTags = (page: Page, index: number) => faces(page).nth(index).locator('.fake-tag');

async function openBulk(page: Page, button: 'Étiqueter' | 'Désétiqueter', ...indexes: number[]) {
  await page.locator('.wm-selection-toggle').click();
  for (const index of indexes) await faces(page).nth(index).click();
  await page.locator('.wm-selection-actions').getByRole('button', { name: button, exact: true }).click();
  await expect(modal(page)).toBeVisible();
}

test('étiquettes choisies une à une, en pastilles au-dessus du champ, envoyées en une fois, posées sans recharger', async ({ page }) => {
  const rare = { id: 't1', name: 'rare', color: '#f472b6' };
  const server = await openSelectionPage(page, {
    entries: [{ ...entry('u1', 'Tour Eiffel'), tags: [rare] }, entry('u2', 'Musée du Louvre', 'R'), entry('u3', 'Mont Blanc', 'SR')],
  });
  await openBulk(page, 'Étiqueter', 0, 1);
  await expect(submit(page)).toHaveText('Ajouter les étiquettes');
  await expect(submit(page)).toBeDisabled();

  // Clic sur une étiquette : choisie, retirée de la liste, rien d'envoyé.
  await option(page, 'rare').click();
  await expect(chips(page)).toHaveText(['rare×']);
  await expect(option(page, 'rare')).toBeHidden();
  // Pastilles juste au-dessus du champ.
  const above = await page.evaluate(() => {
    const field = document.querySelector('#bulk-tags input[type="text"]');
    return field?.previousElementSibling?.classList.contains('wm-root') ?? false;
  });
  expect(above).toBe(true);

  // Entrée : la première étiquette proposée ; puis un nom nouveau par « Créer ».
  await input(page).fill('spo');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('');
  await input(page).fill('Nouvelle');
  await modal(page).getByRole('button', { name: /Créer/ }).click();
  await expect(chips(page)).toHaveText(['rare×', 'sport×', 'Nouvelle×']);
  await expect(submit(page)).toHaveText('Ajouter 3 étiquettes');
  expect(await counter(page, 'siteTagActions')).toBe(0);
  expect(writes(server)).toEqual([]);

  const before = await counter(page, 'loads');
  await submit(page).click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('3 étiquettes ajoutées à 2 cartes.');
  expect(writes(server)).toEqual(['POST /rest/v1/tags?select=*', 'POST /rest/v1/user_card_tags?on_conflict=user_card_id,tag_id']);
  const [create, link] = server.supabase.filter((call) => call.method === 'POST');
  expect(create?.body).toEqual([{ user_id: 'u0', name: 'Nouvelle', color: '#60a5fa' }]);
  expect(link?.body).toEqual([
    { user_card_id: 'u1', tag_id: 't1' },
    { user_card_id: 'u1', tag_id: 't2' },
    { user_card_id: 'u1', tag_id: 'n1' },
    { user_card_id: 'u2', tag_id: 't1' },
    { user_card_id: 'u2', tag_id: 't2' },
    { user_card_id: 'u2', tag_id: 'n1' },
  ]);
  // Avec la session du site.
  expect(link?.apikey).toBe('cle-publique');
  expect(link?.authorization).toBe(`Bearer ${FAKE_JWT}`);
  // Sur les cartes affichées, sans doublon, sans recharger la liste.
  await expect(faceTags(page, 0)).toHaveText(['rare', 'sport', 'Nouvelle']);
  await expect(faceTags(page, 1)).toHaveText(['rare', 'sport', 'Nouvelle']);
  await expect(faceTags(page, 2)).toHaveCount(0);
  await expect(faceTags(page, 1).nth(1)).toHaveAttribute('data-color', '#60a5fa');
  await expect(faceTags(page, 1).nth(2)).toHaveAttribute('data-color', '#60a5fa');
  const state = await pageState(page);
  expect(state.tagOptions).toEqual([
    { ...rare, cardCount: 2 },
    { id: 't2', name: 'sport', color: '#60a5fa', cardCount: 2 },
    { id: 'n1', name: 'Nouvelle', color: '#60a5fa', cardCount: 2 },
  ]);
  expect(state.catalog).toContainEqual({ id: 'n1', name: 'Nouvelle', color: '#60a5fa' });
  await page.waitForTimeout(300);
  expect(await counter(page, 'loads')).toBe(before);
  // Toujours en sélection, les deux cartes cochées ; elles ont maintenant des étiquettes à retirer.
  await expect(page.locator('.wm-selection-count')).toHaveText('2sélectionnées');
  await expect(page.locator('.wm-selection-actions').getByRole('button', { name: 'Désétiqueter', exact: true })).toBeEnabled();
});

test('une étiquette enlevée des choisies revient dans la liste ; la croix annule tout', async ({ page }) => {
  const server = await openSelectionPage(page);
  await openBulk(page, 'Étiqueter', 0);
  await option(page, 'rare').click();
  await option(page, 'histoire').click();
  await expect(submit(page)).toHaveText('Ajouter 2 étiquettes');
  await chips(page).filter({ hasText: 'rare' }).getByRole('button', { name: 'Enlever rare' }).click();
  await expect(chips(page)).toHaveText(['histoire×']);
  await expect(option(page, 'rare')).toBeVisible();
  await expect(submit(page)).toHaveText('Ajouter 1 étiquette');

  await modal(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(modal(page)).toHaveCount(0);
  expect(writes(server)).toEqual([]);
  // Rouverte : plus rien de choisi.
  await page.locator('.wm-selection-actions').getByRole('button', { name: 'Étiqueter', exact: true }).click();
  await expect(chips(page)).toHaveCount(0);
});

test('retrait : même principe, une seule requête pour toutes les cartes', async ({ page }) => {
  const rare = { id: 't1', name: 'rare', color: '#f472b6' };
  const sport = { id: 't2', name: 'sport', color: '#60a5fa' };
  const server = await openSelectionPage(page, {
    entries: [{ ...entry('u1', 'Tour Eiffel'), tags: [rare, sport] }, { ...entry('u2', 'Louvre'), tags: [rare] }, entry('u3', 'Mont Blanc')],
  });
  await openBulk(page, 'Désétiqueter', 0, 1);
  const before = await counter(page, 'loads');
  await expect(option(page, 'histoire')).toHaveCount(0);
  await option(page, 'rare').click();
  await option(page, 'sport').click();
  await expect(submit(page)).toHaveText('Retirer 2 étiquettes');
  await submit(page).click();
  await expect(modal(page)).toHaveCount(0);
  expect(writes(server)).toEqual(['DELETE /rest/v1/user_card_tags?tag_id=in.(t1,t2)&user_card_id=in.(u1,u2)']);
  await expect(page.getByRole('status')).toContainText('2 étiquettes retirées de 2 cartes.');
  await expect(faceTags(page, 0)).toHaveCount(0);
  await expect(faceTags(page, 1)).toHaveCount(0);
  expect((await pageState(page)).tagOptions).toEqual([
    { ...rare, cardCount: 0 },
    { ...sport, cardCount: 0 },
  ]);
  expect(await counter(page, 'loads')).toBe(before);
});

test('pendant l’envoi, tout est bloqué ; un refus s’affiche en toast, la modale reste avec les choix', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openSelectionPage(page, {
    supabase: async (route, url) => {
      if (url.pathname !== '/rest/v1/user_card_tags') return false;
      await held;
      await route.fulfill({ status: 500, json: { code: 'XX000', message: 'boom' } });
      return true;
    },
  });
  await openBulk(page, 'Étiqueter', 0);
  await option(page, 'sport').click();
  await submit(page).click();

  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
  await expect(submit(page).locator('.wm-spin')).toBeVisible();
  await expect(modal(page).getByRole('button', { name: 'Fermer' })).toBeDisabled();
  await expect(input(page)).toBeDisabled();
  // Le fond ne ferme pas la modale pendant l'envoi.
  await modal(page).click({ position: { x: 5, y: 5 } });
  await expect(modal(page)).toBeVisible();

  release();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Étiquetage impossible');
  await expect(alert).toContainText("Impossible d'appliquer les étiquettes (erreur 500).");
  await expect(modal(page)).toBeVisible();
  await expect(chips(page)).toHaveText(['sport×']);
  await expect(submit(page)).toBeEnabled();
  await expect(input(page)).toBeEnabled();
});

test('au repos, la sélection et la modale ne resynchronisent plus la page', async ({ page }) => {
  await openSelectionPage(page);
  await openBulk(page, 'Étiqueter', 0, 2);
  await option(page, 'rare').click();
  await input(page).fill('Nouvelle');
  await page.waitForTimeout(300);
  const domSyncs = () => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
  const before = await domSyncs();
  await page.waitForTimeout(500);
  expect(await domSyncs()).toBe(before);
});
