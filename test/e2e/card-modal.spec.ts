import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, PACK, PULLS_HTML } from './support/pulls';
import { openSite, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const domSyncs = (page: Page) => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);

async function openCardModal(page: Page) {
  await openSite(page, '/pulls', {
    html: PULLS_HTML,
    api: { '/api/packs/open': PACK },
    handle: async (route, url) => {
      if (!url.pathname.endsWith('/discard')) return false;
      await route.fulfill({ json: { balance: 1 } });
      return true;
    },
  });
  await page.click('#open');
  await page.locator('main [class*="glow-"]').click();
  const modal = page.locator('#card-modal');
  // Fin de l'apparition (animate-fade-in-up) : les positions mesurées sont les définitives.
  await modal.locator(':scope > .card-frame').evaluate((panel) => Promise.all(panel.getAnimations().map((a) => a.finished)));
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

  const image = await modal.locator('[class*="h-[45%]"]').boundingBox();
  const box = await report.boundingBox();
  expect(image && box).toBeTruthy();
  if (image && box) {
    expect(Math.round(image.x + image.width - (box.x + box.width))).toBe(8);
    expect(Math.round(image.y + image.height - (box.y + box.height))).toBe(8);
  }

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
  await expect(modal.locator('.wm-market-button')).toHaveClass(/flex-1/);
});

test('pas d’interrupteur dans les paramètres : c’est la présentation par défaut', async ({ page }) => {
  await openCardModal(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  await expect(page.getByRole('dialog', { name: 'Paramètres' })).not.toContainText('Présentation de la modale de carte');
});

test('au repos, le script ne resynchronise plus la page (pas de boucle)', async ({ page }) => {
  await openCardModal(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  // Carte défaussée, modale de cette carte ouverte, « Encore n cartes » en texte : tous les cas marqués.
  await page.locator('.wm-discard-next').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index)).toBe(1);
  await page.locator('main button.w-12').first().click();
  await page.locator('main [class*="glow-"]').click();
  await expect(page.locator('#card-modal .wm-stamp')).toBeVisible();

  await page.waitForTimeout(300);
  const before = await domSyncs(page);
  await page.waitForTimeout(600);
  expect(await domSyncs(page)).toBe(before);
});
