import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, openSite, sitePage } from './support/site';

const AUCTION = '8d52419e-5879-47d7-8324-34cf487c67e1';

/**
 * Page d'une enchère (captures du 01/10/2026) : carte en tête de la colonne de gauche ; l'annonce dans l'état de la
 * page (hooks React imités : mises, annonce). Aucune requête : comme quand le script démarre après celle de la page
 * (F5, injection tardive de Tampermonkey). `window.settle(statut)` imite une relecture qui change le statut : état
 * changé, ligne du statut redessinée.
 */
const html = (status: string) =>
  sitePage(
    '<div id="auction"></div>',
    `
  let auction = { id: '${AUCTION}', status: '${status}', card: { id: 'c-opale', wikipedia_title: 'Opale', rarity: 'SR' } };
  const root = document.getElementById('auction');
  root.innerHTML =
    '<div class="flex flex-col md:flex-row gap-6"><div class="flex-shrink-0 flex flex-col items-center gap-2">' +
    '<div class="w-72 h-[420px] glow-sr relative rounded-2xl overflow-hidden" style="width:18rem;height:420px;position:relative;background:#555">' +
    '<h3>Opale</h3></div></div><div class="flex-1 space-y-4"><h1>Opale</h1><span id="status"></span></div></div>';
  const render = () => { document.getElementById('status').textContent = auction.status; };
  render();
  const states = kit.hooks([[() => []], [() => auction]]);
  kit.fiber(root.querySelector('.glow-sr'), { card: auction.card }, kit.fiber(null, {}, null, { memoizedState: states[0] }));
  window.settle = (next) => { auction = { ...auction, status: next }; render(); };
  `,
  );

async function openAuction(page: Page, status: string) {
  await openSite(page, `/marketplace/${AUCTION}`, { html: html(status) });
  const face = page.locator('.glow-sr');
  await expect(face).toBeVisible();
  return face;
}

test('enchère vendue : carte tamponnée « Vendue » en vert ; un clic la montre sans le tampon', async ({ page }) => {
  const face = await openAuction(page, 'settled_sold');
  const stamp = face.locator('.wm-stamp');
  await expect(stamp).toHaveText('Vendue');
  await expect(face).toHaveAttribute('data-wm-tone', 'success');
  await expectDomIdle(page);

  await face.click();
  await expect(stamp).toHaveCSS('opacity', '0');
  await face.click();
  await expect(stamp).toHaveCSS('opacity', '1');
});

test('enchère terminée sans vente : « Pas vendue » en gris', async ({ page }) => {
  const face = await openAuction(page, 'settled_unsold');
  await expect(face.locator('.wm-stamp')).toHaveText('Pas vendue');
  await expect(face).toHaveAttribute('data-wm-tone', 'neutral');
  await expectDomIdle(page);
});

test('enchère en cours puis finalisée : le tampon apparaît à la relecture, sans recharger', async ({ page }) => {
  const face = await openAuction(page, 'active');
  await expectDomIdle(page);
  await expect(face.locator('.wm-stamp')).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { settle: (status: string) => void }).settle('settled_unsold'));
  await expect(face.locator('.wm-stamp')).toHaveText('Pas vendue');
});

test('enchère retirée par le vendeur : pas de tampon', async ({ page }) => {
  const face = await openAuction(page, 'cancelled');
  await expectDomIdle(page);
  await expect(face.locator('.wm-stamp')).toHaveCount(0);
});
