import { expect, test } from '@playwright/test';
import { letTimePass, openSite, rect, sitePage } from './support/site';

/** Classes Tailwind utiles ici, imitées dans une couche comme celles du site. */
const TAILWIND = `<style>@layer utilities { .p-3 { padding: 12px; } .pt-1 { padding-top: 4px; } .py-1 { padding-block: 4px; }
  .relative { position: relative; } .absolute { position: absolute; } .overflow-hidden { overflow: hidden; } .-top-2 { top: -8px; } .-right-2 { right: -8px; }
  .w-6 { width: 24px; } .h-6 { height: 24px; } .z-30 { z-index: 30; } .transition-all { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  @media (hover: hover) { .hover\\:scale-105:hover { scale: 1.05; } } }</style>`;

/** Texte d'une face (capture du 29/09/2026) : nom, puis ATK · DEF en bas. */
const face = (size: string) =>
  `<div data-size="${size}" class="${size} glow-c relative rounded-2xl overflow-hidden">` +
  `<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20 "><h3>Carte</h3>` +
  `<div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1">` +
  `<div class="flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1 justify-between">` +
  `<span>5 820</span><span>8 297</span></div></div></div></div>`;

test('cartes des grilles : ATK et DEF plus près du bas, grandes faces inchangées', async ({ page }) => {
  await openSite(page, '/collection', {
    html: sitePage(`${TAILWIND}${face('w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]')}${face('w-72 h-[420px]')}`),
  });
  const small = page.locator('[data-size^="w-[clamp"]');
  await expect(small.locator('.p-3')).toHaveCSS('padding-bottom', '6px');
  await expect(small.locator('.border-t')).toHaveCSS('padding-bottom', '2px');
  const large = page.locator('[data-size^="w-72"]');
  await expect(large.locator('.p-3')).toHaveCSS('padding-bottom', '12px');
  await expect(large.locator('.border-t')).toHaveCSS('padding-bottom', '4px');
});

/** Carte de sa vitrine (capture du 29/09/2026) : « Retirer de la vitrine » en débord sur le coin, à côté de la face. */
const VITRINE =
  '<div class="flex flex-wrap justify-center gap-3" style="display:flex;padding:40px"><div class="relative">' +
  '<div class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-sr relative rounded-2xl overflow-hidden transition-all ' +
  'hover:scale-105" style="width:160px;height:224px"><h3>Naine rouge</h3></div>' +
  '<button class="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] ' +
  'flex items-center justify-center text-[var(--color-foreground)]/60 hover:text-red-400 hover:border-red-400/50 transition-colors ' +
  'cursor-pointer shadow-md" aria-label="Retirer de la vitrine"><svg width="10" height="10" viewBox="0 0 10 10"></svg></button>' +
  '</div></div>';

test('le bouton du coin d’une carte reste centré sur son coin, et le suit quand la carte grandit au survol', async ({ page }) => {
  await openSite(page, '/profile', { html: sitePage(`${TAILWIND}${VITRINE}`) });
  const face = page.locator('.glow-sr');
  const remove = page.getByRole('button', { name: 'Retirer de la vitrine' });
  await expect(remove).toHaveClass(/wm-button-round wm-button-sm wm-tone-danger wm-solid/);

  // Centre du bouton par rapport au coin haut droit de la face (agrandie comprise).
  const offset = async () => {
    const [f, b] = await Promise.all([rect(face), rect(remove)]);
    return [Math.round((f.x + f.width - (b.x + b.width / 2)) * 10) / 10, Math.round((b.y + b.height / 2 - f.y) * 10) / 10];
  };
  await expect.poll(offset).toEqual([4, 4]);

  await face.hover();
  await expect(face).toHaveCSS('scale', '1.05');
  await expect.poll(offset).toEqual([4.2, 4.2]);

  // Sur le bouton, la carte reste agrandie : il ne repart pas sous le curseur.
  await remove.hover();
  await letTimePass(page, 400);
  await expect(face).toHaveCSS('scale', '1.05');
  expect(await offset()).toEqual([4.2, 4.2]);

  await page.mouse.move(0, 0);
  await expect(face).toHaveCSS('scale', 'none');
  await expect.poll(offset).toEqual([4, 4]);
});
