import { expect, test, type Locator, type Page } from '@playwright/test';
import { catalogHtml } from './support/global-collection';
import { SUPABASE, openSite } from './support/site';

const DAY = 86_400_000;

/** Notre rangée d'actions, sous les deux colonnes. */
const actions = (modal: Locator) => modal.locator('.wm-root', { has: modal.page().locator('.wm-market-button') }).locator('button');

const SALES = {
  wikipedia_title: '5G',
  sales: [
    { id: 's1', final_price: 5000, settled_at: new Date(Date.now() - DAY).toISOString(), rarity: 'L' },
    { id: 's2', final_price: 5200, settled_at: new Date(Date.now() - DAY / 2).toISOString(), rarity: 'L' },
  ],
  recent: [],
};

async function openCatalogModal(page: Page, requests: string[] = [], friend: { friend?: boolean; pending?: boolean } = {}) {
  await openSite(page, '/global-collection', {
    html: catalogHtml(friend),
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
  await expect(modal.locator('.border-t.pt-3')).toBeHidden();
  await expect(modal.locator('.grid.grid-cols-2')).toBeHidden();
  await expect(modal.locator('.wm-report')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Liste de souhaits' })).toBeVisible();
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

test('vue catalogue : « Liste de souhaits » à gauche, Marché à droite ; roue pendant sa requête', async ({ page }) => {
  const calls: string[] = [];
  let release = () => {};
  await page.route(`${SUPABASE}/**`, async (route) => {
    calls.push(route.request().method());
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({ status: 201, body: '' });
  });
  const modal = await openCatalogModal(page);
  const row = actions(modal);
  await expect(row).toHaveText(['Liste de souhaits', 'Marché']);
  // Celui du site est caché, avec son bloc ; son texte complet et son texte d'aide passent en info-bulle.
  await expect(modal.locator('.space-y-2').filter({ hasText: 'liste de souhaits' }).first()).toBeHidden();
  const wish = row.first();
  await expect(wish).toHaveAttribute('title', 'Ajouter à la liste de souhaits\nRecevez une alerte si cette carte est mise en vente.');
  // Vert en contour, plein une fois la carte dans la liste.
  await expect(wish).toHaveClass(/wm-tone-accent/);
  await expect(wish).not.toHaveClass(/wm-solid/);
  await expect(wish).toHaveAttribute('aria-pressed', 'false');
  await expect(wish).toHaveClass(/wm-button-window/);

  await wish.click();
  await expect(wish).toHaveAttribute('aria-pressed', 'true');
  await expect(wish).toBeDisabled();
  await expect(wish).toHaveClass(/wm-solid/);
  expect(calls).toEqual(['POST']);
  release();
  await expect(wish).toBeEnabled();
  await expect(wish).toHaveAttribute('title', 'Retirer de la liste de souhaits');
});

test('vue catalogue, un ami a la carte : Échanger · Liste de souhaits · Marché', async ({ page }) => {
  const modal = await openCatalogModal(page, [], { friend: true });
  await expect(actions(modal)).toHaveText(['Échanger', 'Liste de souhaits', 'Marché']);
  // Le bloc du site (échange, liste de souhaits) est caché en entier.
  await expect(modal.locator('.space-y-2', { has: page.getByRole('button', { name: 'Proposer un échange' }) })).toBeHidden();
  await actions(modal).first().click();
  await expect(page.locator('#trade-composer')).toBeVisible();
});

test('vue catalogue, offre déjà en cours avec l’ami : « Échange en attente », désactivé', async ({ page }) => {
  const modal = await openCatalogModal(page, [], { friend: true, pending: true });
  await expect(actions(modal)).toHaveText(['Échange en attente', 'Liste de souhaits', 'Marché']);
  await expect(actions(modal).first()).toBeDisabled();
  await expect(actions(modal).nth(1)).toBeEnabled();
});
