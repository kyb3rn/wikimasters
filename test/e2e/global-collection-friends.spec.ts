import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage } from './support/site';

/*
 * Toutes les cartes (code du site, 01/10/2026) : chaque face de la grille a, dans l'emplacement du bas, « Possédée »
 * (`ownedCardIds`) puis la pastille bleue des amis qui l'ont (`friendOwners` : « pseudo +n », `title` = leurs pseudos).
 * États de la page imités dans l'ordre du site (compteurs, amis, possédées, liste de souhaits, offres) ; composant de
 * chaque face aux props `{ card, … }`. Un clic sur une face ouvre la modale de carte (vue catalogue, `catalogView`),
 * notée dans `window.opened`.
 */
const CARDS = [
  { id: 'c-a', wikipedia_title: 'Anvers', rarity: 'R' },
  { id: 'c-b', wikipedia_title: 'Liège', rarity: 'R' },
  { id: 'c-c', wikipedia_title: 'Namur', rarity: 'R' },
];
const OWNERS = { 'c-a': [{ id: 'f1', username: 'alice' }, { id: 'f2', username: 'bob le grand' }], 'c-b': [{ id: 'f1', username: 'alice' }] };
const OWNED = ['c-a', 'c-c'];

const SCRIPT = `
  const { el, fiber, hooks } = kit;
  const cards = ${JSON.stringify(CARDS)};
  const owners = ${JSON.stringify(OWNERS)};
  const owned = new Set(${JSON.stringify(OWNED)});
  const page = fiber(null, {}, null, {
    memoizedState: hooks([[() => ({})], [() => owners], [() => owned], [() => new Set()], [() => new Set()]])[0],
  });
  window.opened = [];

  const bottom = (card) => {
    const friends = owners[card.id] ?? [];
    const pills = (owned.has(card.id) ? '<span class="w-fit rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold text-white" title="Dans ta collection">Possédée</span>' : '') +
      (friends.length ? '<span class="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-full bg-sky-300/65 px-2 py-0.5 text-[9px] font-bold text-black/80" title="' +
        friends.map((f) => f.username).join(', ') + '"><svg class="lucide lucide-users size-2.5 shrink-0 opacity-90"></svg><span class="min-w-0 truncate">' +
        friends[0].username + (friends.length > 1 ? ' +' + (friends.length - 1) : '') + '</span></span>' : '');
    return '<div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1">' +
      (pills ? '<div class="min-w-0 max-w-full shrink-0"><div class="flex w-fit max-w-full flex-col gap-0.5">' + pills + '</div></div>' : '') +
      '<div class="flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1"><span>9 000</span><span>9 371</span></div></div>';
  };
  const faceOf = (card, cls, style) => {
    const face = el('div', cls + ' glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden');
    face.setAttribute('style', style);
    face.innerHTML = '<div class="absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20" style="position:absolute;top:0;left:0;right:0;height:45%"></div>' +
      '<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20" style="position:absolute;top:45%;left:0;right:0;bottom:0;display:flex;flex-direction:column">' +
      '<h3>' + card.wikipedia_title + '</h3>' + bottom(card) + '</div>';
    return face;
  };

  function openModal(card) {
    document.querySelector('.card-modal')?.remove();
    const back = el('div', 'card-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70');
    back.id = 'modal-' + card.id;
    fiber(back, {}, fiber(null, { card, onClose: () => back.remove(), catalogView: true, wishlisted: false }, page));
    const panel = el('div', 'card-frame relative w-full p-6');
    const title = el('h2', 'text-xl font-bold', card.wikipedia_title);
    const big = faceOf({ ...card, id: card.id }, 'w-72 h-[420px]', 'position:relative;width:288px;height:420px;background:#555');
    big.querySelector('.min-w-0.max-w-full')?.remove();
    panel.append(title, big);
    back.append(panel);
    document.body.append(back);
  }

  const grid = el('div', 'flex flex-wrap justify-center gap-3');
  grid.id = 'grid';
  for (const card of cards) {
    const face = faceOf(card, 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]', 'position:relative;width:160px;height:224px;background:#555');
    face.dataset.card = card.id;
    fiber(face, {}, fiber(null, { card, size: 'sm' }, page, { key: card.id }));
    // Comme le onClick de React : la modale s'ouvre au clic sur la face.
    face.addEventListener('click', () => { window.opened.push(card.id); openModal(card); });
    grid.append(face);
  }
  document.querySelector('main').append(grid);
`;

// Classes Tailwind de la pastille ronde, comme la feuille du site (base de Tailwind : bouton sans cadre ni marge).
const TAILWIND = `<style>@layer base, utilities;
@layer base { button { border: 0; padding: 0; background: none; font: inherit; } }
@layer utilities { .flex { display: flex; } .flex-col { flex-direction: column; } .gap-0\\.5 { gap: 2px; } .w-fit { width: fit-content; }
  .inline-flex { display: inline-flex; } .items-center { align-items: center; } .justify-center { justify-content: center; }
  .rounded-full { border-radius: 9999px; } .p-1 { padding: 4px; } .px-2 { padding-inline: 8px; } .py-0\\.5 { padding-block: 2px; } .text-\\[9px\\] { font-size: 9px; } }</style>`;

const HTML = sitePage(TAILWIND, SCRIPT);
const face = (page: Page, id: string) => page.locator(`[data-card="${id}"]`);
const opened = (page: Page) => page.evaluate(() => (window as unknown as { opened: string[] }).opened);

test('amis qui ont la carte : pastille ronde à côté de « Possédée », liste au clic sans ouvrir la carte', async ({ page }) => {
  await openSite(page, '/global-collection', { html: HTML });
  const a = face(page, 'c-a');
  const pill = a.getByRole('button', { name: "Amis qui l'ont" });
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute('title', 'alice, bob le grand');
  await expect(pill).toHaveClass(/rounded-full/);
  await expect(pill).toHaveClass(/bg-sky-300\/65/);
  // La pastille du site est cachée, « Possédée » reste.
  await expect(a.locator('span.bg-sky-300\\/65')).toBeHidden();
  const owned = a.getByText('Possédée', { exact: true });
  await expect(owned).toBeVisible();
  // Ronde, sur la ligne de « Possédée ».
  const [round, badge] = await Promise.all([rect(pill), rect(owned)]);
  expect(Math.abs(round.width - round.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(round.y + round.height / 2 - (badge.y + badge.height / 2))).toBeLessThanOrEqual(1);
  expect(round.x).toBeGreaterThan(badge.x + badge.width);

  await pill.click();
  expect(await opened(page)).toEqual([]);
  const dialog = page.getByRole('dialog', { name: "Amis qui l'ont" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Anvers · 2 amis');
  await expect(dialog.getByRole('link')).toHaveText(['ALalice', 'BObob le grand']);
  await expect(dialog.getByRole('link', { name: /bob le grand/ })).toHaveAttribute('href', '/profile/bob%20le%20grand');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // Un seul ami, sans « Possédée » : la pastille seule.
  await face(page, 'c-b').getByRole('button', { name: "Amis qui l'ont" }).click();
  await expect(page.getByRole('dialog', { name: "Amis qui l'ont" }).getByRole('link')).toHaveText(['ALalice']);
  await page.getByRole('dialog', { name: "Amis qui l'ont" }).getByRole('link').click();
  await expect(page).toHaveURL(/\/profile\/alice$/);
  expect(await opened(page)).toEqual([]);
});

test('modale d’une carte de Toutes les cartes : « Possédée » sur la carte si je l’ai', async ({ page }) => {
  await openSite(page, '/global-collection', { html: HTML });
  await face(page, 'c-a').locator('h3').click();
  const modal = page.locator('#modal-c-a');
  const badge = modal.getByText('Possédée', { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/text-\[10px\]/);
  expect(await modal.locator('div.mt-auto > .wm-root').evaluate((root) => root.nextElementSibling?.matches('.border-t'))).toBe(true);

  await page.evaluate(() => document.querySelector('.card-modal')?.remove());
  await face(page, 'c-b').locator('h3').click();
  const other = page.locator('#modal-c-b');
  await expect(other.locator('h2')).toHaveText('Liège');
  await expect(other.getByText('Possédée', { exact: true })).toHaveCount(0);
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openSite(page, '/global-collection', { html: HTML });
  await expect(face(page, 'c-a').getByRole('button', { name: "Amis qui l'ont" })).toBeVisible();
  await expectDomIdle(page);
});
