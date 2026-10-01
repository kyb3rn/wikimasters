import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/** Hauteur du champ standard sans les variables du site : 5 × 0,25 rem + 2 px + 16 px × 1,25 / 0,875. */
const STANDARD = 20 + 2 + (16 * 1.25) / 0.875;

const TEXT = 'text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/30';
const PICKER =
  '<label class="relative flex size-[2.375rem] shrink-0 items-center justify-center cursor-pointer rounded-lg border border-[var(--color-border)]" title="Couleur">' +
  '<span class="size-[1.75rem] rounded-md" style="background:#e3b341;display:block;width:28px;height:28px"></span>' +
  '<input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" style="position:absolute;inset:0;opacity:0"></label>';

/**
 * Champs relevés sur le site (classes recopiées) : ceux à mettre à la hauteur standard, leurs voisins, et
 * ceux qui restent tels quels (renommage en ligne, connexion, zone de texte, montant, nos interfaces).
 */
const MAIN = `
<style>*, ::before, ::after { box-sizing: border-box; } input, select, textarea { font-size: 16px !important; }</style>
<input id="standard" type="text" placeholder="Rechercher par titre ou catégorie..." class="w-full rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-4 py-2.5 ${TEXT}">
<div class="relative"><input id="tag" maxlength="48" placeholder="Ajouter une étiquette…" role="combobox" class="w-full rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-3 py-2 ${TEXT}" type="text"></div>
<input id="battle" placeholder="ABC123" maxlength="6" class="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-light)] px-4 py-2.5 text-center text-lg font-bold uppercase">
<select id="sort" class="sm:w-56 py-2.5 px-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] outline-none text-sm cursor-pointer"><option>Récemment listées</option></select>
<div class="relative"><button id="listbox" type="button" aria-haspopup="listbox" aria-label="Trier les cartes" class="flex w-full min-h-[42px] min-w-0 items-center rounded-lg border border-[var(--color-border)] py-2 pl-3 pr-2 text-sm">Rareté</button></div>
<div id="chat" class="flex items-center gap-2 px-3 py-3" style="display:flex;align-items:center;gap:8px">
  <input placeholder="Message à la guilde…" maxlength="1000" class="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border)] text-sm" type="text">
  <button class="p-2.5 rounded-xl bg-[var(--color-accent)] flex-shrink-0" aria-label="Envoyer" style="padding:10px"><svg class="w-4 h-4" width="16" height="16" viewBox="0 0 24 24"></svg></button>
</div>
<div id="new-tag" class="flex gap-2" style="display:flex;gap:8px">
  ${PICKER}
  <input type="text" placeholder="Nouvelle étiquette…" maxlength="48" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-light)] px-3 py-2 text-sm leading-5">
  <button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm">Créer</button>
</div>
<div id="hex" class="mt-2 flex items-center gap-2" style="display:flex;align-items:center;gap:8px">
  ${PICKER}
  <input type="text" maxlength="7" aria-label="Code hexadécimal" class="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-sm leading-5 uppercase">
  <button type="button" class="ml-auto rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold">Appliquer</button>
</div>
<input id="rename" type="text" class="flex-1 rounded-md bg-[var(--color-surface-light)] border border-[var(--color-border)] px-2 py-1 text-sm">
<input id="login" type="email" class="w-full rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-4 py-3">
<textarea id="note" rows="3" class="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border)] text-sm resize-none"></textarea>
<input id="amount" type="number" aria-label="Mise de départ" class="flex-1 min-w-0 px-3 py-2.5 bg-transparent outline-none text-sm tabular-nums text-center">
<div class="wm-root"><input id="ours" type="text" class="border py-2"></div>
`;

const height = async (locator: Locator) => (await rect(locator)).height;
const width = async (locator: Locator) => (await rect(locator)).width;

async function openFields(page: Page) {
  await openSite(page, '/collection', { html: sitePage(MAIN) });
  await expect.poll(() => page.evaluate(() => Boolean(document.getElementById('wm-style-site-fields')))).toBe(true);
}

test('champs d’une ligne, listes déroulantes et select à la hauteur standard', async ({ page }) => {
  await openFields(page);
  for (const selector of ['#standard', '#tag', '#battle', '#sort', '#listbox', '#chat input', '#new-tag input[type="text"]', '#hex input[type="text"]']) {
    expect(await height(page.locator(selector)), selector).toBeCloseTo(STANDARD, 1);
  }
});

test('leurs voisins suivent : « Envoyer » et sélecteur de couleur en carrés, boutons à la même hauteur', async ({ page }) => {
  await openFields(page);
  const send = page.getByRole('button', { name: 'Envoyer' });
  expect(await height(send)).toBeCloseTo(STANDARD, 1);
  expect(await width(send)).toBeCloseTo(STANDARD, 1);
  for (const row of ['#new-tag', '#hex']) {
    const picker = page.locator(`${row} label`);
    expect(await height(picker), row).toBeCloseTo(STANDARD, 1);
    expect(await width(picker), row).toBeCloseTo(STANDARD, 1);
  }
  expect(await height(page.getByRole('button', { name: 'Créer' }))).toBeCloseTo(STANDARD, 1);
  expect(await height(page.getByRole('button', { name: 'Appliquer' }))).toBeCloseTo(STANDARD, 1);
});

test('restent tels quels : renommage en ligne, connexion, zone de texte, montant, nos interfaces', async ({ page }) => {
  await openFields(page);
  for (const selector of ['#rename', '#login', '#note', '#amount', '#ours']) {
    expect(Math.abs((await height(page.locator(selector))) - STANDARD), selector).toBeGreaterThan(1);
  }
});
