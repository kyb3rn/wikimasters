import { expect, test } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage } from './support/site';

/*
 * En-tête, onglets et Accueil de /guild dans une guilde (capture du 01/10/2026). Pas de Tailwind dans le faux site :
 * la rangée des onglets reçoit son `flex` en style.
 */
const TAB = 'flex-1 min-w-[4.5rem] py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
const MAIN =
  '<div class="flex-1 flex flex-col p-4 md:p-6 gap-4">' +
  '<div id="header" class="flex items-center justify-between"><div class="min-w-0"><h1>Ma guilde</h1><p>Description</p></div>' +
  '<div id="actions" class="flex items-center gap-2 flex-shrink-0"><span class="text-xs hidden sm:inline">2 membres</span>' +
  '<button id="site-invite" class="px-3 py-1.5 rounded-lg text-xs font-semibold">+ Inviter</button></div></div>' +
  '<div id="tabs" class="flex gap-1 bg-[var(--color-surface-light)] rounded-xl p-1 flex-shrink-0 overflow-x-auto" style="display: flex; overflow-x: auto">' +
  ['Accueil', 'Chat', 'Membres (2)', 'Classement']
    .map((name, i) => `<button type="button" class="${TAB}${i === 0 ? ' bg-[var(--color-accent)]' : ''}" style="flex: 1">${name}</button>`)
    .join('') +
  '</div>' +
  '<div class="card-frame overflow-hidden"><div class="relative p-4 md:p-5">' +
  '<div id="gradient" class="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-amber-500/3 pointer-events-none"></div>' +
  '<div class="relative">Semaine en cours</div></div></div></div>';

const SCRIPT = `document.getElementById('site-invite').onclick = () => { document.body.dataset.invited = String(Number(document.body.dataset.invited ?? 0) + 1); };`;

test('« Inviter » au bout de la rangée des onglets, nombre de membres retiré, trait arrêté avant lui', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(MAIN, SCRIPT) });
  const ours = page.locator('#tabs .wm-guild-invite');
  await expect(ours).toBeVisible();
  await expect(ours).toHaveClass(/wm-button-lg/);
  await expect(page.locator('#actions')).toBeHidden();
  // Toujours reconnue comme menu d'onglets malgré notre bouton : allure des onglets soulignés.
  await expect(page.locator('#tabs')).toHaveClass(/wm-site-tabs/);

  const [bar, button, last] = await Promise.all([rect(page.locator('#tabs')), rect(ours), rect(page.locator('#tabs > button').last())]);
  expect(Math.abs(bar.x + bar.width - (button.x + button.width))).toBeLessThan(2);
  expect(button.x).toBeGreaterThanOrEqual(last.x + last.width);
  expect(button.y).toBeGreaterThanOrEqual(bar.y);
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
  expect(button.height).toBeGreaterThan(46);

  await expect(page.locator('#tabs')).toHaveCSS('border-bottom-width', '0px');
  await expect(page.locator('#tabs')).toHaveCSS('padding-bottom', '1px');
  await expect(page.locator('#tabs > button').first()).toHaveCSS('box-shadow', /1px 0px 0px/);

  await ours.click();
  await expect(page.locator('body')).toHaveAttribute('data-invited', '1');
});

test('Accueil : pas de dégradé en fond du premier cadre', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(MAIN, SCRIPT) });
  await expect(page.locator('#tabs .wm-guild-invite')).toBeVisible();
  await expect(page.locator('#gradient')).toBeHidden();
});

// Liste de souhaits de l'Accueil (capture du 01/10/2026) : pseudo du membre en pastille sous la description.
const wish = (id: string, label: string) =>
  `<div class="flex flex-col items-center gap-1.5"><div class="relative rounded-xl">` +
  `<div data-face="${id}" class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-ur relative rounded-2xl overflow-hidden cursor-pointer" style="position:relative;width:160px;height:224px;overflow:hidden">` +
  '<div class="absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20" style="position:absolute;top:0;left:0;right:0;height:45%"></div>' +
  '<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20" style="position:absolute;top:45%;bottom:0">' +
  `<h3>Carte ${id}</h3><p>description</p>` +
  '<div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1">' +
  `<div class="min-w-0 max-w-full shrink-0"><span class="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[9px] font-bold bg-black/55 text-white" title="${label}">${label}</span></div>` +
  '<div class="flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1"><span>9 000</span><span>9 371</span></div>' +
  '</div></div></div></div></div>';
const WISHLIST =
  '<div class="card-frame p-4 md:p-5 space-y-4"><h3>Liste de souhaits</h3>' +
  `<div class="flex flex-wrap justify-center gap-3">${wish('a', 'gasgot')}${wish('b', "flashito19 · reçu aujourd'hui")}</div></div>`;

test('liste de souhaits : pastille du pseudo retirée, « @pseudo » sur l’image au survol, mène au profil', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(MAIN + WISHLIST, SCRIPT) });
  const face = page.locator('[data-face="a"]');
  const link = face.getByRole('link', { name: '@gasgot', exact: true });
  await expect(link).toHaveAttribute('href', '/profile/gasgot');
  await expect(link).toHaveClass(/wm-button/);
  await expect(face.locator('span.rounded-full')).toBeHidden();

  await page.mouse.move(0, 0);
  await expect(link).toHaveCSS('opacity', '0');
  await face.locator('h3').hover();
  await expect(link).toHaveCSS('opacity', '1');
  const [box, image] = await Promise.all([rect(link), rect(face.locator('.bg-black\\/20'))]);
  expect(box.x - image.x).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThanOrEqual(image.y + image.height);

  // L'état de la demande suit le pseudo.
  await expect(page.locator('[data-face="b"]').getByRole('link', { name: "@flashito19 · reçu aujourd'hui" })).toHaveAttribute(
    'href',
    '/profile/flashito19',
  );

  await link.click();
  await expect(page).toHaveURL(/\/profile\/gasgot$/);
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(MAIN + WISHLIST, SCRIPT) });
  await expect(page.locator('#tabs .wm-guild-invite')).toBeVisible();
  await expectDomIdle(page);
});
