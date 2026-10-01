import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openCard, packFaces } from './support/pulls';
import { animationsDone, expectDomIdle, openSettings, presetSettings, rect } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

async function openCardModal(page: Page) {
  await openCard(page);
  const modal = page.locator('#card-modal');
  // Fin de l'apparition (animate-fade-in-up) : les positions mesurées sont les définitives.
  await animationsDone(modal.locator(':scope > .card-frame'));
  return modal;
}

test('la ligne rareté / onglets et le bloc de signalement disparaissent de la colonne de droite', async ({ page }) => {
  const modal = await openCardModal(page);
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText('Tour Eiffel');
  await expect(modal.getByText('Commun', { exact: true })).toBeHidden();
  await expect(modal.getByRole('tablist')).toBeHidden();
  await expect(modal.locator('.border-t')).toBeHidden();
  await expect(modal.getByText('Détails de la carte')).toBeVisible();
});

test('« Signaler l’image » est une pastille en bas à droite de l’image, qui déclenche le bouton du site', async ({ page }) => {
  const modal = await openCardModal(page);
  const report = modal.locator('.wm-report');
  await expect(report).toBeVisible();
  await expect(report).toHaveAttribute('aria-label', "Signaler l'image");

  const image = await rect(modal.locator('[class*="h-[45%]"]'));
  const box = await rect(report);
  expect(Math.round(image.x + image.width - (box.x + box.width))).toBe(8);
  expect(Math.round(image.y + image.height - (box.y + box.height))).toBe(8);

  await report.click();
  await expect(report).toHaveAttribute('aria-pressed', 'true');
  await expect(report).toBeDisabled();
  await expect(report).toHaveAttribute('aria-label', 'Image signalée');
});

test('actions : Vendre à gauche, Marché (gris) au centre, Défausser (rouge) à droite', async ({ page }) => {
  const modal = await openCardModal(page);
  const labels = await modal.getByRole('button', { name: /Défausser/ }).evaluate((discard) =>
    [...(discard.parentElement?.querySelectorAll('button') ?? [])].map((button) => (button.textContent ?? '').trim()),
  );
  expect(labels).toEqual(['Vendre', 'Marché', 'Défausser+1']);
  await expect(modal.getByRole('button', { name: /Défausser/ })).toHaveCSS('color', 'rgb(248, 81, 73)');
  await expect(modal.locator('.wm-market-button')).not.toHaveCSS('color', 'rgb(248, 81, 73)');
  await expect(modal.locator('.wm-market-button')).toHaveClass(/wm-button-window/);
});

test('pas d’interrupteur dans les paramètres : c’est la présentation par défaut', async ({ page }) => {
  await openCardModal(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(await openSettings(page)).not.toContainText('Présentation de la modale de carte');
});

test('au repos, le script ne resynchronise plus la page (pas de boucle)', async ({ page }) => {
  await openCardModal(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  // Carte défaussée, modale de cette carte ouverte, « Encore n cartes » en texte : tous les cas marqués.
  await page.locator('.wm-discard-next').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index)).toBe(1);
  await page.locator('main button.w-12').first().click();
  await packFaces(page).click();
  await expect(page.locator('#card-modal .wm-stamp')).toBeVisible();
  await expectDomIdle(page);
});
