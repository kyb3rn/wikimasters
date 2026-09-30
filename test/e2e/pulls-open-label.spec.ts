import { expect, test, type Page } from '@playwright/test';
import { openSite, sitePage } from './support/site';

/** Bouton « Ouvrir » du choix du paquet (balisage du 29/09/2026) : image carrée puis texte, en colonne `gap-4`. */
const PAGE = sitePage(`<style>
.flex-col { flex-direction: column; } .gap-4 { gap: 1rem; } .w-64 { width: 16rem; } .h-64 { height: 16rem; }
</style>
<div class="flex-1 flex flex-col items-center justify-center gap-4 md:gap-8 p-4 md:p-6">
  <button id="open" class="relative flex flex-col items-center justify-center gap-4">
    <img alt="Ouvrir un paquet" width="384" height="384" class="w-64 h-64 object-contain pointer-events-none"
      src="/_next/image?url=%2Fcard_pack.png&amp;w=828&amp;q=75">
    <span class="text-lg md:text-xl font-bold">Ouvrir</span>
  </button>
  <p id="after">Suite de la page</p>
</div>`);

async function layout(page: Page) {
  const [image, label, button] = await Promise.all(
    ['#open img', '#open span', '#open'].map((selector) => page.locator(selector).boundingBox()),
  );
  if (!image || !label || !button) throw new Error('bouton « Ouvrir » incomplet');
  return { gap: label.y - (image.y + image.height), button };
}

test('/pulls : « Ouvrir » remonté de 24 px vers le paquet, le bouton garde sa taille et sa place', async ({ page, context }) => {
  // Même page ailleurs que sur /pulls : le bouton tel que le site le dessine.
  const other = await context.newPage();
  await openSite(other, '/collection', { html: PAGE });
  await expect(other.locator('#open span')).toBeVisible();
  await expect(other.locator('#open span')).not.toHaveClass(/wm-open-label/);
  const site = await layout(other);
  expect(site.gap).toBeCloseTo(16, 0);

  await openSite(page, '/pulls', { html: PAGE });
  await expect(page.locator('#open span')).toHaveClass(/wm-open-label/);
  const raised = await layout(page);
  expect(raised.gap).toBeCloseTo(-8, 0);
  expect(raised.button).toEqual(site.button);
});

const labelTransform = (page: Page) => page.locator('#open span').evaluate((el) => getComputedStyle(el).transform);

test('/pulls : au survol, « Ouvrir » grossit un peu plus que le paquet, bouton actif seulement', async ({ page }) => {
  await openSite(page, '/pulls', { html: PAGE });
  await expect(page.locator('#open span')).toHaveClass(/wm-open-label/);
  expect(await labelTransform(page)).toBe('none');
  await page.locator('#open').hover();
  await expect.poll(() => labelTransform(page)).toBe('matrix(1.04, 0, 0, 1.04, 0, 0)');
  await page.mouse.move(0, 0);
  await expect.poll(() => labelTransform(page)).toBe('none');
  // Désactivé (ouverture en cours, plus de paquet…) : le site n'agrandit rien, le texte non plus.
  await page.locator('#open').evaluate((button) => ((button as HTMLButtonElement).disabled = true));
  await page.locator('#open').hover({ force: true });
  expect(await labelTransform(page)).toBe('none');
});
