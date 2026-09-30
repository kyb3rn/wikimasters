import { expect, test, type Page } from '@playwright/test';
import { CATALOG_HTML } from './support/global-collection';
import { SUPABASE, openSite } from './support/site';

const DAY = 86_400_000;

const SALES = {
  wikipedia_title: '5G',
  sales: [
    { id: 's1', final_price: 5000, settled_at: new Date(Date.now() - DAY).toISOString(), rarity: 'L' },
    { id: 's2', final_price: 5200, settled_at: new Date(Date.now() - DAY / 2).toISOString(), rarity: 'L' },
  ],
  recent: [],
};

async function openCatalogModal(page: Page, requests: string[] = []) {
  await openSite(page, '/global-collection', {
    html: CATALOG_HTML,
    handle: async (route, url) => {
      if (!url.pathname.endsWith('/sales')) return false;
      requests.push(url.pathname);
      await route.fulfill({ json: SALES });
      return true;
    },
  });
  await page.click('#grid-card');
  return page.locator('#card-modal');
}

test('vue catalogue : même présentation (onglets et signalement déplacés, ATK / DEF masquées)', async ({ page }) => {
  const modal = await openCatalogModal(page);
  await expect(modal.getByRole('tablist')).toBeHidden();
  await expect(modal.locator('.border-t')).toBeHidden();
  await expect(modal.locator('.grid.grid-cols-2')).toBeHidden();
  await expect(modal.locator('.wm-report')).toBeVisible();
  await expect(modal.getByRole('button', { name: /liste de souhaits/ })).toBeVisible();
});

test('vue catalogue : rangée « Marché » sous les colonnes, qui ouvre l’historique des ventes', async ({ page }) => {
  const requests: string[] = [];
  const modal = await openCatalogModal(page, requests);
  const market = modal.locator('.wm-market-button');
  await expect(market).toHaveCount(1);
  await expect(market).toHaveText('Marché');
  await expect(market).toHaveClass(/wm-button-window/);
  // Au bout du cadre, après les deux colonnes, comme la rangée d'actions du site.
  await expect(modal.locator(':scope > .card-frame > :last-child')).toHaveClass(/wm-root/);

  await market.click();
  const dialog = page.getByRole('dialog', { name: '5G' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.wm-modal-subtitle b')).toHaveText('2');
  expect(requests).toEqual(['/api/marketplace/cards/c-5g/sales']);
});

test('vue catalogue : liste de souhaits en bas à gauche, Marché à droite ; roue pendant sa requête', async ({ page }) => {
  const calls: string[] = [];
  let release = () => {};
  await page.route(`${SUPABASE}/**`, async (route) => {
    calls.push(route.request().method());
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({ status: 201, body: '' });
  });
  const modal = await openCatalogModal(page);
  const row = modal.locator('.wm-root', { has: page.locator('.wm-market-button') }).locator('button');
  await expect(row).toHaveText(['Ajouter à la liste de souhaits', 'Marché']);
  // Celui du site est caché, avec son bloc ; son texte d'aide passe en info-bulle.
  await expect(modal.locator('.space-y-2').filter({ hasText: 'liste de souhaits' }).first()).toBeHidden();
  const wish = row.first();
  await expect(wish).toHaveAttribute('title', 'Recevez une alerte si cette carte est mise en vente.');
  // Vert en contour, plein une fois la carte dans la liste.
  await expect(wish).toHaveClass(/wm-tone-accent/);
  await expect(wish).not.toHaveClass(/wm-solid/);
  await expect(wish).toHaveClass(/wm-button-window/);

  await wish.click();
  await expect(wish).toHaveText('Retirer de la liste de souhaits');
  await expect(wish).toBeDisabled();
  await expect(wish).toHaveClass(/wm-solid/);
  expect(calls).toEqual(['POST']);
  release();
  await expect(wish).toBeEnabled();
  await expect(wish).not.toHaveAttribute('title', /./);
});
