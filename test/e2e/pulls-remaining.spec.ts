import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openPulls as openFakePulls } from './support/pulls';
import { openSettings, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const proceed = (page: Page) => page.locator('main button.px-8');

async function openPulls(page: Page) {
  await openFakePulls(page);
  await page.click('#open');
}

test('« Encore n cartes » s’affiche en texte gris, « Continuer » reste un bouton', async ({ page }) => {
  await openPulls(page);
  await expect(proceed(page)).toHaveText('Encore 2 cartes');
  await expect(proceed(page)).toHaveClass(/wm-remaining-text/);
  await expect(proceed(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(proceed(page)).toHaveCSS('opacity', '0.5');

  await page.locator('main button.w-12').last().click();
  await expect(proceed(page)).toHaveText('Encore 1 cartes');
  await expect(proceed(page)).toHaveClass(/wm-remaining-text/);

  await page.locator('main button.w-12').last().click();
  await expect(proceed(page)).toHaveText('Continuer');
  await expect(proceed(page)).not.toHaveClass(/wm-remaining-text/);
  await expect(proceed(page)).toBeEnabled();
});

test('présentation par défaut : pas d’interrupteur, un ancien choix « désactivée » est ignoré', async ({ page }) => {
  await presetSettings(page, { features: { 'pulls-remaining': false }, values: {} });
  await openPulls(page);
  await expect(proceed(page)).toHaveClass(/wm-remaining-text/);

  const dialog = await openSettings(page, 'Paquets');
  await expect(dialog).toContainText('Navigation au clavier');
  await expect(dialog).not.toContainText('Cartes restantes');
});
