import { expect, test, type Page } from '@playwright/test';
import { rarityBox } from './support/lists';
import { putMarketRecords } from './support/market-db';
import { openShell, type ShellOptions, type SupabaseReply } from './support/shell';
import { SITE_MODULES } from './support/site-modules';
import { chooseOption, expectDomIdle, hold, letTimePass, presetSettings, rect, type Gated } from './support/site';

const RESALE = '/collection?vue=revente';
/** Adresse de la page, à la fin de l'URL. */
const url = (path: string) => new RegExp(`${path.replace(/[?.]/g, (char) => `\\${char}`)}$`);

const nav = (page: Page) => page.locator('nav.w-64');
const resaleLink = (page: Page) => nav(page).locator(`a[href="${RESALE}"]`);
const siteLink = (page: Page, href: string) => nav(page).locator(`:scope > a[href="${href}"]`);
const ACTIVE = /bg-\[var\(--color-accent\)\]\/10/;
/** `display` calculé du point d'un lien (le faux site n'a pas Tailwind : point de taille nulle). */
const dotDisplay = (page: Page, href: string) =>
  nav(page).locator(`a[href="${href}"] .ml-auto`).evaluate((dot) => getComputedStyle(dot).display);

/** La Revente est une option, éteinte par défaut : allumée pour ces tests (sauf mention). */
test.beforeEach(async ({ page }) => {
  await presetSettings(page, { features: { resale: true }, values: {} });
});

/** État de chaque fonctionnalité (`wm.features`). */
async function states(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => Object.fromEntries((window.wm?.features?.list() ?? []).map((f) => [f.id, f.state])));
}

/** La Revente est affichée : notre page, la Collection du site cachée dessous, notre lien allumé. */
async function expectResale(page: Page): Promise<void> {
  await expect(page.locator('.wm-resale-page h1')).toHaveText('Revente');
  await expect(page.locator('#site-collection')).toBeHidden();
  await expect(resaleLink(page)).toHaveClass(ACTIVE);
  expect(await dotDisplay(page, RESALE)).toBe('block');
  // « Collection », que le site allume d'après le chemin, est éteint en CSS : sans son point.
  await expect(siteLink(page, '/collection')).toHaveClass(ACTIVE);
  expect(await dotDisplay(page, '/collection')).toBe('none');
}

/** La Collection du site est affichée, sans notre page. */
async function expectCollection(page: Page): Promise<void> {
  await expect(page.locator('#site-collection h1')).toBeVisible();
  await expect(page.locator('.wm-resale-page')).toHaveCount(0);
  await expect(resaleLink(page)).not.toHaveClass(ACTIVE);
  await expect(resaleLink(page).locator('.ml-auto')).toHaveCount(0);
  expect(await dotDisplay(page, '/collection')).toBe('block');
}

test('« Revente » est tout en haut du menu, au-dessus de « Paquets », séparé de la suite par un trait', async ({ page }) => {
  await openShell(page, '/pulls');
  await expect(resaleLink(page)).toHaveText('Revente');
  // Après la rangée du logo, puis le trait, puis « Paquets ».
  const order = await nav(page).evaluate((element) => {
    const items = [...element.querySelectorAll(':scope > div, :scope > a, :scope > .wm-root > *')];
    return items.map((item) => (item instanceof HTMLAnchorElement ? item.getAttribute('href') : item.className));
  });
  expect(order.slice(0, 4)).toEqual([
    'flex items-center justify-between gap-2 mb-8',
    RESALE,
    'border-t border-[var(--color-border)]',
    '/pulls',
  ]);
  await expect(resaleLink(page)).toHaveClass(/text-\[var\(--color-foreground\)\]\/60/);
  await expect(resaleLink(page).locator('svg')).toHaveCount(1);
  await expectDomIdle(page);
});

test('le lien ouvre la Revente sans recharger ; « Collection » et le retour arrière y ramènent', async ({ page }) => {
  await openShell(page, '/pulls');
  await page.evaluate(() => (window.__sameDocument = true));

  await resaleLink(page).click();
  await expect(page).toHaveURL(url(RESALE));
  await expectResale(page);

  await siteLink(page, '/collection').click();
  await expect(page).toHaveURL(url('/collection'));
  await expectCollection(page);

  await page.goBack();
  await expect(page).toHaveURL(url(RESALE));
  await expectResale(page);
  await page.goForward();
  await expectCollection(page);
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
});

test("en Revente, les fonctionnalités de la Collection ne tournent pas, la page du site charge sa liste comme d'habitude", async ({ page }) => {
  await openShell(page, '/collection');
  await expectCollection(page);
  expect(await states(page)).toMatchObject({ 'collection-search': 'mounted', 'collection-selection': 'mounted', resale: 'mounted' });

  const loads = await page.evaluate(() => window.__shell.collectionLoads);
  await resaleLink(page).click();
  await expectResale(page);
  expect(await states(page)).toMatchObject({
    'collection-search': 'idle',
    'collection-memory': 'idle',
    'collection-pagination': 'idle',
    'collection-selection': 'idle',
    'collection-selection-key': 'idle',
    'collection-prices': 'idle',
    'collection-stay': 'idle',
    resale: 'mounted',
  });
  expect(await page.evaluate(() => window.__shell.collectionLoads)).toBe(loads + 1);
});

test('la Revente se recharge (F5) telle quelle, et reste au repos', async ({ page }) => {
  await openShell(page, RESALE);
  await expectResale(page);
  await page.reload();
  await expectResale(page);
  await expectDomIdle(page);
});

test('rien dans le menu ni dans `<main>` avant que React les ait repris (hydratation)', async ({ page }) => {
  await openShell(page, RESALE, { hydrateLater: true });
  await letTimePass(page, 300);
  await expect(resaleLink(page)).toHaveCount(0);
  await expect(page.locator('.wm-resale-page')).toHaveCount(0);
  // Déjà cachée (CSS posé dès le chargement) : rien de la Collection ne se voit en attendant.
  await expect(page.locator('#site-collection')).toBeHidden();

  await page.evaluate(() => window.__hydrate());
  await expectResale(page);
});

test('éteinte, ni lien ni page', async ({ page }) => {
  await presetSettings(page, { features: { resale: false }, values: {} });
  await openShell(page, RESALE);
  await expect(page.locator('#site-collection h1')).toBeVisible();
  await expect(resaleLink(page)).toHaveCount(0);
  await expect(page.locator('.wm-resale-page')).toHaveCount(0);
  expect(await states(page)).toMatchObject({ resale: 'off' });
});

test('Ctrl, Maj ou clic du milieu sur le lien sont laissés au navigateur', async ({ page }) => {
  await openShell(page, '/pulls');
  // Après notre code, le clic est annulé : l'onglet ouvert irait au vrai site.
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      window.__prevented = event.defaultPrevented;
      event.preventDefault();
    });
  });
  await resaleLink(page).click({ modifiers: ['Control'] });
  expect(await page.evaluate(() => window.__prevented)).toBe(false);
  await expect(page).toHaveURL(url('/pulls'));
});

// --- Étape 2 : cartes à vendre ---

/** Exemplaire sans étiquette, comme le rend `user_cards` (carte jointe). */
function copyRow(id: string, title: string, rarity: string, day: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    card_id: `card-${id}`,
    starred: false,
    is_shiny: false,
    obtained_at: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000000+00:00`,
    snapshot_rarity: rarity,
    snapshot_atk: 100,
    snapshot_def: 200,
    card: { wikipedia_title: title, category: 'Monument', image_url: null, hide_image: false, rarity, atk: 100, def: 200 },
    user_card_tags: [],
    ...extra,
  };
}

/** Ventes en cache d'une carte (base `wm-market`), récentes. */
const sales = (cardId: string, rarity: string, amounts: readonly number[]) => ({
  id: cardId,
  fetchedAt: Date.now(),
  title: cardId,
  sales: amounts.map((price, i) => ({ id: `${cardId}-${i}`, final_price: price, settled_at: `2026-10-0${i + 1}T00:00:00.000Z`, rarity })),
});

/** Supabase imité : les exemplaires sans étiquette (`rows`), lectures notées, réponses retenues par `hold`. */
function copiesServer(rows: () => readonly object[]) {
  const server: Gated & { reads: URL[]; fail: number } = { gate: undefined, reads: [], fail: 0 };
  const supabase: ShellOptions['supabase'] = async (url): Promise<SupabaseReply | undefined> => {
    if (url.pathname !== '/rest/v1/user_cards') return undefined;
    server.reads.push(url);
    await server.gate;
    if (server.fail > 0) {
      server.fail--;
      return { status: 500, json: { message: 'boum' } };
    }
    return { json: rows() };
  };
  return { server, supabase };
}

const titles = (page: Page) => page.locator('.wm-resale-page h3').allTextContents();
const prices = (page: Page) => page.locator('.wm-resale-page .wm-resale-price').allTextContents();
const submit = (page: Page) => page.locator('.wm-resale-submit');

const THREE = [copyRow('a', 'Tour Eiffel', 'R', 1), copyRow('b', 'Élysée', 'SR', 2), copyRow('c', 'Zèbre', 'C', 3)];

/** Paquets, ventes en cache posées, puis la Revente par son lien. */
async function openResale(page: Page, options: ShellOptions, cache: readonly object[] = []): Promise<void> {
  await openShell(page, '/pulls', options);
  if (cache.length > 0) await putMarketRecords(page, 'sales', cache);
  await resaleLink(page).click();
}

test('lit les cartes sans étiquette à l’arrivée : triées par prix, puis sans prix, la plus récente d’abord', async ({ page }) => {
  const { server, supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase }, [sales('card-a', 'R', [100, 200]), sales('card-b', 'SR', [500]), sales('card-c', 'R', [999])]);

  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  // Moyenne des ventes de la rareté de l'exemplaire (aucune vente en C pour « Zèbre »).
  expect(await prices(page)).toEqual(['500(1)', '150(2)', 'Aucune vente']);
  await expect(page.locator('.wm-resale-page h1').locator('..')).toContainText('3 cartes · 3 sans prix souhaité');
  const [read] = server.reads;
  expect(read?.searchParams.get('user_card_tags')).toBe('is.null');
  expect(read?.searchParams.get('user_id')).toBe('eq.u0');
  await expectDomIdle(page);
});

test('recherche à Entrée ou au bouton, sans accents ; raretés et tri attendent le lancement', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toEqual(['Zèbre', 'Élysée', 'Tour Eiffel']);
  await expect(submit(page)).toHaveAttribute('data-status', 'reload');

  const field = page.getByRole('textbox', { name: 'Rechercher' });
  await field.fill('ELYS');
  await expect(submit(page)).toHaveAttribute('data-status', 'search');
  expect(await titles(page)).toHaveLength(3);
  await field.press('Enter');
  await expect.poll(() => titles(page)).toEqual(['Élysée']);
  await expect(submit(page)).toHaveAttribute('data-status', 'reload');

  await field.fill('');
  await rarityBox(page, 'R').click();
  await rarityBox(page, 'C').click();
  await chooseOption(page, 'Trier les cartes', 'Nom');
  await letTimePass(page, 300);
  expect(await titles(page)).toEqual(['Élysée']);
  await submit(page).click();
  await expect.poll(() => titles(page)).toEqual(['Tour Eiffel', 'Zèbre']);
});

test('« Empêcher le rechargement automatique » coupé : la liste suit la frappe et chaque choix', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { resale: { holdSearch: false } } });
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toHaveLength(3);
  await page.getByRole('textbox', { name: 'Rechercher' }).fill('tour');
  await expect.poll(() => titles(page)).toEqual(['Tour Eiffel']);
  await expect(submit(page)).toHaveAttribute('data-status', 'reload');
});

test('50 cartes par page, pagination en haut et en bas', async ({ page }) => {
  const rows = Array.from({ length: 120 }, (_, i) => copyRow(`n${i}`, `Carte ${String(i).padStart(3, '0')}`, 'C', 1 + (i % 28)));
  const { supabase } = copiesServer(() => rows);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toHaveLength(50);
  const bars = page.locator('.wm-resale-page nav[aria-label="Pagination"]');
  await expect(bars).toHaveCount(2);
  await bars.first().getByRole('button', { name: 'Dernière page' }).click();
  await expect.poll(() => titles(page)).toHaveLength(20);
});

test('rechargement : nouvelle lecture, roue et bouton désactivé pendant la requête ; échec en toast, liste gardée', async ({ page }) => {
  const { server, supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toHaveLength(3);

  const release = hold(server);
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
  server.fail = 1;
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'Revente' })).toBeVisible();
  expect(await titles(page)).toHaveLength(3);
  await expect(submit(page)).toBeEnabled();
  expect(server.reads).toHaveLength(2);
});

test('première lecture en échec : message et « Réessayer »', async ({ page }) => {
  const { server, supabase } = copiesServer(() => THREE);
  server.fail = 1;
  await openResale(page, { supabase });
  await expect(page.locator('.wm-resale-page [role="alert"]')).toContainText('erreur 500');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect.poll(() => titles(page)).toHaveLength(3);
});

test('filtres retenus d’une visite à l’autre (tri, raretés, recherche)', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toHaveLength(3);
  await chooseOption(page, 'Trier les cartes', 'Nom');
  await submit(page).click();
  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  await page.reload();
  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  await expect(page.getByRole('button', { name: 'Trier les cartes' })).toHaveText(/Nom/);
});

// --- Étape 3 : prix souhaité ---

const titleGroup = (page: Page) => page.locator('.wm-resale-page h1').locator('..');

test('prix souhaité : bouton mauve à gauche du prix moyen, fenêtre, total, et le tri le prend au lancement suivant', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase }, [sales('card-a', 'R', [100, 200]), sales('card-b', 'SR', [500])]);
  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  await expect(titleGroup(page)).toContainText('3 cartes · 3 sans prix souhaité');

  // Sans prix : rond mauve ghost, crayon seul, à gauche du prix moyen.
  const zebre = page.locator('.wm-resale-page [data-copy="c"]');
  const wished = zebre.locator('.wm-resale-wished button');
  await expect(wished).toHaveClass(/wm-button-round wm-button-xs wm-tone-violet wm-ghost/);
  expect((await rect(wished)).x).toBeLessThan((await rect(zebre.locator('.wm-resale-price'))).x);

  await wished.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Zèbre');
  await expect(dialog).toContainText('Aucune vente en cache dans cette rareté.');
  const field = dialog.getByRole('textbox', { name: 'Prix souhaité' });
  await expect(field).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await field.fill('1 500');
  await field.press('Enter');
  await expect(dialog).toHaveCount(0);

  await expect(wished).toHaveText('1 500');
  await expect(wished).toHaveClass(/wm-tone-violet wm-solid/);
  await expect(titleGroup(page)).toContainText('1 500');
  await expect(titleGroup(page)).toContainText('3 cartes · 2 sans prix souhaité');
  // L'ordre ne bouge qu'au lancement suivant.
  expect(await titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  await submit(page).click();
  await expect.poll(() => titles(page)).toEqual(['Zèbre', 'Élysée', 'Tour Eiffel']);

  // Gardé d'une visite à l'autre.
  await page.reload();
  await expect(page.locator('.wm-resale-page [data-copy="c"] .wm-resale-wished button')).toHaveText('1 500');
  await expectDomIdle(page);
});

test('fenêtre du prix souhaité : repère des ventes, − et + de 10, Annuler sans rien changer, Retirer', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase }, [sales('card-b', 'SR', [500, 300])]);
  const elysee = page.locator('.wm-resale-page [data-copy="b"] .wm-resale-wished button');
  await elysee.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Moyenne des 7 dernières ventes : 400 wb');
  await dialog.getByRole('button', { name: 'Augmenter' }).click();
  await dialog.getByRole('button', { name: 'Augmenter' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Prix souhaité' })).toHaveValue('20');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(elysee).toHaveAttribute('aria-label', 'Fixer le prix souhaité');

  await elysee.click();
  await expect(dialog.getByRole('button', { name: 'Retirer' })).toHaveCount(0);
  await dialog.getByRole('textbox', { name: 'Prix souhaité' }).fill('450');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(elysee).toHaveText('450');
  await elysee.click();
  await expect(dialog.getByRole('textbox', { name: 'Prix souhaité' })).toHaveValue('450');
  await dialog.getByRole('button', { name: 'Retirer' }).click();
  await expect(elysee).toHaveAttribute('aria-label', 'Fixer le prix souhaité');
  await expect(titleGroup(page)).toContainText('3 sans prix souhaité');
});

test('prix souhaité par rareté de l’exemplaire : la L shiny a le sien', async ({ page }) => {
  const rows = [copyRow('l', 'Olympique lyonnais', 'L', 1), copyRow('s', 'Olympique lyonnais', 'L', 2, { is_shiny: true, card_id: 'card-l' })];
  const { supabase } = copiesServer(() => rows);
  await openResale(page, { supabase });
  await expect.poll(() => titles(page)).toHaveLength(2);
  await page.locator('.wm-resale-page [data-copy="l"] .wm-resale-wished button').click();
  await page.getByRole('textbox', { name: 'Prix souhaité' }).fill('5000');
  await page.getByRole('textbox', { name: 'Prix souhaité' }).press('Enter');
  await expect(page.locator('.wm-resale-page [data-copy="l"] .wm-resale-wished button')).toHaveText('5 000');
  await expect(page.locator('.wm-resale-page [data-copy="s"] .wm-resale-wished button')).toHaveAttribute('aria-label', 'Fixer le prix souhaité');
});

// --- Étape 5 : modale de carte du site, tampons après une action ---

/**
 * Modale de carte du site imitée (module 515678, inscrit dans le registre de Turbopack de la page) : mêmes paramètres
 * que la sienne ; « Mettre aux enchères » envoie directement la mise en vente, « Défausser » la défausse (puis
 * `onCollectionChange` et `onClose`, comme le site), l'étoile appelle `onToggleStar`, « Ajouter #keep » `onTagsChange`.
 * Props reçues dans `window.cardModalProps`.
 */
const CARD_MODAL_MODULE = `${SITE_MODULES}
TURBOPACK.push(['static/chunks/collection.js', 515678, (e, m, exports) => {
  exports.default = function ({card:c,starred:s,count:n,onClose:o,onToggleStar:t,userCardId:u,tags:g=[],tagsCatalog:k,tagsReadOnly:r,onTagsChange:p,friendUsername:f,friendProfileId:fi,friendOfferPending:fo,ownOfferPending:op,onCollectionChange:cc}) {
    window.cardModalProps = { card: c, starred: s, count: n, userCardId: u, tags: g, ownOfferPending: op };
    const root = document.createElement('div');
    root.id = 'site-card-modal';
    root.innerHTML = '<h2>' + c.wikipedia_title + '</h2><p>Exemplaires : ' + n + '</p>' +
      '<button id="m-star">' + (s ? 'Retirer des favoris' : 'Ajouter aux favoris') + '</button>' +
      '<p id="m-tags">' + g.map((tag) => tag.name).join(' ') + '</p><button id="m-tag">Ajouter #keep</button>' +
      (n > 0 && !op ? '<button id="m-sell">Mettre aux enchères</button><button id="m-discard">Défausser</button>' : '') +
      '<button id="m-close">Fermer</button>';
    root.querySelector('#m-star').onclick = () => t();
    root.querySelector('#m-tag').onclick = () => p([...g, { id: 't1', name: 'keep', color: '#ffffff' }]);
    root.querySelector('#m-close').onclick = () => o();
    const sell = root.querySelector('#m-sell');
    if (sell) sell.onclick = () => fetch('/api/marketplace', { method: 'POST', body: JSON.stringify({ card_id: u, base_amount: 10, duration_minutes: 60 }) });
    const discard = root.querySelector('#m-discard');
    if (discard) discard.onclick = async () => {
      const response = await fetch('/api/user-cards/' + u + '/discard', { method: 'POST' });
      if (response.ok) { cc?.(); o(); }
    };
    return root;
  };
}]);`;

interface CardModalSeen {
  readonly card: Record<string, unknown>;
  readonly starred: boolean;
  readonly count: number;
  readonly userCardId: string;
  readonly tags: unknown[];
  readonly ownOfferPending: boolean;
}

/** Revente avec la modale du site imitée, la défausse et la mise en vente acceptées ; requêtes PATCH notées. */
async function openWithModal(page: Page, rows: () => readonly object[] = () => THREE) {
  const { server, supabase } = copiesServer(rows);
  const patches: { url: URL; body: unknown }[] = [];
  await openResale(page, {
    modules: CARD_MODAL_MODULE,
    // `POST` : l'enchère créée ; `GET` (`mine=1`) : aucune vente en cours.
    api: { '/api/marketplace': { auction_id: 'a1', selling: [] } },
    handle: async (route, url) => {
      if (!/^\/api\/user-cards\/[^/]+\/discard$/.test(url.pathname)) return false;
      await route.fulfill({ json: { balance: 13 } });
      return true;
    },
    supabase: (url, request) => {
      if (request.method() !== 'PATCH') return supabase?.(url, request);
      patches.push({ url, body: request.postDataJSON() as unknown });
      return { json: [] };
    },
  });
  await expect.poll(() => titles(page)).toHaveLength(3);
  return { server, patches };
}

const cell = (page: Page, id: string) => page.locator(`.wm-resale-page [data-copy="${id}"]`);
const face = (page: Page, id: string) => cell(page, id).locator('> div').first();
const siteModal = (page: Page) => page.locator('#site-card-modal');
const modalProps = (page: Page) => page.evaluate(() => (window as unknown as { cardModalProps: CardModalSeen }).cardModalProps);

test('clic sur une carte : la modale de carte du site, avec l’exemplaire (rareté, ATK, DEF, shiny) ; fermée, elle se rouvre', async ({ page }) => {
  await openWithModal(page);
  await face(page, 'b').click();
  await expect(siteModal(page).locator('h2')).toHaveText('Élysée');
  const props = await modalProps(page);
  expect(props).toMatchObject({ userCardId: 'b', count: 1, starred: false, tags: [], ownOfferPending: false });
  expect(props.card).toMatchObject({ id: 'card-b', wikipedia_title: 'Élysée', rarity: 'SR', atk: 100, def: 200, is_shiny: false });

  await siteModal(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(siteModal(page)).toHaveCount(0);
  await face(page, 'a').click();
  await expect(siteModal(page).locator('h2')).toHaveText('Tour Eiffel');
});

test('défaussée depuis la modale : la carte reste, tamponnée « Défaussée », hors du total ; elle ne se rouvre plus', async ({ page }) => {
  await openWithModal(page);
  await expect(titleGroup(page)).toContainText('3 cartes');
  await face(page, 'c').click();
  await siteModal(page).getByRole('button', { name: 'Défausser' }).click();
  await expect(siteModal(page)).toHaveCount(0);
  await expect(face(page, 'c')).toHaveAttribute('data-wm-stamp', 'resale');
  await expect(face(page, 'c').locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(titleGroup(page)).toContainText('2 cartes · 2 sans prix souhaité');
  await face(page, 'c').click();
  await letTimePass(page, 300);
  await expect(siteModal(page)).toHaveCount(0);
  await expectDomIdle(page);
});

test('mise aux enchères : tamponnée « En vente » ; étiquetée : grisée sans texte, hors du total', async ({ page }) => {
  await openWithModal(page);
  await face(page, 'a').click();
  await siteModal(page).getByRole('button', { name: 'Mettre aux enchères' }).click();
  await expect(face(page, 'a').locator('.wm-stamp')).toHaveText('En vente');
  await siteModal(page).getByRole('button', { name: 'Fermer' }).click();

  await face(page, 'b').click();
  await siteModal(page).getByRole('button', { name: 'Ajouter #keep' }).click();
  // La modale montre l'étiquette posée.
  await expect(siteModal(page).locator('#m-tags')).toHaveText('keep');
  await expect(face(page, 'b')).toHaveAttribute('data-wm-stamp', 'resale');
  await expect(face(page, 'b').locator('.wm-stamp')).toHaveCount(0);
  await expect(titleGroup(page)).toContainText('1 carte · 1 sans prix souhaité');
});

test('favori : demandé à Supabase comme la Collection, la modale le montre', async ({ page }) => {
  const { patches } = await openWithModal(page);
  await face(page, 'a').click();
  await siteModal(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await expect(siteModal(page).getByRole('button', { name: 'Retirer des favoris' })).toBeVisible();
  expect(patches.map(({ url, body }) => [url.pathname, url.searchParams.get('id'), body])).toEqual([['/rest/v1/user_cards', 'eq.a', { starred: true }]]);
});

test('rechargement : les cartes vendues, défaussées ou étiquetées disparaissent, les tampons avec elles', async ({ page }) => {
  let rows: readonly object[] = THREE;
  await openWithModal(page, () => rows);
  await face(page, 'c').click();
  await siteModal(page).getByRole('button', { name: 'Défausser' }).click();
  await expect(face(page, 'c').locator('.wm-stamp')).toHaveText('Défaussée');
  rows = THREE.slice(0, 2);
  await submit(page).click();
  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel']);
  await expect(page.locator('.wm-resale-page [data-wm-stamp]')).toHaveCount(0);
});

// --- Mes ventes en cours ---

/** Annonce de « Mes ventes » (`selling` de `mine=1`), carte jointe. */
function sellingRow(id: string, title: string, rarity: string, amount: number, bid: number | null, minutes: number) {
  return {
    id,
    card_id: `card-${id}`,
    card: { id: `card-${id}`, wikipedia_title: title, category: 'Monument', image_url: null, hide_image: false, rarity, atk: 1, def: 2 },
    status: 'active',
    base_amount: amount,
    current_bid: bid,
    effective_bid: bid ?? amount,
    end_at: new Date(Date.now() + minutes * 60_000).toISOString(),
    created_at: new Date().toISOString(),
    snapshot_rarity: rarity,
    snapshot_atk: 10,
    snapshot_def: 20,
    is_shiny: false,
  };
}

const saleCells = (page: Page) => page.locator('.wm-resale-page [data-sale]');
const sectionTitles = (page: Page) => page.locator('.wm-resale-page h2').allTextContents();

test('« Au marché » : mes ventes en cours entre les filtres et la collection, triées, avec leur mise et leur temps', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  const selling = [sellingRow('v1', 'Arc de triomphe', 'R', 40, null, 30), sellingRow('v2', 'Big Ben', 'UR', 100, 250, 90)];
  let mine = 0;
  await openResale(page, {
    supabase,
    handle: async (route, url) => {
      if (url.pathname !== '/api/marketplace') return false;
      mine++;
      expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '1', mine: '1' });
      await route.fulfill({ json: { auctions: [], mine: true, selling } });
      return true;
    },
  }, [sales('card-v2', 'UR', [800]), sales('card-v1', 'R', [60])]);
  await expect.poll(() => sectionTitles(page)).toEqual(['Au marché (2)', 'Collection (3)']);
  await expect(saleCells(page).locator('h3')).toHaveText(['Big Ben', 'Arc de triomphe']);
  const bigBen = saleCells(page).first();
  await expect(bigBen).toContainText('Mise actuelle');
  await expect(bigBen).toContainText('250');
  await expect(saleCells(page).nth(1)).toContainText('Mise de départ');
  await expect(bigBen.locator('a')).toHaveAttribute('href', '/marketplace/v2');
  await expect(bigBen.locator('.wm-resale-price')).toHaveText('800(1)');
  // Elles comptent dans le total : 5 cartes.
  await expect(titleGroup(page)).toContainText('5 cartes · 5 sans prix souhaité');

  // Prix souhaité d'une vente, comme d'une carte de la collection.
  await bigBen.locator('.wm-resale-wished button').click();
  await page.getByRole('textbox', { name: 'Prix souhaité' }).fill('900');
  await page.getByRole('textbox', { name: 'Prix souhaité' }).press('Enter');
  await expect(titleGroup(page)).toContainText('900');

  // Les filtres valent aussi pour elles.
  await page.getByRole('textbox', { name: 'Rechercher' }).fill('big');
  await submit(page).click();
  await expect.poll(() => sectionTitles(page)).toEqual(['Au marché (1)', 'Collection (0)']);
  // Le rechargement relit aussi le marché.
  await submit(page).click();
  await expect.poll(() => mine).toBe(2);
  await expectDomIdle(page);
});

test('« Au marché » : aucune vente, ou ventes pas lues (la collection s’affiche quand même)', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase });
  await expect.poll(() => sectionTitles(page)).toEqual(['Au marché (0)', 'Collection (3)']);
  await expect(page.locator('.wm-resale-page')).toContainText('Aucune carte en vente.');

  await page.unroute('https://www.wiki-masters.com/**');
  await openResale(page, {
    supabase,
    handle: async (route, url) => {
      if (url.pathname !== '/api/marketplace') return false;
      await route.fulfill({ status: 500, json: { error: 'Erreur serveur' } });
      return true;
    },
  });
  await expect.poll(() => titles(page)).toHaveLength(3);
  await expect(page.locator('.wm-resale-page [role="alert"]')).toContainText('Erreur serveur');
});

// --- Sens du tri ---

test('sens du tri : bouton à droite de la liste, inversé au lancement ; un autre tri part dans son sens habituel', async ({ page }) => {
  const { supabase } = copiesServer(() => THREE);
  await openResale(page, { supabase }, [sales('card-a', 'R', [100, 200]), sales('card-b', 'SR', [500])]);
  await expect.poll(() => titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);

  const order = page.locator('.wm-resale-order');
  // Juste à droite de la liste du tri, avant le bouton de la recherche.
  const [sortBox, orderBox, submitBox] = [
    await rect(page.getByRole('button', { name: 'Trier les cartes' })),
    await rect(order),
    await rect(submit(page)),
  ];
  expect(orderBox.x).toBeGreaterThan(sortBox.x + sortBox.width - 1);
  expect(submitBox.x).toBeGreaterThan(orderBox.x + orderBox.width - 1);
  await expect(order).toHaveAttribute('aria-label', 'Sens du tri : Du plus cher au moins cher');

  await order.click();
  await expect(order).toHaveAttribute('data-order', 'asc');
  await expect(submit(page)).toHaveAttribute('data-status', 'search');
  expect(await titles(page)).toEqual(['Élysée', 'Tour Eiffel', 'Zèbre']);
  await submit(page).click();
  // Le moins cher d'abord ; sans prix, toujours en fin.
  await expect.poll(() => titles(page)).toEqual(['Tour Eiffel', 'Élysée', 'Zèbre']);

  await chooseOption(page, 'Trier les cartes', 'Nom');
  await expect(order).toHaveAttribute('aria-label', 'Sens du tri : De A à Z');
  await order.click();
  await submit(page).click();
  await expect.poll(() => titles(page)).toEqual(['Zèbre', 'Tour Eiffel', 'Élysée']);
  // Retenu avec les filtres.
  await page.reload();
  await expect.poll(() => titles(page)).toEqual(['Zèbre', 'Tour Eiffel', 'Élysée']);
  await expect(page.locator('.wm-resale-order')).toHaveAttribute('data-order', 'desc');
});

declare global {
  interface Window {
    __sameDocument?: boolean;
    __prevented?: boolean;
  }
}
