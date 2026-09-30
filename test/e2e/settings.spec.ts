import { expect, test, type Page } from '@playwright/test';
import { PACK, PULLS_HTML } from './support/pulls';
import { openSite } from './support/site';

const GEAR = 'button[aria-label="Paramètres WikiMasters"]';
/** Interrupteur de la fonctionnalité : visible « Afficher le bouton », nommé avec la fonctionnalité. */
const QUICK_DISCARD = 'Défaussage rapide : Afficher le bouton';
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('wm-settings-v1') ?? 'null') as unknown);

async function openPulls(page: Page) {
  await openSite(page, '/pulls', { html: PULLS_HTML, api: { '/api/packs/open': PACK } });
}

/** Ouvre les paramètres sur une catégorie. */
async function openSettings(page: Page, tab: string) {
  await page.locator(`${GEAR}:visible`).click();
  await page.getByRole('dialog', { name: 'Paramètres' }).getByRole('button', { name: tab }).click();
}

test('un engrenage juste à gauche du solde ouvre la fenêtre de paramètres', async ({ page }) => {
  await openPulls(page);

  // Un engrenage devant chaque bouton du solde (barre mobile et boîte ordinateur).
  await expect(page.locator(GEAR)).toHaveCount(2);
  const beforeBalance = await page.locator(GEAR).evaluateAll((gears) =>
    gears.every((gear) => gear.parentElement?.nextElementSibling?.getAttribute('aria-label') === 'Ouvrir la boutique WikiBidous'),
  );
  expect(beforeBalance).toBe(true);

  // Même allure que le bouton du solde : nos styles ne doivent pas écraser ses classes.
  const look = (selector: string) =>
    page.locator(`${selector}:visible`).evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.fontSize, style.fontWeight];
    });
  expect(await look(GEAR)).toEqual(await look('button[aria-label="Ouvrir la boutique WikiBidous"]'));
  expect(await look(GEAR)).toEqual(['rgb(227, 179, 65)', '12px', '600']);

  await page.locator(`${GEAR}:visible`).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.wm-settings-tab')).toHaveText([
    'Défaussage rapide',
    'Paquets',
    'Modale de carte',
    'Enchères',
    'Collection',
    'Échanges',
    'Marché',
    'Profil',
    'Toutes les cartes',
    'Développement',
    'À propos',
  ]);
  await expect(dialog.getByRole('button', { name: 'Défaussage rapide' })).toHaveAttribute('aria-current', 'page');
  await expect(dialog.getByRole('button', { name: 'Par défaut' })).toHaveCount(0);
  // Chaque onglet a son icône (Paquets : le puzzle de la navigation du site).
  await expect(dialog.locator('.wm-settings-tab > svg')).toHaveCount(11);
  await expect(dialog.getByRole('button', { name: 'Paquets' }).locator('svg path')).toHaveAttribute('d', /^M15\.39 4\.39/);
  // 960 × 620, colonne des catégories de 240 px.
  const panel = await dialog.boundingBox();
  expect([Math.round(panel?.width ?? 0), Math.round(panel?.height ?? 0)]).toEqual([960, 620]);
  expect(await dialog.locator('.wm-settings-nav').evaluate((nav) => nav.getBoundingClientRect().width)).toBe(240);

  await dialog.getByRole('button', { name: 'Paquets' }).click();
  await expect(dialog.locator('.wm-settings-heading')).toHaveText([
    'Apparence',
    'Son',
    'Défaussage rapide',
    'Enchère rapide',
    'Navigation au clavier',
  ]);
  await expect(dialog.getByRole('switch', { name: QUICK_DISCARD })).toBeVisible();
  await expect(dialog.getByRole('switch', { name: 'Enchère rapide : Afficher le bouton' })).toBeVisible();
  await expect(dialog).toContainText("Un bouton défausse la carte d'un clic. Dans le carrousel, il passe ensuite à la suivante.");

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('l’onglet « À propos » présente le script et sa version', async ({ page }) => {
  await openPulls(page);
  await page.locator(`${GEAR}:visible`).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });

  const tabs = dialog.locator('.wm-settings-tab');
  await expect(tabs.last()).toHaveText('À propos');
  await tabs.last().click();
  await expect(dialog).toContainText('WikiMasters ajoute au site des outils');
  await expect(dialog).toContainText('Version 0.1.0 (dev)');
  await expect(dialog.locator('.wm-modal-title')).toHaveText('Paramètres');
});

test('la fenêtre se rouvre sur le dernier onglet, même après un rechargement', async ({ page }) => {
  await openPulls(page);
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  const current = dialog.locator('.wm-settings-tab[aria-current="page"]');

  await openSettings(page, 'Collection');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator(`${GEAR}:visible`).click();
  await expect(current).toHaveText('Collection');

  await page.reload();
  await page.locator(`${GEAR}:visible`).click();
  await expect(current).toHaveText('Collection');

  // Onglet retenu qui n'existe plus : le premier.
  await page.evaluate(() => localStorage.setItem('wm-settings-tab-v1', JSON.stringify('Disparu')));
  await page.reload();
  await page.locator(`${GEAR}:visible`).click();
  await expect(current).toHaveText('Défaussage rapide');
});

test('désactiver une fonctionnalité la retire tout de suite et reste mémorisé', async ({ page }) => {
  await openPulls(page);
  await page.click('#open');
  await expect(page.locator('.wm-discard-next').first()).toBeVisible();

  await openSettings(page, 'Paquets');
  const toggle = page.getByRole('switch', { name: QUICK_DISCARD });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.wm-discard-next')).toHaveCount(0);
  expect(await stored(page)).toEqual({ features: { 'pulls-discard-next': false }, values: {} });

  await page.reload();
  await openSettings(page, 'Paquets');
  await expect(page.getByRole('switch', { name: QUICK_DISCARD })).toHaveAttribute('aria-checked', 'false');
});

test('un réglage numérique est borné et mémorisé', async ({ page }) => {
  await openPulls(page);
  await openSettings(page, 'Paquets');
  const field = page.getByRole('spinbutton', { name: 'Délai avant la carte suivante' });
  await expect(field).toHaveValue('600');

  await field.fill('99999');
  await field.press('Enter');
  await expect(field).toHaveValue('3000');
  expect(await stored(page)).toEqual({ features: {}, values: { 'pulls-discard-next': { delayMs: 3000 } } });

  await page.reload();
  await openSettings(page, 'Paquets');
  await expect(page.getByRole('spinbutton', { name: 'Délai avant la carte suivante' })).toHaveValue('3000');
});

test('le champ numérique se règle avec − et +, du pas du réglage, dans ses bornes', async ({ page }) => {
  await openPulls(page);
  await openSettings(page, 'Paquets');
  const field = page.getByRole('spinbutton', { name: 'Délai avant la carte suivante' });
  const minus = page.getByRole('button', { name: 'Diminuer : Délai avant la carte suivante' });
  const plus = page.getByRole('button', { name: 'Augmenter : Délai avant la carte suivante' });

  await plus.click();
  await expect(field).toHaveValue('700');
  await minus.click();
  await minus.click();
  await expect(field).toHaveValue('500');
  expect(await stored(page)).toEqual({ features: {}, values: { 'pulls-discard-next': { delayMs: 500 } } });

  await field.fill('0');
  await field.press('Enter');
  await expect(minus).toBeDisabled();
  await expect(plus).toBeEnabled();
  // Le champ de la mise du site (ses classes : pas de petites flèches du navigateur).
  await expect(field).toHaveClass(/\[appearance:textfield\]/);
});

test('défaussage rapide : protections seules dans sa catégorie, options dans Paquets et Modale de carte', async ({ page }) => {
  await openPulls(page);
  await page.locator(`${GEAR}:visible`).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });

  // Sa catégorie : une section sans interrupteur, les protections.
  await expect(dialog.locator('.wm-settings-section')).toHaveCount(1);
  await expect(dialog.getByRole('switch')).toHaveCount(2);
  await expect(dialog.getByRole('switch', { name: 'Protéger les cartes en favori' })).toBeVisible();
  await expect(dialog.getByRole('switch', { name: 'Protéger les cartes avec une étiquette' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Paquets' }).click();
  const pulls = dialog.locator('.wm-settings-section', { hasText: 'Défaussage rapide' });
  await expect(pulls.locator('.wm-settings-heading')).toHaveText('Défaussage rapide');
  await expect(pulls.locator('.wm-settings-main').getByRole('switch')).toHaveCount(1);
  await expect(pulls.locator('.wm-settings-main').getByRole('switch', { name: QUICK_DISCARD })).toBeVisible();
  await expect(pulls.locator('.wm-settings-rows').getByRole('spinbutton', { name: 'Délai avant la carte suivante' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Modale de carte' }).click();
  await expect(dialog.locator('.wm-settings-heading')).toHaveText(['Apparence', 'Défaussage', 'Défaussage rapide']);
  await expect(dialog.getByRole('switch', { name: "Apparence : Masquer l'attaque et la défense à droite de la carte" })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('switch', { name: 'Défaussage : Rester sur la carte après une défausse' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('switch', { name: 'Défaussage rapide : Utiliser le défaussage rapide' })).toBeVisible();

  // Les protections réglées avant le déplacement sont reprises.
  await page.evaluate(() => {
    localStorage.setItem('wm-settings-v1', JSON.stringify({ features: {}, values: { 'pulls-discard-next': { protectStarred: false } } }));
  });
  await page.reload();
  await openSettings(page, 'Défaussage rapide');
  await expect(page.getByRole('switch', { name: 'Protéger les cartes en favori' })).toHaveAttribute('aria-checked', 'false');
});

test('un réglage à choix : pastilles sous son libellé', async ({ page }) => {
  await openPulls(page);
  await page.locator(`${GEAR}:visible`).click();
  await page.getByRole('dialog', { name: 'Paramètres' }).getByRole('button', { name: 'Enchères' }).click();
  const choice = page.getByRole('radiogroup', { name: 'Durée par défaut' });
  const label = page.locator('.wm-settings-row-label', { hasText: 'Durée par défaut' });
  const [labelBox, choiceBox] = [await label.boundingBox(), await choice.boundingBox()];
  expect(choiceBox && labelBox && choiceBox.y > labelBox.y + labelBox.height).toBe(true);
  expect(choiceBox && labelBox && Math.abs(choiceBox.x - labelBox.x) < 1).toBe(true);
});
