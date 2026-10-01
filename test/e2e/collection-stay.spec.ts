import { expect, test, type Page } from '@playwright/test';
import { entry, faces, openCollection as openFakeCollection, titles, type Entry } from './support/collection';

const modal = (page: Page) => page.locator('#card-modal');
const loads = (page: Page) => page.evaluate(() => (window as unknown as { __collection: { loads: number } }).__collection.loads);

/** Serveur imité : la page 0 perd les exemplaires défaussés ou mis en vente ; `requests` : listes et compteurs demandés. */
async function openCollection(page: Page, first: Entry[] = [entry('u1', 'Tour Eiffel'), entry('u2', 'Musée du Louvre', 'R'), entry('u3', 'Mont Blanc', 'SR')]) {
  let shown = [...first];
  const second = [entry('u9', 'Lyon')];
  const server = await openFakeCollection(page, {
    list: (params) => (params.get('page') === '0' ? shown : second),
    // Deux pages : la pagination s'affiche.
    total: 50 + second.length,
    noteList: (params) => `liste ${params.get('page')}`,
    noteStats: () => 'compteurs',
    handle: async (route, url) => {
      const discard = /^\/api\/user-cards\/([^/]+)\/discard$/.exec(url.pathname);
      if (discard) {
        shown = shown.filter((e) => e.id !== discard[1]);
        await route.fulfill({ json: { balance: 12661 } });
        return true;
      }
      if (url.pathname === '/api/marketplace' && route.request().method() === 'POST') {
        const { card_id } = JSON.parse(route.request().postData() ?? '{}') as { card_id: string };
        shown = shown.filter((e) => e.id !== card_id);
        await route.fulfill({ status: 201, json: { auction_id: 'a1b2c3d4-0000-4000-8000-000000000001' } });
        return true;
      }
      return false;
    },
  });
  await expect(faces(page)).toHaveCount(first.length);
  return server;
}

/** Défausse l'exemplaire affiché en `index` par sa modale, puis referme la modale (gardée par le script). */
async function discardAt(page: Page, index: number) {
  await faces(page).nth(index).click();
  await modal(page).getByRole('button', { name: /Défausser/ }).click();
  await expect.poll(() => loads(page)).toBe(2);
  await modal(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(modal(page)).toHaveCount(0);
}

test('après une défausse, la liste n’est pas rechargée : la carte reste, marquée « Défaussée »', async ({ page }) => {
  const server = await openCollection(page);
  await discardAt(page, 1);

  await expect(faces(page)).toHaveCount(3);
  await expect(faces(page).nth(1).locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(faces(page).nth(0).locator('.wm-stamp')).toHaveCount(0);
  await expect(faces(page).nth(2).locator('.wm-stamp')).toHaveCount(0);
  // Seul le chargement de la page a interrogé le site.
  expect([...server.requests].sort()).toEqual(['compteurs', 'liste 0']);
});

test('après une mise aux enchères : la carte reste, marquée « En vente »', async ({ page }) => {
  const server = await openCollection(page);
  await faces(page).nth(0).click();
  await modal(page).getByRole('button', { name: 'Vendre' }).click();
  await expect.poll(() => loads(page)).toBe(2);

  await expect(faces(page)).toHaveCount(3);
  await expect(faces(page).nth(0).locator('.wm-stamp')).toHaveText('En vente');
  expect([...server.requests].sort()).toEqual(['compteurs', 'liste 0']);
});

test('le chargement suivant de la liste vient du site : la carte défaussée n’y est plus', async ({ page }) => {
  const server = await openCollection(page);
  await discardAt(page, 1);

  await page.getByRole('button', { name: 'Page suivante' }).first().click();
  await expect(faces(page)).toHaveCount(1);
  await expect(page.locator('#stage .wm-stamp')).toHaveCount(0);
  await page.getByRole('button', { name: 'Page précédente' }).first().click();
  await expect(faces(page)).toHaveCount(2);
  await expect(titles(page)).toHaveText(['Tour Eiffel', 'Mont Blanc']);
  await expect(page.locator('#stage .wm-stamp')).toHaveCount(0);
  expect(server.requests.filter((request) => request.startsWith('liste'))).toEqual(['liste 0', 'liste 1', 'liste 0']);
});

test('la modale rouverte d’une carte défaussée est verrouillée', async ({ page }) => {
  await openCollection(page);
  await discardAt(page, 1);

  await faces(page).nth(1).click();
  await expect(modal(page).getByRole('button', { name: /Défausser/ })).toBeDisabled();
  await expect(modal(page).getByRole('button', { name: 'Vendre' })).toBeDisabled();
  await expect(modal(page).getByPlaceholder('Ajouter une étiquette…')).toBeDisabled();
  await expect(modal(page).locator('.wm-stamp')).toHaveText('Défaussée');
});

test('un exemplaire parmi plusieurs : « 1 défaussée »', async ({ page }) => {
  await openCollection(page, [entry('u1', 'Tour Eiffel', 'C', 3), entry('u2', 'Mont Blanc')]);
  await discardAt(page, 0);
  await expect(faces(page).nth(0).locator('.wm-stamp')).toHaveText('1 défaussée');
});
