import { expect, test, type Page } from '@playwright/test';
import { COLLECTION_HTML, entry } from './support/collection';
import { openSite, sitePage } from './support/site';

const LONG = 'Monuments historiques de la région parisienne et d’ailleurs, à revoir un jour';

/** Classes du site utiles à la mise en page, en couche comme sur le site (Tailwind v4). */
const TAILWIND = `<style>
@layer utilities {
  *, ::before, ::after { box-sizing: border-box; }
  .max-w-lg { max-width: 32rem; } .max-h-\\[90vh\\] { max-height: 90vh; } .w-full { width: 100%; }
  .overflow-hidden { overflow: hidden; } .min-h-0 { min-height: 0; } .flex-1 { flex: 1 1 0%; } .overflow-y-auto { overflow-y: auto; }
  .p-4 { padding: 1rem; } .p-3 { padding: .75rem; } .min-w-0 { min-width: 0; } .ml-auto { margin-left: auto; } .shrink-0 { flex-shrink: 0; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .space-y-2 > * + * { margin-top: .5rem; }
  .text-sm { font-size: .875rem; line-height: 1.25rem; } .size-2\\.5 { width: .625rem; height: .625rem; }
  .px-2 { padding-inline: .5rem; } .py-1 { padding-block: .25rem; } .inline-flex { display: inline-flex; }
}
</style>`;

function row(name: string, count: number): string {
  return (
    `<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-light)] p-3">` +
    `<div class="flex items-center gap-2 min-w-0"><span class="size-2.5 shrink-0 rounded-full" style="background:#e3b341"></span>` +
    `<span class="min-w-0 truncate text-sm font-semibold">${name}</span>` +
    `<span class="text-xs text-[var(--color-foreground)]/45">${count}<!-- --> carte<!-- -->${count > 1 ? 's' : ''}</span>` +
    `<div class="ml-auto flex items-center gap-1">` +
    ['Couleur', 'Renommer', 'Supprimer'].map((label) => `<button type="button" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">${label}</button>`).join('') +
    `</div></div></div>`
  );
}

/** Fenêtre « Gérer les étiquettes » (code du site, 29/09/2026), avec `rows` étiquettes. */
function managerPage(rows: number): string {
  const list = [row(LONG, 12), row('sport', 1), ...Array.from({ length: rows - 2 }, (_, i) => row(`étiquette ${i}`, i + 2))].join('');
  return sitePage(
    `${TAILWIND}<div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">` +
      `<div class="card-frame-solid relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden animate-fade-in-up isolate">` +
      `<button type="button" class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full" aria-label="Fermer">×</button>` +
      `<div class="border-b border-[var(--color-border)] p-4 pr-12"><h2 class="text-lg font-bold">Gérer les étiquettes</h2>` +
      `<p class="mt-1 text-xs">Créez, renommez, colorez ou supprimez vos étiquettes.</p></div>` +
      `<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--color-border)] p-3"><div class="space-y-2">${list}</div></div>` +
      `</div></div>`,
  );
}

const frame = (page: Page) => page.locator('.card-frame-solid');
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

async function openManager(page: Page, rows: number, height: number) {
  await page.setViewportSize({ width: 1280, height });
  await openSite(page, '/collection', { html: managerPage(rows) });
  await expect(frame(page)).toHaveClass(/wm-tag-manager/);
}

test('fenêtre 20 % plus large (614 px), au plus 900 px de haut, 90 % de l’écran sur un petit écran', async ({ page }) => {
  await openManager(page, 40, 1200);
  // Arrondi : l'animation d'entrée du cadre laisse des fractions de pixel.
  const size = async () => {
    const { width, height } = await box(page, '.card-frame-solid');
    return [Math.round(width), Math.round(height)];
  };
  expect(await size()).toEqual([614, 900]);

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect.poll(size).toEqual([614, 630]);
});

test('« n cartes » sur une ligne, collé aux boutons quand le nom est long (le nom est tronqué)', async ({ page }) => {
  await openManager(page, 3, 900);
  const long = page.locator('.card-frame-solid div.min-w-0', { hasText: LONG });
  const count = long.locator('span').nth(2);
  await expect(count).toHaveText('12 cartes');
  await expect(count).toHaveCSS('white-space', 'nowrap');

  const [name, counted, colour] = await Promise.all([
    long.locator('span.truncate').evaluate((el) => el.scrollWidth > el.clientWidth),
    count.boundingBox(),
    long.getByRole('button', { name: 'Couleur' }).boundingBox(),
  ]);
  expect(name).toBe(true);
  // Une seule ligne (hauteur de ligne de text-xs : 16 px), puis l'écart de la rangée (gap-2 : 8 px) avant « Couleur ».
  expect(counted?.height).toBe(16);
  expect(Math.round((colour?.x ?? 0) - ((counted?.x ?? 0) + (counted?.width ?? 0)))).toBe(8);
});

const GEAR = (page: Page) => page.getByRole('button', { name: 'Gérer les étiquettes', exact: true });
const TAG_LIST = (page: Page) => page.getByRole('button', { name: 'Filtrer par étiquette' });

/** Page Collection imitée : `requests` garde les listes demandées. */
async function openCollection(page: Page) {
  const server = { requests: [] as string[] };
  await openSite(page, '/collection', {
    html: COLLECTION_HTML,
    handle: async (route, url) => {
      if (url.pathname === '/api/my-collection') {
        server.requests.push(`liste ${url.searchParams.get('tag_id') ?? '-'}`);
        await route.fulfill({ json: { collection: [entry('u1', 'Tour Eiffel', 'R')], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        await route.fulfill({ json: { total: 1, rarityCounts: {}, tagOptions: [] } });
        return true;
      }
      return false;
    },
  });
  await expect(page.locator('#stage [class*="glow-"]')).toHaveCount(1);
  return server;
}

const manageOpened = (page: Page) => page.evaluate(() => (window as unknown as { __collection: { manageOpened: number } }).__collection.manageOpened);

test('engrenage carré collé à droite de la liste des étiquettes ; l’option « Gérer les étiquettes… » quitte la liste', async ({ page }) => {
  await openCollection(page);
  await expect(GEAR(page)).toBeVisible();
  const [list, gear] = await Promise.all([TAG_LIST(page).boundingBox(), GEAR(page).boundingBox()]);
  expect(Math.round(gear?.x ?? 0)).toBe(Math.round((list?.x ?? 0) + (list?.width ?? 0)));
  expect(Math.round(gear?.height ?? 0)).toBe(Math.round(list?.height ?? 0));
  expect(Math.round(gear?.width ?? 0)).toBe(Math.round(gear?.height ?? 0));

  await TAG_LIST(page).click();
  await expect(page.getByRole('option')).toHaveText(['Toutes les étiquettes', 'Sans étiquette', '#rare']);
  await expect(page.getByRole('option', { name: 'Gérer les étiquettes…', includeHidden: true })).toBeHidden();
});

test('l’engrenage ouvre la fenêtre du site sans changer de filtre ni recharger ; le menu ouvert se referme', async ({ page }) => {
  const server = await openCollection(page);
  await TAG_LIST(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();

  await GEAR(page).click();
  await expect(page.getByRole('heading', { name: 'Gérer les étiquettes' })).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(TAG_LIST(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(TAG_LIST(page)).toHaveText('Toutes les étiquettes');
  expect(await manageOpened(page)).toBe(1);
  expect(server.requests).toEqual(['liste -']);
});
