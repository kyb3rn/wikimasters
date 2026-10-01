import { expect, test } from '@playwright/test';
import { CAROUSEL, openCard } from './support/pulls';
import { presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

test('attaque et défense masquées à droite, toujours sur la carte', async ({ page }) => {
  await openCard(page);
  const modal = page.locator('#card-modal');
  await expect(modal.locator('.grid.grid-cols-2')).toBeHidden();
  await expect(modal.locator('.face-stats')).toBeVisible();
  await expect(modal.locator('.face-stats')).toContainText('1200');
});

test('option désactivée : le site les affiche', async ({ page }) => {
  await presetSettings(page, { features: { 'card-modal-stats': false }, values: {} });
  await openCard(page);
  await expect(page.locator('#card-modal .grid.grid-cols-2')).toBeVisible();
  await expect(page.locator('#card-modal .grid.grid-cols-2')).toContainText('ATK');
});
