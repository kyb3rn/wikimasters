import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, hold, letTimePass, openSettings, openSite, presetSettings, sitePage, type Gated } from './support/site';
import { putMarketRecords } from './support/market-db';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Ventes de « Vitamine B8 », chargées il y a `days` jours : en SR, 7 dernières à 100 de moyenne, dans les 20 heures
 * avant le chargement (9 en tout, les 2 plus anciennes à 900 il y a un mois) ; une en UR, hors de la moyenne.
 */
function salesOf(days = 0) {
  const ago = (hours: number) => new Date(Date.now() - days * DAY - hours * HOUR).toISOString();
  return [
    { id: 's0', final_price: 900, settled_at: ago(40 * 24), rarity: 'SR' },
    { id: 's1', final_price: 900, settled_at: ago(30 * 24), rarity: 'SR' },
    ...[90, 110, 95, 105, 100, 99, 101].map((price, index) => ({ id: `s${index + 2}`, final_price: price, settled_at: ago(20 - index), rarity: 'SR' })),
    { id: 'u1', final_price: 5000, settled_at: ago(1), rarity: 'UR' },
  ];
}

const SALES = { wikipedia_title: 'Vitamine B8', sales: salesOf(), recent: [] };

/** Face `sm` (capture du 29/09/2026), réduite. */
const FACE = '<div class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-sr relative rounded-2xl overflow-hidden"><h3>Carte</h3></div>';

/** Vignette d'annonce (capture du 29/09/2026). */
const tile = (id: string) =>
  `<div id="marketplace-auction-${id}"><a class="card-frame block p-3 w-[172px] md:w-[184px]" href="/marketplace/${id}">` +
  `<div class="flex flex-col items-center gap-2.5"><div class="overflow-hidden rounded-2xl">${FACE}</div>` +
  `<div class="w-full flex items-center justify-between gap-2 text-xs">` +
  `<div class="flex flex-col min-w-0"><span class="text-[10px] uppercase">Mise de départ</span><span class="font-semibold">?</span></div>` +
  `<div class="flex flex-col items-end"><span class="text-[10px] uppercase">Durée</span>` +
  `<span class="tabular-nums font-medium text-xs">1h 0m</span></div></div>` +
  `<p class="w-full text-[10px] truncate">Vendu par Conch</p></div></a></div>`;

/**
 * Annonces lues dans les props du composant de chaque vignette, enfant de la case, comme chez le site :
 * `listing(id, carte, mise, fin dans ms)`. a1 à 30 (revente estimée vers 92), a2 à 90 (rien à gagner), a3 à 10 mais
 * finie : même carte. a4 : une autre carte, jamais vendue.
 */
const HTML = sitePage(
  `<div class="flex flex-wrap justify-center gap-4 md:gap-5">${['a1', 'a2', 'a3', 'a4'].map(tile).join('')}</div>`,
  `window.opened = [];
  const listing = (id, cardId, title, amount, ms) => {
    const auction = {
      id, card_id: cardId, status: 'active', snapshot_rarity: 'SR', base_amount: amount, current_bid: null, effective_bid: amount,
      end_at: new Date(Date.now() + ms).toISOString(), card: { id: cardId, wikipedia_title: title, rarity: 'UR' },
    };
    document.getElementById('marketplace-auction-' + id)['__reactFiber$test'] = {
      memoizedProps: { id: 'marketplace-auction-' + id }, return: null,
      child: { memoizedProps: { auction, href: '/marketplace/' + id, owned: false }, return: null },
    };
  };
  listing('a1', 'c1', 'Vitamine B8', 30, 3600000);
  listing('a2', 'c1', 'Vitamine B8', 90, 3600000);
  listing('a3', 'c1', 'Vitamine B8', 10, -1000);
  listing('a4', 'c2', 'Tour Eiffel', 50, 3600000);
  // Un clic qui irait jusqu'au lien de l'annonce est compté (le site navigue sans recharger).
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/marketplace/"]');
    if (!link) return;
    event.preventDefault();
    window.opened.push(link.getAttribute('href'));
  });`,
);

interface SalesServer extends Gated {
  /** Demandes de ventes reçues, par carte. */
  readonly requests: string[];
  status: number;
}

async function openMarketplace(page: Page, server: SalesServer = newServer()): Promise<SalesServer> {
  await openSite(page, '/marketplace', {
    html: HTML,
    handle: async (route, url) => {
      const card = /^\/api\/marketplace\/cards\/([^/]+)\/sales$/.exec(url.pathname)?.[1];
      if (!card) return false;
      server.requests.push(card);
      await server.gate;
      await route.fulfill(
        server.status !== 200
          ? { status: server.status, json: { error: 'Erreur serveur' } }
          : { json: card === 'c1' ? SALES : { wikipedia_title: 'Tour Eiffel', sales: [], recent: [] } },
      );
      return true;
    },
  });
  return server;
}

const newServer = (): SalesServer => ({ requests: [], status: 200, gate: undefined });
const priceButton = (page: Page, id: string) => page.locator(`#marketplace-auction-${id} .wm-tile-price button`);
const badge = (page: Page, id: string) => page.locator(`#marketplace-auction-${id} .glow-sr > .wm-root > span`);
const ring = (page: Page, id: string) => page.locator(`#marketplace-auction-${id} .wm-deal-ring`);

/** Ventes de la carte `c1` déjà en cache, chargées il y a `days` jours. */
async function cacheSales(page: Page, days: number): Promise<void> {
  await putMarketRecords(page, 'sales', [{ id: 'c1', fetchedAt: Date.now() - days * DAY, title: 'Vitamine B8', sales: salesOf(days) }]);
}

/** Le cadre et le gain sont de la même couleur. */
async function expectSameColor(page: Page, id: string): Promise<void> {
  const color = await badge(page, id).evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(ring(page, id)).toHaveCSS('border-top-color', color);
}

test('rien en cache : « Charger le prix » (ghost), rien demandé ; le clic charge (roue), puis la moyenne, les bonnes affaires', async ({ page }) => {
  const server = await openMarketplace(page);
  const button = priceButton(page, 'a1');
  await expect(button).toHaveText('Charger le prix');
  await expect(button).toHaveClass(/wm-ghost/);
  await expect(button).toHaveClass(/wm-tone-accent/);
  await expect(button).toHaveClass(/wm-pill/);
  await letTimePass(page, 300);
  expect(server.requests).toEqual([]);
  await expect(badge(page, 'a1')).toHaveCount(0);

  const release = hold(server);
  await button.click();
  // Roue et bouton désactivé pendant la requête, sur toutes les annonces de la carte.
  await expect(button).toBeDisabled();
  await expect(button.locator('svg.wm-spin')).toBeVisible();
  await expect(priceButton(page, 'a2')).toBeDisabled();
  await expect(priceButton(page, 'a4')).toBeEnabled();
  release();

  // Revente estimée d'après les ventes en SR (rareté de l'exemplaire, pas de la carte) et nombre de ventes en SR.
  for (const id of ['a1', 'a2', 'a3']) {
    await expect(priceButton(page, id)).toHaveText(/^\d+\(9\)$/);
    await expect(priceButton(page, id)).toHaveClass(/wm-solid/);
  }
  await expect(priceButton(page, 'a1').locator('.wm-price-count')).toHaveText('(9)');
  await expect(priceButton(page, 'a4')).toHaveText('Charger le prix');
  expect(server.requests).toEqual(['c1']);
  // Le clic n'a pas ouvert l'annonce.
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([]);

  // a1 à 30 : gain estimé sur la carte, cadre de la même couleur autour de la vignette ; ventes récentes : trait plein.
  await expect(badge(page, 'a1')).toHaveText(/^\+\d+$/);
  await expectSameColor(page, 'a1');
  await expect(ring(page, 'a1')).toHaveCSS('border-top-style', 'solid');
  // Mise + gain = revente estimée, le montant du bouton.
  const shown = Number((await priceButton(page, 'a1').textContent())?.replace(/\(.*$/, ''));
  const gain = Number((await badge(page, 'a1').textContent())?.slice(1));
  expect(30 + gain).toBe(shown);
  // Détail de l'estimation au survol du prix, puis la moyenne des 7 dernières ventes.
  await expect(priceButton(page, 'a1')).toHaveAttribute(
    'title',
    /^Revente estimée : \d+ \(marché 100, .*\n.* : revente en ≈ \d+ h\nGain estimé : \+\d+ · intérêt : \+\d+\nMoyenne des 7 dernières ventes en SR \(9 ventes\)/,
  );
  // a2 à 90 : rien à gagner ; a3 à 10, mais finie : plus rien à acheter.
  await expect(badge(page, 'a2')).toHaveCount(0);
  await expect(ring(page, 'a2')).toHaveCount(0);
  await expect(badge(page, 'a3')).toHaveCount(0);
  await expect(ring(page, 'a3')).toHaveCount(0);

  // Ventes récentes : le clic ouvre l'historique des ventes, sans rien redemander.
  await priceButton(page, 'a1').click();
  await expect(page.getByRole('dialog', { name: 'Vitamine B8' })).toBeVisible();
  expect(server.requests).toEqual(['c1']);
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([]);
});

test('carte jamais vendue : « Aucune vente », sans bonne affaire ; le cache reste après un rechargement', async ({ page }) => {
  const server = await openMarketplace(page);
  await priceButton(page, 'a4').click();
  await expect(priceButton(page, 'a4')).toHaveText('Aucune vente');
  await expect(badge(page, 'a4')).toHaveCount(0);

  await page.reload();
  await expect(priceButton(page, 'a4')).toHaveText('Aucune vente');
  await expect(priceButton(page, 'a4')).toHaveClass(/wm-solid/);
  expect(server.requests).toEqual(['c2']);
});

test('ventes anciennes en cache : prix et bonnes affaires affichés, bouton en contour ; le clic les redemande', async ({ page }) => {
  const server = await openMarketplace(page);
  await expect(priceButton(page, 'a1')).toHaveText('Charger le prix');
  await cacheSales(page, 3);
  await page.reload();

  const button = priceButton(page, 'a1');
  await expect(button).toHaveText(/^\d+\(9\)$/);
  await expect(button).toHaveClass(/wm-button-wide/);
  await expect(button).not.toHaveClass(/wm-solid|wm-ghost/);
  await expect(button).toHaveAttribute('title', /\nMoyenne des 7 dernières ventes en SR \(9 ventes\), chargées il y a 3 j\. Clic : actualiser\.$/);
  // Le prix a pu bouger depuis : estimation peu sûre, cadre en tirets.
  await expect(button).toHaveAttribute('title', /peu sûre\)\n/);
  await expect(badge(page, 'a1')).toHaveText(/^\+\d+$/);
  await expect(ring(page, 'a1')).toHaveCSS('border-top-style', 'dashed');
  expect(server.requests).toEqual([]);

  await button.click();
  await expect(button).toHaveClass(/wm-solid/);
  expect(server.requests).toEqual(['c1']);
  await expect(page.getByRole('dialog', { name: 'Vitamine B8' })).toHaveCount(0);
});

test('échec du site : toast avec son message, le bouton reste à recharger', async ({ page }) => {
  const server = newServer();
  server.status = 500;
  await openMarketplace(page, server);
  await priceButton(page, 'a1').click();
  await expect(page.getByText('Prix non chargé')).toBeVisible();
  await expect(priceButton(page, 'a1')).toHaveText('Charger le prix');
  await expect(priceButton(page, 'a1')).toBeEnabled();
});

test('compte sans PRO : badge PRO du site, le clic ouvre son offre sans rien demander', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wm-pro-v1', 'false'));
  const server = await openMarketplace(page);
  const button = priceButton(page, 'a1');
  await expect(button.locator('.bg-violet-600')).toBeAttached();
  await button.click();
  await expect(page.getByRole('dialog', { name: 'Vue du marché' })).toBeVisible();
  expect(server.requests).toEqual([]);
});

test('réglages : cadre et gain chacun désactivables, grisés quand le prix moyen est éteint', async ({ page }) => {
  await openMarketplace(page);
  await cacheSales(page, 0);
  await page.reload();
  await expect(badge(page, 'a1')).toHaveText(/^\+\d+$/);
  await expect(ring(page, 'a1')).toHaveCount(1);

  const settings = await openSettings(page, 'Marché');
  const highlight = settings.getByRole('switch', { name: 'Colorer les bonnes affaires' });
  const discount = settings.getByRole('switch', { name: 'Afficher le gain estimé' });
  await highlight.click();
  await expect(ring(page, 'a1')).toHaveCount(0);
  await expect(badge(page, 'a1')).toHaveText(/^\+\d+$/);
  await discount.click();
  await expect(badge(page, 'a1')).toHaveCount(0);
  await highlight.click();
  await expect(ring(page, 'a1')).toHaveCount(1);

  await settings.getByRole('switch', { name: 'Prix moyen : Afficher le prix moyen des annonces' }).click();
  await expect(priceButton(page, 'a1')).toHaveCount(0);
  await expect(ring(page, 'a1')).toHaveCount(0);
  await expect(highlight).toBeDisabled();
  await expect(discount).toBeDisabled();
});

test('réglages coupés d’avance : ni cadre ni gain, le prix reste', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'marketplace-prices': { highlight: false, gain: false } } });
  await openMarketplace(page);
  await cacheSales(page, 0);
  await page.reload();
  await expect(priceButton(page, 'a1')).toHaveText(/^\d+\(9\)$/);
  await letTimePass(page, 300);
  await expect(badge(page, 'a1')).toHaveCount(0);
  await expect(ring(page, 'a1')).toHaveCount(0);
});

test('heure de slot chère : une carte qui met des heures à se revendre n’est plus une bonne affaire', async ({ page }) => {
  // Revente à 101 (haut de la fourchette) en 9 h environ (6 ventes par jour, 44 % à ce prix ou plus) :
  // 9 × 25 = 225 de slot, plus que les quelque 60 de gain.
  await presetSettings(page, { features: {}, values: { 'marketplace-prices': { slotHour: 25 } } });
  await openMarketplace(page);
  await cacheSales(page, 0);
  await page.reload();
  await expect(priceButton(page, 'a1')).toHaveAttribute('title', /intérêt : −\d+\n/);
  await expect(badge(page, 'a1')).toHaveCount(0);
  await expect(ring(page, 'a1')).toHaveCount(0);
});

test('au repos, la page ne bouge plus (prix, gain et cadre posés)', async ({ page }) => {
  await openMarketplace(page);
  await cacheSales(page, 0);
  await page.reload();
  await expect(badge(page, 'a1')).toHaveText(/^\+\d+$/);
  await expectDomIdle(page);
});
