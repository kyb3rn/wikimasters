import { expect, test, type Page, type Route } from '@playwright/test';
import { CAROUSEL, openPulls as openFakePulls, packFaces, PRO_PACK } from './support/pulls';
import { presetSettings, rect } from './support/site';

test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

const panel = (page: Page) => page.getByRole('region', { name: 'Pack Pro' });
const button = (page: Page) => panel(page).getByRole('button');

/** `status` : réponse de `GET /api/packs/pro-daily` (par défaut : disponible). */
async function openPulls(page: Page, status?: (route: Route) => Promise<void>) {
  await openFakePulls(page, {
    pro: true,
    handle: async (route, url) => {
      if (url.pathname !== '/api/packs/pro-daily' || route.request().method() !== 'GET' || !status) return false;
      await status(route);
      return true;
    },
  });
}

const claimed = (route: Route) => route.fulfill({ json: { eligible: false, claimed_today: true, claim_date: '2026-09-30' } });

test('disponible : cadre « Pack Pro » de 400 px, titre, description, bouton « Ouvrir » qui ouvre le pack', async ({ page }) => {
  await openPulls(page);
  await expect(page.locator('#pro')).toBeHidden();
  await expect(panel(page).getByRole('heading', { name: 'Pack Pro' })).toBeVisible();
  await expect(panel(page)).toContainText('Un paquet de 15 cartes aux raretés plus élevées, offert chaque jour aux membres PRO.');
  await expect(button(page)).toHaveText('Ouvrir');
  await expect(button(page)).toBeEnabled();
  expect(Math.round((await rect(panel(page))).width)).toBe(400);

  await button(page).click();
  await expect(packFaces(page).first()).toBeAttached();
});

test('pendant l’ouverture : roue et bouton désactivé, comme celui du site', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await openPulls(page);
  await page.route('**/api/packs/pro-daily', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await held;
    await route.fulfill({ json: PRO_PACK });
  });
  await button(page).click();
  await expect(button(page)).toHaveText('Ouverture…');
  await expect(button(page)).toBeDisabled();
  await expect(button(page).locator('.wm-spin')).toBeVisible();
  release();
  await expect(packFaces(page).first()).toBeAttached();
});

test('déjà ouvert : bouton désactivé avec le temps restant jusqu’à minuit (heure française), seconde par seconde', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T19:28:06+02:00'));
  await openPulls(page, claimed);
  await expect(button(page)).toHaveText('04:31:54');
  await expect(button(page)).toBeDisabled();
  await expect(panel(page)).toContainText('Pack du jour déjà ouvert : le prochain sera disponible à minuit.');

  await page.clock.setFixedTime(new Date('2026-09-30T19:28:07+02:00'));
  await expect(button(page)).toHaveText('04:31:53');
});

test('le temps restant suit l’horloge du serveur (en-tête Date), pas celle du PC', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T19:28:06+02:00'));
  // Sans le jour de l'ouverture (stockage du site vide) : minuit suivant.
  await openPulls(page, (route) =>
    route.fulfill({
      json: { eligible: false, claimed_today: true },
      headers: { date: new Date('2026-09-30T20:28:06+02:00').toUTCString() },
    }),
  );
  await expect(button(page)).toHaveText('03:31:54');
});

test('minuit passé : le script redemande le pack au site, qui l’affiche sans recharger la page', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T23:59:59.500+02:00'));
  let requests = 0;
  await openPulls(page, (route) => {
    requests += 1;
    return requests === 1 ? claimed(route) : route.fulfill({ json: { eligible: true, claimed_today: false } });
  });
  await expect(button(page)).toHaveText('00:00:01');
  const loads = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await page.clock.setFixedTime(new Date('2026-10-01T00:00:00.200+02:00'));
  await expect(button(page)).toHaveText('Ouvrir');
  await expect(page.locator('#open-pro')).toHaveText('Ouvrir le pack PRO du jour');
  expect(requests).toBe(2);
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(loads);

  await button(page).click();
  await expect(packFaces(page).first()).toBeAttached();
});

test('minuit passé mais le serveur dit encore « réclamé » (horloges) : nouvelle demande 2 s après', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T23:59:59.500+02:00'));
  let requests = 0;
  await openPulls(page, (route) => {
    requests += 1;
    return requests <= 2 ? claimed(route) : route.fulfill({ json: { eligible: true, claimed_today: false } });
  });
  await expect(button(page)).toHaveText('00:00:01');
  await page.clock.setFixedTime(new Date('2026-10-01T00:00:00.200+02:00'));
  await expect.poll(() => requests).toBe(2);
  await expect(panel(page).getByRole('button', { name: 'Chargement du pack Pro' })).toBeDisabled();
  await expect(button(page)).toHaveText('Ouvrir', { timeout: 4000 });
  expect(requests).toBe(3);
});

test('état de la page illisible : « Actualiser » recharge la page', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T23:59:59.500+02:00'));
  let requests = 0;
  await openPulls(page, (route) => {
    requests += 1;
    return requests === 1 ? claimed(route) : route.fulfill({ json: { eligible: true, claimed_today: false } });
  });
  await expect(button(page)).toHaveText('00:00:01');
  await page.locator('#pro').evaluate((box) => delete (box as unknown as Record<string, unknown>)['__reactFiber$test']);
  await page.clock.setFixedTime(new Date('2026-10-01T00:00:00.200+02:00'));
  await expect(button(page)).toHaveText('Actualiser');
  await button(page).click();
  await expect(button(page)).toHaveText('Ouvrir');
});

test('en attente de la réponse du site : roue ; réponse en erreur : le script redemande lui-même', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let requests = 0;
  await openPulls(page, async (route) => {
    requests += 1;
    if (requests > 1) return route.fulfill({ json: { eligible: true, claimed_today: false } });
    await held;
    await route.fulfill({ status: 500, json: { error: 'Erreur serveur' } });
  });
  await expect(panel(page).getByRole('button', { name: 'Chargement du pack Pro' })).toBeDisabled();
  await expect(button(page).locator('.wm-spin')).toBeVisible();
  release();
  await expect(button(page)).toHaveText('Ouvrir');
  expect(requests).toBe(2);
});

test('ordre de la page : cadre des paquets, paquet, pack Pro ; la rangée du site vidée disparaît', async ({ page }) => {
  await openPulls(page);
  await expect(panel(page)).toBeVisible();
  const [bar, pack, pro] = await Promise.all([rect(page.locator('.wm-packs-bar')), rect(page.locator('#open')), rect(panel(page))]);
  expect(bar.y + bar.height).toBeLessThanOrEqual(pack.y);
  expect(pack.y + pack.height).toBeLessThanOrEqual(pro.y);
  await expect(page.locator('#packs').locator('..')).toBeHidden();
});
