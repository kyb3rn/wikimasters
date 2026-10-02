import { expect, test, type Page } from '@playwright/test';
import { openFriendsPage } from './support/friends';
import { expectDomIdle, hold, letTimePass, openSettings, presetSettings, rect } from './support/site';

const dialog = (page: Page) => page.locator('#site-player-search');
const results = (page: Page) => page.locator('#site-player-results');
const players = (page: Page) => results(page).locator(':scope > [data-player]');
const siteField = (page: Page) => page.locator('#site-player-field');
const ourField = (page: Page) => page.locator('.wm-player-search-bar input');
const searchButton = (page: Page) => page.locator('.wm-player-search-button');

async function openSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ Ajouter un ami' }).click();
  await expect(dialog(page)).toBeVisible();
}

/** Réglage « Rechercher pendant la frappe » coupé. */
const searchOnEnter = (page: Page) => presetSettings(page, { features: {}, values: { 'player-search': { whileTyping: false } } });

/** Position et largeur des lignes de joueurs. */
const playerBoxes = (page: Page) =>
  players(page).evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect()).map(({ x, y, width }) => ({ x, y, width })));

test('fenêtre agrandie, joueurs sur deux colonnes : dix joueurs sans défilement', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFriendsPage(page);
  await openSearch(page);
  await expect.poll(async () => (await rect(dialog(page).locator('.card-frame'))).width).toBeCloseTo(896, 0);
  // Messages sur toute la largeur.
  const message = results(page).getByText('Entrez au moins 2 caractères…');
  expect((await rect(message)).width).toBeCloseTo((await rect(results(page))).width, 0);

  await siteField(page).fill('jou');
  await expect(players(page)).toHaveCount(10);
  const [first, second, third] = await playerBoxes(page);
  if (!first || !second || !third) throw new Error('joueurs introuvables');
  expect(second.y).toBeCloseTo(first.y, 0);
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(third.y).toBeGreaterThan(first.y);
  expect(first.width).toBeGreaterThanOrEqual(400);
  expect(await results(page).evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);
});

test('mobile : une seule colonne', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await openFriendsPage(page);
  await openSearch(page);
  await siteField(page).fill('jou');
  await expect(players(page)).toHaveCount(10);
  const [first, second] = await playerBoxes(page);
  if (!first || !second) throw new Error('joueurs introuvables');
  expect(second.x).toBeCloseTo(first.x, 0);
  expect(second.y).toBeGreaterThan(first.y);
  expect(first.width).toBeCloseTo(await results(page).evaluate((element) => element.clientWidth), 0);
});

test('par défaut, le site cherche pendant la frappe, dans son propre champ', async ({ page }) => {
  const server = await openFriendsPage(page);
  await openSearch(page);
  await expect(siteField(page)).toBeFocused();
  await expect(ourField(page)).toHaveCount(0);
  await siteField(page).pressSequentially('zorg');
  await expect(players(page)).toHaveCount(1);
  expect(server.searched).toEqual(['zorg']);
});

test('recherche à Entrée : rien ne part pendant la frappe ; roue sur la loupe jusqu’à la réponse', async ({ page }) => {
  await searchOnEnter(page);
  const server = await openFriendsPage(page);
  await openSearch(page);
  await expect(siteField(page)).toBeHidden();
  await expect(ourField(page)).toBeFocused();
  await expect(ourField(page)).toHaveAttribute('placeholder', 'Nom d’utilisateur...');
  await expect(searchButton(page)).toBeDisabled();

  await page.keyboard.type('zorg');
  await expect(searchButton(page)).toBeEnabled();
  await letTimePass(page, 600);
  expect(server.searched).toEqual([]);
  await expect(results(page)).toContainText('Entrez au moins 2 caractères…');

  const release = hold(server);
  await page.keyboard.press('Enter');
  await expect(searchButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(searchButton(page)).toBeDisabled();
  await expect.poll(() => server.searched).toEqual(['zorg']);
  release();
  await expect(players(page)).toHaveCount(1);
  await expect(searchButton(page)).toHaveAttribute('aria-busy', 'false');
  // Texte déjà cherché : rien à relancer.
  await expect(searchButton(page)).toBeDisabled();
  await page.keyboard.press('Enter');
  await letTimePass(page, 500);
  expect(server.searched).toEqual(['zorg']);

  await ourField(page).fill('jou');
  await searchButton(page).click();
  await expect(players(page)).toHaveCount(10);
  expect(server.searched).toEqual(['zorg', 'jou']);
});

test('recherche à Entrée : moins de 2 caractères, le message du site sans roue ni requête', async ({ page }) => {
  await searchOnEnter(page);
  const server = await openFriendsPage(page);
  await openSearch(page);
  await ourField(page).fill('jou');
  await page.keyboard.press('Enter');
  await expect(players(page)).toHaveCount(10);
  await ourField(page).fill('j');
  await page.keyboard.press('Enter');
  await expect(players(page)).toHaveCount(0);
  await expect(results(page)).toContainText('Entrez au moins 2 caractères…');
  await expect(searchButton(page)).toHaveAttribute('aria-busy', 'false');
  expect(server.searched).toEqual(['jou']);
});

test('recherche à Entrée : fenêtre rouverte, champ vide et prêt à la frappe', async ({ page }) => {
  await searchOnEnter(page);
  await openFriendsPage(page);
  await openSearch(page);
  await ourField(page).fill('zorg');
  await page.keyboard.press('Enter');
  await expect(players(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await openSearch(page);
  await expect(ourField(page)).toHaveValue('');
  await expect(ourField(page)).toBeFocused();
});

test('réglage rallumé dans les paramètres : le champ du site revient, sans recharger', async ({ page }) => {
  await searchOnEnter(page);
  await openFriendsPage(page);
  const settings = await openSettings(page, 'Amis');
  await settings.getByRole('switch', { name: 'Rechercher pendant la frappe' }).click();
  await page.keyboard.press('Escape');
  await openSearch(page);
  await expect(siteField(page)).toBeVisible();
  await expect(ourField(page)).toHaveCount(0);
});

test('au repos, le script ne resynchronise plus la page (fenêtre ouverte, recherche à Entrée)', async ({ page }) => {
  await searchOnEnter(page);
  await openFriendsPage(page);
  await openSearch(page);
  await ourField(page).fill('jou');
  await page.keyboard.press('Enter');
  await expect(players(page)).toHaveCount(10);
  await expectDomIdle(page);
});
