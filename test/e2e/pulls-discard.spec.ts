import { expect, test, type Page, type Route } from '@playwright/test';
import { CAROUSEL, PACK, PRO_COPIES, PRO_PACK, PULLS_HTML } from './support/pulls';
import { openSite, presetSettings, SUPABASE } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const TRASH = '.wm-discard-next';
const index = (page: Page) => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index);

/** Réponse de défausse qu'on libère quand on veut, pour observer l'état « en cours ». */
function deferred() {
  let release: (response: { status: number; json: unknown }) => void = () => {};
  const ready = new Promise<{ status: number; json: unknown }>((resolve) => (release = resolve));
  return { ready, release };
}

async function openPulls(page: Page, discard: (route: Route, userCardId: string) => Promise<void>, pack: unknown = PACK) {
  const discarded: string[] = [];
  await page.route(`${SUPABASE}/**`, (route) =>
    route.fulfill({ json: PRO_COPIES, headers: { 'access-control-allow-origin': '*' } }),
  );
  await openSite(page, '/pulls', {
    html: PULLS_HTML,
    api: { '/api/packs/open': pack, '/api/packs/pro-daily': PRO_PACK },
    handle: async (route, url) => {
      // Favori et étiquettes (Supabase, servi ici sur la même origine) : acceptés.
      if (url.pathname.startsWith('/rest/v1/')) {
        await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 204, body: '' });
        return true;
      }
      const match = /^\/api\/user-cards\/([^/]+)\/discard$/.exec(url.pathname);
      if (!match?.[1]) return false;
      discarded.push(match[1]);
      await discard(route, match[1]);
      return true;
    },
  });
  return discarded;
}

const accept = (route: Route) => route.fulfill({ json: { balance: 12661 } });

test.beforeEach(async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'pulls-discard-next': { delayMs: 300 } } });
});

test('la corbeille rouge apparaît à gauche de la flèche « suivante » une fois le paquet ouvert', async ({ page }) => {
  await openPulls(page, accept);
  await expect(page.locator(TRASH)).toHaveCount(0);

  await page.click('#open');
  const trash = page.locator(TRASH);
  await expect(trash).toBeVisible();
  const layout = await trash.evaluate((button) => {
    const next = button.parentElement?.nextElementSibling;
    return {
      beforeNext: next?.tagName === 'BUTTON' && next.classList.contains('w-12'),
      classes: button.getAttribute('class') ?? '',
    };
  });
  expect(layout.beforeNext).toBe(true);
  expect(layout.classes).toContain('w-12 h-12 rounded-full');
  await expect(trash).toHaveCSS('color', 'rgb(248, 81, 73)');
});

test('défausse la carte, la marque « Défaussée », puis passe à la suivante', async ({ page }) => {
  const response = deferred();
  const discarded = await openPulls(page, async (route) => route.fulfill(await response.ready));
  await page.click('#open');
  await page.locator(TRASH).click();

  // Requête en cours : roue, carrousel verrouillé (flèche, pastille, glissement), curseur « interdit ».
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'busy');
  await expect(page.locator(TRASH)).toHaveCSS('cursor', 'not-allowed');
  await expect(page.locator('main button.w-12').last()).toHaveCSS('cursor', 'not-allowed');
  await expect(page.locator('main [class*="glow-"]')).toHaveCSS('cursor', 'not-allowed');
  await page.locator('main button.w-12').last().click({ force: true });
  await page.locator('main .gap-2 > button').nth(2).click({ force: true });
  const area = await page.locator('main .relative').first().boundingBox();
  if (area) {
    await page.mouse.move(area.x + area.width - 5, area.y + 20);
    await page.mouse.down();
    await page.mouse.move(area.x + 5, area.y + 20);
    await page.mouse.up();
  }
  expect(await index(page)).toBe(0);

  response.release({ status: 200, json: { balance: 12661 } });
  await expect(page.locator('.wm-stamp')).toHaveText('Défaussée');
  expect(await index(page)).toBe(0);
  await expect.poll(() => index(page)).toBe(1);
  await expect(page.locator('.wm-stamp')).toHaveCount(0);
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'ready');
  expect(discarded).toEqual(['u1']);
});

test('sur la dernière carte, reste dessus ; revenir sur une carte défaussée la montre défaussée', async ({ page }) => {
  await openPulls(page, accept);
  await page.click('#open');
  await page.locator('main .gap-2 > button').nth(2).click();
  await page.locator(TRASH).click();

  await expect(page.locator('.wm-stamp')).toBeVisible();
  await page.waitForTimeout(600);
  expect(await index(page)).toBe(2);
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'discarded');
  await expect(page.locator(TRASH)).toBeDisabled();

  await page.locator('main button.w-12').first().click();
  expect(await index(page)).toBe(1);
  await expect(page.locator('.wm-stamp')).toHaveCount(0);
  await page.locator('main button.w-12').last().click();
  await expect(page.locator('.wm-stamp')).toBeVisible();
});

test('un refus du site s’affiche en toast sous le solde, sans changer de carte', async ({ page }) => {
  await openPulls(page, (route) => route.fulfill({ status: 409, json: { error: 'Cette carte a déjà été défaussée' } }));
  await page.click('#open');
  await page.locator(TRASH).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Défausse impossible');
  await expect(alert).toContainText('« Tour Eiffel » : Cette carte a déjà été défaussée');
  const balance = await page.locator('button[aria-label="Ouvrir la boutique WikiBidous"]:visible').boundingBox();
  const toastBox = await alert.boundingBox();
  expect(toastBox && balance && toastBox.y >= balance.y + balance.height + 8).toBe(true);

  await page.waitForTimeout(500);
  expect(await index(page)).toBe(0);
  await expect(page.locator('.wm-stamp')).toHaveCount(0);
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'ready');
});

test('une carte en favori est protégée (cadenas), selon le réglage', async ({ page }) => {
  const starred = { ...PACK, owned_copies: PACK.owned_copies.map((c) => (c.card_id === 'c1' ? { ...c, starred: true } : c)) };
  const discarded = await openPulls(page, accept, starred);
  await page.click('#open');

  const trash = page.locator(TRASH);
  await expect(trash).toHaveAttribute('data-status', 'protected');
  await expect(trash).toHaveAttribute('title', 'Protégée : carte en favori');
  await expect(trash).toBeDisabled();

  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  await page.getByRole('switch', { name: 'Protéger les cartes en favori' }).click();
  await page.keyboard.press('Escape');
  await expect(trash).toHaveAttribute('data-status', 'ready');
  await trash.click();
  await expect.poll(() => discarded).toEqual(['u1']);
});

test('une étiquette ajoutée dans la modale du site protège la carte tout de suite', async ({ page }) => {
  await openPulls(page, accept);
  await page.click('#open');
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'ready');

  await page.locator('main [class*="glow-"]').click();
  await page.getByPlaceholder('Ajouter une étiquette…').fill('garder');
  await page.getByPlaceholder('Ajouter une étiquette…').press('Enter');
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'protected');
  await expect(page.locator(TRASH)).toHaveAttribute('title', 'Protégée : carte avec une étiquette');
});

test('une carte défaussée ne peut plus être défaussée, mise aux enchères ni étiquetée depuis la modale du site', async ({ page }) => {
  await openPulls(page, accept);
  await page.click('#open');
  await page.locator(TRASH).click();
  await expect.poll(() => index(page)).toBe(1);
  await page.locator('main button.w-12').first().click();

  await page.locator('main [class*="glow-"]').click();
  const modal = page.locator('#card-modal');
  for (const control of [
    modal.getByRole('button', { name: /Défausser/ }),
    modal.getByRole('button', { name: 'Vendre' }),
    modal.getByPlaceholder('Ajouter une étiquette…'),
  ]) {
    await expect(control).toBeDisabled();
    await expect(control).toHaveCSS('cursor', 'not-allowed');
  }
  await expect(modal.getByRole('button', { name: 'Ajouter aux favoris' })).toBeEnabled();
  await expect(page.locator(TRASH)).toHaveCSS('cursor', 'not-allowed');
  await modal.getByRole('button', { name: 'Fermer' }).click();

  // Carte non défaussée : modale intacte.
  await page.locator('main button.w-12').last().click();
  await page.locator('main [class*="glow-"]').click();
  await expect(page.locator('#card-modal').getByRole('button', { name: 'Vendre' })).toBeEnabled();
});

test('dans sa modale, une carte défaussée est grisée ; un clic la montre propre, un autre la regrise', async ({ page }) => {
  await openPulls(page, accept);
  await page.click('#open');
  await page.locator('main button.w-12').last().click();
  await page.locator('main button.w-12').last().click();
  await page.locator(TRASH).click();
  await expect(page.locator('main .wm-stamp')).toBeVisible();
  // Fin de la défausse (délai compris) : le carrousel n'est plus verrouillé.
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'discarded');

  await page.locator('main [class*="glow-"]').click();
  const modal = page.locator('#card-modal');
  const face = modal.locator('[class*="glow-"]');
  const mark = face.locator('.wm-stamp');
  await expect(mark).toHaveText('Défaussée');
  await expect(mark).toHaveCSS('opacity', '1');
  await expect(face).toHaveCSS('cursor', 'pointer');

  const content = face.locator(':scope > :not(.wm-stamp)').first();
  await expect(content).toHaveCSS('filter', /grayscale/);
  await face.click({ position: { x: 30, y: 200 } });
  await expect(mark).toHaveCSS('opacity', '0');
  await expect(content).toHaveCSS('filter', 'none');
  await face.click({ position: { x: 30, y: 200 } });
  await expect(mark).toHaveCSS('opacity', '1');

  // Montrée propre puis modale refermée : grisée à nouveau à la réouverture.
  await face.click({ position: { x: 30, y: 200 } });
  await expect(mark).toHaveCSS('opacity', '0');
  await modal.getByRole('button', { name: 'Fermer' }).click();
  await page.locator('main [class*="glow-"]').click();
  await expect(page.locator('#card-modal .wm-stamp')).toHaveCSS('opacity', '1');
  // Le bouton favori sur la carte ne bascule pas le gris.
  await page.locator('#card-modal').getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await expect(page.locator('#card-modal .wm-stamp')).toHaveCSS('opacity', '1');
});

test('une défausse faite par le bouton du site marque aussi la carte', async ({ page }) => {
  const discarded = await openPulls(page, accept);
  await page.click('#open');
  await page.locator('main [class*="glow-"]').click();
  await page.locator('#card-modal').getByRole('button', { name: /Défausser/ }).click();

  await expect(page.locator('main .wm-stamp')).toHaveText('Défaussée');
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'discarded');
  expect(discarded).toEqual(['u1']);
  expect(await index(page)).toBe(0);
});

test('paquet PRO : l’exemplaire vient de la requête Supabase faite par le site', async ({ page }) => {
  const discarded = await openPulls(page, accept);
  await page.getByRole('region', { name: 'Pack Pro' }).getByRole('button', { name: 'Ouvrir' }).click();
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'ready');
  await page.locator(TRASH).click();
  await expect.poll(() => index(page)).toBe(1);
  expect(discarded).toEqual(['p1']);
});
