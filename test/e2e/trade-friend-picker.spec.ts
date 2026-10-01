import { expect, test, type Page } from '@playwright/test';
import { openFriendPickerPage } from './support/friend-picker';
import { expectDomIdle, rect } from './support/site';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Choisir un ami' });
const names = (page: Page) => dialog(page).locator('.wm-picker-name');

test('notre fenêtre à la place de celle du site : deux colonnes, 900 px de haut au plus, « Échanger » choisit l’ami', async ({ page }) => {
  await openFriendPickerPage(page);
  await page.click('#new-trade');
  await expect(names(page)).toHaveText(['Aline', 'Bruno', 'Chloé', 'Zoé']);
  await expect(dialog(page)).toContainText('4 amis');
  await expect(page.locator('div.fixed.inset-0.z-50')).toBeHidden();

  const [first, second] = [await rect(names(page).nth(0)), await rect(names(page).nth(1))];
  expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  expect(second.x).toBeGreaterThan(first.x + 200);
  const box = await rect(dialog(page));
  expect(box.height).toBeLessThanOrEqual(900);
  expect(box.width).toBeGreaterThan(700);

  // La photo est celle du site (copiée de sa ligne).
  await expect(dialog(page).locator('.site-avatar').first()).toHaveText('AL');
  await dialog(page).getByRole('button', { name: 'Échanger avec Chloé' }).click();
  await expect(page.locator('#chosen')).toHaveText('Échanger avec Chloé');
  await expect(dialog(page)).toHaveCount(0);
});

test('recherche, filtre des échanges en cours et tri par date d’amitié', async ({ page }) => {
  await openFriendPickerPage(page);
  await page.click('#new-trade');
  await expect(names(page)).toHaveCount(4);
  await expect(dialog(page).getByText('Échange en cours', { exact: true })).toHaveCount(1);

  const search = dialog(page).getByRole('textbox', { name: 'Rechercher un ami' });
  await search.fill('CHLOE');
  await expect(names(page)).toHaveText(['Chloé']);
  await search.fill('');

  await dialog(page).getByRole('button', { name: 'Filtrer les amis' }).click();
  await page.getByRole('option', { name: 'Sans échange en cours' }).click();
  await expect(names(page)).toHaveText(['Aline', 'Chloé', 'Zoé']);

  await dialog(page).getByRole('button', { name: 'Trier les amis' }).click();
  await page.getByRole('option', { name: 'Amis récents' }).click();
  await expect(names(page)).toHaveText(['Aline', 'Zoé', 'Chloé']);

  // Échap ferme d'abord la liste ouverte, puis la fenêtre (celle du site aussi).
  await dialog(page).getByRole('button', { name: 'Trier les amis' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox', { name: 'Trier les amis' })).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('div.fixed.inset-0.z-50')).toHaveCount(0);
});

for (const fail of [500, 'network'] as const) {
  test(`amis en échec (${fail}) : « Réessayer » les relit et les donne au site`, async ({ page }) => {
    const server = await openFriendPickerPage(page);
    server.fail = fail;
    await page.click('#new-trade');
    const alert = dialog(page).getByRole('alert');
    await expect(alert).toContainText('Le chargement de vos amis a échoué.');

    server.fail = undefined;
    await alert.getByRole('button', { name: 'Réessayer' }).click();
    await expect(names(page)).toHaveText(['Aline', 'Bruno', 'Chloé', 'Zoé']);
    await dialog(page).getByRole('button', { name: 'Échanger avec Zoé' }).click();
    await expect(page.locator('#chosen')).toHaveText('Échanger avec Zoé');
  });
}

test('au repos, fenêtre ouverte, le script ne resynchronise plus la page', async ({ page }) => {
  await openFriendPickerPage(page);
  await page.click('#new-trade');
  await expect(names(page)).toHaveCount(4);
  await expectDomIdle(page);
});
