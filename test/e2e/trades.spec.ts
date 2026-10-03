import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, hold, rect } from './support/site';
import { openTradeComposer, type TradeServer } from './support/trades';

const composer = (page: Page) => page.locator('div.fixed.inset-0.z-50 > div.max-w-5xl');
const line = (page: Page) => composer(page).locator('div.mb-4.flex-col > div.flex').first();
/** Moitié du résumé qui sert d'onglet, par son pseudo. */
const sideTab = (page: Page, name: string) => composer(page).getByRole('tab', { name: new RegExp(`^${name}`) });
const cardTitles = (page: Page) => composer(page).locator('#grid h3');
const lastRequest = (server: TradeServer, side: 'mine' | 'theirs') => new URLSearchParams(server.requests[side].at(-1) ?? '');

async function open(page: Page): Promise<TradeServer> {
  const server = await openTradeComposer(page);
  await expect(cardTitles(page)).toHaveText(['mine toutes p0']);
  return server;
}

test.describe("fenêtre d'échange : filtres", () => {
  test('cases de rareté, étiquette et liste de souhaits à la place des contrôles du site', async ({ page }) => {
    const server = await open(page);
    const row = line(page);
    await expect(row.locator('input[type="text"]')).toHaveAttribute('placeholder', 'Rechercher par nom ou description');
    await expect(row.locator(':scope > div.order-1')).toBeHidden();
    await expect(row.getByRole('group', { name: 'Raretés' }).getByRole('button')).toHaveCount(7);

    await row.getByRole('button', { name: 'SR', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR p0']);
    await expect(row.getByRole('button', { name: 'SR', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await row.getByRole('button', { name: 'R', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['mine R+SR p0']);
    await row.getByRole('button', { name: 'Décocher toutes les raretés' }).click();
    await expect(cardTitles(page)).toHaveText(['mine toutes p0']);

    const tags = row.getByRole('button', { name: 'Filtrer par étiquette' });
    await expect(tags).toHaveText('Toutes les étiquettes');
    await tags.click();
    await page.getByRole('option', { name: '#rouge (3)' }).click();
    await expect(cardTitles(page)).toHaveText(['mine toutes #t1 p0']);
    await expect(tags).toHaveText('#rouge (3)');

    const wishlist = row.getByRole('button', { name: 'Souhaits de aelonka' });
    await wishlist.click();
    await expect(cardTitles(page)).toHaveText(['mine toutes #t1 ♥ p0']);
    await expect(wishlist).toHaveAttribute('aria-pressed', 'true');
    expect(lastRequest(server, 'mine').get('wishlisted_by')).toBe('aelonka');
  });

  test('au repos, le script ne resynchronise plus la page (encart d’erreur affiché compris)', async ({ page }) => {
    const server = await open(page);
    server.fail.mine = 500;
    await line(page).getByRole('button', { name: 'SR', exact: true }).click();
    await expect(composer(page).getByRole('alert')).toBeVisible();
    await expectDomIdle(page);
  });

  test("Échap ferme la liste des étiquettes, pas la fenêtre d'échange", async ({ page }) => {
    await open(page);
    await line(page).getByRole('button', { name: 'Filtrer par étiquette' }).click();
    await expect(page.getByRole('listbox', { name: 'Filtrer par étiquette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox', { name: 'Filtrer par étiquette' })).toHaveCount(0);
    await expect(composer(page)).toBeVisible();
  });

  test("l'autre onglet a les mêmes contrôles, sur ses cartes", async ({ page }) => {
    const server = await open(page);
    await sideTab(page, 'aelonka').click();
    await line(page).getByRole('button', { name: 'UR', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['theirs UR p0']);
    await line(page).getByRole('button', { name: 'Mes souhaits' }).click();
    await expect(cardTitles(page)).toHaveText(['theirs UR ♥ p0']);
    expect(lastRequest(server, 'theirs').get('wishlisted_by_me')).toBe('1');
  });

  test('« Mes cartes » : « Sans étiquette », que le site n’a pas, ajoutée à ses requêtes (liste et compteurs)', async ({ page }) => {
    const server = await open(page);
    const row = line(page);
    const tags = row.getByRole('button', { name: 'Filtrer par étiquette' });
    await tags.click();
    await expect(page.getByRole('option')).toHaveText(['Toutes les étiquettes', 'Sans étiquette', '#rouge (3)']);
    await page.getByRole('option', { name: 'Sans étiquette' }).click();
    await expect(cardTitles(page)).toHaveText(['mine toutes #aucune p0']);
    await expect(tags).toHaveText('Sans étiquette');
    expect(server.requests.mine.at(-1)).toBe('sort=rarity&untagged=1&page=0&stats=0&owned_by=aelonka');
    expect(server.stats.at(-1)).toBe('sort=rarity&untagged=1');

    // Les autres filtres la gardent ; une étiquette la remplace, et inversement.
    await row.getByRole('button', { name: 'SR', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR #aucune p0']);
    await row.getByRole('button', { name: 'Souhaits de aelonka' }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR #aucune ♥ p0']);
    expect(server.stats.at(-1)).toBe('sort=rarity&rarity=SR&untagged=1&wishlisted_by=aelonka');
    await tags.click();
    await page.getByRole('option', { name: '#rouge (3)' }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR #t1 ♥ p0']);
    await tags.click();
    await page.getByRole('option', { name: 'Sans étiquette' }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR #aucune ♥ p0']);
    expect(lastRequest(server, 'mine').has('tag_id')).toBe(false);
    await tags.click();
    await page.getByRole('option', { name: 'Toutes les étiquettes' }).click();
    await expect(cardTitles(page)).toHaveText(['mine SR ♥ p0']);
    await expect(tags).toHaveText('Toutes les étiquettes');
  });

  test('« Sans étiquette » reste à « Mes cartes » d’un onglet à l’autre ; « Cartes de … » ne la propose pas', async ({ page }) => {
    const server = await open(page);
    await line(page).getByRole('button', { name: 'Filtrer par étiquette' }).click();
    await page.getByRole('option', { name: 'Sans étiquette' }).click();
    await expect(cardTitles(page)).toHaveText(['mine toutes #aucune p0']);

    await sideTab(page, 'aelonka').click();
    await line(page).getByRole('button', { name: 'Filtrer par étiquette' }).click();
    await expect(page.getByRole('option')).toHaveText(['Toutes les étiquettes', '#rouge (3)']);
    await page.keyboard.press('Escape');
    await line(page).getByRole('button', { name: 'UR', exact: true }).click();
    await expect(cardTitles(page)).toHaveText(['theirs UR p0']);
    expect(server.requests.theirs.filter((params) => params.includes('untagged'))).toEqual([]);

    await sideTab(page, 'Moi').click();
    await expect(line(page).getByRole('button', { name: 'Filtrer par étiquette' })).toHaveText('Sans étiquette');
    await expectDomIdle(page);
  });

  test('« Sans étiquette » sans réponse : erreur et « Réessayer », jamais toutes les cartes à la place', async ({ page }) => {
    const server = await open(page);
    server.fail.mine = 'network';
    await line(page).getByRole('button', { name: 'Filtrer par étiquette' }).click();
    await page.getByRole('option', { name: 'Sans étiquette' }).click();
    const alert = composer(page).getByRole('alert');
    await expect(alert).toContainText('Le chargement des cartes a échoué.');
    expect(server.requests.mine.slice(1)).toEqual(['sort=rarity&untagged=1&page=0&stats=0&owned_by=aelonka']);

    server.fail.mine = undefined;
    await alert.getByRole('button', { name: 'Réessayer' }).click();
    await expect(cardTitles(page)).toHaveText(['mine toutes #aucune p0']);
    await expect(alert).toHaveCount(0);
  });
});

test.describe("fenêtre d'échange : wikibidous", () => {
  test('« Ajouter des wikibidous » ouvre une fenêtre ; enregistré, le bouton devient « Modifier les wikibidous »', async ({ page }) => {
    await open(page);
    const add = composer(page).getByRole('button', { name: 'Ajouter des wikibidous' });
    await expect(line(page).getByRole('button', { name: 'Ajouter des WB' })).toBeHidden();
    await add.click();

    const dialog = page.getByRole('dialog', { name: 'Ajouter des wikibidous' });
    await expect(dialog).toContainText("Wikibidous que j'offre");
    await expect(dialog).toContainText('Solde : 250 wb');
    // Le champ du site, ouvert pour servir de moteur, reste caché.
    await expect(composer(page).locator('input[type="number"]')).toBeHidden();

    const amount = dialog.getByRole('spinbutton');
    await amount.fill('300');
    await expect(dialog).toContainText('Solde insuffisant : 250 wb');
    await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    await amount.fill('200');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#summary-mine')).toHaveText('Moi : 0 cartes · 200 wb');
    // Ligne à part en tête de l'onglet, au-dessus des filtres : montant de ce côté et bouton.
    const wbLine = composer(page).locator('.wm-trade-wb-line');
    await expect(wbLine).toContainText('Wikibidous offerts :200');
    expect(await wbLine.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe('1px');
    const [wbBox, filtersBox] = [await rect(wbLine), await rect(line(page))];
    expect(wbBox.y + wbBox.height).toBeLessThanOrEqual(filtersBox.y);
    await expect(composer(page).getByRole('button', { name: 'Modifier les wikibidous' })).toBeVisible();
    await expect(composer(page).locator('input[type="number"]')).toHaveCount(0);

    await composer(page).getByRole('button', { name: 'Modifier les wikibidous' }).click();
    const edit = page.getByRole('dialog', { name: 'Modifier les wikibidous' });
    await expect(edit.getByRole('spinbutton')).toHaveValue('200');
    await edit.getByRole('spinbutton').fill('0');
    await edit.getByRole('spinbutton').press('Enter');
    await expect(page.locator('#summary-mine')).toHaveText('Moi : 0 cartes');
    await expect(composer(page).getByRole('button', { name: 'Ajouter des wikibidous' })).toBeVisible();
  });

  test('Annuler referme la fenêtre et le champ du site sans rien changer', async ({ page }) => {
    await open(page);
    await composer(page).getByRole('button', { name: 'Ajouter des wikibidous' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter des wikibidous' });
    await dialog.getByRole('spinbutton').fill('100');
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#summary-mine')).toHaveText('Moi : 0 cartes');
    await expect(composer(page).locator('input[type="number"]')).toHaveCount(0);
    await expect(composer(page)).toBeVisible();
  });

  test("ce qu'on demande à l'ami n'est pas limité par le solde", async ({ page }) => {
    await open(page);
    await sideTab(page, 'aelonka').click();
    await composer(page).getByRole('button', { name: 'Ajouter des wikibidous' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter des wikibidous' });
    await expect(composer(page).locator('.wm-trade-wb-line')).toContainText('Wikibidous demandés :0');
    await expect(dialog).toContainText('Wikibidous demandés');
    await expect(dialog).not.toContainText('aelonka');
    await dialog.getByRole('spinbutton').fill('5000');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#summary-theirs')).toHaveText('aelonka : 0 cartes · 5000 wb');
  });
});

test.describe("fenêtre d'échange : erreur de chargement", () => {
  test('réponse en erreur : encart à la place de la grille, « Réessayer » recharge la même liste', async ({ page }) => {
    const server = await open(page);
    server.fail.mine = 500;
    await line(page).getByRole('button', { name: 'SR', exact: true }).click();

    const alert = composer(page).getByRole('alert');
    await expect(alert).toContainText('Le chargement des cartes a échoué.');
    await expect(composer(page).locator('p[role="status"]')).toBeHidden();
    await expect(composer(page).getByText('Aucune carte', { exact: true })).toBeHidden();

    server.fail.mine = undefined;
    const release = hold(server);
    const count = server.requests.mine.length;
    await alert.getByRole('button', { name: 'Réessayer' }).click();
    await expect(alert.getByRole('button', { name: 'Réessayer' })).toBeDisabled();
    await expect.poll(() => server.requests.mine.length).toBe(count + 1);
    release();
    await expect(cardTitles(page)).toHaveText(['mine SR p0']);
    await expect(alert).toHaveCount(0);
  });

  test('pas de réponse (le site ne montre rien) : encart aussi, grille périmée cachée', async ({ page }) => {
    const server = await open(page);
    server.fail.mine = 'network';
    await line(page).getByRole('button', { name: 'UR', exact: true }).click();
    const alert = composer(page).getByRole('alert');
    await expect(alert).toContainText('Le chargement des cartes a échoué.');
    await expect(cardTitles(page)).toBeHidden();

    server.fail.mine = undefined;
    await alert.getByRole('button', { name: 'Réessayer' }).click();
    await expect(cardTitles(page)).toHaveText(['mine UR p0']);
    await expect(alert).toHaveCount(0);
  });

  test("délai dépassé (504) : message de la recherche ; l'autre onglet n'est pas touché", async ({ page }) => {
    const server = await open(page);
    server.fail.mine = 504;
    await line(page).getByRole('button', { name: 'L', exact: true }).click();
    await expect(composer(page).getByRole('alert')).toContainText('La recherche a pris trop de temps.');
    await sideTab(page, 'aelonka').click();
    await expect(composer(page).getByRole('alert')).toHaveCount(0);
    await expect(cardTitles(page)).toHaveText(['theirs toutes p0']);
  });
});

test.describe("fenêtre d'échange : présentation", () => {
  test('le pseudo de l’ami dans le titre mène à son profil', async ({ page }) => {
    await open(page);
    const link = composer(page).locator('h2').getByRole('link', { name: 'aelonka' });
    await expect(link).toHaveAttribute('href', '/profile/aelonka');
    await expect(composer(page).locator('h2 > span[data-wm-hidden]')).toHaveText('aelonka');
  });

  test('résumé : pseudo (le sien à la place de « Moi ») au-dessus des cartes et wikibidous, chaque côté centré dans sa moitié', async ({ page }) => {
    // Joueur connecté retenu d'une visite précédente.
    await page.addInitScript(() => localStorage.setItem('wm-me-v1', JSON.stringify({ id: 'me', username: 'Vreeecht' })));
    await open(page);
    const sides = composer(page).locator('.wm-trade-sum-side');
    await expect(sides).toHaveCount(2);
    await expect(sides.locator('.wm-trade-sum-name')).toHaveText(['Vreeecht', 'aelonka']);
    await expect(sides.nth(0).locator('.wm-trade-sum-value')).toHaveText(['0', '0']);
    const [name, counts] = [await rect(sides.nth(0).locator('.wm-trade-sum-name')), await rect(sides.nth(0).locator('.wm-trade-sum-counts'))];
    expect(counts.y).toBeGreaterThanOrEqual(name.y + name.height);
    await expect(page.locator('#summary-mine')).toBeHidden();
    // Chaque moitié est un onglet : ceux du site sont cachés, la moitié affichée est soulignée.
    await expect(composer(page).getByRole('button', { name: 'Cartes de aelonka' })).toBeHidden();
    await expect(sideTab(page, 'Vreeecht')).toHaveAttribute('aria-selected', 'true');
    await sideTab(page, 'aelonka').click();
    await expect(sideTab(page, 'aelonka')).toHaveAttribute('aria-selected', 'true');
    await expect(sideTab(page, 'Vreeecht')).toHaveAttribute('aria-selected', 'false');
    await expect(cardTitles(page)).toHaveText(['theirs toutes p0']);
    await sideTab(page, 'Vreeecht').click();
    await expect(cardTitles(page)).toHaveText(['mine toutes p0']);

    await cardTitles(page).first().click();
    await expect(sides.nth(0).locator('.wm-trade-sum-value')).toHaveText(['1', '0']);
    // Un nombre non nul en accent (ici les cartes de mon côté seulement).
    await expect(sides.nth(0).locator('.wm-trade-sum-value[data-active]')).toHaveText(['1']);
    await expect(sides.nth(1).locator('.wm-trade-sum-value[data-active]')).toHaveCount(0);

    const frame = await rect(composer(page));
    const [left, right] = [await rect(sides.nth(0)), await rect(sides.nth(1))];
    const middle = frame.x + frame.width / 2;
    expect(left.x + left.width / 2).toBeLessThan(middle - 100);
    expect(right.x).toBeGreaterThan(middle + 20);
  });

  test('cartes choisies sous les filtres, séparées des autres, avec l’anneau et la case cochée de la Collection', async ({ page }) => {
    await open(page);
    await cardTitles(page).first().click();
    const selected = composer(page).locator('#selected-grid > button');
    await expect(selected).toHaveCount(1);
    await expect(composer(page).getByText('Sélectionnées (1)')).toBeHidden();
    const filters = await rect(line(page));
    const chosen = await rect(selected.first());
    expect(chosen.y).toBeGreaterThanOrEqual(filters.y + filters.height);

    await expect(selected.first().locator('.wm-trade-box')).toHaveClass(/bg-\[var\(--color-accent\)\]/);
    await expect(selected.first().locator('.wm-trade-veil')).toHaveClass(/ring-4/);
    await expect(selected.first().locator('#site-tint')).toBeHidden();

    // Comme dans la Collection : le voile (anneau) grandit avec la carte au survol, la case suit son coin.
    await expect(selected.first()).toHaveClass(/(^| )group( |$)/);
    await expect(selected.first().locator('.wm-trade-veil')).toHaveClass(/group-hover:scale-105/);
    await selected.first().hover();
    const box = selected.first().locator('.wm-trade-box');
    const size = await selected.first().evaluate((element) => ({ height: element.clientHeight, width: element.clientWidth }));
    await expect
      .poll(() => box.evaluate((element) => [parseFloat(getComputedStyle(element).top), parseFloat(getComputedStyle(element).right)]))
      .toEqual([expect.closeTo(6 * 1.05 - 0.025 * size.height, 0), expect.closeTo(6 * 1.05 - 0.025 * size.width, 0)]);

    // Le choix retiré, la case redevient vide dans la grille.
    await selected.first().click();
    await expect(selected).toHaveCount(0);
    await expect(composer(page).locator('#grid > button .wm-trade-box')).toHaveClass(/border-white\/70/);
  });
});
