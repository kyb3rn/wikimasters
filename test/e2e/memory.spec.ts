import { expect, test, type Page } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { putMarketRecords, readMarketRecords } from './support/market-db';
import { expectDomIdle, openSite, presetSettings, rect } from './support/site';

const MEMORY = 'button[aria-label="Mémoire WikiMasters"]';
const GEAR = 'button[aria-label="Paramètres WikiMasters"]';
const DAY = 86_400_000;

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mémoire' });
const section = (page: Page, id: string) => dialog(page).locator(`.wm-memory-section[data-set="${id}"]`);
const rows = (page: Page, id: string) => section(page, id).locator('.wm-memory-row:not([data-head])');

async function openMemory(page: Page, tab?: string) {
  await page.locator(`${MEMORY}:visible`).click();
  await expect(dialog(page)).toBeVisible();
  if (tab) await dialog(page).locator('.wm-side-tab', { hasText: tab }).click();
  return dialog(page);
}

const sale = (id: string, daysAgo: number, rarity: string, price: number) => ({
  id,
  final_price: price,
  settled_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
  rarity,
});

/** Trois cartes en cache : chargées il y a une heure, un jour, quarante jours. */
async function seedMarket(page: Page) {
  await putMarketRecords(page, 'sales', [
    { id: 'c1', title: 'Tour Eiffel', fetchedAt: Date.now() - DAY, sales: [sale('s1', 3, 'R', 20), sale('s2', 4, 'C', 10)] },
    { id: 'c2', title: 'Rome antique', fetchedAt: Date.now() - 40 * DAY, sales: [sale('s3', 41, 'UR', 180)] },
    { id: 'c3', title: 'Église', fetchedAt: Date.now() - 3_600_000, sales: [] },
  ]);
}

const listings = [
  {
    id: 'c1',
    title: 'Tour Eiffel',
    attempts: [
      { at: Date.now() - DAY, price: 180, minutes: 10, rarity: 'UR', shiny: false, auctionId: 'a1' },
      { at: Date.now() - 2 * DAY, price: 160, minutes: 60, rarity: 'L', shiny: true, auctionId: 'a2' },
    ],
  },
];

test('la base de données, juste à gauche de l’engrenage, ouvre la fenêtre Mémoire', async ({ page }) => {
  await openSite(page, '/achievements');
  // Un bouton devant chaque engrenage (barre mobile et boîte ordinateur), petit rond gris ghost comme lui.
  await expect(page.locator(MEMORY)).toHaveCount(2);
  const beforeGear = await page
    .locator(MEMORY)
    .evaluateAll((buttons, gear) => buttons.every((button) => button.parentElement?.nextElementSibling?.querySelector(gear) !== null), GEAR);
  expect(beforeGear).toBe(true);
  await expect(page.locator(MEMORY).first()).toHaveClass(/wm-button-round wm-button-sm wm-tone-neutral wm-ghost/);

  const memory = await openMemory(page);
  await expect(memory.locator('.wm-side-tab')).toHaveText([
    "Vue d'ensemble",
    'Historique du marché',
    'Historique des mises en vente',
    // Version de dev.
    'Prix souhaités',
    'Réglages',
    'Notifications',
    'Filtres retenus',
    'Technique',
  ]);
  await expect(memory.locator('.wm-side-tab > svg')).toHaveCount(8);
  await expectDomIdle(page);
});

test('fenêtre Mémoire : 1400 × 950, réduite à l’écran avec 16 px de marge', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openSite(page, '/achievements');
  const memory = await openMemory(page);
  const size = async () => {
    const frame = await rect(memory);
    return [Math.round(frame.width), Math.round(frame.height)];
  };
  expect(await size()).toEqual([1400, 950]);
  await page.setViewportSize({ width: 1100, height: 700 });
  expect(await size()).toEqual([1068, 668]);
});

test('historique du marché : liste, recherche, historique d’une carte, suppression en deux clics, données anciennes', async ({ page }) => {
  await openSite(page, '/achievements');
  await seedMarket(page);
  const memory = await openMemory(page, 'Historique du marché');

  // Les plus récentes d'abord ; ventes par rareté ; ancienne (au-delà de la durée du cache) mise en avant.
  await expect(rows(page, 'market-history').locator('.wm-memory-name, .wm-memory-open')).toHaveText(['Église', 'Tour Eiffel', 'Rome antique']);
  await expect(rows(page, 'market-history').nth(1).locator('.wm-memory-details')).toHaveText('2 ventes · R 1 · C 1');
  await expect(rows(page, 'market-history').nth(2).locator('.wm-memory-date')).toHaveAttribute('data-stale', '');
  await expect(rows(page, 'market-history').nth(0).locator('.wm-memory-date')).not.toHaveAttribute('data-stale');

  // Recherche à Entrée seulement, sans accents ni casse.
  const search = memory.getByLabel('Rechercher dans « Historique du marché »');
  await search.fill('EGLI');
  await expect(rows(page, 'market-history')).toHaveCount(3);
  await search.press('Enter');
  await expect(rows(page, 'market-history')).toHaveCount(1);
  await search.fill('');
  await search.press('Enter');
  await expect(rows(page, 'market-history')).toHaveCount(3);

  // Clic sur une carte : son historique, par-dessus.
  await rows(page, 'market-history').getByRole('button', { name: 'Tour Eiffel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tour Eiffel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tour Eiffel' })).toHaveCount(0);
  await expect(memory).toBeVisible();

  // Chargée il y a plus de 30 jours : Rome antique seulement ; tout sélectionner, puis supprimer après confirmation.
  await memory.getByRole('button', { name: 'Chargée' }).click();
  await page.getByRole('option', { name: 'Il y a plus de 30 jours' }).click();
  await memory.locator('.wm-memory-submit').click();
  await expect(memory.locator('.wm-memory-results')).toHaveText('1 élément sur 3');
  await memory.getByRole('checkbox', { name: 'Tout sélectionner' }).check();
  await memory.getByRole('button', { name: 'Supprimer la sélection' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer la sélection ?' });
  await expect(confirm).toContainText('1 élément de « Historique du marché » sera supprimé.');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await memory.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(rows(page, 'market-history')).toHaveCount(2);
  await expect(memory.locator('.wm-memory-results')).toHaveText('2 éléments');
  expect(((await readMarketRecords(page, 'sales')) as { id: string }[]).map((record) => record.id).sort()).toEqual(['c1', 'c3']);

  // Une ligne : corbeille, puis « Confirmer ? ».
  await memory.getByRole('button', { name: 'Supprimer « Église »' }).click();
  await memory.getByRole('button', { name: 'Confirmer ?' }).click();
  await expect(rows(page, 'market-history')).toHaveCount(1);
  expect(((await readMarketRecords(page, 'sales')) as { id: string }[]).map((record) => record.id)).toEqual(['c1']);
});

test('historique du marché : « Actualiser » d’une ligne redemande ses ventes, roue pendant la requête ; sans PRO, l’offre du site', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let count = 0;
  await openSite(page, '/achievements', {
    handle: async (route, url) => {
      if (url.pathname !== '/api/marketplace/cards/c2/sales') return false;
      count++;
      await held;
      await route.fulfill({ json: { wikipedia_title: 'Rome antique', sales: [sale('s3', 41, 'UR', 180), sale('s4', 1, 'UR', 200)], recent: [] } });
      return true;
    },
  });
  await seedMarket(page);
  await openMemory(page, 'Historique du marché');
  const rome = rows(page, 'market-history').filter({ hasText: 'Rome antique' });
  await expect(rome.locator('.wm-memory-date')).toHaveAttribute('data-stale', '');

  // À gauche de la corbeille, rond comme elle.
  const actions = rome.locator('.wm-memory-actions button');
  await expect(actions).toHaveCount(2);
  await expect(actions.first()).toHaveAccessibleName('Actualiser « Rome antique »');
  await expect(actions.first()).toHaveClass(/wm-button-round wm-button-sm/);

  const refresh = rome.getByRole('button', { name: 'Actualiser « Rome antique »' });
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh.locator('.wm-spin')).toBeVisible();
  release();
  await expect(rome.locator('.wm-memory-details')).toHaveText('2 ventes · UR 2');
  await expect(rome.locator('.wm-memory-date')).not.toHaveAttribute('data-stale');
  await expect(refresh).toBeEnabled();
  expect(count).toBe(1);
  await expectDomIdle(page);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('wikimasters:is-pro-changed', { detail: false })));
  await refresh.click();
  await expect(page.getByRole('dialog', { name: 'Vue du marché' })).toBeVisible();
  expect(count).toBe(1);
});

test('sélection : cocher, voir la sélection, tout désélectionner, tout cocher, supprimer la sélection', async ({ page }) => {
  await openSite(page, '/achievements');
  await seedMarket(page);
  const memory = await openMemory(page, 'Historique du marché');
  const selection = memory.locator('.wm-memory-selection');
  await rows(page, 'market-history').nth(0).getByRole('checkbox').check();
  await expect(selection).toContainText('1 élément sélectionné');

  // Sélection vidée depuis sa vue : la vue s'éteint, la case suivante n'y ramène pas.
  await selection.getByRole('switch', { name: 'Voir la sélection' }).click();
  await expect(rows(page, 'market-history')).toHaveCount(1);
  await rows(page, 'market-history').nth(0).getByRole('checkbox').uncheck();
  await expect(selection).toHaveCount(0);
  await expect(rows(page, 'market-history')).toHaveCount(3);
  await rows(page, 'market-history').nth(1).getByRole('checkbox').check();
  await expect(selection.getByRole('switch', { name: 'Voir la sélection' })).toHaveAttribute('aria-checked', 'false');
  await expect(rows(page, 'market-history')).toHaveCount(3);

  await selection.getByRole('button', { name: 'Tout désélectionner' }).click();
  await expect(selection).toHaveCount(0);
  await memory.getByRole('checkbox', { name: 'Tout sélectionner' }).check();
  await expect(selection).toContainText('3 éléments sélectionnés');
  await memory.getByRole('button', { name: 'Supprimer la sélection' }).click();
  await page.getByRole('alertdialog', { name: 'Supprimer la sélection ?' }).getByRole('button', { name: 'Supprimer' }).click();
  await expect(section(page, 'market-history').locator('.wm-memory-empty')).toHaveText('Rien de gardé.');
  expect(await readMarketRecords(page, 'sales')).toEqual([]);
});

test('historique du marché : filtres des ventes au bouton ou à Entrée ; la sélection survit aux filtres, « Voir la sélection » la montre', async ({ page }) => {
  await openSite(page, '/achievements');
  await seedMarket(page);
  const memory = await openMemory(page, 'Historique du marché');
  const names = rows(page, 'market-history').locator('.wm-memory-name, .wm-memory-open');
  const filters = memory.locator('.wm-memory-tools');
  const clear = filters.getByRole('button', { name: 'Réinitialiser les filtres' });
  await expect(clear).toHaveCount(0);

  // Rareté, sur la ligne de la recherche : rien ne change avant la loupe.
  await filters.getByRole('group', { name: 'Raretés' }).getByRole('button', { name: 'UR', exact: true }).click();
  await expect(names).toHaveCount(3);
  await expect(clear).toBeVisible();
  await memory.locator('.wm-memory-submit').click();
  await expect(names).toHaveText(['Rome antique']);

  // Prix médian des raretés cochées, à Entrée.
  const priceMax = filters.getByRole('spinbutton', { name: 'Prix médian maximum' });
  await priceMax.fill('100');
  await priceMax.press('Enter');
  await expect(section(page, 'market-history').locator('.wm-memory-empty')).toHaveText('Aucun élément trouvé.');

  // Réinitialiser : tout, aussitôt, puis le bouton s'en va.
  await clear.click();
  await expect(names).toHaveCount(3);
  await expect(priceMax).toHaveValue('');
  await expect(clear).toHaveCount(0);

  // Nombre de ventes ; chargée au-delà de la durée du cache.
  await filters.getByRole('spinbutton', { name: 'Ventes minimum' }).fill('2');
  await memory.locator('.wm-memory-submit').click();
  await expect(names).toHaveText(['Tour Eiffel']);
  await clear.click();
  await filters.getByRole('button', { name: 'Chargée' }).click();
  await page.getByRole('option', { name: 'Au-delà de la durée du cache' }).click();
  await memory.locator('.wm-memory-submit').click();
  await expect(names).toHaveText(['Rome antique']);
  await clear.click();

  // Une carte sélectionnée le reste quand les filtres la cachent, et compte.
  const selection = memory.locator('.wm-memory-selection');
  await rows(page, 'market-history').filter({ hasText: 'Tour Eiffel' }).getByRole('checkbox').check();
  await filters.getByRole('button', { name: 'Dernière vente' }).click();
  await page.getByRole('option', { name: 'Il y a plus de 30 jours' }).click();
  await memory.locator('.wm-memory-submit').click();
  await expect(names).toHaveText(['Église', 'Rome antique']);
  await expect(selection).toContainText('1 élément sélectionné');
  await rows(page, 'market-history').filter({ hasText: 'Rome antique' }).getByRole('checkbox').check();
  await expect(selection).toContainText('2 éléments sélectionnés');

  // « Voir la sélection » : elle seule, sans les filtres ; une nouvelle recherche l'éteint.
  const only = selection.getByRole('switch', { name: 'Voir la sélection' });
  await only.click();
  await expect(only).toHaveAttribute('aria-checked', 'true');
  await expect(names).toHaveText(['Tour Eiffel', 'Rome antique']);
  await expect(memory.locator('.wm-memory-results')).toHaveText('2 éléments sur 3');
  const search = memory.getByLabel('Rechercher dans « Historique du marché »');
  await search.fill('rome');
  await search.press('Enter');
  await expect(only).toHaveAttribute('aria-checked', 'false');
  await expect(names).toHaveText(['Rome antique']);
  await expect(selection).toContainText('2 éléments sélectionnés');

  // Suppression : toute la sélection, cachée comprise.
  await memory.getByRole('button', { name: 'Supprimer la sélection' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer la sélection ?' });
  await expect(confirm).toContainText('2 éléments de « Historique du marché » seront supprimés.');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect(section(page, 'market-history').locator('.wm-memory-empty')).toHaveText('Aucun élément trouvé.');
  await expect(selection).toHaveCount(0);
  expect(((await readMarketRecords(page, 'sales')) as { id: string }[]).map((record) => record.id)).toEqual(['c3']);
  await expectDomIdle(page);
});

test('historique des mises en vente : une ligne par carte, ses mises en vente dépliées, chacune supprimable', async ({ page }) => {
  await openSite(page, '/achievements');
  await putMarketRecords(page, 'listings', listings);
  const memory = await openMemory(page, 'Historique des mises en vente');
  const card = rows(page, 'listings').first();
  await expect(card.locator('.wm-memory-details')).toHaveText('2 mises en vente · Dernière : 180 wb · 10 min');
  await card.getByRole('button', { name: 'Déplier' }).click();
  const entries = section(page, 'listings').locator('.wm-memory-row[data-child]');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(1).locator('.wm-memory-title')).toContainText('L✦');
  await entries.nth(1).getByRole('button', { name: /^Supprimer/ }).click();
  await memory.getByRole('button', { name: 'Confirmer ?' }).click();
  await expect(entries).toHaveCount(1);
  const stored = (await readMarketRecords(page, 'listings')) as { attempts: { auctionId: string }[] }[];
  expect(stored[0]?.attempts.map((attempt) => attempt.auctionId)).toEqual(['a1']);
});

test('réglages listés sans corbeille ; filtres retenus en clair, oubliés en deux clics', async ({ page }) => {
  await presetSettings(page, { features: { resale: true }, values: { market: { cacheHours: 72 } } });
  await page.addInitScript(() => {
    localStorage.setItem('wm-collection-filters-v1', JSON.stringify({ sort: 'recent', tag: 'untagged', search: 'rome', rarities: 'L,UR' }));
  });
  await openSite(page, '/achievements');

  const memory = await openMemory(page, 'Réglages');
  const settings = rows(page, 'settings');
  await expect(settings.filter({ hasText: 'Revente : Afficher la page Revente' })).toContainText('Allumée');
  await expect(settings.filter({ hasText: 'Historique du marché : Durée du cache' })).toContainText('72 h');
  await expect(section(page, 'settings').getByRole('button', { name: /^Supprimer/ })).toHaveCount(0);
  await expect(section(page, 'settings').getByRole('button', { name: 'Tout supprimer' })).toHaveCount(0);

  await memory.locator('.wm-side-tab', { hasText: 'Filtres retenus' }).click();
  const collection = memory.locator('.wm-memory-row', { hasText: 'Collection' }).first();
  await expect(collection.locator('.wm-memory-details')).toHaveText('Tri : recent · Sans étiquette · Recherche : « rome » · Raretés : L, UR');
  await expect(memory.locator('.wm-memory-row', { hasText: 'Marché' }).first().locator('.wm-memory-details')).toHaveText('Rien de retenu');
  await collection.getByRole('button', { name: 'Supprimer « Collection »' }).click();
  await collection.getByRole('button', { name: 'Confirmer ?' }).click();
  await expect(collection.locator('.wm-memory-details')).toHaveText('Rien de retenu');
  expect(await page.evaluate(() => localStorage.getItem('wm-collection-filters-v1'))).toBeNull();
});

test('export : un fichier daté, les données choisies sous leur id', async ({ page }) => {
  await presetSettings(page, { features: { resale: true }, values: {} });
  await openSite(page, '/achievements');
  await seedMarket(page);
  await putMarketRecords(page, 'listings', listings);
  const memory = await openMemory(page);

  const choices = memory.locator('.wm-memory-choice');
  await expect(choices.locator('.wm-memory-choice-name')).toHaveText(['Historique du marché', 'Historique des mises en vente', 'Prix souhaités', 'Réglages']);
  await expect(choices.first().locator('.wm-memory-choice-note')).toContainText('3 éléments');
  await choices.filter({ hasText: 'Prix souhaités' }).getByRole('checkbox').uncheck();

  const [download] = await Promise.all([page.waitForEvent('download'), memory.getByRole('button', { name: 'Exporter', exact: true }).click()]);
  expect(download.suggestedFilename()).toMatch(/^wikimasters-memoire-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(await readFile(await download.path(), 'utf8')) as { format: string; data: Record<string, unknown> };
  expect(file.format).toBe('wikimasters-memoire');
  expect(Object.keys(file.data)).toEqual(['market-history', 'listings', 'settings']);
  expect((file.data['market-history'] as { id: string }[]).map((record) => record.id).sort()).toEqual(['c1', 'c2', 'c3']);
  expect(file.data.settings).toMatchObject({ features: { resale: true } });
});

test('import : aperçu de ce que la fusion ajoute ou change, puis fusion ; fichier étranger refusé', async ({ page }) => {
  await openSite(page, '/achievements');
  await seedMarket(page);
  const memory = await openMemory(page);

  const choose = async (content: unknown) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), memory.getByRole('button', { name: 'Choisir un fichier' }).click()]);
    await chooser.setFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) });
  };

  await choose({ autre: 'chose' });
  await expect(page.locator('.wm-toast', { hasText: "Ce fichier n'est pas un export de la Mémoire de WikiMasters." })).toBeVisible();

  await choose({
    format: 'wikimasters-memoire',
    version: 1,
    script: '0.6.0',
    exportedAt: '2026-10-04T07:12:00.000Z',
    data: {
      // c1 : une vente de plus ; c9 : nouvelle.
      'market-history': [
        { id: 'c1', title: 'Tour Eiffel', fetchedAt: Date.now(), sales: [sale('s1', 3, 'R', 20), sale('s5', 0, 'UR', 200)] },
        { id: 'c9', title: 'Marie Curie', fetchedAt: Date.now(), sales: [sale('s9', 1, 'SR', 70)] },
        { pas: 'une carte' },
      ],
      listings,
      settings: { features: { resale: true }, changedAt: { features: { resale: 1 } } },
      inconnue: {},
    },
  });
  // Troisième section : l'import (la deuxième, l'export, a aussi ses cases).
  const plan = memory.locator('.wm-memory-section').nth(2).locator('.wm-memory-choice');
  await expect(memory.locator('.wm-memory-file')).toContainText('(version 0.6.0)');
  await expect(plan.filter({ hasText: 'Historique du marché' })).toContainText('1 ajout · 1 mise à jour · 1 illisible');
  await expect(plan.filter({ hasText: 'Historique des mises en vente' })).toContainText('1 ajout');
  await expect(plan.filter({ hasText: 'inconnue' })).toContainText('Inconnue de cette version : ignorée');
  // Rien n'est écrit avant « Importer ».
  expect((await readMarketRecords(page, 'sales')).length).toBe(3);

  await memory.getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(page.locator('.wm-toast', { hasText: 'Import terminé' })).toContainText('3 ajouts · 1 mise à jour');
  const sales = (await readMarketRecords(page, 'sales')) as { id: string; sales: { id: string }[] }[];
  expect(sales.map((record) => record.id).sort()).toEqual(['c1', 'c2', 'c3', 'c9']);
  expect(sales.find((record) => record.id === 'c1')?.sales.map((entry) => entry.id).sort()).toEqual(['s1', 's2', 's5']);
  expect((await readMarketRecords(page, 'listings')).length).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wm-settings-v1') ?? '{}') as unknown)).toMatchObject({ features: { resale: true } });
});

test('toute donnée gardée par le script est déclarée à la fenêtre Mémoire', async ({ page }) => {
  await openSite(page, '/achievements');
  const declared = await page.evaluate(
    () => (window as unknown as { wm?: { memory?: { storage(): string[] } } }).wm?.memory?.storage() ?? [],
  );
  const used = new Set<string>();
  const root = path.resolve(import.meta.dirname, '../../src');
  for (const file of await readdir(root, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    for (const match of (await readFile(path.join(root, file), 'utf8')).matchAll(/'(wm-[a-z0-9-]+-v\d+)'/g)) used.add(match[1] ?? '');
  }
  expect(used.size).toBeGreaterThan(10);
  expect([...used].filter((key) => !declared.includes(key))).toEqual([]);
  expect(declared).toEqual(expect.arrayContaining(['idb:wm-market/sales', 'idb:wm-market/listings']));
});
