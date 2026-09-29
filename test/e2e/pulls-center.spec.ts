import { expect, test, type Page } from '@playwright/test';
import { openSite, sitePage } from './support/site';

/**
 * Mise en page du site (29/09/2026) : `<main>` de hauteur fixe, qui défile, non flex ; son unique enfant
 * en `flex-1`. Carrousel : rangée `items-start md:items-center` ; choix du paquet : colonne `justify-center`.
 */
const LAYOUT = `<style>
main { height: 500px; min-height: 0; overflow-y: auto; }
.flex-1 { flex: 1 1 0%; } .items-start { align-items: flex-start; }
@media (min-width: 768px) { .md\\:items-center { align-items: center; } }
</style>`;
const CAROUSEL = 'flex-1 flex items-start md:items-center justify-center';
const PACKS = 'flex-1 flex flex-col items-center justify-center';

const html = (wrapper: string, height: number) =>
  sitePage(`${LAYOUT}<div class="${wrapper}"><div id="content" style="width:100px;height:${height}px"></div></div>`);

/** Espace libre de `<main>` au-dessus et en dessous du contenu. */
async function placement(page: Page) {
  const [main, content] = [await page.locator('main').boundingBox(), await page.locator('#content').boundingBox()];
  if (!main || !content) throw new Error('main ou contenu introuvable');
  const top = content.y - main.y;
  return { top, bottom: main.height - content.height - top };
}

for (const [label, wrapper] of [
  ['carrousel', CAROUSEL],
  ['choix du paquet', PACKS],
] as const) {
  for (const width of [1280, 400]) {
    test(`/pulls, ${label}, ${width} px de large : 40 % de l'espace libre au-dessus, 60 % en dessous`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await openSite(page, '/pulls', { html: html(wrapper, 200) });
      await expect(page.locator('main')).toHaveClass(/wm-pulls-center/);
      // <main> de 500 px, contenu de 200 px : 300 px libres.
      const { top, bottom } = await placement(page);
      expect(Math.abs(top - 120)).toBeLessThan(1);
      expect(Math.abs(bottom - 180)).toBeLessThan(1);
    });
  }
}

test('/pulls, contenu plus haut que la page : il commence en haut et défile, rien n’est coupé', async ({ page }) => {
  await openSite(page, '/pulls', { html: html(CAROUSEL, 800) });
  await expect(page.locator('main')).toHaveClass(/wm-pulls-center/);
  expect(Math.abs((await placement(page)).top)).toBeLessThan(1);
  expect(await page.locator('main').evaluate((main) => main.scrollHeight)).toBeGreaterThanOrEqual(800);
});

test('ailleurs que sur /pulls, la page n’est pas touchée', async ({ page }) => {
  await openSite(page, '/marketplace', { html: html(CAROUSEL, 200) });
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('main')).not.toHaveClass(/wm-pulls-center/);
  expect((await placement(page)).top).toBe(0);
});
