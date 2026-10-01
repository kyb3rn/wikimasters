import { expect, test, type Page } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

// « Choisir une carte » de la vitrine, balisage du code du site (30/09/2026). Pas de Tailwind dans le faux site :
// seules la largeur du cadre, les marges des zones (en couche comme chez lui) et les classes lues par le script
// comptent. Les pastilles se redessinent à chaque changement, « Réinitialiser » s'ajoute dès qu'une est cochée ;
// `siteLog` note le filtre.
const CSS =
  '<style>@layer base { *, ::before, ::after { box-sizing: border-box; } input { font-size: 16px !important; } } ' +
  '@layer utilities { .w-full { width: 100%; } .max-w-md { max-width: 28rem; } .px-5 { padding-inline: 1.25rem; } ' +
  '.py-3 { padding-block: .75rem; } .py-2 { padding-block: .5rem; } .pb-5 { padding-bottom: 1.25rem; } .overflow-y-auto { overflow-y: auto; } ' +
  '.card { width: 160px; height: 224px; } .card h3 { margin: 0; } }</style>';

const SCRIPT = `
const RARITIES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
const SMALL = 'px-2.5 py-0.5 text-[11px]';
const checked = new Set();
window.siteLog = [];

function renderPills(row) {
  row.innerHTML = RARITIES.map((r) => {
    const color = 'var(--color-rarity-' + r.toLowerCase() + ')';
    const state = checked.has(r) ? 'ring-2 ring-white/30' : 'opacity-50 hover:opacity-80';
    return '<button type="button" class="' + SMALL + ' rounded-full font-semibold transition-all cursor-pointer ' + state + '" ' +
      'style="background-color: ' + color + '30; color: ' + color + ';">' + r + '</button>';
  }).join('') + (checked.size ? '<button type="button" class="' + SMALL + ' rounded-full"><span class="inline-flex items-center gap-1">Réinitialiser</span></button>' : '');
}

function open() {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in';
  overlay.innerHTML =
    '<div class="w-full max-w-md max-h-[85vh] rounded-2xl border flex flex-col overflow-hidden animate-fade-in-up" id="picker">' +
    '<div class="flex items-center justify-between px-5 py-4 border-b"><div class="min-w-0"><h3 class="text-base font-bold truncate">Choisir une carte</h3></div>' +
    '<button class="cursor-pointer" id="site-close"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 2l14 14M16 2L2 16"></path></svg></button></div>' +
    '<div class="px-5 py-3 space-y-3" id="picker-search"><input type="text" placeholder="Rechercher une carte..." class="w-full rounded-lg border px-4 py-2.5 text-sm">' +
    '<div class="flex flex-wrap gap-2 mb-0" id="site-pills"></div></div>' +
    '<div class="flex-1 overflow-y-auto px-5 pb-5 min-h-[200px]" id="picker-list"><div class="flex flex-wrap justify-center gap-4 py-2">' +
    '<div><div class="glow-l card"><h3>Tour Eiffel</h3></div></div></div></div></div>';
  const row = overlay.querySelector('#site-pills');
  renderPills(row);
  row.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const text = button && button.textContent.trim();
    if (!text) return;
    if (text === 'Réinitialiser') checked.clear();
    else if (checked.has(text)) checked.delete(text);
    else checked.add(text);
    window.siteLog.push([...checked].join(',') || '-');
    renderPills(row);
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.querySelector('#site-close').addEventListener('click', close);
  function close() { checked.clear(); overlay.remove(); }
  document.body.append(overlay);
}
document.getElementById('add').addEventListener('click', open);`;

const MAIN = `${CSS}<div class="card-frame"><h2>Vitrine</h2><button id="add" type="button">Ajouter</button></div>`;

const FILTER = (page: Page) => page.getByRole('group', { name: 'Raretés' });
const FIELD = (page: Page) => page.locator('#picker-search input');

async function openPicker(page: Page, size = { width: 1400, height: 1200 }): Promise<void> {
  await page.setViewportSize(size);
  await openSite(page, '/profile', { html: sitePage(MAIN, SCRIPT) });
  await page.locator('#add').click();
  await expect(FILTER(page)).toBeVisible();
}

test("fenêtre élargie (5 cartes par ligne), 900 px de haut au plus", async ({ page }) => {
  await openPicker(page);
  const frame = page.locator('#picker');
  await expect(frame).toHaveCSS('max-width', '928px');
  await expect(frame).toHaveCSS('max-height', '900px');
  expect(Math.round((await rect(frame)).width)).toBe(928);
});

test('halo des cartes de la première ligne entier : 32 px au-dessus d’elles dans la zone qui défile', async ({ page }) => {
  await openPicker(page);
  const [list, card, field] = await Promise.all([rect(page.locator('#picker-list')), rect(page.locator('#picker-list .card')), rect(FIELD(page))]);
  expect(Math.round(card.y - list.y)).toBe(32);
  expect(Math.round(card.y - (field.y + field.height))).toBe(36);
});

test('raretés en cases collées au bout de la ligne du champ, à sa hauteur ; pastilles du site cachées', async ({ page }) => {
  await openPicker(page);
  const filter = FILTER(page);
  await expect(filter.locator('.wm-rarity')).toHaveText(['L', 'UR', 'SR', 'R', 'PC', 'C']);
  await expect(page.locator('#site-pills')).toBeHidden();
  await expect(FIELD(page)).toHaveAttribute('placeholder', 'Rechercher par nom ou description');

  const [field, box] = await Promise.all([rect(FIELD(page)), rect(filter)]);
  expect(Math.round(box.x - (field.x + field.width))).toBe(12);
  expect(Math.round(box.y)).toBe(Math.round(field.y));
  expect(Math.round(box.height)).toBe(Math.round(field.height));
});

test('chaque case clique la pastille du site ; la croix décoche tout (« Réinitialiser » du site)', async ({ page }) => {
  await openPicker(page);
  const filter = FILTER(page);
  const reset = filter.getByRole('button', { name: 'Décocher toutes les raretés' });
  await expect(reset).toBeDisabled();

  await filter.getByRole('button', { name: 'L', exact: true }).click();
  await filter.getByRole('button', { name: 'SR', exact: true }).click();
  await expect(filter.locator('[aria-pressed="true"]')).toHaveText(['L', 'SR']);
  await expect(reset).toBeEnabled();

  await reset.click();
  await expect(filter.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(reset).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { siteLog: string[] }).siteLog)).toEqual(['L', 'L,SR', '-']);
});

test('fenêtre rouverte : les cases reviennent', async ({ page }) => {
  await openPicker(page);
  // Sa croix est remplacée par celle de site-modals, qui la clique.
  await page.locator('#site-close').evaluate((button: HTMLElement) => button.click());
  await expect(page.locator('#picker')).toHaveCount(0);
  await page.locator('#add').click();
  await expect(FILTER(page).locator('.wm-rarity')).toHaveCount(6);
});

test('fenêtre étroite : les cases passent sous le champ', async ({ page }) => {
  await openPicker(page, { width: 400, height: 800 });
  const [field, box] = await Promise.all([rect(FIELD(page)), rect(FILTER(page))]);
  expect(box.y).toBeGreaterThanOrEqual(field.y + field.height);
});
