import { expect, test, type Page } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

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

/** Face `sm` (capture du 29/09/2026) : image en haut, nom, pastille « Possédée » si la carte est dans ma collection. */
const tileFace = (owned: boolean) =>
  '<div class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-r relative rounded-2xl overflow-hidden">' +
  '<div class="absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20"><div class="relative h-full w-full min-h-0"></div></div>' +
  (owned
    ? '<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20"><h3>Vitamine B8</h3>' +
      '<div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1"><div class="min-w-0 max-w-full shrink-0">' +
      '<span class="w-fit rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold text-white" title="Dans ta collection">Possédée</span>' +
      '</div></div></div>'
    : '<h3>Vitamine B8</h3>') +
  '</div>';

/** Vignette d'annonce (capture du 29/09/2026), avec le bandeau « Vous menez » de l'onglet Mes enchères. */
const tile = (id: string, seller: string, { badge = '', duration = '9m 38s', owned = false } = {}) =>
  `<div id="marketplace-auction-${id}"><a class="card-frame block p-3 w-[172px] md:w-[184px]" href="/marketplace/${id}">` +
  `<div class="flex flex-col items-center gap-2.5">` +
  (badge ? `<span class="w-full text-center rounded-lg">${badge}</span>` : '') +
  `<div class="overflow-hidden rounded-2xl">${tileFace(owned)}</div>` +
  `<div class="w-full flex items-center justify-between gap-2 text-xs">` +
  `<div class="flex flex-col min-w-0"><span class="text-[10px] uppercase">Mise actuelle</span><span class="font-semibold">30</span></div>` +
  `<div class="flex flex-col items-end"><span class="text-[10px] uppercase">Durée</span>` +
  `<span class="tabular-nums font-medium text-xs">${duration}</span></div></div>` +
  `<p class="w-full text-[10px] text-[var(--color-foreground)]/40 truncate">Vendu par ${seller}</p></div></a></div>`;

/**
 * Annonce lue dans les props du composant de la vignette, comme chez le site : fin dans `ms`. Ce composant est
 * l'enfant de la case `div#marketplace-auction-<id>`, pas un ancêtre.
 */
const ENDS_IN = `const endsIn = (id, ms) => {
    const auction = { id, end_at: new Date(Date.now() + ms).toISOString() };
    document.getElementById('marketplace-auction-' + id)['__reactFiber$test'] = {
      memoizedProps: { id: 'marketplace-auction-' + id }, return: null,
      child: { memoizedProps: { auction, href: '/marketplace/' + id, owned: false }, return: null },
    };
  };`;

// Le lien de l'annonce navigue sans recharger, comme un Link de Next.js : les ouvertures sont comptées.
const HTML = sitePage(
  `${TAILWIND}<div class="flex flex-wrap justify-center gap-4 md:gap-5">` +
    tile('a1', 'Production Prod-Prod') +
    tile('a2', 'eli!', { badge: 'Vous menez', owned: true }) +
    tile('a3', 'Conch', { duration: 'Terminée' }) +
    tile('a4', 'Conch') +
    tile('a5', 'Conch') +
    tile('a6', 'Conch', { duration: 'Terminée' }) +
    tile('a7', 'Conch') +
    `</div>`,
  `window.opened = [];
  ${ENDS_IN}
  // Fin dans 2:07:28, une terminée, une dans 4 s ; a6 : compte à rebours du site à zéro (horloge du PC en avance), fin
  // encore dans 1 h.
  endsIn('a4', (2 * 3600 + 7 * 60 + 28) * 1000 + 700);
  endsIn('a5', -1000);
  endsIn('a6', 3600 * 1000);
  endsIn('a7', 4000);
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

  const [faceBox, frameBox, caseBox] = await Promise.all([rect(face), rect(frame), rect(case_)]);
  // La carte est en haut de la case, le cadre commence sous elle (32 px cachés) et a sa largeur.
  expect(Math.abs(faceBox.y - caseBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.y - (faceBox.y + faceBox.height - 32))).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.width - faceBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox.x - faceBox.x)).toBeLessThanOrEqual(1);
  const price = await rect(page.locator('#marketplace-auction-a1 .justify-between'));
  expect(price.y).toBeGreaterThan(faceBox.y + faceBox.height);
  // Le vendeur n'est plus dans l'appendice : il se termine sous la mise et la durée.
  expect(frameBox.y + frameBox.height - (price.y + price.height)).toBeLessThanOrEqual(10);

  // Onglet Mes enchères : le bandeau passe sous la carte, dans l'appendice.
  const badge = await rect(page.getByText('Vous menez'));
  const face2 = await rect(page.locator('#marketplace-auction-a2 .glow-r'));
  expect(badge.y).toBeGreaterThan(face2.y + face2.height);
});

test('annonces : « Terminée » en italique, plus petit que les durées en cours', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  const ended = page.locator('#marketplace-auction-a3').getByText('Terminée');
  const running = page.locator('#marketplace-auction-a1').getByText('9m 38s');
  await expect(ended).toHaveCSS('font-style', 'italic');
  await expect(ended).toHaveCSS('font-size', '11px');
  await expect(running).toHaveCSS('font-style', 'normal');
  await expect(running).toHaveCSS('font-size', '12px');
  await expect(running).toHaveCSS('font-weight', '400');

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
  // Pastille « Possédée » (même emplacement que celle d'un auteur de demande de guilde) : gardée, pas prise pour un pseudo.
  const tileA2 = page.locator('#marketplace-auction-a2');
  await expect(tileA2.locator('.wm-profile-link')).toHaveText(['@eli!']);
  await expect(tileA2.getByText('Possédée')).toBeVisible();

  // Hors survol, invisible ; au survol de la vignette, en bas à gauche de l'image.
  await page.mouse.move(0, 0);
  await expect(seller).toHaveCSS('opacity', '0');
  await tileA1.locator('.justify-between').hover();
  await expect(seller).toHaveCSS('opacity', '1');
  const [link, image] = await Promise.all([rect(seller), rect(tileA1.locator('.bg-black\\/20'))]);
  expect(Math.abs(link.x - image.x - 6)).toBeLessThanOrEqual(1);
  expect(link.height).toBeLessThanOrEqual(20);
  expect(Math.abs(image.y + image.height - (link.y + link.height) - 6)).toBeLessThanOrEqual(1);

  // Clic sur la carte : l'annonce s'ouvre comme avant.
  await tileA1.locator('h3').click();
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['/marketplace/a1']);

  // Pas de routeur Next.js dans le faux site : la navigation recharge la page.
  await seller.click();
  await expect(page).toHaveURL(/\/profile\/Production%20Prod-Prod$/);
});

test('annonces : temps restant court (« 2h »), précis au survol de la vignette (« 2:07:28 »), « Terminée » à zéro', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  const tile = page.locator('#marketplace-auction-a4');
  const short = tile.locator('.wm-auction-time-short');
  const precise = tile.locator('.wm-auction-time-precise');
  await expect(short).toHaveText('2h');
  await expect(precise).toBeHidden();
  // Le compte à rebours du site (horloge du PC) est caché.
  await expect(tile.getByText('9m 38s')).toBeHidden();
  await expect(tile.locator('.wm-auction-time')).toHaveCSS('font-size', '12px');

  await tile.locator('h3').hover();
  await expect(short).toBeHidden();
  await expect(precise).toHaveText(/^2:07:2\d$/);

  const ended = page.locator('#marketplace-auction-a5 .wm-auction-time');
  await expect(ended).toHaveText('Terminée');
  await expect(ended).toHaveCSS('font-style', 'italic');
  await expect(ended).toHaveCSS('font-size', '11px');
});

/** Face de la vignette. */
const face = (page: Page, id: string) => page.locator(`#marketplace-auction-${id} .glow-r`);
/** Ce que le tampon teinte : les enfants de la face (l'image en premier, avec ce qui est posé dessus). */
const content = (page: Page, id: string) => face(page, id).locator(':scope > :not(.wm-stamp)').first();

async function expectGreyed(page: Page, id: string): Promise<void> {
  await expect(face(page, id)).toHaveAttribute('data-wm-stamp', 'marketplace-tiles');
  // Assombrie, jamais transparente : le fond derrière (l'appendice, en bas) ne change pas son gris.
  await expect(content(page, id)).toHaveCSS('filter', 'grayscale(1) brightness(0.55)');
  await expect(content(page, id)).toHaveCSS('opacity', '1');
}

const expectNotGreyed = (page: Page, id: string) => expect(face(page, id)).not.toHaveAttribute('data-wm-stamp');

test('annonces : enchère finie grisée par le tampon commun (sans texte, en fondu), moins sombre au survol', async ({ page }) => {
  await openSite(page, '/marketplace', { html: HTML });
  // Notre « Terminée » (a5), celui du site resté affiché (a3) : grisées. En cours (a4), ou finie seulement à
  // l'horloge du PC, dans le compte à rebours caché du site (a6) : non.
  await expectGreyed(page, 'a5');
  await expectGreyed(page, 'a3');
  await expectNotGreyed(page, 'a4');
  await expectNotGreyed(page, 'a6');
  await expectNotGreyed(page, 'a1');
  await expect(face(page, 'a5').locator('.wm-stamp')).toHaveCount(0);
  // Le fondu commun à tous les tampons.
  await expect(content(page, 'a5')).toHaveCSS('transition-property', 'filter');
  await expect(content(page, 'a5')).toHaveCSS('transition-duration', '0.3s');

  await face(page, 'a5').locator('h3').hover();
  await expect(content(page, 'a5')).toHaveCSS('filter', 'grayscale(1) brightness(0.8)');
  await page.mouse.move(0, 0);
  await expect(content(page, 'a5')).toHaveCSS('filter', 'grayscale(1) brightness(0.55)');

  // Notre temps arrive à zéro : grisée en même temps que « Terminée ».
  await expectNotGreyed(page, 'a7');
  await expect(page.locator('#marketplace-auction-a7 .wm-auction-time')).toHaveText('Terminée', { timeout: 10_000 });
  await expectGreyed(page, 'a7');

  // Le compte à rebours du site resté affiché arrive à zéro.
  await page.evaluate(() => {
    const span = [...document.querySelectorAll('#marketplace-auction-a1 span')].find((el) => el.textContent === '9m 38s');
    span!.firstChild!.nodeValue = 'Terminée';
  });
  await expectGreyed(page, 'a1');
});

const TABS = ['Parcourir', 'Mes ventes (1/5)', 'Mes enchères (0)', 'Gagnées (0)', 'Historique (1)'];

/** Onglets du marché (capture du 29/09/2026), `chosen` choisi, un clic en choisit un autre ; une enchère terminée. */
const withTabs = (chosen: string) =>
  sitePage(
    `${TAILWIND}<div class="flex overflow-x-auto border-b" id="bar">` +
      TABS.map((text) => `<button class="px-4 py-3 text-sm${text === chosen ? ' border-b-2' : ''}">${text}</button>`).join('') +
      `</div><div class="flex flex-wrap">${tile('a5', 'Conch')}</div>`,
    `${ENDS_IN}
    endsIn('a5', -1000);
    const tabs = [...document.querySelectorAll('#bar > button')];
    for (const tab of tabs) tab.onclick = () => { for (const other of tabs) other.classList.toggle('border-b-2', other === tab); };`,
  );

test('annonces : rien de grisé dans Gagnées et Historique, qui ne listent que des enchères finies', async ({ page }) => {
  await openSite(page, '/marketplace', { html: withTabs('Historique (1)') });
  await expect(page.locator('#marketplace-auction-a5 .wm-auction-time')).toHaveText('Terminée');
  await expectNotGreyed(page, 'a5');
  await page.getByRole('button', { name: 'Mes ventes (1/5)' }).click();
  await expectGreyed(page, 'a5');
  // Retirée en fondu, comme posée.
  await page.getByRole('button', { name: 'Gagnées (0)' }).click();
  await expectNotGreyed(page, 'a5');
  await expect(content(page, 'a5')).toHaveCSS('filter', 'none');
});
