import { expect, test } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage } from './support/site';

/*
 * En-tête et onglets de /trades (code du 30/09/2026). Pas de Tailwind dans le faux site : la rangée des onglets
 * reçoit son `flex` en style.
 */
const MAIN =
  '<div class="flex-1 p-4 md:p-6 space-y-6">' +
  '<div class="flex items-center justify-between"><div><h1>Échanges</h1><p>Gérez vos offres d’échange avec vos amis</p></div>' +
  '<button id="site-new" class="flex items-center gap-2 px-4 py-2 rounded-xl"><span>+</span> <span class="hidden sm:inline">Proposer un échange</span><span class="sm:hidden">Échanger</span></button></div>' +
  '<div id="tabs" class="flex border-b" style="display: flex">' +
  ['Reçues', 'Envoyées', 'Historique'].map((name) => `<button class="flex-1 py-3 text-sm" style="flex: 1">${name}</button>`).join('') +
  '</div><div class="space-y-3"></div></div>';

const SCRIPT = `document.getElementById('site-new').onclick = () => { document.body.dataset.opened = String(Number(document.body.dataset.opened ?? 0) + 1); };`;

test('« Proposer un échange » au bout de la rangée des onglets, qui gardent le reste de la largeur, trait arrêté avant lui', async ({ page }) => {
  await openSite(page, '/trades', { html: sitePage(MAIN, SCRIPT) });
  const ours = page.locator('#tabs .wm-trades-new');
  await expect(ours).toBeVisible();
  await expect(page.locator('#site-new')).toBeHidden();

  // Notre bouton est le dernier de la rangée, à droite des onglets, sur la même ligne.
  const [bar, button, last] = await Promise.all([rect(page.locator('#tabs')), rect(ours), rect(page.locator('#tabs > button').last())]);
  expect(Math.abs(bar.x + bar.width - (button.x + button.width))).toBeLessThan(2);
  expect(button.x).toBeGreaterThanOrEqual(last.x + last.width);
  expect(button.y).toBeGreaterThanOrEqual(bar.y);
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y + bar.height + 1);

  // Taille moyenne ; le trait du menu est dessiné sous les onglets, pas sous toute la rangée.
  expect(button.height).toBeGreaterThan(40);
  await expect(page.locator('#tabs')).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#tabs > button').first()).toHaveCSS('box-shadow', /1px 0px 0px/);

  await ours.click();
  await expect(page.locator('body')).toHaveAttribute('data-opened', '1');
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openSite(page, '/trades', { html: sitePage(MAIN, SCRIPT) });
  await expect(page.locator('#tabs .wm-trades-new')).toBeVisible();
  await expectDomIdle(page);
});

test('rangée des onglets disparue : notre bouton retiré, celui du site rendu', async ({ page }) => {
  await openSite(page, '/trades', { html: sitePage(MAIN, SCRIPT) });
  await expect(page.locator('#tabs .wm-trades-new')).toBeVisible();
  await page.evaluate(() => document.getElementById('tabs')?.remove());
  await expect(page.locator('.wm-trades-new')).toHaveCount(0);
  await expect(page.locator('#site-new')).toBeVisible();
});
