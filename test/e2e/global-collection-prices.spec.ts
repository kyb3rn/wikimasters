import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, hold, letTimePass, openSettings, openSite, presetSettings, rect, sitePage, type Gated } from './support/site';

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

/** Sept cartes : trois lignes (3, 3, puis 1 centrée) dans une rangée de 600 px. */
const CARDS = [
  { id: 'c-eiffel', wikipedia_title: 'Tour Eiffel', rarity: 'R' },
  ...['Anvers', 'Liège', 'Namur', 'Mons', 'Gand', 'Bruges'].map((title, index) => ({ id: `c-${index}`, wikipedia_title: title, rarity: 'SR' })),
];

/*
 * Toutes les cartes (capture du 10/10/2026) : rangée > case `div.relative.isolate.group` > face, composant aux props
 * `{ card, … }`. Pas de Tailwind : la taille d'une face vient de ses classes, écrites ici comme les génère le site ;
 * rangée et écart en style. Un clic sur une face est noté dans `window.opened`.
 */
const SCRIPT = `
  const { el, fiber } = kit;
  const sizes = { 'w-[clamp(8.4rem,43vw,10rem)]': 'width: clamp(8.4rem,43vw,10rem)', 'h-[clamp(11.8rem,60vw,14rem)]': 'height: clamp(11.8rem,60vw,14rem)' };
  const style = el('style');
  style.textContent = Object.entries(sizes).map(([name, rule]) => '.' + CSS.escape(name) + ' { ' + rule + '; }').join('\\n');
  document.head.append(style);
  window.opened = [];
  const grid = el('div', 'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]');
  grid.id = 'grid';
  grid.setAttribute('style', 'display:flex;flex-wrap:wrap;justify-content:center;gap:26px;width:600px');
  for (const card of ${JSON.stringify(CARDS)}) {
    const cell = el('div', 'relative isolate group');
    const face = el('div', Object.keys(sizes).join(' ') + ' glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden');
    face.style.background = '#555';
    face.dataset.card = card.id;
    face.innerHTML = '<h3>' + card.wikipedia_title + '</h3>';
    fiber(face, {}, fiber(null, { card, size: 'sm' }, null, { key: card.id }));
    face.addEventListener('click', () => window.opened.push(card.id));
    cell.append(face);
    grid.append(cell);
  }
  document.querySelector('main').append(grid);
`;

interface SalesServer extends Gated {
  readonly requests: string[];
}

async function openPage(page: Page): Promise<SalesServer> {
  const server: SalesServer = { requests: [], gate: undefined };
  await openSite(page, '/global-collection', {
    html: sitePage('', SCRIPT),
    handle: async (route, url) => {
      const card = /^\/api\/marketplace\/cards\/([^/]+)\/sales$/.exec(url.pathname)?.[1];
      if (!card) return false;
      server.requests.push(card);
      await server.gate;
      await route.fulfill({ json: card === 'c-eiffel' ? SALES : { wikipedia_title: 'Autre', sales: [], recent: [] } });
      return true;
    },
  });
  return server;
}

const faces = (page: Page) => page.locator('#grid [data-card]');
const priceButtons = (page: Page) => page.locator('#grid .wm-catalog-price button');
const opened = (page: Page) => page.evaluate(() => (window as unknown as { opened: string[] }).opened);

/** Chaque bouton sous sa carte, de sa largeur, 6 px plus bas (à la taille des cartes), sur chaque ligne. */
async function expectUnderFaces(page: Page, scale = 1): Promise<void> {
  await expect(priceButtons(page)).toHaveCount(CARDS.length);
  for (let index = 0; index < CARDS.length; index++) {
    const [face, button] = await Promise.all([rect(faces(page).nth(index)), rect(priceButtons(page).nth(index))]);
    expect(Math.abs(button.x - face.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.width - face.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.y - (face.y + face.height + 6 * scale))).toBeLessThanOrEqual(1);
  }
}

test('sous chaque carte, sur toutes les lignes : « Charger le prix », rien demandé ; le clic charge, puis l’historique', async ({ page }) => {
  const server = await openPage(page);
  const button = priceButtons(page).first();
  await expect(button).toHaveText('Charger le prix');
  await expect(button).toHaveClass(/wm-ghost/);
  await expect(button).toHaveClass(/wm-button-xs/);
  await expectUnderFaces(page);
  // Trois lignes, la dernière centrée.
  const [first, last] = await Promise.all([rect(faces(page).first()), rect(faces(page).last())]);
  expect(last.y).toBeGreaterThan(first.y + 2 * first.height);
  expect(Math.abs(last.x - (first.x + first.width + 26))).toBeLessThanOrEqual(1);
  await letTimePass(page, 300);
  expect(server.requests).toEqual([]);

  const release = hold(server);
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button.locator('svg.wm-spin')).toBeVisible();
  release();
  // Moyenne des 7 dernières ventes en R et nombre de ventes en R ; la carte ne s'est pas ouverte.
  await expect(button).toHaveText('100(9)');
  await expect(button).toHaveClass(/wm-solid/);
  expect(server.requests).toEqual(['c-eiffel']);

  await button.click();
  await expect(page.getByRole('dialog', { name: 'Tour Eiffel' })).toBeVisible();
  expect(server.requests).toEqual(['c-eiffel']);
  expect(await opened(page)).toEqual([]);
});

test('taille et espacement des cartes réglés : chaque bouton reste sous sa carte', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'global-collection-card-display': { scale: 75, gap: 30 } } });
  await openPage(page);
  await expect.poll(async () => (await rect(faces(page).first())).width).toBe(120);
  await expectUnderFaces(page, 0.75);
});

test('la liste change (autre page) : les boutons suivent les nouvelles cartes', async ({ page }) => {
  await openPage(page);
  await expect(priceButtons(page)).toHaveCount(CARDS.length);
  await page.evaluate(() => {
    for (const cell of [...document.querySelectorAll('#grid > div')].slice(2)) cell.remove();
  });
  await expect(priceButtons(page)).toHaveCount(2);
  await expect(priceButtons(page).nth(1)).toHaveText('Charger le prix');
});

test('réglage : « Prix moyen » dans l’onglet Toutes les cartes, actif par défaut ; coupé, plus de prix', async ({ page }) => {
  await openPage(page);
  await expect(priceButtons(page).first()).toBeVisible();
  const settings = await openSettings(page, 'Toutes les cartes');
  const toggle = settings.getByRole('switch', { name: 'Prix moyen : Afficher le prix moyen des cartes' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator('.wm-catalog-price')).toHaveCount(0);
  await toggle.click();
  await expect(priceButtons(page).first()).toHaveText('Charger le prix');
});

test('coupé d’avance : rien sous les cartes', async ({ page }) => {
  await presetSettings(page, { features: { 'global-collection-prices': false }, values: {} });
  await openPage(page);
  await expect(faces(page)).toHaveCount(CARDS.length);
  await letTimePass(page, 300);
  await expect(page.locator('.wm-catalog-price')).toHaveCount(0);
});

test('au repos, la page ne bouge plus', async ({ page }) => {
  await openPage(page);
  await expect(priceButtons(page).last()).toBeVisible();
  await expectDomIdle(page);
});
