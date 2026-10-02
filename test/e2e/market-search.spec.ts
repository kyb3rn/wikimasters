import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, FAKE_JWT, letTimePass, openSite, presetSettings, sitePage, SUPABASE } from './support/site';

/**
 * Marché réduit à ses onglets (capture du 29/09/2026) : rangée `border-b`, « Parcourir » choisi (`border-b-2`), son
 * contenu en frère suivant ; « Mes ventes » change l'onglet choisi et le contenu. Au chargement, le site lit son
 * profil à Supabase avec la session : le script la reprend.
 */
const HTML = sitePage(
  // Le faux site n'a pas Tailwind : lien en bloc, colonnes en flex, position et taille des faces, sans quoi une face remonterait sur
  // les filtres (marges fusionnées).
  `<style>@layer utilities { .relative { position: relative; } .overflow-hidden { overflow: hidden; }
    .block { display: block; } .flex { display: flex; } .flex-col { flex-direction: column; } .flex-wrap { flex-wrap: wrap; }
    [class*="glow-"] { width: 10rem; height: 14rem; } }</style>
  <div class="flex-1 p-4 md:p-6 space-y-6" id="page">
    <div><h1>Marché</h1></div>
    <div class="flex overflow-x-auto border-b border-[var(--color-border)]" id="bar">
      <button class="px-4 py-3 text-sm border-b-2 border-[var(--color-accent)]">Parcourir</button>
      <button class="px-4 py-3 text-sm">Mes ventes (0/5)</button>
    </div>
    <div id="content">Annonces du site</div>
  </div>`,
  `
  const [browse, sales] = document.querySelectorAll('#bar > button');
  const choose = (chosen, text) => {
    for (const tab of [browse, sales]) tab.classList.toggle('border-b-2', tab === chosen);
    document.getElementById('content').textContent = text;
  };
  browse.onclick = () => choose(browse, 'Annonces du site');
  sales.onclick = () => choose(sales, 'Mes ventes du site');
  fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', {
    headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' },
  });
  `,
);

const pad = (n: number) => String(n).padStart(2, '0');
/** Enchère n : fin à 12:n0 (microsecondes, comme Postgres), carte cn, vendue par s1 ou s2 ; la 3e est menée par moi. */
const auction = (n: number) => ({
  id: `a${pad(n)}`,
  card_id: `c${n}`,
  seller_id: n % 2 ? 's1' : 's2',
  end_at: `2099-10-01T12:${pad(n)}:00.123456+00:00`,
  created_at: '2026-10-01T10:00:00+00:00',
  base_amount: 100 + n,
  current_bid: n === 3 ? 250 : null,
  current_bidder_id: n === 3 ? 'u0' : null,
  snapshot_rarity: 'SR',
  snapshot_atk: 4000,
  snapshot_def: 3000,
  is_shiny: n === 2,
});

interface Server {
  readonly auctions: URL[];
  readonly prefer: (string | undefined)[];
}

async function openMarket(page: Page): Promise<Server> {
  const server: Server = { auctions: [], prefer: [] };
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url());
    const ids = (name: string) => /in\.\(([^)]*)\)/.exec(url.searchParams.get(name) ?? '')?.[1]?.split(',') ?? [];
    if (url.pathname === '/rest/v1/auctions') {
      server.auctions.push(url);
      server.prefer.push(route.request().headers()['prefer']);
      // Première page pleine (50), la suite en a 2.
      const rows = url.searchParams.has('and') && url.searchParams.get('and')?.includes('end_at.gt')
        ? [auction(51), auction(52)]
        : Array.from({ length: 50 }, (_, i) => auction(i + 1));
      return route.fulfill({ json: rows, headers: { date: new Date().toUTCString() } });
    }
    if (url.pathname === '/rest/v1/cards') {
      return route.fulfill({ json: ids('id').map((id) => ({ id, wikipedia_title: `Carte ${id.slice(1)}`, category: 'test', image_url: null, hide_image: false })) });
    }
    if (url.pathname === '/rest/v1/profiles' && url.searchParams.has('id') && url.searchParams.get('select') === 'id,username') {
      return route.fulfill({ json: ids('id').map((id) => ({ id, username: id === 's1' ? 'Alice' : 'Bob' })) });
    }
    return route.fulfill({ json: [] });
  });
  const session = page.waitForRequest((request) => request.url().includes('/rest/v1/profiles?select=is_pro'));
  await openSite(page, '/marketplace', { html: HTML });
  await session;
  return server;
}

const tab = (page: Page) => page.getByRole('button', { name: 'Recherche avancée' });
const tiles = (page: Page) => page.locator('.wm-msearch-tile');
const submit = (page: Page) => page.locator('.wm-msearch-submit');

/** Ouvre l'onglet et lance la recherche (rien ne part à l'ouverture). */
async function openTab(page: Page): Promise<void> {
  await tab(page).click();
  await submit(page).click();
}

test('l’onglet suit « Parcourir » ; ouvert, il cache le contenu du site ; sa recherche lit Supabase', async ({ page }) => {
  const server = await openMarket(page);
  await expect(tab(page)).toBeVisible();
  const labels = await page.locator('#bar button').allTextContents();
  expect(labels).toEqual(['Parcourir', 'Recherche avancée', 'Mes ventes (0/5)']);
  // Choisi d'office à l'arrivée sur le marché, sans requête.
  await expect(tab(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#content')).toBeHidden();
  expect(server.auctions).toHaveLength(0);

  await openTab(page);
  await expect(page.locator('#content')).toBeHidden();
  await expect(tiles(page)).toHaveCount(50);
  await expect(tiles(page).first()).toContainText('Carte 1');
  await expect(tiles(page).first()).toContainText('Vendu par Alice');
  await expect(tiles(page).nth(2)).toContainText('Vous menez');
  await expect(tiles(page).nth(2)).toContainText('Mise actuelle');
  await expect(tiles(page).first().locator('a').first()).toHaveAttribute('href', '/marketplace/a01');

  // Même habillage que les annonces du site : vendeur sur l'image (player-links), « Vendu par » caché.
  // Cadre du site réduit à l'appendice sous la carte (marketplace-tiles) : il commence 32 px avant le bas de la face.
  expect(await tiles(page).first().locator('a').first().evaluate((link) => getComputedStyle(link).marginTop)).toBe('192px');
  await expect(tiles(page).first().locator('.wm-auction-time-short')).toHaveText(/^\d+h$/);
  await expect(tiles(page).first().getByText('@Alice')).toBeAttached();
  await expect(tiles(page).first().locator('p', { hasText: 'Vendu par Alice' })).toBeHidden();
  // Au repos (compte à rebours qui tourne, une seconde au moins), la page n'est plus resynchronisée.
  await expectDomIdle(page, { quiet: 1500 });

  const first = server.auctions[0];
  expect(first?.searchParams.get('status')).toBe('eq.active');
  expect(first?.searchParams.get('order')).toBe('end_at.asc,id.asc');
  expect(first?.searchParams.get('limit')).toBe('50');
  expect(first?.searchParams.get('select')).not.toContain('*');
  expect(server.prefer[0]).toBeUndefined();

  // Un onglet du site rend son contenu.
  await page.getByRole('button', { name: 'Mes ventes (0/5)' }).click();
  await expect(page.locator('#content')).toHaveText('Mes ventes du site');
  await expect(page.locator('.wm-msearch')).toBeHidden();
  // Rouvert : même liste, sans nouvelle requête.
  await tab(page).click();
  await expect(tiles(page)).toHaveCount(50);
  expect(server.auctions).toHaveLength(1);
});

test('« Charger la suite » reprend après la dernière annonce ; un filtre de prix part à Entrée', async ({ page }) => {
  const server = await openMarket(page);
  await openTab(page);
  await expect(tiles(page)).toHaveCount(50);

  await page.getByRole('button', { name: 'Charger la suite' }).click();
  await expect(tiles(page)).toHaveCount(52);
  expect(server.auctions[1]?.searchParams.get('and')).toBe(
    '(or(end_at.gt."2099-10-01T12:50:00.123456+00:00",and(end_at.eq."2099-10-01T12:50:00.123456+00:00",id.gt."a50")))',
  );
  await expect(page.getByRole('button', { name: 'Charger la suite' })).toBeHidden();

  await page.getByRole('spinbutton', { name: 'Prix minimum' }).fill('200');
  await expect(page.locator('.wm-msearch-submit')).toHaveAttribute('data-status', 'search');
  await page.getByRole('spinbutton', { name: 'Prix minimum' }).press('Enter');
  await expect.poll(() => server.auctions.length).toBe(3);
  expect(server.auctions[2]?.searchParams.get('and')).toBe('(or(current_bid.gte.200,and(current_bid.is.null,base_amount.gte.200)))');
  await expect(page.locator('.wm-msearch-submit')).toHaveAttribute('data-status', 'reload');
});

test('la taille et l’espacement des cartes du marché valent aussi pour la recherche avancée', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'marketplace-card-display': { scale: 150, gap: 40 } } });
  await openMarket(page);
  await openTab(page);
  await expect(tiles(page)).toHaveCount(50);
  const grid = page.locator('.wm-msearch .wm-own-card-grid');
  expect(await grid.evaluate((element) => getComputedStyle(element).columnGap)).toBe('40px');
  expect(await tiles(page).first().evaluate((element) => getComputedStyle(element).zoom)).toBe('1.5');
});

test('mises et shiny en cases collées, enchères par requête en − / +, réinitialisation visible seulement si un filtre a changé', async ({ page }) => {
  const server = await openMarket(page);
  await openTab(page);
  await expect(tiles(page)).toHaveCount(50);
  const reset = page.getByRole('button', { name: 'Réinitialiser les filtres' });
  await expect(reset).toHaveCount(0);

  const bids = page.getByRole('group', { name: 'Mises' });
  await expect(bids.locator('.wm-case')).toHaveText(['Avec mise', 'Sans mise']);
  await bids.getByRole('button', { name: 'Avec mise' }).click();
  await expect(bids.getByRole('button', { name: 'Avec mise' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Shiny' }).getByRole('button', { name: 'Shiny', exact: true }).click();
  await page.getByRole('button', { name: 'Augmenter : Enchères par requête' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Enchères par requête' })).toHaveValue('100');
  await expect(reset).toBeVisible();

  await page.locator('.wm-msearch-submit').click();
  await expect.poll(() => server.auctions.length).toBe(2);
  const query = server.auctions[1];
  expect(query?.searchParams.getAll('current_bid')).toEqual(['not.is.null']);
  expect(query?.searchParams.get('is_shiny')).toBe('is.true');
  expect(query?.searchParams.get('limit')).toBe('100');

  // Les deux cases cochées : toutes les annonces.
  await bids.getByRole('button', { name: 'Sans mise' }).click();
  await page.locator('.wm-msearch-submit').click();
  await expect.poll(() => server.auctions.length).toBe(3);
  expect(server.auctions[2]?.searchParams.getAll('current_bid')).toEqual([]);

  await reset.click();
  await expect(reset).toHaveCount(0);
  await expect(bids.getByRole('button', { name: 'Avec mise' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('spinbutton', { name: 'Enchères par requête' })).toHaveValue('50');
});

test('rien ne part à l’ouverture de l’onglet ; les filtres sont retrouvés après un rechargement', async ({ page }) => {
  const server = await openMarket(page);
  await tab(page).click();
  await page.getByRole('spinbutton', { name: 'Prix minimum' }).fill('200');
  await page.getByRole('group', { name: 'Mises' }).getByRole('button', { name: 'Avec mise' }).click();
  await page.getByRole('group', { name: 'Raretés' }).getByRole('button', { name: 'UR' }).click();
  await expect(submit(page)).toHaveAttribute('data-status', 'search');
  expect(server.auctions).toHaveLength(0);
  await expect(tiles(page)).toHaveCount(0);

  await page.reload();
  await tab(page).click();
  await expect(page.getByRole('spinbutton', { name: 'Prix minimum' })).toHaveValue('200');
  await expect(page.getByRole('group', { name: 'Mises' }).getByRole('button', { name: 'Avec mise' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Raretés' }).getByRole('button', { name: 'UR' })).toHaveAttribute('aria-pressed', 'true');
  await letTimePass(page, 300);
  expect(server.auctions).toHaveLength(0);

  await submit(page).click();
  await expect.poll(() => server.auctions.length).toBe(1);
  expect(server.auctions[0]?.searchParams.get('snapshot_rarity')).toBe('in.(UR)');
});

test('l’image de la carte est cadrée comme chez le site : rognée au centre, portrait en gardant le haut, entière si transparente', async ({ page }) => {
  // Images servies par le faux site : paysage opaque, portrait opaque, paysage avec de la transparence.
  const png = (width: number, height: number, alpha: number) =>
    page.evaluate(
      ([w, h, a]) => {
        const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
        const context = canvas.getContext('2d')!;
        context.fillStyle = `rgba(200, 50, 50, ${a})`;
        context.fillRect(0, 0, w, h);
        return canvas.toDataURL('image/png');
      },
      [width, height, alpha] as const,
    );
  await openMarket(page);
  const images = { c1: await png(300, 200, 1), c2: await png(200, 300, 1), c3: await png(300, 200, 0.5) };
  await page.unroute(`${SUPABASE}/**`);
  const server = { auctions: 0 };
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/rest/v1/auctions') {
      server.auctions++;
      return route.fulfill({ json: [auction(1), auction(2), auction(3)].map((row) => ({ ...row, is_shiny: false })) });
    }
    if (url.pathname === '/rest/v1/cards') {
      return route.fulfill({
        json: Object.entries(images).map(([id, image_url]) => ({ id, wikipedia_title: id, category: '', image_url, hide_image: false })),
      });
    }
    return route.fulfill({ json: [] });
  });
  await submit(page).click();
  const image = (n: number) => tiles(page).nth(n - 1).locator(`img[alt="c${n}"]`);
  await expect(image(1)).toHaveClass('object-cover object-center');
  await expect(image(2)).toHaveClass('object-cover');
  await expect(image(2)).toHaveCSS('object-position', '50% 28%');
  await expect(image(3)).toHaveClass('object-contain object-center');
  await expect(image(3)).toHaveCSS('transform', 'matrix(0.9, 0, 0, 0.9, 0, 0)');
});

test('« Liste de souhaits » en bouton carré dans la ligne de la recherche, comme dans « Toutes les cartes »', async ({ page }) => {
  const server = await openMarket(page);
  const wishlist = page.locator('.wm-msearch-line').getByRole('button', { name: 'Liste de souhaits' });
  await expect(wishlist).toHaveClass(/wm-wishlist-toggle/);
  await expect(wishlist).toHaveAttribute('aria-pressed', 'false');
  await wishlist.click();
  await expect(wishlist).toHaveAttribute('aria-pressed', 'true');

  // Liste de souhaits vide (Supabase imité) : aucune enchère ne peut correspondre, pas de requête des enchères.
  await submit(page).click();
  await expect(page.getByText('Aucune enchère ne correspond à ces filtres.')).toBeVisible();
  expect(server.auctions).toHaveLength(0);
});

/** Réponses des enchères retenues jusqu'à `release()`. */
async function holdAuctions(page: Page) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  await page.route(`${SUPABASE}/rest/v1/auctions**`, async (route) => {
    await gate;
    await route.fallback();
  });
  return { release: () => release() };
}

test('pendant « Charger la suite », la recherche est désactivée', async ({ page }) => {
  await openMarket(page);
  await openTab(page);
  await expect(tiles(page)).toHaveCount(50);

  const held = await holdAuctions(page);
  const more = page.getByRole('button', { name: 'Charger la suite' });
  await more.click();
  await expect(more).toBeDisabled();
  await expect(more).toHaveAttribute('aria-busy', 'true');
  await expect(submit(page)).toBeDisabled();
  held.release();
  await expect(tiles(page)).toHaveCount(52);
  await expect(submit(page)).toBeEnabled();
});

test('recherche en échec : message à la place de la liste ; « Réessayer » tourne pendant le nouvel essai', async ({ page }) => {
  const server = await openMarket(page);
  let failing = true;
  await page.route(`${SUPABASE}/rest/v1/auctions**`, (route) =>
    failing ? route.fulfill({ status: 500, json: { message: 'panne' } }) : route.fallback(),
  );
  await openTab(page);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Supabase a refusé la recherche (panne).');

  failing = false;
  const held = await holdAuctions(page);
  const retry = alert.getByRole('button', { name: 'Réessayer' });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  held.release();
  await expect(tiles(page)).toHaveCount(50);
  await expect(alert).toHaveCount(0);
  expect(server.auctions).toHaveLength(1);
});

test('prix moyen aussi sous nos vignettes : chargé au clic, gain et cadre comme pour celles du site', async ({ page }) => {
  await openMarket(page);
  const requests: string[] = [];
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  await page.route('**/api/marketplace/cards/*/sales', (route) => {
    requests.push(new URL(route.request().url()).pathname);
    const sales = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, final_price: 500, settled_at: ago(10 - i), rarity: 'SR' }));
    return route.fulfill({ json: { wikipedia_title: 'Carte 1', sales, recent: [] } });
  });
  await openTab(page);
  const first = tiles(page).first();
  const button = first.locator('.wm-tile-price button');
  await expect(button).toHaveText('Charger le prix');

  await button.click();
  // Mise de départ 101 pour une moyenne de 500 en SR : gain estimé sur la carte.
  await expect(button).toHaveText(/^\d+\(7\)$/);
  await expect(first.locator('.wm-deal-ring')).toHaveCount(1);
  await expect(first.getByText(/^\+\d+$/)).toBeVisible();
  expect(requests).toEqual(['/api/marketplace/cards/c1/sales']);
  // Le clic n'a pas ouvert l'annonce.
  await expect(page).toHaveURL(/\/marketplace$/);
});
