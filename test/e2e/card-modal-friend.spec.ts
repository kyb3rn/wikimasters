import { expect, test, type Page } from '@playwright/test';
import { openFriendCollection } from './support/profile-collection';
import { expectDomIdle } from './support/site';

const COPY = { id: 'u-7', card_id: 'c7', card: { id: 'c7', wikipedia_title: 'Bastogne', rarity: 'SR' }, tags: [{ id: 't1', name: 'rouge' }], owned_by_viewer: false };

/** Collection d'un ami, un exemplaire ; clic sur sa face : la modale de carte du site, cas « exemplaire d'un ami ». */
async function openFriendCopy(page: Page, { pending = false } = {}) {
  await openFriendCollection(page, { collection: () => [COPY], pending: pending ? [COPY.id] : [] });
  await page.locator('#grid [class*="glow-"]').click();
  return page.locator('#card-modal');
}

/** Notre rangée d'actions, sous les deux colonnes. */
const actions = (page: Page) => page.locator('#card-modal .wm-root', { has: page.locator('.wm-market-button') }).locator('button');

test('même présentation que les autres modales : onglets et signalement déplacés, ATK / DEF masquées', async ({ page }) => {
  const modal = await openFriendCopy(page);
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText('Bastogne');
  await expect(modal.getByRole('tablist')).toBeHidden();
  await expect(modal.locator('.border-t.pt-3')).toBeHidden();
  await expect(modal.locator('.wm-report')).toBeVisible();
  await expect(modal.locator('.grid.grid-cols-2')).toBeHidden();
  // Ses étiquettes, en lecture seule comme chez le site.
  await expect(modal.getByText('rouge', { exact: true })).toBeVisible();
});

test('rangée Échanger · Marché ; « Échanger » ouvre la fenêtre d’échange du site', async ({ page }) => {
  const modal = await openFriendCopy(page);
  await expect(actions(page)).toHaveText(['Échanger', 'Marché']);
  // Au bout du cadre, après les deux colonnes, comme la rangée d'actions du site.
  await expect(modal.locator(':scope > .card-frame > :last-child')).toHaveClass(/wm-root/);
  // Celui du site est caché, avec son bloc.
  await expect(modal.getByRole('button', { name: 'Proposer un échange' })).toBeHidden();
  const trade = actions(page).first();
  await expect(trade).toHaveClass(/wm-button-window/);
  await expect(trade).toHaveClass(/wm-tone-accent/);
  await expect(trade).toHaveAttribute('title', 'Proposer un échange');

  await trade.click();
  await expect(page.locator('#trade-composer')).toBeVisible();
  // La fenêtre d'échange ouverte dans son fond ne change rien à la modale.
  await expect(actions(page)).toHaveText(['Échanger', 'Marché']);
});

test('offre déjà en cours : « Échange en attente », désactivé', async ({ page }) => {
  await openFriendCopy(page, { pending: true });
  await expect(actions(page)).toHaveText(['Échange en attente', 'Marché']);
  await expect(actions(page).first()).toBeDisabled();
  await expect(page.locator('#card-modal [role="status"]')).toBeHidden();
});

test('« Marché » ouvre l’historique des ventes de la carte', async ({ page }) => {
  const requests: string[] = [];
  await openFriendCopy(page);
  await page.route('**/api/marketplace/cards/*/sales', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.fulfill({ json: { wikipedia_title: 'Bastogne', sales: [], recent: [] } });
  });
  await page.locator('#card-modal .wm-market-button').click();
  await expect(page.getByRole('dialog', { name: 'Bastogne' })).toBeVisible();
  expect(requests).toEqual(['/api/marketplace/cards/c7/sales']);
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openFriendCopy(page);
  await expect(actions(page)).toHaveText(['Échanger', 'Marché']);
  await expectDomIdle(page);
});
