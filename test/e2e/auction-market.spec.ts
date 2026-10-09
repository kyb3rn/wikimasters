import { expect, test, type Page } from '@playwright/test';
import { openSite, sitePage } from './support/site';

const AUCTION = '198816ca-4758-42ca-a1d3-800a37b0d850';

const DAY = 86_400_000;

const SALES = {
  wikipedia_title: 'Michael Mando',
  sales: [
    { id: 's1', final_price: 180, settled_at: new Date(Date.now() - DAY).toISOString(), rarity: 'UR' },
    { id: 's2', final_price: 210, settled_at: new Date(Date.now() - DAY / 2).toISOString(), rarity: 'UR' },
    { id: 's3', final_price: 90, settled_at: new Date(Date.now() - DAY / 3).toISOString(), rarity: 'SR' },
  ],
  recent: [],
};

const LISTING = {
  id: AUCTION,
  card_id: 'c-mando',
  snapshot_rarity: 'UR',
  card: { id: 'c-mando', wikipedia_title: 'Michael Mando', rarity: 'UR' },
};

/**
 * Comment le script connaît l'enchère : `request` (la page la demande, réponse vue passer), `state` (déjà dans l'état
 * de la page, sans requête : script démarré après elle, F5 ou injection tardive de Tampermonkey), `none` (ni l'un ni
 * l'autre).
 */
type Source = 'request' | 'state' | 'none';

/**
 * Page d'une enchère : le titre et le bouton « Vue du marché » (relevé du 30/09/2026), qui ouvre la vue du site (ici
 * `#site-market`).
 */
const auctionHtml = (source: Source) =>
  sitePage(
    '<div id="auction"></div>',
    `
  const render = (auction) => {
    const row = document.createElement('div');
    row.className = 'flex items-start gap-2';
    const title = document.createElement('h1'); title.textContent = auction.card.wikipedia_title;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'relative shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border';
    button.setAttribute('aria-label', 'Vue du marché');
    button.innerHTML = '<svg class="lucide lucide-chart-line size-[18px]" width="18" height="18"></svg>';
    button.onclick = () => {
      const view = document.createElement('div'); view.id = 'site-market'; view.textContent = 'Vue du marché du site';
      document.body.append(view);
    };
    row.append(title, button);
    document.getElementById('auction').append(row);
    return button;
  };
  const source = '${source}';
  if (source === 'request') {
    fetch('/api/marketplace/${AUCTION}').then((r) => r.json()).then(({ auction }) => render(auction));
  } else {
    const auction = ${JSON.stringify(LISTING)};
    const button = render(auction);
    if (source === 'state') kit.fiber(button, {}, kit.fiber(null, {}, null, { memoizedState: kit.hooks([[() => auction]])[0] }));
  }
  `,
  );

interface Server {
  sales: number;
  auctions: number;
  release: () => void;
  hold: boolean;
  /** Prochaine demande de l'enchère en échec. */
  failAuction: boolean;
}

async function openAuction(page: Page, server: Server, source: Source = 'request') {
  let waiting: (() => void)[] = [];
  // La requête peut arriver après `release` : elle ne doit plus être retenue.
  server.release = () => {
    server.hold = false;
    for (const go of waiting) go();
    waiting = [];
  };
  await openSite(page, `/marketplace/${AUCTION}`, {
    html: auctionHtml(source),
    api: { [`/api/marketplace/${AUCTION}`]: { auction: LISTING, bids: [] } },
    handle: async (route, url) => {
      if (url.pathname === `/api/marketplace/${AUCTION}`) {
        server.auctions++;
        if (!server.failAuction) return false;
        server.failAuction = false;
        await route.fulfill({ status: 500, json: { error: 'Erreur serveur' } });
        return true;
      }
      if (!url.pathname.endsWith('/sales')) return false;
      server.sales++;
      if (server.hold) await new Promise<void>((resolve) => waiting.push(resolve));
      await route.fulfill({ json: SALES });
      return true;
    },
  });
  const button = page.getByRole('button', { name: 'Vue du marché', exact: true });
  await expect(button).toBeVisible();
  return button;
}

const newServer = (): Server => ({ sales: 0, auctions: 0, release: () => {}, hold: false, failAuction: false });

test('« Vue du marché » ouvre notre historique des ventes, pas la vue du site ; roue pendant le chargement', async ({ page }) => {
  const server = { ...newServer(), hold: true };
  const button = await openAuction(page, server);
  // Moyen, plus grand que le petit carré du site (demande de l'utilisateur).
  await expect(button).toHaveClass(/wm-button-md/);
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button).toBeDisabled();
  server.release();

  const dialog = page.getByRole('dialog', { name: 'Michael Mando' });
  await expect(dialog).toBeVisible();
  // Rareté de l'exemplaire en vente : ses ventes par défaut.
  await expect(dialog.locator('h2 > span')).toHaveText('UR');
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#site-market')).toHaveCount(0);
  expect(server.sales).toBe(1);
});

test('compte non PRO : l’offre PRO, dans notre modale', async ({ page }) => {
  const server = newServer();
  const button = await openAuction(page, server);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('wikimasters:is-pro-changed', { detail: false })));
  await button.click();
  const offer = page.getByRole('dialog', { name: 'Vue du marché' });
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('Découvre l’historique des ventes de « Michael Mando »');
  await expect(page.locator('#site-market')).toHaveCount(0);
  expect(server.sales).toBe(0);
});

test('script démarré après la requête de l’enchère : la carte lue dans l’état de la page, jamais la vue du site', async ({ page }) => {
  const server = newServer();
  const button = await openAuction(page, server, 'state');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Michael Mando' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h2 > span')).toHaveText('UR');
  await expect(page.locator('#site-market')).toHaveCount(0);
  expect(server.auctions).toBe(0);
});

test('carte inconnue : l’enchère redemandée ; en échec, l’erreur seule, jamais la vue du site', async ({ page }) => {
  const server = { ...newServer(), failAuction: true };
  const button = await openAuction(page, server, 'none');
  await button.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Marché indisponible' })).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(page.locator('#site-market')).toHaveCount(0);
  expect(server.auctions).toBe(1);

  await button.click();
  await expect(page.getByRole('dialog', { name: 'Michael Mando' })).toBeVisible();
  await expect(page.locator('#site-market')).toHaveCount(0);
  expect(server.auctions).toBe(2);
});
