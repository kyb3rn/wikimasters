import { expect, test, type Page } from '@playwright/test';
import { openSelectionPage } from './support/collection';
import { presetSettings } from './support/site';

const GEAR = 'button[aria-label="Paramètres WikiMasters"]';
const SWITCH = 'Sélection : Activer ou quitter la sélection avec Ctrl';
const toggle = (page: Page) => page.locator('.wm-selection-toggle');
const faces = (page: Page) => page.locator('#stage [class*="glow-"]');

async function openPage(page: Page) {
  await openSelectionPage(page);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
}

test('un appui sur Ctrl active la sélection, un autre la quitte', async ({ page }) => {
  await openPage(page);
  await page.keyboard.press('Control');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await faces(page).nth(0).click();
  await expect(page.locator('.wm-selection-count')).toHaveText('1sélectionnée');
  await page.keyboard.press('Control');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  // Même depuis le champ de recherche.
  await page.getByPlaceholder('Rechercher par nom ou description').focus();
  await page.keyboard.press('Control');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
});

test('Ctrl avec une autre touche ou un clic ne change rien', async ({ page }) => {
  await openPage(page);
  await page.keyboard.press('Control+a');
  await page.keyboard.down('Control');
  await page.locator('#stage h1').click();
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('modale ouverte : Ctrl ne change rien', async ({ page }) => {
  await openPage(page);
  await page.keyboard.press('Control');
  await faces(page).nth(0).click();
  await page.locator('.wm-selection-actions').getByRole('button', { name: 'Étiqueter', exact: true }).click();
  await expect(page.locator('#bulk-tags')).toBeVisible();
  await page.keyboard.press('Control');
  await page.waitForTimeout(200);
  await expect(page.locator('#bulk-tags')).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wm-selection-count')).toHaveText('1sélectionnée');
});

test('paramètres : onglet Collection, section Sélection, active par défaut, désactivée sur-le-champ', async ({ page }) => {
  await openPage(page);
  await page.locator(`${GEAR}:visible`).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByRole('button', { name: 'Collection' }).click();
  const option = dialog.getByRole('switch', { name: SWITCH });
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(dialog).toContainText('Un appui sur Ctrl, seul, active la sélection de cartes ; un autre la quitte.');
  await option.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press('Control');
  await page.waitForTimeout(200);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('désactivée : Ctrl ne fait rien', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-selection-key': false }, values: {} });
  await openPage(page);
  await page.keyboard.press('Control');
  await page.waitForTimeout(200);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});
