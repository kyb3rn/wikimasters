import { expect, test } from '@playwright/test';
import { openSite, sitePage } from './support/site';

/** Classes Tailwind de la vignette, imitées dans une couche comme celles du site (Tailwind v4 : `@layer utilities`). */
const TAILWIND = `<style>@layer utilities {
  .glow-r { width: 10rem; height: 14rem; background: #555; border-radius: 1rem; }
  .card-frame { display: block; padding: 12px; width: 184px; border: 1px solid #444; border-radius: 16px; }
  .gap-2\\.5 { gap: 10px; } .overflow-hidden { overflow: hidden; } .w-full { width: 100%; }
  .flex { display: flex; } .flex-col { flex-direction: column; } .justify-between { justify-content: space-between; }
  .truncate { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .relative { position: relative; } .absolute { position: absolute; } .z-20 { z-index: 20; }
  .top-0 { top: 0; } .left-0 { left: 0; } .right-0 { right: 0; } .h-\\[45\\%\\] { height: 45%; } .h-full { height: 100%; }
}</style>`;

/** Face `sm` (capture du 29/09/2026) : image en haut, nom. */
const FACE =
  '<div class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-r relative rounded-2xl overflow-hidden">' +
  '<div class="absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20"><div class="relative h-full w-full min-h-0"></div></div>' +
  '<h3>Vitamine B8</h3></div>';

/** Vignette d'annonce (capture du 29/09/2026), avec le bandeau « Vous menez » de l'onglet Mes enchères. */
const tile = (id: string, seller: string, { badge = '', duration = '9m 38s' } = {}) =>
  `<div id="marketplace-auction-${id}"><a class="card-frame block p-3 w-[172px] md:w-[184px]" href="/marketplace/${id}">` +
  `<div class="flex flex-col items-center gap-2.5">` +
  (badge ? `<span class="w-full text-center rounded-lg">${badge}</span>` : '') +
  `<div class="overflow-hidden rounded-2xl">${FACE}</div>` +
  `<div class="w-full flex items-center justify-between gap-2 text-xs">` +
  `<div class="flex flex-col min-w-0"><span class="text-[10px] uppercase">Mise actuelle</span><span class="font-semibold">30</span></div>` +
  `<div class="flex flex-col items-end"><span class="text-[10px] uppercase">Durée</span>` +
  `<span class="tabular-nums font-medium text-xs">${duration}</span></div></div>` +
  `<p class="w-full text-[10px] text-[var(--color-foreground)]/40 truncate">Vendu par ${seller}</p></div></a></div>`;

// Le lien de l'annonce navigue sans recharger, comme un Link de Next.js : les ouvertures sont comptées.
const HTML = sitePage(
  `${TAILWIND}<div class="flex flex-wrap justify-center gap-4 md:gap-5">` +
    tile('a1', 'Production Prod-Prod') +
    tile('a2', 'eli!', { badge: 'Vous menez' }) +
    tile('a3', 'Conch', { duration: 'Terminée' }) +
    `</div>`,
  `window.opened = [];
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/marketplace/"]');
    if (!link) return;
    event.preventDefault();
    window.opened.push(link.getAttribute('href'));
  });`,
);

test('annonces : carte sans cadre, appendice (mise, durée) qui dépasse sous la carte', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  const face = page.locator('#marketplace-auction-a1 .glow-r');
  const frame = page.locator('#marketplace-auction-a1 > a');
  const case_ = page.locator('#marketplace-auction-a1');
  await expect(page.locator('#marketplace-auction-a1 .wm-profile-link')).toBeAttached();

  const [faceBox, frameBox, caseBox] = await Promise.all([face.boundingBox(), frame.boundingBox(), case_.boundingBox()]);
  if (!faceBox || !frameBox || !caseBox) throw new Error('vignette invisible');
  // La carte est en haut de la case, le cadre commence sous elle (32 px cachés) et a sa largeur.
  expect(Math.abs(faceBox.y - caseBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.y - (faceBox.y + faceBox.height - 32))).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.width - faceBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.x - faceBox.x)).toBeLessThanOrEqual(1);
  const price = await page.locator('#marketplace-auction-a1 .justify-between').boundingBox();
  expect(price!.y).toBeGreaterThan(faceBox.y + faceBox.height);
  // Le vendeur n'est plus dans l'appendice : il se termine sous la mise et la durée.
  expect(frameBox.y + frameBox.height - (price!.y + price!.height)).toBeLessThanOrEqual(10);

  // Onglet Mes enchères : le bandeau passe sous la carte, dans l'appendice.
  const badge = await page.getByText('Vous menez').boundingBox();
  const face2 = await page.locator('#marketplace-auction-a2 .glow-r').boundingBox();
  expect(badge!.y).toBeGreaterThan(face2!.y + face2!.height);
});

test('annonces : « Terminée » en italique, plus petit que les durées en cours', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  const ended = page.locator('#marketplace-auction-a3').getByText('Terminée');
  const running = page.locator('#marketplace-auction-a1').getByText('9m 38s');
  await expect(ended).toHaveCSS('font-style', 'italic');
  await expect(ended).toHaveCSS('font-size', '11px');
  await expect(running).toHaveCSS('font-style', 'normal');
  await expect(running).toHaveCSS('font-size', '13px');

  // Le compte à rebours arrive à zéro : seul son texte change.
  await page.evaluate(() => {
    const span = [...document.querySelectorAll('#marketplace-auction-a1 span')].find((el) => el.textContent === '9m 38s');
    span!.firstChild!.nodeValue = 'Terminée';
  });
  await expect(page.locator('#marketplace-auction-a1').getByText('Terminée')).toHaveCSS('font-style', 'italic');
});

test('annonces : « @vendeur » sur l’image de la carte au survol, mène au profil, pas à l’annonce', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  const tileA1 = page.locator('#marketplace-auction-a1');
  const seller = tileA1.getByRole('link', { name: '@Production Prod-Prod', exact: true });
  await expect(seller).toHaveAttribute('href', '/profile/Production%20Prod-Prod');
  await expect(seller).toHaveClass(/wm-button/);
  // Le « Vendu par » du site est caché.
  await expect(tileA1.getByText('Vendu par Production Prod-Prod')).toBeHidden();

  // Hors survol, invisible ; au survol de la vignette, en bas à gauche de l'image.
  await page.mouse.move(0, 0);
  await expect(seller).toHaveCSS('opacity', '0');
  await tileA1.locator('.justify-between').hover();
  await expect(seller).toHaveCSS('opacity', '1');
  const [link, image] = await Promise.all([seller.boundingBox(), tileA1.locator('.bg-black\\/20').boundingBox()]);
  expect(Math.abs(link!.x - image!.x - 6)).toBeLessThanOrEqual(1);
  expect(link!.height).toBeLessThanOrEqual(20);
  expect(Math.abs(image!.y + image!.height - (link!.y + link!.height) - 6)).toBeLessThanOrEqual(1);

  // Clic sur la carte : l'annonce s'ouvre comme avant.
  await tileA1.locator('h3').click();
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['/marketplace/a1']);

  // Pas de routeur Next.js dans le faux site : la navigation recharge la page.
  await seller.click();
  await expect(page).toHaveURL(/\/profile\/Production%20Prod-Prod$/);
});
