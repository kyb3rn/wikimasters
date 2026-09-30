import { expect, test, type Page, type Route } from '@playwright/test';
import { CAROUSEL, PACK, PULLS_HTML } from './support/pulls';
import { openSite, presetSettings } from './support/site';

// Le carrousel du site, sans « toutes les cartes d'un coup ».
test.beforeEach(({ page }) => presetSettings(page, CAROUSEL));

type Reply = { status: number; json: unknown };

/** Ouvre la modale de la première carte du paquet ; `discarded` : exemplaires défaussés par le site. */
async function openCard(page: Page, reply: (route: Route) => Promise<void> = (route) => route.fulfill({ json: { balance: 12661 } })) {
  const discarded: string[] = [];
  await openSite(page, '/pulls', {
    html: PULLS_HTML,
    api: { '/api/packs/open': PACK },
    handle: async (route, url) => {
      if (url.pathname.startsWith('/rest/v1/')) {
        await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 204, body: '' });
        return true;
      }
      const match = /^\/api\/user-cards\/([^/]+)\/discard$/.exec(url.pathname);
      if (!match?.[1]) return false;
      discarded.push(match[1]);
      await reply(route);
      return true;
    },
  });
  await page.click('#open');
  await page.locator('main [class*="glow-"]').click();
  return discarded;
}

const modal = (page: Page) => page.locator('#card-modal');
// Par son icône : en « Confirmer ? », son texte change.
const discardButton = (page: Page) => modal(page).locator('button:has(svg.lucide-trash-2)');
const confirmation = (page: Page) => page.locator('#discard-confirm');

/** Défaussée : la modale reste ouverte (réglage par défaut), carte marquée, sans confirmation. */
async function expectKept(page: Page) {
  await expect(modal(page).locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(confirmation(page)).toHaveCount(0);
  await expect(discardButton(page)).toBeDisabled();
}

test('« Défausser » défausse tout de suite, sans confirmation', async ({ page }) => {
  const discarded = await openCard(page);
  await discardButton(page).click();
  await expect(confirmation(page)).toBeHidden();
  await expect.poll(() => discarded).toEqual(['u1']);
  await expectKept(page);
  // Sur /pulls, la carte est marquée défaussée comme avec le bouton du paquet.
  await expect(page.locator('main .wm-stamp')).toHaveText('Défaussée');
});

/** Réponse de défausse retenue jusqu'à `release`. */
function held() {
  let release: (reply: Reply) => void = () => {};
  const ready = new Promise<Reply>((resolve) => (release = resolve));
  return { reply: async (route: Route) => route.fulfill(await ready), release };
}

/** Requête en cours : roue à la place de la corbeille, bouton désactivé, curseur « interdit ». */
async function expectBusy(page: Page) {
  await expect(discardButton(page)).toHaveClass(/wm-discard-busy/);
  await expect(discardButton(page)).toBeDisabled();
  await expect(discardButton(page)).toHaveCSS('cursor', 'not-allowed');
  await expect(discardButton(page)).toHaveCSS('opacity', '1');
}

test('pendant la défausse : roue à la place de la corbeille, bouton désactivé', async ({ page }) => {
  const { reply, release } = held();
  await openCard(page, reply);
  await discardButton(page).click();
  await expectBusy(page);
  await expect(confirmation(page)).toBeHidden();

  release({ status: 200, json: { balance: 12661 } });
  await expectKept(page);
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-busy/);
});

test('après « Confirmer ? » aussi : roue et bouton désactivé le temps de la requête', async ({ page }) => {
  const { reply, release } = held();
  await openCard(page, reply);
  await modal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await discardButton(page).click();
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-confirm-wait/);
  await discardButton(page).click();
  await expectBusy(page);
  await expect(discardButton(page)).toHaveAccessibleName(/^Défausser/);

  release({ status: 200, json: { balance: 12661 } });
  await expectKept(page);
});

test('sans défaussage rapide : roue sur « Défausser » de la confirmation du site et de la modale', async ({ page }) => {
  await presetSettings(page, { features: { 'card-modal-discard': false }, values: {} });
  const { reply, release } = held();
  await openCard(page, reply);
  await discardButton(page).click();
  const confirm = confirmation(page).getByRole('button', { name: /^(Défausser|…)$/ });
  await confirm.click();
  await expect(confirm).toHaveClass(/wm-discard-busy/);
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveCSS('cursor', 'not-allowed');
  await expectBusy(page);

  release({ status: 200, json: { balance: 12661 } });
  await expectKept(page);
});

test('sans réponse du site : la roue s’arrête, message en notification, la modale reste utilisable', async ({ page }) => {
  const discarded = await openCard(page, (route) => route.abort('failed'));
  await discardButton(page).click();
  await expect(page.getByRole('alert').filter({ hasText: "Le site n'a pas répondu (erreur réseau)." })).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-busy/);
  await expect(discardButton(page)).toBeEnabled();
  expect(discarded).toEqual(['u1']);
});

test('refus du site : message en notification, la modale de carte reste utilisable', async ({ page }) => {
  const discarded = await openCard(page, (route) => route.fulfill({ status: 409, json: { error: 'Exemplaire déjà défaussé' } }));
  await discardButton(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Exemplaire déjà défaussé' })).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-busy/);
  await expect(discardButton(page)).toBeEnabled();
  expect(discarded).toEqual(['u1']);

  await discardButton(page).click();
  await expect.poll(() => discarded).toEqual(['u1', 'u1']);
});

test('carte en favori : le bouton passe en « Confirmer ? », un second clic défausse', async ({ page }) => {
  const discarded = await openCard(page);
  await modal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await discardButton(page).click();

  // Pas de modale de confirmation : le bouton demande un second clic, d'abord inactif un court instant.
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  // Rouge plein des boutons (rouge 500 de Tailwind).
  await expect(discardButton(page)).toHaveCSS('background-color', 'oklch(0.637 0.237 25.331)');
  await expect(discardButton(page)).toHaveCSS('cursor', 'not-allowed');
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-confirm-wait/);
  await expect(confirmation(page)).toHaveCount(0);
  expect(discarded).toEqual([]);

  await discardButton(page).click();
  await expect.poll(() => discarded).toEqual(['u1']);
  await expectKept(page);
});

test('carte en favori : un double-clic ne défausse pas', async ({ page }) => {
  const discarded = await openCard(page);
  await modal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await discardButton(page).dblclick();
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-confirm-wait/);
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  expect(discarded).toEqual([]);
  await expect(confirmation(page)).toHaveCount(0);
});

test('sans second clic, le bouton redevient « Défausser »', async ({ page }) => {
  const discarded = await openCard(page);
  await modal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await discardButton(page).click();
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  // 0,75 s inactif puis 3,5 s actif.
  await page.waitForTimeout(3700);
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  await expect(discardButton(page)).toHaveAccessibleName(/^Défausser/, { timeout: 2000 });

  // Et tout recommence : un clic ne défausse toujours pas.
  await discardButton(page).click();
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  expect(discarded).toEqual([]);
});

test('carte avec une étiquette : second clic demandé ; étiquette retirée, plus de protection', async ({ page }) => {
  const discarded = await openCard(page);
  await modal(page).getByPlaceholder('Ajouter une étiquette…').fill('garder');
  await modal(page).getByPlaceholder('Ajouter une étiquette…').press('Enter');
  await discardButton(page).click();
  await expect(discardButton(page)).toHaveAccessibleName('Confirmer ?');
  expect(discarded).toEqual([]);

  await modal(page).getByRole('button', { name: "Retirer l'étiquette garder" }).click();
  await expect(discardButton(page)).not.toHaveClass(/wm-discard-confirm-wait/);
  await discardButton(page).click();
  await expect.poll(() => discarded).toEqual(['u1']);
  await expectKept(page);
});

test('protection des favoris désactivée : sans confirmation, même en favori', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'quick-discard': { protectStarred: false } } });
  const discarded = await openCard(page);
  await modal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await discardButton(page).click();
  await expect.poll(() => discarded).toEqual(['u1']);
  await expect(confirmation(page)).toHaveCount(0);
});

test('option désactivée : la confirmation du site revient', async ({ page }) => {
  await presetSettings(page, { features: { 'card-modal-discard': false }, values: {} });
  const discarded = await openCard(page);
  await discardButton(page).click();
  await expect(confirmation(page)).toBeVisible();
  expect(discarded).toEqual([]);
});
