import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, PACK, PULLS_HTML } from './support/pulls';
import { openSite, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

async function openCard(page: Page) {
  await openSite(page, '/pulls', { html: PULLS_HTML, api: { '/api/packs/open': PACK } });
  await page.click('#open');
  await page.locator('main [class*="glow-"]').click();
}

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
