import { expect, test, type Page } from '@playwright/test';
import { openSite, presetSettings, sitePage } from './support/site';

// Grilles relevées dans les captures du 29/09/2026. Le faux site n'a pas Tailwind : tailles et espacements du
// site en style dans la balise (160 × 224 px, écart de la grille).
const FACE = (id: string) =>
  `<div data-face="${id}" class="w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-c relative rounded-2xl overflow-hidden" ` +
  `style="width:160px;height:224px;flex:none"><h3>Carte ${id}</h3></div>`;
const row = (classes: string, gap: number, items: string[]) =>
  `<div id="grid" class="${classes}" style="display:flex;flex-wrap:wrap;justify-content:center;gap:${gap}px">${items.join('')}</div>`;
const ids = ['a', 'b', 'c', 'd', 'e', 'f'];

const PAGES = {
  collection: {
    path: '/collection',
    tab: 'Collection',
    gap: 26,
    html: row(
      'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px] transition-opacity',
      26,
      ids.map((id) => `<div class="relative isolate group">${FACE(id)}</div>`),
    ),
  },
  marketplace: {
    path: '/marketplace',
    tab: 'Marché',
    gap: 20,
    html: row(
      'flex flex-wrap justify-center gap-4 md:gap-5',
      20,
      ids.map(
        (id) =>
          `<div id="marketplace-auction-${id}"><a href="/marketplace/${id}" class="card-frame block p-3 w-[172px] md:w-[184px]" style="display:block;width:184px">` +
          `<div class="flex flex-col items-center gap-2.5"><div class="overflow-hidden rounded-2xl">${FACE(id)}</div>` +
          `<span>Mise actuelle 12</span></div></a></div>`,
      ),
    ),
  },
  globalCollection: {
    path: '/global-collection',
    tab: 'Toutes les cartes',
    gap: 26,
    html: row('flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]', 26, ids.map(FACE)),
  },
  profile: {
    path: '/profile/aelonka',
    tab: 'Profil',
    gap: 26,
    html: row(
      'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]',
      26,
      ids.map((id) => `<div class="relative">${FACE(id)}</div>`),
    ),
  },
  trades: {
    path: '/trades',
    tab: 'Échanges',
    gap: 12,
    // Choix des cartes d'un échange : dans la modale « Échanger avec ».
    html:
      '<div class="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70"><div class="rounded-2xl border">' +
      row(
        'grid w-full grid-cols-2 gap-1.5 min-[500px]:flex min-[500px]:flex-wrap min-[500px]:justify-center min-[500px]:gap-3',
        12,
        ids.map((id) => `<button type="button" class="relative w-full min-w-0 min-[500px]:w-auto rounded-2xl">${FACE(id)}</button>`),
      ) +
      '</div></div>',
  },
} as const;

type PageName = keyof typeof PAGES;
const featureId = (name: PageName) =>
  ({
    collection: 'collection-card-display',
    marketplace: 'marketplace-card-display',
    globalCollection: 'global-collection-card-display',
    profile: 'profile-card-display',
    trades: 'trades-card-display',
  })[name];

async function openPage(page: Page, name: PageName) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openSite(page, PAGES[name].path, { html: sitePage(PAGES[name].html) });
  await expect(page.locator('[data-face="a"]')).toBeVisible();
}

/** Largeur affichée d'une carte et espacement de la grille. */
async function measure(page: Page) {
  const face = await page.locator('[data-face="a"]').boundingBox();
  const gap = await page.locator('#grid').evaluate((grid) => getComputedStyle(grid).columnGap);
  return { width: Math.round(face?.width ?? 0), gap };
}

for (const name of Object.keys(PAGES) as PageName[]) {
  const { path, gap } = PAGES[name];

  test(`${path} : sans réglage, les cartes et leur espacement sont ceux du site`, async ({ page }) => {
    await openPage(page, name);
    await expect(page.locator('#grid')).toHaveClass(/wm-card-grid/);
    expect(await measure(page)).toEqual({ width: 160, gap: `${gap}px` });
  });

  test(`${path} : taille et espacement réglés pour cette page`, async ({ page }) => {
    await presetSettings(page, { features: {}, values: { [featureId(name)]: { scale: 150, gap: 40 } } });
    await openPage(page, name);
    await expect.poll(() => measure(page)).toEqual({ width: 240, gap: '40px' });
  });
}

test('chaque page a ses propres réglages', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'collection-card-display': { scale: 200, gap: 0 } } });
  await openPage(page, 'marketplace');
  await expect(page.locator('#grid')).toHaveClass(/wm-card-grid/);
  expect(await measure(page)).toEqual({ width: 160, gap: '20px' });
});

test('une grille recréée par le site est réglée elle aussi, la grande carte de la modale jamais', async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'collection-card-display': { scale: 50 } } });
  await openPage(page, 'collection');
  await expect.poll(() => measure(page)).toEqual({ width: 80, gap: '26px' });

  // Nouvelle liste (autre page, autres filtres) : React remplace la grille.
  await page.locator('#grid').evaluate((grid, html) => (grid.outerHTML = html), PAGES.collection.html);
  await expect.poll(() => measure(page)).toEqual({ width: 80, gap: '26px' });

  // Modale de carte : grande face (w-72) hors de toute grille.
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="fixed inset-0 z-50 flex items-center justify-center p-4"><div class="card-frame relative w-full">' +
        '<div class="flex flex-col md:flex-row gap-6"><div class="flex-shrink-0 flex justify-center">' +
        '<div id="big" class="w-72 h-[420px] glow-c relative rounded-2xl" style="width:288px;height:420px"><h3>Carte a</h3></div>' +
        '</div></div></div></div>',
    ),
  );
  await expect(page.locator('#big')).toBeVisible();
  expect(Math.round((await page.locator('#big').boundingBox())?.width ?? 0)).toBe(288);

  // Au repos, le script ne resynchronise plus la page.
  await page.waitForTimeout(300);
  const syncs = () => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
  const before = await syncs();
  await page.waitForTimeout(600);
  expect(await syncs()).toBe(before);
});

test('paramètres : curseur cranté de la taille et espacement, appliqués aussitôt', async ({ page }) => {
  await openPage(page, 'collection');
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByRole('button', { name: 'Collection' }).click();

  const section = dialog.locator('.wm-settings-section', { hasText: 'Apparence' });
  await expect(section.locator('.wm-settings-heading')).toHaveText('Apparence');
  await expect(section).toContainText('Taille des cartes de la collection et espace entre elles.');
  // Réglages obligatoires : pas d'interrupteur.
  await expect(section.getByRole('switch')).toHaveCount(0);

  const slider = section.getByRole('slider', { name: 'Taille des cartes' });
  await expect(slider).toHaveAttribute('aria-valuetext', '100 %');
  const ticks = section.locator('.wm-step-slider-tick');
  await expect(ticks).toHaveText(['50 %', '75 %', '87,5 %', '100 %', '112,5 %', '125 %', '150 %', '200 %']);

  // Sous son libellé, sur toute la largeur ; chaque cran à la place de sa valeur entre 50 et 200 %.
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (!box) throw new Error('curseur introuvable');
  expect(box.width).toBeGreaterThan(550);
  const centers = await ticks.evaluateAll((spans) =>
    spans.map((span) => {
      const rect = span.getBoundingClientRect();
      return rect.x + rect.width / 2;
    }),
  );
  const [first = 0, last = 0] = [centers[0], centers.at(-1)];
  const relative = centers.map((x) => Math.round(((x - first) / (last - first)) * 1000) / 1000);
  expect(relative).toEqual([0, 0.167, 0.25, 0.333, 0.417, 0.5, 0.667, 1]);
  // Le cran de 50 % et celui de 200 % sont aux deux bouts de la course du curseur (rond de 18 px).
  expect(Math.abs(first - (box.x + 9))).toBeLessThan(1);
  expect(Math.abs(last - (box.x + box.width - 9))).toBeLessThan(1);

  // Clavier : d'un cran à l'autre ; la grille suit sans fermer la fenêtre.
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '112,5 %');
  await expect.poll(() => measure(page)).toEqual({ width: 180, gap: '26px' });
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', '200 %');
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', '50 %');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '75 %');

  // Glissé : lâché à 145 %, le curseur est sur le cran de 150 %, pas entre deux.
  const at = (scale: number) => box.x + 9 + ((box.width - 18) * (scale - 50)) / 150;
  const y = box.y + box.height / 2;
  await page.mouse.move(at(75), y);
  await page.mouse.down();
  await page.mouse.move(at(145), y, { steps: 10 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuetext', '150 %');
  await expect(slider).toHaveValue('150');
  await expect(ticks.and(page.locator('[data-active]'))).toHaveText('150 %');
  await expect.poll(() => measure(page)).toEqual({ width: 240, gap: '26px' });

  // Clic sur un libellé.
  await section.locator('.wm-step-slider-tick', { hasText: /^75 %$/ }).click();
  await expect(slider).toHaveAttribute('aria-valuetext', '75 %');
  await expect.poll(() => measure(page)).toEqual({ width: 120, gap: '26px' });

  // Espacement : du pas de 2 px, borné de 0 à 64.
  const gap = section.getByRole('spinbutton', { name: 'Espacement entre les cartes' });
  await expect(gap).toHaveValue('26');
  await section.getByRole('button', { name: 'Augmenter : Espacement entre les cartes' }).click();
  await expect(gap).toHaveValue('28');
  await expect.poll(() => measure(page)).toEqual({ width: 120, gap: '28px' });
  await gap.fill('500');
  await gap.press('Enter');
  await expect(gap).toHaveValue('64');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wm-settings-v1') ?? 'null') as unknown);
  expect(stored).toEqual({ features: {}, values: { 'collection-card-display': { scale: 75, gap: 64 } } });

  // Retenu au rechargement.
  await page.reload();
  await expect.poll(() => measure(page)).toEqual({ width: 120, gap: '64px' });
});

test('paramètres : une section « Apparence » dans l’onglet de chaque page', async ({ page }) => {
  await openPage(page, 'collection');
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  for (const name of Object.keys(PAGES) as PageName[]) {
    await dialog.getByRole('button', { name: PAGES[name].tab, exact: true }).click();
    const section = dialog.locator('.wm-settings-section', { hasText: 'Apparence' });
    await expect(section.getByRole('slider', { name: 'Taille des cartes' })).toHaveAttribute('aria-valuetext', '100 %');
    await expect(section.getByRole('spinbutton', { name: 'Espacement entre les cartes' })).toHaveValue(String(PAGES[name].gap));
  }
});
