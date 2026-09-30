import { expect, test, type Page } from '@playwright/test';
import { PACK, playedSounds, PULLS_HTML, recordSounds } from './support/pulls';
import { openSite } from './support/site';

const bar = (page: Page) => page.locator('.wm-packs-bar');
const soundButton = (page: Page) => bar(page).locator('button[aria-pressed]');
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('wm-settings-v1') ?? 'null') as unknown);

/** `siteSound` : réglage du son du site déjà enregistré. */
async function openPulls(page: Page, siteSound?: 'on' | 'off') {
  await recordSounds(page);
  await page.addInitScript((initial) => {
    if (initial && !sessionStorage.getItem('wm-test-site-sound')) {
      sessionStorage.setItem('wm-test-site-sound', '1');
      localStorage.setItem('wiki-masters-sound', initial);
    }
  }, siteSound);
  await openSite(page, '/pulls', { html: PULLS_HTML, api: { '/api/packs/open': PACK } });
  await expect(bar(page)).toBeVisible();
}

async function openSettings(page: Page) {
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  await page.getByRole('dialog', { name: 'Paramètres' }).getByRole('button', { name: 'Paquets' }).click();
}

test('le cadre du site devient un cadre en largeur : paquets, recharge, son, affichage', async ({ page }) => {
  await openPulls(page);
  await expect(page.locator('#packs')).toBeHidden();

  const parts = bar(page).locator('.wm-packs-part');
  await expect(parts).toHaveCount(4);
  await expect(parts.nth(0)).toHaveText('3 / 10');
  await expect(parts.nth(0)).toHaveAttribute('title', 'Paquets disponibles');
  await expect(parts.nth(1)).toContainText('prochain paquet');
  const tops = await parts.evaluateAll((elements) => elements.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  // Le temps restant suit celui du site, réécrit chaque seconde.
  const time = parts.nth(1).locator('.font-mono');
  const first = await time.textContent();
  await expect(time).not.toHaveText(first ?? '', { timeout: 3000 });

  await page.evaluate(() => (window as unknown as { __packs: { set(n: number): void } }).__packs.set(10));
  await expect(parts.nth(0)).toContainText('10 / 10');
  await expect(parts.nth(1)).toHaveText('Pleinau maximum');
  await page.evaluate(() => (window as unknown as { __packs: { set(n: number): void } }).__packs.set(7));
  await expect(parts.nth(0)).toContainText('7 / 10');
  await expect(parts.nth(1)).toContainText('prochain paquet');
});

test('son actif : l’ouverture d’un paquet joue son son', async ({ page }) => {
  await openPulls(page);
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
  await page.click('#open');
  await expect.poll(() => playedSounds(page)).toEqual(['pack-rip']);
});

test('le bouton du son coupe les sons des paquets, réglage partagé avec les paramètres', async ({ page }) => {
  await openPulls(page);
  await soundButton(page).click();
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(soundButton(page)).toHaveAccessibleName('Activer le son des paquets');
  await expect(bar(page)).toContainText('son coupé');
  expect(await stored(page)).toEqual({ features: {}, values: { 'pulls-sound': { enabled: false } } });

  await openSettings(page);
  const toggle = page.getByRole('switch', { name: 'Jouer les sons des paquets' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');

  await page.click('#open');
  await expect(page.locator('main [class*="glow-"]').first()).toBeAttached();
  await page.waitForTimeout(300);
  expect(await playedSounds(page)).toEqual([]);
});

test('rétabli dans les paramètres, le son revient tout de suite dans le cadre', async ({ page }) => {
  await openPulls(page);
  await soundButton(page).click();
  await openSettings(page);
  await page.getByRole('switch', { name: 'Jouer les sons des paquets' }).click();
  await page.keyboard.press('Escape');
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
});

test('son coupé par le réglage du site : repris au chargement, le site le garde ensuite actif', async ({ page }) => {
  await openPulls(page, 'off');
  await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('wiki-masters-sound'))).toBe('on');
});

test('carrousel ou grille : le choix du cadre est celui des paramètres', async ({ page }) => {
  await openPulls(page);
  const grid = page.getByRole('radio', { name: 'Grille' });
  const carousel = page.getByRole('radio', { name: 'Carrousel' });
  await expect(grid).toHaveAttribute('aria-checked', 'true');
  await expect(bar(page)).toContainText('grille');

  await carousel.click();
  await expect(carousel).toHaveAttribute('aria-checked', 'true');
  await expect(bar(page)).toContainText('carrousel');
  expect(await stored(page)).toEqual({ features: { 'pulls-grid': false }, values: {} });
  await openSettings(page);
  await expect(page.getByRole('switch', { name: "Apparence : Afficher toutes les cartes d'un coup" })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await page.keyboard.press('Escape');

  await page.click('#open');
  await expect(page.locator('main div.flex.items-center.gap-4:has(> button.w-12)')).toBeVisible();
  await expect(page.locator('.wm-pulls-grid')).toHaveCount(0);
});
