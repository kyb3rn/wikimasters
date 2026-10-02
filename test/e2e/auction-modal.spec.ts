import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openCard, openPulls, packFaces } from './support/pulls';
import { openSettings, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

interface Sale {
  /** Corps des `POST /api/marketplace` reçus. */
  readonly posted: unknown[];
  /** Tant qu'elle n'est pas appelée, la réponse à la mise en vente attend. */
  release: () => void;
}

async function openSale(
  page: Page,
  options: { mine?: unknown; response?: { status: number; json: unknown }; hold?: boolean } = {},
): Promise<Sale> {
  const sale: Sale = { posted: [], release: () => undefined };
  const held = new Promise<void>((resolve) => {
    sale.release = resolve;
  });
  await openCard(page, {
    api: { '/api/marketplace/mine': options.mine ?? { sellingCount: 2, maxConcurrentAuctions: 10 } },
    handle: async (route, url) => {
      if (url.pathname !== '/api/marketplace' || route.request().method() !== 'POST') return false;
      sale.posted.push(route.request().postDataJSON());
      if (options.hold) await held;
      await route.fulfill(options.response ?? { status: 201, json: { auction_id: 'a1b2c3d4-0000-4000-8000-000000000001' } });
      return true;
    },
  });
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
  return sale;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mise en vente' });

test('la modale du site est remplacée : carte en grand, enchères actives, mise, durées', async ({ page }) => {
  await openSale(page);
  const sale = dialog(page);
  await expect(sale).toBeVisible();
  await expect(page.locator('#auction-modal')).toBeHidden();

  // La carte de la modale de carte (grand format), sans son bouton favori.
  const card = sale.locator('.wm-sale-card [class*="glow-"]');
  await expect(card.locator('h3')).toHaveText('Tour Eiffel');
  await expect(card).toHaveCSS('width', '200px');
  await expect(card.locator('button')).toHaveCount(0);

  await expect(sale).toContainText('Enchères actives : 2 / 10 · 8 restantes');
  await expect(sale.getByLabel('Mise de départ')).toHaveValue('10');
  await expect(sale.getByRole('radio')).toHaveText(['10 min', '30 min', '1 h', '3 h', '6 h', '12 h']);
  await expect(sale.getByRole('radio', { name: '10 min' })).toHaveAttribute('aria-checked', 'true');
  await expect(sale.getByRole('radio', { name: '1 h' })).toHaveAttribute('aria-checked', 'false');
  await expect(sale.getByRole('alert')).toHaveCount(0);
});

test('Confirmer met en vente avec la mise et la durée choisies', async ({ page }) => {
  const posted = (await openSale(page)).posted;
  const sale = dialog(page);
  await sale.getByLabel('Mise de départ').fill('25');
  await sale.getByRole('button', { name: 'Augmenter' }).click();
  await sale.getByRole('radio', { name: '3 h' }).click();
  await expect(sale.getByRole('radio', { name: '3 h' })).toHaveAttribute('aria-checked', 'true');
  await expect(sale.getByRole('radio', { name: '10 min' })).toHaveAttribute('aria-checked', 'false');
  await sale.getByRole('button', { name: 'Confirmer' }).click();

  await expect(sale).toHaveCount(0);
  await expect(page.locator('#auction-modal')).toHaveCount(0);
  expect(posted).toEqual([{ card_id: 'u1', base_amount: 26, duration_minutes: 180 }]);
  await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toBeVisible();
});

test('Entrée dans la mise confirme aussi', async ({ page }) => {
  const posted = (await openSale(page)).posted;
  await dialog(page).getByLabel('Mise de départ').fill('40');
  await dialog(page).getByLabel('Mise de départ').press('Enter');
  await expect(dialog(page)).toHaveCount(0);
  expect(posted).toEqual([{ card_id: 'u1', base_amount: 40, duration_minutes: 10 }]);
});

for (const [how, close] of [
  ['Annuler', (page: Page) => dialog(page).getByRole('button', { name: 'Annuler' }).click()],
  ['✕', (page: Page) => dialog(page).getByRole('button', { name: 'Fermer' }).click()],
  ['Échap', (page: Page) => page.keyboard.press('Escape')],
  ['le fond', (page: Page) => page.mouse.click(5, 300)],
] as const) {
  test(`${how} ferme la mise en vente sans rien envoyer, la modale de carte reste`, async ({ page }) => {
    const posted = (await openSale(page)).posted;
    await expect(dialog(page)).toBeVisible();
    await close(page);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('#auction-modal')).toHaveCount(0);
    await expect(page.locator('#card-modal')).toBeVisible();
    expect(posted).toEqual([]);
  });
}

test('pendant l’envoi : « Mise en vente… », tout est désactivé', async ({ page }) => {
  const sale = await openSale(page, { hold: true });
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  const confirm = dialog(page).locator('.wm-sale-actions button').last();
  await expect(confirm).toHaveText('Mise en vente…');
  await expect(confirm).toBeDisabled();
  await expect(dialog(page).getByRole('button', { name: 'Annuler' })).toBeDisabled();
  await expect(dialog(page).getByRole('radio', { name: '3 h' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();

  sale.release();
  await expect(dialog(page)).toHaveCount(0);
});

test('refus du site : son message s’affiche, on peut corriger et réessayer', async ({ page }) => {
  const posted = (await openSale(page, { response: { status: 400, json: { error: 'Mise de départ trop élevée' } } })).posted;
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect(dialog(page).getByRole('alert')).toHaveText('Mise de départ trop élevée');
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeEnabled();
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect.poll(() => posted.length).toBe(2);
});

/** Mise en vente refusée une première fois : le site demande sa « Vérification rapide » (anti-robot). */
async function openSaleWithHumanCheck(page: Page): Promise<{ posted: unknown[]; checks: unknown[] }> {
  const server = { posted: [] as unknown[], checks: [] as unknown[] };
  await openCard(page, {
    api: { '/api/marketplace/mine': { sellingCount: 2, maxConcurrentAuctions: 10 } },
    handle: async (route, url) => {
      const method = route.request().method();
      if (url.pathname === '/api/human-check' && method === 'POST') {
        server.checks.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true } });
        return true;
      }
      if (url.pathname !== '/api/marketplace' || method !== 'POST') return false;
      server.posted.push(route.request().postDataJSON());
      await route.fulfill(
        server.posted.length === 1
          ? { status: 403, json: { error: 'Vérification anti-bot requise.', code: 'human_verification_required' } }
          : { status: 201, json: { auction_id: 'a1b2c3d4-0000-4000-8000-000000000001' } },
      );
      return true;
    },
  });
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('#human-check')).toBeVisible();
  return server;
}

test('vérification anti-robot du site : par-dessus la mise en vente, qui repart une fois faite', async ({ page }) => {
  const server = await openSaleWithHumanCheck(page);
  // La nôtre attend : rien ne la ferme, rien ne se change.
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeDisabled();
  await expect(dialog(page).getByRole('button', { name: 'Annuler' })).toBeDisabled();
  await expect(dialog(page).getByLabel('Mise de départ')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();

  // Le clic atteint la vérification : elle n'est pas sous notre modale.
  await page.locator('#human-check').getByRole('button', { name: 'Je suis humain' }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(server.checks).toEqual([{ token: 'jeton' }]);
  expect(server.posted).toHaveLength(2);
});

test('vérification anti-robot annulée : la mise en vente reprend la main', async ({ page }) => {
  const server = await openSaleWithHumanCheck(page);
  await page.locator('#human-check').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('#human-check')).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeEnabled();
  await expect(dialog(page).getByRole('alert')).toHaveCount(0);
  expect(server.posted).toHaveLength(1);
});

test('mise invalide : Confirmer désactivé', async ({ page }) => {
  await openSale(page);
  await dialog(page).getByLabel('Mise de départ').fill('0');
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'Augmenter' }).click();
  await expect(dialog(page).getByLabel('Mise de départ')).toHaveValue('1');
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeEnabled();
});

test('limite d’enchères atteinte : avertissement, Confirmer désactivé', async ({ page }) => {
  await openSale(page, { mine: { sellingCount: 10, maxConcurrentAuctions: 10 } });
  await expect(dialog(page)).toContainText('Enchères actives : 10 / 10 · plus de place disponible');
  await expect(dialog(page).getByRole('alert')).toContainText('Limite de 10 enchères actives atteinte');
  await expect(dialog(page).getByRole('button', { name: 'Confirmer' })).toBeDisabled();
});

test('durée par défaut réglée : sélectionnée à l’ouverture et envoyée', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'auction-modal-layout': { defaultDuration: 180 } } });
  const posted = (await openSale(page)).posted;
  await expect(dialog(page).getByRole('radio', { name: '3 h' })).toHaveAttribute('aria-checked', 'true');
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();
  await expect.poll(() => posted).toEqual([{ card_id: 'u1', base_amount: 10, duration_minutes: 180 }]);
});

test('paramètres : durée par défaut au choix, historique, sans interrupteur ; un ancien choix « désactivée » est ignoré', async ({ page }) => {
  await presetSettings(page, { features: { 'auction-modal-layout': false }, values: {} });
  await openPulls(page);
  const settings = await openSettings(page, 'Enchères');
  // Une seule section « Mise aux enchères » : la modale (sans interrupteur), puis rester sur la carte.
  await expect(settings.locator('.wm-settings-heading')).toHaveText(['Mise aux enchères']);
  const [layout, stay] = [settings.locator('.wm-settings-feature').first(), settings.locator('.wm-settings-feature').nth(1)];
  await expect(settings.locator('.wm-settings-feature')).toHaveCount(2);
  // Pas d'interrupteur pour la modale : seulement ceux de l'historique, la reprise grisée quand il est masqué.
  await expect(layout.getByRole('switch')).toHaveCount(2);
  const show = layout.getByRole('switch', { name: "Afficher l'historique" });
  const reuse = layout.getByRole('switch', { name: 'Reprendre la dernière mise en vente' });
  await expect(show).toBeChecked();
  await expect(reuse).toBeChecked();
  await expect(reuse).toBeEnabled();
  await show.click();
  await expect(show).not.toBeChecked();
  await expect(reuse).toBeDisabled();
  await expect(reuse).toBeChecked();
  await show.click();
  await expect(reuse).toBeEnabled();
  await expect(stay.getByRole('switch', { name: 'Mise aux enchères : Rester sur la carte après la mise aux enchères' })).toBeVisible();
  const choice = layout.getByRole('radiogroup', { name: 'Durée par défaut' });
  await expect(choice.getByRole('radio', { name: '10 min' })).toHaveAttribute('aria-checked', 'true');
  await choice.getByRole('radio', { name: '30 min' }).click();
  await expect(choice.getByRole('radio', { name: '30 min' })).toHaveAttribute('aria-checked', 'true');
  await settings.getByRole('button', { name: 'Fermer' }).click();

  await page.click('#open');
  await packFaces(page).click();
  await page.locator('#card-modal').getByRole('button', { name: 'Vendre' }).click();
  await expect(dialog(page).getByRole('radio', { name: '30 min' })).toHaveAttribute('aria-checked', 'true');
});
