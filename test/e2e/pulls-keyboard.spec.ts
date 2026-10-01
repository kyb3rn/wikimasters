import { expect, test, type Page, type Route } from '@playwright/test';
import { CAROUSEL, openPulls as openFakePulls, packFaces } from './support/pulls';
import { openSettings, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const index = (page: Page) => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index);

/** /pulls imité, paquet ouvert (carrousel). */
async function openPulls(page: Page, discard?: (route: Route) => Promise<void>) {
  await openFakePulls(page, { discard });
  await page.click('#open');
  await expect(packFaces(page)).toBeVisible();
}

test('les flèches gauche et droite changent de carte, sans dépasser les extrémités', async ({ page }) => {
  await openPulls(page);

  await page.keyboard.press('ArrowLeft');
  expect(await index(page)).toBe(0);
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(2);
  await page.keyboard.press('ArrowLeft');
  expect(await index(page)).toBe(1);
});

test('les flèches ne font rien avec Alt, pendant une saisie ou quand une modale est ouverte', async ({ page }) => {
  await openPulls(page);

  await page.keyboard.press('Alt+ArrowRight');
  expect(await index(page)).toBe(0);

  // Modale de carte du site ouverte (et saisie dans son champ d'étiquette).
  await packFaces(page).click();
  await page.getByPlaceholder('Ajouter une étiquette…').focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Fermer' }).click();
  expect(await index(page)).toBe(0);

  // Fenêtre de paramètres ouverte.
  await openSettings(page);
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(1);
});

test('désactivée dans les paramètres, les flèches ne naviguent plus', async ({ page }) => {
  await presetSettings(page, { features: { 'pulls-keyboard': false }, values: {} });
  await openPulls(page);
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(0);

  await openSettings(page, 'Paquets');
  const toggle = page.getByRole('switch', { name: 'Navigation au clavier : Utiliser les flèches du clavier' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(1);
});

test('pendant un défaussage rapide, les flèches sont bloquées comme le reste du carrousel', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => (release = resolve));
  await presetSettings(page, { features: {}, values: { 'pulls-discard-next': { delayMs: 0 } } });
  await openPulls(page, async (route) => {
    await pending;
    await route.fulfill({ json: { balance: 1 } });
  });

  await page.locator('.wm-discard-next').click();
  await expect(page.locator('.wm-discard-next')).toHaveAttribute('data-status', 'busy');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(0);

  release();
  await expect.poll(() => index(page)).toBe(1);
});
