import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, PACK, playedSounds, PULLS_HTML, recordSounds } from './support/pulls';
import { openSite, presetSettings } from './support/site';

const NEXT = 'main div.flex.items-center.gap-4 > button.w-12:last-child';
const PREVIOUS = 'main div.flex.items-center.gap-4 > button.w-12:first-child';

/** Le paquet de test, plus une L en dernière position. */
const WITH_LEGENDARY = {
  ...PACK,
  cards: [...PACK.cards, { id: 'c4', wikipedia_title: 'Lyon', rarity: 'L', atk: 1, def: 1 }],
  owned_copies: [...PACK.owned_copies, { id: 'u4', card_id: 'c4', starred: false, is_shiny: false, user_card_tags: [] }],
};

async function openPulls(page: Page, pack: unknown = PACK) {
  await recordSounds(page);
  await openSite(page, '/pulls', { html: PULLS_HTML, api: { '/api/packs/open': pack } });
}

test('carrousel : le paquet déchiré, puis un son à chaque carte tournée, dans les deux sens', async ({ page }) => {
  await presetSettings(page, CAROUSEL);
  await openPulls(page, WITH_LEGENDARY);
  await page.click('#open');
  await expect.poll(() => playedSounds(page)).toEqual(['pack-rip']);

  await page.locator(NEXT).click();
  await page.locator(NEXT).click();
  await page.locator(PREVIOUS).click();
  await expect.poll(() => playedSounds(page)).toEqual(['pack-rip', 'card-flip', 'card-flip', 'card-flip']);
  // Arrivée sur la L : le son du site pour les légendaires aussi.
  await page.locator(NEXT).click();
  await page.locator(NEXT).click();
  await expect.poll(() => playedSounds(page)).toEqual([
    'pack-rip',
    'card-flip',
    'card-flip',
    'card-flip',
    'card-flip',
    'card-flip',
    'legendary-reveal',
  ]);
});

test('grille : seul le paquet déchiré s’entend, pas l’arrivée des cartes (légendaire comprise)', async ({ page }) => {
  await openPulls(page, WITH_LEGENDARY);
  await page.click('#open');
  await expect(page.locator('.wm-pulls-slot[data-state="arrived"]')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled();
  expect(await playedSounds(page)).toEqual(['pack-rip']);

  // Ouvrir une carte fait tourner le carrousel caché : toujours sans son.
  await page.locator('.wm-pulls-slot').nth(0).locator('.wm-pulls-card > *').click();
  await expect(page.locator('#card-modal')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await playedSounds(page)).toEqual(['pack-rip']);
});

test('son coupé : ni l’ouverture ni les cartes tournées', async ({ page }) => {
  await presetSettings(page, { features: { 'pulls-grid': false }, values: { 'pulls-sound': { enabled: false } } });
  await openPulls(page);
  await page.click('#open');
  await page.locator(NEXT).click();
  await page.locator(PREVIOUS).click();
  await page.waitForTimeout(300);
  expect(await playedSounds(page)).toEqual([]);
});
