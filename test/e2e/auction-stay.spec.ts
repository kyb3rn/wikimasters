import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openCard } from './support/pulls';
import { presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const AUCTION_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

/** Réponse de la création : `abort`, le site ne répond pas du tout. */
type Creation = { status: number; json: unknown } | 'abort';

async function listCurrentCard(page: Page, response: Creation = { status: 201, json: { auction_id: AUCTION_ID } }) {
  await openCard(page, {
    handle: async (route, url) => {
      const method = route.request().method();
      if (url.pathname === '/api/marketplace' && method === 'POST') {
        await (response === 'abort' ? route.abort('failed') : route.fulfill(response));
        return true;
      }
      if (url.pathname === `/api/marketplace/${AUCTION_ID}` && method === 'DELETE') {
        await route.fulfill({ json: { status: 'cancelled' } });
        return true;
      }
      return false;
    },
  });
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
  await page.getByRole('dialog', { name: 'Mise en vente' }).getByRole('button', { name: 'Confirmer' }).click();
}

test('après la mise en vente : pas de redirection, retour à la carte, bouton grisé, notification', async ({ page }) => {
  await listCurrentCard(page);

  const notification = page.getByRole('status').filter({ hasText: 'Enchère publiée' });
  await expect(notification).toContainText('« Tour Eiffel » est aux enchères.');
  expect(new URL(page.url()).pathname).toBe('/pulls');
  await expect(page.locator('#auction-modal')).toHaveCount(0);
  const sell = page.locator('#card-modal').getByRole('button', { name: 'Vendre' });
  await expect(sell).toBeDisabled();
  await expect(sell).toHaveAttribute('title', 'Carte déjà en vente');
  await expect(sell).toHaveCSS('cursor', 'not-allowed');

  // Le lien de la notification mène à l'enchère (navigation du site).
  const link = notification.getByRole('link', { name: "Voir l'enchère" });
  await expect(link).toHaveAttribute('href', `/marketplace/${AUCTION_ID}`);
  await link.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/marketplace/${AUCTION_ID}`);
  await expect(page.locator('#stage')).toHaveText(`Fiche /marketplace/${AUCTION_ID}`);
});

test('Ctrl+clic sur « Voir l’enchère » : autre onglet, la page reste, notification lue et toast fermé', async ({ page }) => {
  await listCurrentCard(page);
  const notification = page.getByRole('status').filter({ hasText: 'Enchère publiée' });
  await expect(notification).toBeVisible();
  // Un onglet ouvert par Ctrl+clic échappe aux routes du test (il irait au vrai site) : le clic est annulé après
  // notre code, qui ne doit pas l'avoir annulé lui-même.
  await page.evaluate(() => {
    window.addEventListener('click', (event) => {
      (window as unknown as { __prevented: boolean }).__prevented = event.defaultPrevented;
      event.preventDefault();
    });
  });
  await notification.getByRole('link', { name: "Voir l'enchère" }).click({ modifiers: ['ControlOrMeta'] });
  expect(await page.evaluate(() => (window as unknown as { __prevented: boolean }).__prevented)).toBe(false);
  await expect(notification).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wm-notifications-v1') ?? '[]') as { read: boolean }[]);
  expect(stored.map((n) => n.read)).toEqual([true]);
  expect(new URL(page.url()).pathname).toBe('/pulls');
});

test('carte aux enchères : Vendre, Défausser, étiquettes et défaussage rapide verrouillés', async ({ page }) => {
  await listCurrentCard(page);
  const modal = page.locator('#card-modal');
  const controls = [
    modal.getByRole('button', { name: 'Vendre' }),
    modal.getByRole('button', { name: /Défausser/ }),
    modal.getByPlaceholder('Ajouter une étiquette…'),
  ];
  for (const control of controls) {
    await expect(control).toBeDisabled();
    await expect(control).toHaveAttribute('title', 'Carte déjà en vente');
    await expect(control).toHaveCSS('cursor', 'not-allowed');
  }
  const trash = page.locator('.wm-discard-next');
  await expect(trash).toHaveAttribute('data-status', 'listed');
  await expect(trash).toHaveAttribute('title', 'Carte déjà en vente');
  await expect(trash).toBeDisabled();

  // Enchère retirée (depuis sa fiche) : l'exemplaire revient, tout se déverrouille.
  await page.evaluate((id) => fetch(`/api/marketplace/${id}`, { method: 'DELETE' }), AUCTION_ID);
  for (const control of controls) await expect(control).toBeEnabled();
  await expect(trash).toHaveAttribute('data-status', 'ready');
});

test('carte aux enchères : tampon « En vente » vert dans la modale (clic pour la revoir) et le carrousel', async ({ page }) => {
  await listCurrentCard(page);
  const modal = page.locator('#card-modal');
  const face = modal.locator('[class*="glow-"]');
  const stamp = face.locator('.wm-stamp');
  await expect(stamp).toHaveText('En vente');
  await expect(stamp.locator('span')).toHaveCSS('color', 'rgb(63, 185, 80)');
  const content = face.locator(':scope > :not(.wm-stamp)').first();
  await expect(content).toHaveCSS('filter', /sepia/);
  await face.click({ position: { x: 30, y: 200 } });
  await expect(stamp).toHaveCSS('opacity', '0');
  await expect(content).toHaveCSS('filter', 'none');

  await modal.getByRole('button', { name: 'Fermer' }).click();
  const carouselStamp = page.locator('main [class*="glow-"] .wm-stamp');
  await expect(carouselStamp).toHaveText('En vente');
  await expect(carouselStamp).toHaveCSS('opacity', '1');
  await page.locator('main button.w-12').last().click();
  await expect(page.locator('main .wm-stamp')).toHaveCount(0);
  await page.locator('main button.w-12').first().click();
  await expect(carouselStamp).toHaveText('En vente');

  await page.evaluate((id) => fetch(`/api/marketplace/${id}`, { method: 'DELETE' }), AUCTION_ID);
  await expect(page.locator('.wm-stamp')).toHaveCount(0);
});

test('désactivée : comportement du site, redirection vers l’enchère et aucune notification', async ({ page }) => {
  await presetSettings(page, { features: { 'auction-stay': false }, values: {} });
  await listCurrentCard(page);

  await expect.poll(() => new URL(page.url()).pathname).toBe(`/marketplace/${AUCTION_ID}`);
  await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toHaveCount(0);
});

test('une mise en vente refusée ne retient aucune redirection', async ({ page }) => {
  await listCurrentCard(page, { status: 400, json: { error: 'Mise de départ invalide' } });

  await expect(page.getByRole('dialog', { name: 'Mise en vente' }).getByRole('alert')).toHaveText('Mise de départ invalide');
  await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toHaveCount(0);
  await expect(page.locator('#card-modal').getByRole('button', { name: 'Vendre' })).toBeEnabled();
});

test('une mise en vente restée sans réponse ne retient pas la navigation suivante vers une enchère', async ({ page }) => {
  const failed = page.waitForEvent('requestfailed', (request) => new URL(request.url()).pathname === '/api/marketplace');
  await listCurrentCard(page, 'abort');
  await failed;
  // Navigation du site vers une enchère (son routeur, lu dans l'état React au-dessus de <main>).
  await page.evaluate((id) => {
    type Fiber = { return: { memoizedProps: { value: { push(href: string): void } } } };
    const main = document.querySelector('main') as unknown as Record<string, Fiber>;
    main['__reactFiber$test']?.return.memoizedProps.value.push(`/marketplace/${id}`);
  }, AUCTION_ID);
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/marketplace/${AUCTION_ID}`);
  await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toHaveCount(0);
});
