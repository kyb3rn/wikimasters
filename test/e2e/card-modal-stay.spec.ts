import { expect, test, type Page, type Route } from '@playwright/test';
import { CAROUSEL, openCard as openPulledCard, packFaces } from './support/pulls';
import { letTimePass, presetSettings, rect } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

type Reply = { status: number; json: unknown };

/**
 * Ouvre la modale de la première carte. Par défaut sans défaussage rapide (la défausse passe par la
 * confirmation du site) : le réglage doit valoir sans lui.
 */
async function openCard(
  page: Page,
  options: { features?: Record<string, boolean>; reply?: (route: Route) => Promise<void> } = {},
): Promise<string[]> {
  await presetSettings(page, { features: options.features ?? { 'card-modal-discard': false }, values: {} });
  return (await openPulledCard(page, { discard: options.reply })).discarded;
}

const modal = (page: Page) => page.locator('#card-modal');
const discardButton = (page: Page) => modal(page).locator('button:has(svg.lucide-trash-2)');
const index = (page: Page) => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index);

async function discardWithSiteConfirmation(page: Page) {
  await discardButton(page).click();
  await page.locator('#discard-confirm').getByRole('button', { name: 'Défausser' }).click();
}

test('après une défausse, la modale reste : carte « Défaussée », actions verrouillées', async ({ page }) => {
  const discarded = await openCard(page);
  await discardWithSiteConfirmation(page);
  await expect.poll(() => discarded).toEqual(['u1']);

  await expect(modal(page)).toBeVisible();
  await expect(page.locator('#discard-confirm')).toHaveCount(0);
  await expect(modal(page).locator('.wm-stamp')).toHaveText('Défaussée');
  for (const control of [
    discardButton(page),
    modal(page).getByRole('button', { name: 'Vendre' }),
    modal(page).getByRole('button', { name: 'Ajouter aux favoris' }),
    modal(page).getByPlaceholder('Ajouter une étiquette…'),
  ]) {
    await expect(control).toBeDisabled();
  }
  await expect(modal(page).getByRole('link', { name: /Wikipédia/ })).toBeVisible();

  // ✕ la ferme ; le paquet est de nouveau accessible.
  await modal(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(modal(page)).toHaveCount(0);
  await page.locator('main button.w-12').last().click();
  expect(await index(page)).toBe(1);
});

test('la modale ne clignote pas : présente à chaque image, sans rejouer son apparition', async ({ page }) => {
  await openCard(page);
  await page.evaluate(() => {
    const state = { missed: 0, running: true };
    (window as unknown as { __frames: typeof state }).__frames = state;
    const tick = () => {
      if (!document.getElementById('card-modal')) state.missed++;
      if (state.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await discardWithSiteConfirmation(page);
  await expect(modal(page).locator('.wm-stamp')).toBeVisible();
  const missed = await page.evaluate(() => {
    const state = (window as unknown as { __frames: { missed: number; running: boolean } }).__frames;
    state.running = false;
    return state.missed;
  });
  expect(missed).toBe(0);
  await expect(modal(page).locator(':scope > .card-frame')).toHaveCSS('animation-name', 'none');
});

test('Échap ou un clic sur le fond ferment aussi la modale gardée', async ({ page }) => {
  await openCard(page);
  await discardWithSiteConfirmation(page);
  await expect(modal(page).locator('.wm-stamp')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal(page)).toHaveCount(0);

  await page.locator('main button.w-12').last().click();
  await packFaces(page).click();
  await discardWithSiteConfirmation(page);
  await expect(modal(page).locator('.wm-stamp')).toBeVisible();
  // Un glisser du cadre (sa marge du haut, pas un bouton) jusqu’au fond, lui, ne la ferme pas.
  const frame = await rect(modal(page).locator(':scope > .card-frame'));
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 10);
  await page.mouse.down();
  await page.mouse.move(5, 300, { steps: 5 });
  await page.mouse.up();
  await letTimePass(page, 100);
  // Pas la copie qui s'efface (même id), la modale elle-même.
  await expect(page.locator('#card-modal:not(.wm-modal-ghost *)')).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(modal(page)).toHaveCount(0);
});

test('avec le défaussage rapide aussi', async ({ page }) => {
  const discarded = await openCard(page, { features: {} });
  await discardButton(page).click();
  await expect.poll(() => discarded).toEqual(['u1']);
  await expect(modal(page).locator('.wm-stamp')).toHaveText('Défaussée');
});

test('fermée pendant la défausse : elle ne revient pas', async ({ page }) => {
  let release: (reply: Reply) => void = () => {};
  const ready = new Promise<Reply>((resolve) => (release = resolve));
  // Défaussage rapide : la confirmation du site, cachée, ne recouvre pas la croix pendant la requête.
  await openCard(page, { features: {}, reply: async (route) => route.fulfill(await ready) });
  await discardButton(page).click();
  await expect(discardButton(page)).toHaveAttribute('aria-busy', 'true');
  await modal(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(modal(page)).toHaveCount(0);
  release({ status: 200, json: { balance: 12661 } });
  await letTimePass(page, 300);
  await expect(modal(page)).toHaveCount(0);
});

test('défausse restée sans réponse : une fermeture par le site ensuite ne garde pas la modale', async ({ page }) => {
  const discarded = await openCard(page, { reply: (route) => route.abort('failed') });
  await discardWithSiteConfirmation(page);
  await expect.poll(() => discarded).toEqual(['u1']);
  await expect(page.locator('#discard-confirm')).toContainText('Erreur réseau');
  // Le site retire la modale de lui-même (sans geste de l'utilisateur) : rien ne l'explique par une défausse.
  await page.evaluate(() => {
    document.getElementById('discard-confirm')?.remove();
    document.getElementById('card-modal')?.remove();
  });
  await letTimePass(page, 300);
  await expect(modal(page)).toHaveCount(0);
});

test('désactivée : le site ferme la modale après la défausse', async ({ page }) => {
  const discarded = await openCard(page, { features: { 'card-modal-discard': false, 'card-modal-stay': false } });
  await discardWithSiteConfirmation(page);
  await expect.poll(() => discarded).toEqual(['u1']);
  await expect(modal(page)).toHaveCount(0);
});
