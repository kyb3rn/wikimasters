import { expect, test, type Page } from '@playwright/test';
import { entry, faces, openCollection } from './support/collection';
import { expectDomIdle, hold, letTimePass, openSettings, presetSettings, rect, type Gated } from './support/site';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Ventes de « Tour Eiffel » (R) : 7 dernières à 100 de moyenne en R (9 en tout) ; une en L, hors de la moyenne. */
const SALES = {
  wikipedia_title: 'Tour Eiffel',
  sales: [
    { id: 's0', final_price: 900, settled_at: ago(40), rarity: 'R' },
    { id: 's1', final_price: 900, settled_at: ago(30), rarity: 'R' },
    ...[90, 110, 95, 105, 100, 99, 101].map((price, index) => ({ id: `s${index + 2}`, final_price: price, settled_at: ago(20 - index), rarity: 'R' })),
    { id: 'l1', final_price: 5000, settled_at: ago(1), rarity: 'L' },
  ],
  recent: [],
};

interface SalesServer extends Gated {
  readonly requests: string[];
}

/** Collection : « Tour Eiffel » (R, ventes ci-dessus) et « Vitamine B8 » (SR, jamais vendue). */
async function openPage(page: Page): Promise<SalesServer> {
  const server: SalesServer = { requests: [], gate: undefined };
  await openCollection(page, {
    list: () => [entry('u1', 'Tour Eiffel', 'R'), entry('u2', 'Vitamine B8', 'SR')],
    handle: async (route, url) => {
      const card = /^\/api\/marketplace\/cards\/([^/]+)\/sales$/.exec(url.pathname)?.[1];
      if (!card) return false;
      server.requests.push(card);
      await server.gate;
      await route.fulfill({ json: card === 'card-u1' ? SALES : { wikipedia_title: 'Vitamine B8', sales: [], recent: [] } });
      return true;
    },
  });
  return server;
}

const priceButton = (page: Page, index: number) => page.locator('#stage .relative.isolate.group').nth(index).locator('.wm-card-price button');

test('sous chaque carte : « Charger le prix » (ghost), rien demandé ; le clic charge (roue), puis la moyenne ; reclic : historique', async ({ page }) => {
  const server = await openPage(page);
  const button = priceButton(page, 0);
  await expect(button).toHaveText('Charger le prix');
  await expect(button).toHaveClass(/wm-ghost/);
  await expect(button).toHaveClass(/wm-button-xs/);
  await expect(priceButton(page, 1)).toHaveText('Charger le prix');
  await letTimePass(page, 300);
  expect(server.requests).toEqual([]);

  // Sous la carte, de sa largeur.
  const [faceBox, buttonBox] = [await rect(faces(page).first()), await rect(button)];
  expect(buttonBox.y).toBeGreaterThanOrEqual(faceBox.y + faceBox.height);
  expect(buttonBox.width).toBeCloseTo(faceBox.width, 0);

  const release = hold(server);
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button.locator('svg.wm-spin')).toBeVisible();
  release();
  // Moyenne des 7 dernières ventes en R et nombre de ventes en R ; la modale de la carte ne s'est pas ouverte.
  await expect(button).toHaveText('100(9)');
  await expect(button).toHaveClass(/wm-solid/);
  await expect(page.locator('#card-modal')).toHaveCount(0);
  expect(server.requests).toEqual(['card-u1']);

  await button.click();
  await expect(page.getByRole('dialog', { name: 'Tour Eiffel' })).toBeVisible();
  await expect(page.locator('#card-modal')).toHaveCount(0);
  expect(server.requests).toEqual(['card-u1']);
});

test('carte jamais vendue : « Aucune vente » ; le cache reste après un rechargement', async ({ page }) => {
  const server = await openPage(page);
  await priceButton(page, 1).click();
  await expect(priceButton(page, 1)).toHaveText('Aucune vente');
  await page.reload();
  await expect(priceButton(page, 1)).toHaveText('Aucune vente');
  await expect(priceButton(page, 0)).toHaveText('Charger le prix');
  expect(server.requests).toEqual(['card-u2']);
});

test('mode sélection : le calque (anneau, voile) reste sur la carte, pas sur le prix', async ({ page }) => {
  await openPage(page);
  const button = priceButton(page, 0);
  await expect(button).toBeVisible();
  // Calque du site, sur toute la case (classes Tailwind imitées dans leur couche, comme chez lui).
  const overlay = await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '@layer utilities { .absolute { position: absolute; } .inset-0 { inset: 0; } }';
    document.head.append(style);
    const layer = document.createElement('div');
    layer.className = 'pointer-events-none absolute inset-0 z-10 rounded-2xl';
    layer.id = 'overlay';
    document.querySelector('#stage .relative.isolate.group')?.append(layer);
    return layer.id;
  });
  const [layerBox, faceBox, buttonBox] = [await rect(page.locator(`#${overlay}`)), await rect(faces(page).first()), await rect(button)];
  expect(layerBox.y + layerBox.height).toBeCloseTo(faceBox.y + faceBox.height, 0);
  expect(layerBox.y + layerBox.height).toBeLessThan(buttonBox.y);
});

test('réglage : « Prix moyen » dans l’onglet Collection, actif par défaut ; coupé, plus de prix', async ({ page }) => {
  await openPage(page);
  await expect(priceButton(page, 0)).toBeVisible();
  const settings = await openSettings(page, 'Collection');
  const toggle = settings.getByRole('switch', { name: 'Prix moyen : Afficher le prix moyen des cartes' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(priceButton(page, 0)).toHaveCount(0);
  await toggle.click();
  await expect(priceButton(page, 0)).toHaveText('Charger le prix');
});

test('coupé d’avance : rien sous les cartes', async ({ page }) => {
  await presetSettings(page, { features: { 'collection-prices': false }, values: {} });
  await openPage(page);
  await expect(faces(page)).toHaveCount(2);
  await letTimePass(page, 300);
  await expect(page.locator('.wm-card-price')).toHaveCount(0);
});

test('au repos, la page ne bouge plus', async ({ page }) => {
  await openPage(page);
  await expect(priceButton(page, 1)).toBeVisible();
  await expectDomIdle(page);
});
