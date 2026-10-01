import { expect, test, type Page } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/**
 * Mise en page du site (29/09/2026) : `<main>` de hauteur fixe, qui défile, non flex. Feuille posée dans `<head>` :
 * dans `<main>`, le rond n'y serait plus seul.
 */
const LAYOUT = `document.head.insertAdjacentHTML('beforeend', '<style>main { height: 500px; min-height: 0; overflow-y: auto; } .flex-1 { flex: 1 1 0%; }</style>');`;

const html = (main: string) => sitePage(main, LAYOUT);

/** Rond de chargement d'une page, tel que le site le rend à la place du contenu. */
const SPINNER =
  '<div class="flex-1 flex items-center justify-center"><div id="spinner" ' +
  'class="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" ' +
  'style="width:32px;height:32px"></div></div>';

const CONTENT = '<div class="flex-1 p-4 md:p-6 space-y-6"><h1 id="content">Collection</h1></div>';

/** Écart entre le centre du rond et celui de `<main>`, en pixels. */
async function offCenter(page: Page) {
  const [main, spinner] = [await rect(page.locator('main')), await rect(page.locator('#spinner'))];
  return {
    x: Math.abs(spinner.x + spinner.width / 2 - (main.x + main.width / 2)),
    y: Math.abs(spinner.y + spinner.height / 2 - (main.y + main.height / 2)),
  };
}

for (const path of ['/collection', '/marketplace/07c0e0bd-fa05-4d22-8b59-073e0736a492', '/pulls']) {
  for (const width of [1280, 400]) {
    test(`${path}, ${width} px de large : le rond de chargement est au milieu de la page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await openSite(page, path, { html: html(SPINNER) });
      await expect(page.locator('main')).toHaveClass(/wm-page-spinner/);
      const { x, y } = await offCenter(page);
      expect(x).toBeLessThan(1);
      expect(y).toBeLessThan(1);
    });
  }
}

test('le contenu arrivé, la page reprend sa mise en page', async ({ page }) => {
  await openSite(page, '/collection', { html: html(SPINNER) });
  await expect(page.locator('main')).toHaveClass(/wm-page-spinner/);

  await page.locator('main').evaluate((main, content) => (main.innerHTML = content), CONTENT);
  await expect(page.locator('main')).not.toHaveClass(/wm-page-spinner/);
  const [main, content] = [await rect(page.locator('main')), await rect(page.locator('#content'))];
  expect(content.y - main.y).toBeLessThan(40);
});

test('/pulls : 50 / 50 pendant le chargement, puis 40 / 60 pour le contenu', async ({ page }) => {
  await openSite(page, '/pulls', { html: html(SPINNER) });
  await expect(page.locator('main')).toHaveClass(/wm-page-spinner/);
  await expect(page.locator('main')).not.toHaveClass(/wm-pulls-center/);

  await page
    .locator('main')
    .evaluate(
      (main) =>
        (main.innerHTML = '<div class="flex-1 flex flex-col items-center justify-center"><div id="content" style="height:200px"></div></div>'),
    );
  await expect(page.locator('main')).toHaveClass(/wm-pulls-center/);
  await expect(page.locator('main')).not.toHaveClass(/wm-page-spinner/);
});

test('un rond de chargement dans le contenu (liste, fenêtre) ne touche pas à la page', async ({ page }) => {
  await openSite(page, '/collection', {
    html: html(
      '<div class="flex-1 p-4"><h1 id="content">Amis</h1><div class="flex justify-center py-12">' +
        '<div class="w-8 h-8 rounded-full animate-spin"></div></div></div>',
    ),
  });
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('main')).not.toHaveClass(/wm-page-spinner/);
});
