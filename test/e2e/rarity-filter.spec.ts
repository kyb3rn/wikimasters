import { expect, test } from '@playwright/test';
import { loadSharedApi } from './support/modules';

// Cases de rareté à la place des pastilles du site (`placeRarityFilter`), vérifiées seules dans une page vide.

/** Deux rangées de pastilles, comme sur un profil : collection de l'ami et choix d'une carte de vitrine. */
const ROW = (n: number) =>
  `<div id="box${n}"><div id="row${n}">` +
  ['L', 'UR'].map((r) => `<button type="button" style="--color-rarity-${r.toLowerCase()}: red">${r}</button>`).join('') +
  '</div></div>';

test('deux instances : chacune ne rend, à son arrêt, que les pastilles qu’elle a cachées', async ({ page }) => {
  await loadSharedApi(page, ROW(1) + ROW(2));
  await page.evaluate(() => {
    const { placeRarityFilter } = window.wmTest;
    const place = (n: number) => {
      const controller = new AbortController();
      const parent = document.getElementById(`box${n}`) as HTMLElement;
      placeRarityFilter({
        signal: controller.signal,
        locate: () => {
          const row = document.getElementById(`row${n}`) as HTMLElement;
          const pills = [...row.querySelectorAll('button')].map((button) => ({
            rarity: button.textContent === 'L' ? ('L' as const) : ('UR' as const),
            button,
            checked: false,
          }));
          return { parent, before: null, pills: { row, pills, reset: undefined } };
        },
      });
      return controller;
    };
    const controllers = [place(1), place(2)];
    (window as unknown as { stopFirst: () => void }).stopFirst = () => controllers[0]?.abort();
  });

  const filters = page.getByRole('group', { name: 'Raretés' });
  await expect(filters).toHaveCount(2);
  await expect(page.locator('#row1')).toBeHidden();
  await expect(page.locator('#row2')).toBeHidden();

  await page.evaluate(() => (window as unknown as { stopFirst: () => void }).stopFirst());
  await expect(page.locator('#box1').getByRole('group', { name: 'Raretés' })).toHaveCount(0);
  await expect(page.locator('#row1')).toBeVisible();
  await expect(page.locator('#row2')).toBeHidden();
  await expect(page.locator('#box2').getByRole('group', { name: 'Raretés' })).toHaveCount(1);
});
