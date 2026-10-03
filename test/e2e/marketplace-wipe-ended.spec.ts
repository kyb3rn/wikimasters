import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, FAKE_JWT, letTimePass, nextFrame, openSite, presetSettings, sitePage, SUPABASE } from './support/site';

/** Vignette d'annonce (capture du 29/09/2026), réduite. */
const tile = (id: string) =>
  `<div id="marketplace-auction-${id}"><a class="card-frame block p-3" href="/marketplace/${id}">` +
  `<div class="flex flex-col items-center gap-2.5"><div class="overflow-hidden rounded-2xl">` +
  `<div class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-r relative rounded-2xl overflow-hidden"><h3>Carte ${id}</h3></div></div>` +
  `<div class="w-full flex items-center justify-between gap-2 text-xs">` +
  `<div class="flex flex-col min-w-0"><span class="text-[10px] uppercase">Mise actuelle</span><span class="font-semibold">30</span></div>` +
  `<div class="flex flex-col items-end"><span class="text-[10px] uppercase">Durée</span><span class="tabular-nums text-xs">1h 0m</span></div></div>` +
  `<p class="w-full text-[10px] truncate">Vendu par Conch</p></div></a></div>`;

/**
 * Marché réduit à ses onglets (capture du 29/09/2026) : « Parcourir » choisi, « Mes ventes » le remplace (les mêmes
 * annonces, pour voir ce qui y reste affiché). Annonces dans les props du composant de chaque vignette, enfant de la
 * case : b1 en cours, b2 et b3 terminées (`window.ends`, fin dans n ms). `window.rerender()` redessine la grille avec de nouveaux nœuds, comme au
 * retour d'une annonce. Au chargement, le site lit son profil à Supabase avec la session : la recherche avancée la
 * reprend.
 */
const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6">
    <div><h1>Marché</h1><input id="field" type="search"></div>
    <div class="flex overflow-x-auto border-b" id="bar">
      <button class="px-4 py-3 text-sm border-b-2">Parcourir</button>
      <button class="px-4 py-3 text-sm">Mes ventes (0/5)</button>
    </div>
    <div class="flex flex-wrap" id="grid"></div>
  </div>`,
  `
  const ends = (window.ends = { b1: 3600000, b2: -1000, b3: -60000 });
  window.rerender = () => {
    const grid = document.getElementById('grid');
    grid.innerHTML = Object.keys(ends).map((id) => ${JSON.stringify(tile('ID'))}.replaceAll('ID', id)).join('');
    for (const [id, ms] of Object.entries(ends)) {
      const auction = { id, status: 'active', end_at: new Date(Date.now() + ms).toISOString() };
      document.getElementById('marketplace-auction-' + id)['__reactFiber$test'] = {
        memoizedProps: { id: 'marketplace-auction-' + id }, return: null,
        child: { memoizedProps: { auction, href: '/marketplace/' + id, owned: false }, return: null },
      };
    }
  };
  window.rerender();
  const tabs = [...document.querySelectorAll('#bar > button')];
  for (const tab of tabs) tab.onclick = () => { for (const other of tabs) other.classList.toggle('border-b-2', other === tab); };
  fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', {
    headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' },
  });
  `,
);

const siteTile = (page: Page, id: string) => page.locator(`#marketplace-auction-${id}`);

/** Parcourir, sans la recherche avancée (outil de dev, choisie d'office à l'arrivée). */
async function openBrowse(page: Page): Promise<void> {
  await presetSettings(page, { features: { 'market-search': false }, values: {} });
  await openSite(page, '/marketplace', { html: HTML });
  // « Terminée » affiché : les enchères finies se reconnaissent.
  await expect(siteTile(page, 'b2').locator('.wm-auction-time')).toHaveText('Terminée');
  await expect(siteTile(page, 'b3').locator('.wm-auction-time')).toHaveText('Terminée');
}

async function expectShown(page: Page, shown: readonly string[], hidden: readonly string[]): Promise<void> {
  for (const id of shown) await expect(siteTile(page, id)).toBeVisible();
  for (const id of hidden) await expect(siteTile(page, id)).toBeHidden();
}

test('Suppr retire de Parcourir les enchères terminées, encore affichées dans les autres onglets et retirées au retour', async ({ page }) => {
  await openBrowse(page);
  await expectShown(page, ['b1', 'b2', 'b3'], []);

  await page.keyboard.press('Delete');
  await expectShown(page, ['b1'], ['b2', 'b3']);
  await expectDomIdle(page);

  await page.getByRole('button', { name: 'Mes ventes (0/5)' }).click();
  await expectShown(page, ['b1', 'b2', 'b3'], []);
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await expectShown(page, ['b1'], ['b2', 'b3']);

  // Retour d'une annonce : le site remet sa liste, nouvelles vignettes comprises.
  await page.evaluate(() => (window as unknown as { rerender: () => void }).rerender());
  await expectShown(page, ['b1'], ['b2', 'b3']);
  await expectDomIdle(page);
});

test('D retire aussi les enchères terminées, majuscules verrouillées comprises', async ({ page }) => {
  await openBrowse(page);
  await page.keyboard.press('d');
  await expectShown(page, ['b1'], ['b2', 'b3']);

  await page.evaluate(() => {
    const ends = (window as unknown as { ends: Record<string, number> }).ends;
    ends['b4'] = -1000;
  });
  await page.evaluate(() => (window as unknown as { rerender: () => void }).rerender());
  await expect(siteTile(page, 'b4').locator('.wm-auction-time')).toHaveText('Terminée');
  // Majuscules verrouillées : la touche arrive en « D », sans Maj.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true })));
  await expectShown(page, ['b1'], ['b2', 'b3', 'b4']);
});

test('Suppr et D ne retirent rien pendant une saisie, avec une autre touche, ni dans un autre onglet', async ({ page }) => {
  await openBrowse(page);

  await page.locator('#field').focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('d');
  await expect(page.locator('#field')).toHaveValue('d');
  await page.locator('#field').blur();
  await page.keyboard.press('Shift+Delete');
  await page.keyboard.press('Control+Delete');
  await page.keyboard.press('Shift+D');
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Alt+d');
  await page.getByRole('button', { name: 'Mes ventes (0/5)' }).click();
  await nextFrame(page);
  await page.keyboard.press('Delete');
  await page.keyboard.press('d');
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await letTimePass(page, 200);
  await expectShown(page, ['b1', 'b2', 'b3'], []);
});

const pad = (n: number) => String(n).padStart(2, '0');
/** Enchère n de la recherche avancée : la 1re en cours, les 2e et 3e terminées (pas encore finalisées). */
const auction = (n: number) => ({
  id: `r${n}`,
  card_id: `c${n}`,
  seller_id: 's1',
  end_at: n === 1 ? '2099-10-01T12:00:00+00:00' : `2026-01-01T12:${pad(n)}:00+00:00`,
  created_at: '2026-01-01T10:00:00+00:00',
  base_amount: 100,
  current_bid: null,
  current_bidder_id: null,
  snapshot_rarity: 'SR',
  snapshot_atk: 4000,
  snapshot_def: 3000,
  is_shiny: false,
});

test('Suppr retire les enchères terminées de la recherche avancée, sans toucher à Parcourir caché dessous', async ({ page }) => {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url());
    const ids = (name: string) => /in\.\(([^)]*)\)/.exec(url.searchParams.get(name) ?? '')?.[1]?.split(',') ?? [];
    if (url.pathname === '/rest/v1/auctions') return route.fulfill({ json: [1, 2, 3].map(auction) });
    if (url.pathname === '/rest/v1/cards') {
      return route.fulfill({ json: ids('id').map((id) => ({ id, wikipedia_title: `Carte ${id}`, category: 'test', image_url: null, hide_image: false })) });
    }
    if (url.pathname === '/rest/v1/profiles' && url.searchParams.get('select') === 'id,username') {
      return route.fulfill({ json: ids('id').map((id) => ({ id, username: 'Alice' })) });
    }
    return route.fulfill({ json: [] });
  });
  const session = page.waitForRequest((request) => request.url().includes('/rest/v1/profiles?select=is_pro'));
  await openSite(page, '/marketplace', { html: HTML });
  await session;
  await expect(page.getByRole('button', { name: 'Recherche avancée' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.wm-msearch-submit').click();
  const own = (id: string) => page.locator(`.wm-msearch-tile:has(a[href="/marketplace/${id}"])`);
  await expect(page.locator('.wm-msearch-tile')).toHaveCount(3);
  await expect(own('r3').locator('.wm-auction-time')).toHaveText('Terminée');

  await page.keyboard.press('Delete');
  await expect(own('r2')).toBeHidden();
  await expect(own('r3')).toBeHidden();
  await expect(own('r1')).toBeVisible();
  await expectDomIdle(page);

  // Les enchères terminées de Parcourir n'étaient pas affichées : elles restent.
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await expectShown(page, ['b1', 'b2', 'b3'], []);
});
