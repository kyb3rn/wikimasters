import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, openSettings, openSite, presetSettings, rect, sitePage } from './support/site';

/** Heure du serveur figée en cours de minute : la remise à zéro du compteur est dans 50 s. */
const NOW = new Date('2026-10-02T12:37:10Z');
const MINUTE = Math.floor(NOW.getTime() / 60_000);

const CARDS = ['Anvers', 'Liège', 'Namur', 'Mons', 'Gand', 'Bruges', 'Ypres', 'Louvain', 'Malines', 'Ostende', 'Arlon', 'Dinant'].map((title, index) => ({
  id: `c-${index}`,
  wikipedia_title: title,
  rarity: 'SR',
}));

const REFUSAL = { error: "Trop de requêtes automatisées. L'automatisation n'est pas autorisée — voir le règlement.", code: 'automation_limit' };

/*
 * Toutes les cartes (code et captures du site, 30/09/2026) : ligne des filtres (rangée du champ et « Rechercher »,
 * liste « Trier les cartes »), pastilles de rareté, puis la grille, dont chaque face est la case, composant aux props
 * `{ card, … }`.
 */
const SCRIPT = `
  const { el, button, fiber, listbox, rarityPills } = kit;
  const area = el('div', 'space-y-3');
  const line = el('div', 'flex flex-col gap-3 md:flex-row md:items-stretch');
  line.id = 'line';
  line.style.display = 'flex';
  line.style.gap = '12px';
  const fieldRow = el('div', 'flex w-full min-w-0 flex-1 gap-2');
  const fieldBox = el('div', 'relative min-w-0 flex-1');
  const field = el('input', 'w-full rounded-lg border px-4 py-2.5 text-sm');
  field.type = 'text';
  fieldBox.append(field);
  fieldRow.append(fieldBox, button('shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold', 'Rechercher'));
  const sortList = listbox({ label: 'Trier les cartes', value: () => 'rarity', options: () => [{ value: 'rarity', label: 'Rareté' }], onChange() {} });
  line.append(fieldRow, sortList.box);
  const pills = rarityPills({ checked: () => new Set(), toggle() {}, reset() {} });
  area.append(line, pills.row);
  const grid = el('div', 'flex flex-wrap justify-center gap-3');
  grid.id = 'grid';
  for (const card of ${JSON.stringify(CARDS)}) {
    const face = el('div', 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-sr relative rounded-2xl overflow-hidden');
    face.innerHTML = '<h3>' + card.wikipedia_title + '</h3>';
    fiber(face, {}, fiber(null, { card, size: 'sm' }, null, { key: card.id }));
    grid.append(face);
  }
  document.querySelector('main').append(area, grid);
  sortList.render();
  pills.render();
`;

interface SalesServer {
  /** Cartes dont les ventes ont été demandées, dans l'ordre. */
  readonly requests: string[];
  /** Heure de départ de chaque demande (horloge du test, pas celle, figée, de la page). */
  readonly startedAt: number[];
  /** Plus grand nombre de demandes en cours en même temps. */
  concurrent: number;
  /** Refuse les demandes à partir de ce rang (à partir de 1), comme le site au-delà de sa limite. */
  refuseFrom: number;
  /** Les demandes attendent `release` pour recevoir leur réponse. */
  holding: boolean;
  /** Répond aux `count` plus anciennes demandes retenues ; sans nombre : à toutes, et plus rien n'est retenu. */
  release(count?: number): void;
}

async function openCatalog(page: Page, { alreadyCounted = 0, enabled = true } = {}): Promise<SalesServer> {
  const waiting: (() => void)[] = [];
  const server: SalesServer = {
    requests: [],
    startedAt: [],
    concurrent: 0,
    refuseFrom: Infinity,
    holding: false,
    release(count = Infinity) {
      if (count === Infinity) server.holding = false;
      for (const resolve of waiting.splice(0, count)) resolve();
    },
  };
  let running = 0;
  await page.clock.setFixedTime(NOW);
  // Éteinte par défaut : allumée dans chaque test, sauf demande.
  await presetSettings(page, { features: { 'market-search': false, 'global-collection-load-prices': enabled }, values: {} });
  // Historiques déjà chargés dans la minute (compteur commun aux onglets).
  await page.addInitScript(
    ([minute, count]) => {
      localStorage.setItem('wm-sales-rate-v1', JSON.stringify({ minute, count, blocked: false }));
    },
    [MINUTE, alreadyCounted] as const,
  );
  await openSite(page, '/global-collection', {
    html: sitePage('', SCRIPT),
    handle: async (route, url) => {
      const card = /^\/api\/marketplace\/cards\/([^/]+)\/sales$/.exec(url.pathname)?.[1];
      if (!card) return false;
      server.requests.push(card);
      server.startedAt.push(Date.now());
      running++;
      server.concurrent = Math.max(server.concurrent, running);
      if (server.holding) await new Promise<void>((resolve) => waiting.push(resolve));
      running--;
      const headers = { date: NOW.toUTCString() };
      await route.fulfill(
        server.requests.length >= server.refuseFrom
          ? { status: 403, json: REFUSAL, headers }
          : { json: { wikipedia_title: 'Carte', sales: [], recent: [] }, headers },
      );
      return true;
    },
  });
  await expect(page.locator('#grid h3')).toHaveCount(CARDS.length);
  return server;
}

const loadButton = (page: Page) => page.locator('.wm-gc-load-prices button');

test('au bout de la ligne des filtres ; un clic : 10 demandes en cours au plus, 0,5 à 1 s entre deux départs, roue sur chaque carte demandée', async ({ page }) => {
  const server = await openCatalog(page);
  const button = loadButton(page);
  await expect(button).toHaveText('Charger les prix (12)');
  await expect(button).toBeEnabled();
  // Calé à droite de la ligne, après le bouton de la recherche.
  const [line, placed] = await Promise.all([rect(page.locator('#line')), rect(button)]);
  expect(Math.abs(line.x + line.width - (placed.x + placed.width))).toBeLessThan(2);
  await expectDomIdle(page);

  server.holding = true;
  await button.click();
  await expect(button).toHaveText('Chargement… 0 / 12');
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#grid .wm-catalog-price button').first()).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => server.requests.length, { timeout: 15_000 }).toBe(10);
  // Dix en cours : la onzième attend qu'une finisse.
  await page.waitForTimeout(1200);
  expect(server.requests).toHaveLength(10);
  server.release(1);
  await expect.poll(() => server.requests.length).toBe(11);
  await expect(button).toHaveText('Chargement… 1 / 12');

  server.release();
  await expect(button).toHaveText('Prix à jour', { timeout: 15_000 });
  await expect(button).toBeDisabled();
  expect(server.requests).toEqual(CARDS.map((card) => card.id));
  expect(server.concurrent).toBe(10);
  // Écarts des dix premières, parties sans attendre de place (marge pour l'horloge du test).
  const gaps = server.startedAt.slice(1, 10).map((time, index) => time - (server.startedAt[index] ?? 0));
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(450);
  expect(Math.max(...gaps)).toBeLessThan(1300);
  await expectDomIdle(page);
});

test('s’arrête à 28 historiques dans la minute ; repart d’un nouveau clic après la remise à zéro', async ({ page }) => {
  const server = await openCatalog(page, { alreadyCounted: 25 });
  const button = loadButton(page);
  await button.click();
  await expect(button).toHaveText('Limite atteinte · 50 s');
  await expect(button).toBeDisabled();
  expect(server.requests).toEqual(['c-0', 'c-1', 'c-2']);

  // Minute suivante du serveur : rien ne repart seul.
  await page.clock.setFixedTime(new Date(NOW.getTime() + 51_000));
  await expect(button).toHaveText('Charger les prix (9)');
  expect(server.requests).toHaveLength(3);
  await button.click();
  await expect(button).toHaveText('Prix à jour', { timeout: 15_000 });
  expect(server.requests).toHaveLength(CARDS.length);
});

test('minute déjà pleine : bouton désactivé avec le temps restant, aucune demande', async ({ page }) => {
  const server = await openCatalog(page, { alreadyCounted: 28 });
  const button = loadButton(page);
  await expect(button).toHaveText('Limite atteinte · 50 s');
  await expect(button).toBeDisabled();
  expect(server.requests).toHaveLength(0);
});

test('refus du site pour trop de requêtes : arrêt aussitôt, message du site en toast', async ({ page }) => {
  const server = await openCatalog(page);
  server.refuseFrom = 3;
  await loadButton(page).click();
  await expect(page.getByText(/Trop de requêtes automatisées\..*Chargement arrêté : 2 prix chargés sur 12\./)).toBeVisible();
  expect(server.requests).toEqual(['c-0', 'c-1', 'c-2']);
  await expect(loadButton(page)).toHaveText('Limite atteinte · 50 s');
});

test('éteint par défaut : pas de bouton ; allumé dans les paramètres, il apparaît', async ({ page }) => {
  await openCatalog(page, { enabled: false });
  await expect(page.locator('#grid .wm-catalog-price button')).toHaveCount(CARDS.length);
  await expect(loadButton(page)).toHaveCount(0);

  const settings = await openSettings(page, 'Toutes les cartes');
  const toggle = settings.getByRole('switch', { name: 'Prix moyen : Charger tous les prix d’un clic' });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(loadButton(page)).toHaveText('Charger les prix (12)');
});
