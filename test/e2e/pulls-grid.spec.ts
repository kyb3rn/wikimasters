import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, PACK, playedSounds, PULLS_HTML, recordSounds } from './support/pulls';
import { openSite, presetSettings } from './support/site';

const GRID = 'main .wm-pulls-grid';
/** Rangée de navigation du carrousel du site. */
const NAV = 'main div.flex.items-center.gap-4:has(> button.w-12)';
const slots = (page: Page) => page.locator(`${GRID} > .wm-pulls-slot`);
const face = (page: Page, index: number) => slots(page).nth(index).locator('.wm-pulls-card > *');
const arrived = (page: Page) => page.locator(`${GRID} > .wm-pulls-slot[data-state="arrived"]`);
const proceed = (page: Page) => page.getByRole('button', { name: 'Continuer' });
const carouselIndex = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index);
const domSyncs = (page: Page) => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);

interface Watched {
  /** Arrivées des cartes : position dans le paquet, instant. */
  __arrivals: { index: number; at: number }[];
}
const arrivals = (page: Page) => page.evaluate(() => (window as unknown as Watched).__arrivals);

/** Paquet de `count` cartes (données inventées), l'exemplaire `u<n>` pour la carte `c<n>`. */
function packOf(count: number, extra: Record<string, unknown>[] = []) {
  const cards = [
    ...Array.from({ length: count }, (_, i) => ({ id: `c${i + 1}`, wikipedia_title: `Carte ${i + 1}`, rarity: 'C', atk: 1, def: 1 })),
    ...extra,
  ];
  return {
    ...PACK,
    cards,
    owned_copies: cards.map((card, i) => ({ id: `u${i + 1}`, card_id: card.id, starred: false, is_shiny: false, user_card_tags: [] })),
  };
}

/** `hold` : la réponse de défausse attend cette promesse. */
async function openPulls(page: Page, pack: unknown = PACK, hold?: Promise<void>) {
  const discarded: string[] = [];
  const starChanges: string[] = [];
  await recordSounds(page);
  // Avant le script : note les arrivées des cartes.
  await page.addInitScript(() => {
    const w = window as unknown as Watched;
    w.__arrivals = [];
    new MutationObserver((records) => {
      for (const { target } of records) {
        if (target instanceof HTMLElement && target.dataset.state === 'arrived') {
          w.__arrivals.push({ index: Number(target.dataset.index), at: performance.now() });
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
  });
  await openSite(page, '/pulls', {
    html: PULLS_HTML,
    api: { '/api/packs/open': pack },
    handle: async (route, url) => {
      if (url.pathname.startsWith('/rest/v1/')) {
        if (route.request().method() === 'PATCH') starChanges.push(`${url.search} ${route.request().postData() ?? ''}`);
        await route.fulfill({ status: 204, body: '' });
        return true;
      }
      const match = /^\/api\/user-cards\/([^/]+)\/discard$/.exec(url.pathname);
      if (!match?.[1]) return false;
      discarded.push(match[1]);
      await hold;
      await route.fulfill({ json: { balance: 12661 } });
      return true;
    },
  });
  return { discarded, starChanges };
}

/** Ouvre le paquet et attend l'arrivée de toutes ses cartes. */
async function openPack(page: Page, count: number) {
  await page.click('#open');
  await expect(arrived(page)).toHaveCount(count);
  await expect(proceed(page)).toBeEnabled();
}

test('les cartes arrivent l’une après l’autre, en grille, sans carrousel ni son', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'pulls-grid': { waveMs: 150 } } });
  await openPulls(page);
  await openPack(page, 3);

  await expect(face(page, 0).locator('h3')).toHaveText('Tour Eiffel');
  await expect(face(page, 1).locator('h3')).toHaveText('Musée du Louvre');
  await expect(face(page, 2).locator('h3')).toHaveText('Mont Blanc');
  const arrived = await arrivals(page);
  expect(arrived.map((arrival) => arrival.index)).toEqual([0, 1, 2]);
  for (let i = 1; i < arrived.length; i++) {
    expect((arrived[i]?.at ?? 0) - (arrived[i - 1]?.at ?? 0)).toBeGreaterThan(100);
  }
  // Seul le son de l'ouverture du paquet : aucun des changements de carte du carrousel.
  expect(await playedSounds(page)).toEqual(['pack-rip']);

  // Carrousel caché : compteur, navigation, « Encore n cartes » ; la carte du site reste là, invisible.
  await expect(page.locator(NAV)).toBeHidden();
  await expect(page.getByText('Carte 3 / 3')).toBeHidden();
  await expect(page.locator('main .relative.inline-flex')).toHaveCSS('opacity', '0');
  await expect(page.getByText(/^Encore/)).toHaveCount(0);
  await expect(proceed(page)).toHaveCount(1);
});

test('« Continuer » reste grisé tant que toutes les cartes ne sont pas là, puis ferme le paquet', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'pulls-grid': { waveMs: 400 } } });
  await openPulls(page);
  await page.click('#open');
  await expect(proceed(page)).toBeDisabled();
  await expect(arrived(page).first()).toBeVisible();
  await expect(proceed(page)).toBeDisabled();
  await expect(arrived(page)).toHaveCount(3);
  await expect(proceed(page)).toBeEnabled();

  await proceed(page).click();
  await expect(page.locator('#open')).toBeVisible();
  await expect(page.locator(GRID)).toHaveCount(0);
});

/** Nombre de cartes par ligne de la grille. */
const rows = (page: Page) =>
  page.locator(GRID).evaluate((grid) => {
    const counts = new Map<number, number>();
    for (const slot of grid.children) {
      const top = (slot as HTMLElement).offsetTop;
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.values()];
  });

test('paquet PRO de 15 cartes : trois lignes de cinq', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openPulls(page, packOf(15));
  await openPack(page, 15);
  expect(await rows(page)).toEqual([5, 5, 5]);
});

test('lignes de cinq cartes au plus, la dernière centrée', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openPulls(page, packOf(7));
  await openPack(page, 7);
  expect(await rows(page)).toEqual([5, 2]);
  const centered = await page.locator(GRID).evaluate((grid) => {
    const middle = (el: Element) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
    const [sixth, seventh] = [grid.children[5], grid.children[6]];
    return sixth && seventh ? Math.abs((middle(sixth) + middle(seventh)) / 2 - middle(grid)) : Infinity;
  });
  expect(centered).toBeLessThan(2);
});

test('défaussage rapide : un bouton sous chaque carte, qui défausse sans changer de carte', async ({ page }) => {
  const { discarded } = await openPulls(page);
  await openPack(page, 3);
  const trash = (index: number) => slots(page).nth(index).locator('.wm-pulls-actions .wm-discard-next');
  await expect(page.locator(`${GRID} .wm-discard-next`)).toHaveCount(3);
  await expect(trash(0)).toHaveAttribute('title', 'Défausser');
  expect(await carouselIndex(page)).toBe(2);

  await trash(1).click();
  await expect(face(page, 1).locator('.wm-stamp')).toHaveText('Défaussée');
  await expect(trash(1)).toHaveAttribute('data-status', 'discarded');
  await expect(trash(0)).toHaveAttribute('data-status', 'ready');
  await expect(trash(2)).toHaveAttribute('data-status', 'ready');
  await expect(face(page, 0).locator('.wm-stamp')).toHaveCount(0);
  expect(discarded).toEqual(['u2']);
  expect(await carouselIndex(page)).toBe(2);
});

test('un clic sur une carte ouvre la modale du site de cette carte, sans son', async ({ page }) => {
  await openPulls(page);
  await openPack(page, 3);

  await face(page, 0).click();
  const modal = page.locator('#card-modal');
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText('Tour Eiffel');
  await modal.getByRole('button', { name: 'Fermer' }).click();
  await face(page, 1).click();
  await expect(modal.getByRole('heading', { level: 2 })).toHaveText('Musée du Louvre');
  expect(await playedSounds(page)).toEqual(['pack-rip']);
});

test('l’étoile d’une carte est celle du site : favori enregistré, carte et protection à jour', async ({ page }) => {
  const { starChanges } = await openPulls(page);
  await openPack(page, 3);

  await face(page, 1).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await expect(face(page, 1).getByRole('button', { name: 'Retirer des favoris' })).toBeVisible();
  expect(starChanges).toEqual(['?user_id=eq.u0&card_id=eq.c2 {"starred":true}']);
  await expect(page.locator('#card-modal')).toHaveCount(0);
  await expect(slots(page).nth(1).locator('.wm-discard-next')).toHaveAttribute('data-status', 'protected');
});

test('une L shiny arrive révélée, comme au bout de son animation dans le carrousel', async ({ page }) => {
  await openPulls(page, packOf(3, [{ id: 'c4', wikipedia_title: 'Lyon', rarity: 'L', is_shiny: true, atk: 1, def: 1 }]));
  await openPack(page, 4);
  await expect(face(page, 3)).toHaveClass(/shiny-card/);
  await expect(face(page, 2)).not.toHaveClass(/shiny-card/);
});

test('les flèches du clavier ne font plus défiler le carrousel', async ({ page }) => {
  await openPulls(page);
  await openPack(page, 3);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await carouselIndex(page)).toBe(2);
});

test('désactivée dans les paramètres : le carrousel du site, comme avant', async ({ page }) => {
  await presetSettings(page, CAROUSEL);
  await openPulls(page);
  await page.click('#open');
  await expect(page.locator(NAV)).toBeVisible();
  await expect(page.locator(GRID)).toHaveCount(0);

  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  await page.getByRole('dialog', { name: 'Paramètres' }).getByRole('button', { name: 'Paquets' }).click();
  await page.getByRole('switch', { name: "Apparence : Afficher toutes les cartes d'un coup" }).click();
  await page.keyboard.press('Escape');
  await expect(arrived(page)).toHaveCount(3);
  await expect(page.locator(NAV)).toBeHidden();
});

test('activée pendant une défausse lancée depuis le carrousel : la grille attend qu’elle finisse', async ({ page }) => {
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => (release = resolve));
  await presetSettings(page, { features: { 'pulls-grid': false }, values: { 'pulls-discard-next': { delayMs: 0 } } });
  const { discarded } = await openPulls(page, PACK, hold);
  await page.click('#open');
  await page.locator('.wm-discard-next').click();
  await expect(page.locator('.wm-discard-next')).toHaveAttribute('data-status', 'busy');

  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  await page.getByRole('dialog', { name: 'Paramètres' }).getByRole('button', { name: 'Paquets' }).click();
  await page.getByRole('switch', { name: "Apparence : Afficher toutes les cartes d'un coup" }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(arrived(page)).toHaveCount(0);

  release();
  await expect(arrived(page)).toHaveCount(3);
  await expect(face(page, 0).locator('.wm-stamp')).toHaveText('Défaussée');
  expect(discarded).toEqual(['u1']);
});

test('au repos, le script ne resynchronise plus la page (pas de boucle)', async ({ page }) => {
  await openPulls(page);
  await openPack(page, 3);
  await slots(page).nth(0).locator('.wm-discard-next').click();
  await expect(face(page, 0).locator('.wm-stamp')).toBeVisible();

  await page.waitForTimeout(300);
  const before = await domSyncs(page);
  await page.waitForTimeout(600);
  expect(await domSyncs(page)).toBe(before);
});
