import { expect, test, type Locator } from '@playwright/test';
import { openFriendCollection } from './support/profile-collection';
import { expectDomIdle, openSite, sitePage } from './support/site';

/*
 * « Possédée » là où le site sait que je possède la carte sans l'afficher. Liste de souhaits de l'Accueil de guilde
 * (capture et code du 01/10/2026) : case de chaque demande sous le composant de la demande (clé = id de la demande ;
 * « Ma demande » sans clé), demandes lues dans l'état de l'Accueil (`wishlist[]`, `owned_copy_ids`).
 */
const wish = (key: string, id: string, label: string, pill: string) =>
  `<div class="flex flex-col items-center gap-1.5" data-wish="${key}"><div class="relative rounded-xl">` +
  `<div data-face="${id}" class="glow-ur relative rounded-2xl overflow-hidden" style="position:relative;width:160px;height:224px;overflow:hidden">` +
  '<div class="absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20" style="position:absolute;top:0;left:0;right:0;height:45%"></div>' +
  '<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20" style="position:absolute;top:45%;bottom:0">' +
  `<h3>Carte ${id}</h3><p>description</p>` +
  '<div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1">' +
  `<div class="min-w-0 max-w-full shrink-0"><span class="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[9px] font-bold ${pill}" title="${label}">${label}</span></div>` +
  '<div class="flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1"><span>9 000</span><span>9 371</span></div>' +
  '</div></div></div></div></div>';

const GUILD =
  '<div class="card-frame p-4 md:p-5 space-y-4"><h3>Liste de souhaits</h3><div class="flex flex-wrap justify-center gap-3">' +
  wish('', 'own', 'Ma demande', 'bg-[var(--color-accent)]/90 text-[var(--color-accent-foreground)]') +
  wish('w-a', 'a', 'gasgot', 'bg-black/55 text-white') +
  wish('w-b', 'b', 'flashito19', 'bg-black/55 text-white') +
  '</div></div>';

// `window.donate()` : je donne mon exemplaire de la carte de « a » (la page relit l'Accueil, la face est redessinée).
const GUILD_SCRIPT = `
  const home = { wishlist: [{ id: 'w-a', owned_copy_ids: ['uc-1'] }, { id: 'w-b', owned_copy_ids: [] }] };
  const homeFiber = kit.fiber(null, {}, null, { memoizedState: kit.hooks([[() => home]])[0] });
  for (const cell of document.querySelectorAll('[data-wish]')) {
    kit.fiber(cell, {}, kit.fiber(null, {}, homeFiber, { key: cell.dataset.wish || null }));
  }
  window.donate = () => {
    home.wishlist[0].owned_copy_ids = [];
    document.querySelector('[data-face="a"] p').textContent = 'description ';
  };
`;

const ownedBadge = (face: Locator) => face.getByText('Possédée', { exact: true });

test('liste de souhaits de guilde : « Possédée » sur les demandes dont je possède la carte, avant ATK · DEF', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(GUILD, GUILD_SCRIPT) });
  const owned = page.locator('[data-face="a"]');
  const badge = ownedBadge(owned);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('title', 'Dans ta collection');
  await expect(badge).toHaveClass(/bg-emerald-600\/90/);
  // Dans l'emplacement du bas, comme celle du site : juste avant ATK · DEF.
  expect(await owned.locator('div.mt-auto > .wm-root').evaluate((root) => root.nextElementSibling?.matches('.border-t'))).toBe(true);

  await expect(ownedBadge(page.locator('[data-face="b"]'))).toHaveCount(0);
  await expect(ownedBadge(page.locator('[data-face="own"]'))).toHaveCount(0);

  await page.evaluate(() => (window as unknown as { donate: () => void }).donate());
  await expect(badge).toHaveCount(0);
});

test('collection d’un autre joueur : « Possédée » sur les cartes que je possède aussi', async ({ page }) => {
  await openFriendCollection(page, {
    collection: () => [
      { id: 'u-1', card_id: 'c1', card: { id: 'c1', wikipedia_title: 'Anvers', rarity: 'L' }, tags: [], owned_by_viewer: true },
      { id: 'u-2', card_id: 'c2', card: { id: 'c2', wikipedia_title: 'Liège', rarity: 'R' }, tags: [], owned_by_viewer: false },
    ],
  });
  const cell = (title: string) => page.locator('#grid > div', { hasText: title });
  await expect(ownedBadge(cell('Anvers'))).toBeVisible();
  await expect(cell('Liège')).toBeVisible();
  await expect(ownedBadge(cell('Liège'))).toHaveCount(0);

  // Modale d'un de ses exemplaires (props du site : `friendUsername`, `userCardId`) : « Possédée » si je l'ai aussi.
  const modal = page.locator('#card-modal');
  await cell('Anvers').locator('[class*="glow-"]').click();
  await expect(modal.locator('h2')).toHaveText('Anvers');
  await expect(ownedBadge(modal)).toBeVisible();
  await expect(ownedBadge(modal)).toHaveClass(/text-\[10px\]/);
  // Fermée en fondu (site-modals) : partie une fois le fondu fini.
  await modal.getByRole('button', { name: 'Fermer' }).click();
  await expect(modal).toHaveCount(0);
  await cell('Liège').locator('[class*="glow-"]').click();
  await expect(modal.locator('h2')).toHaveText('Liège');
  await expect(ownedBadge(modal)).toHaveCount(0);
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openSite(page, '/guild', { html: sitePage(GUILD, GUILD_SCRIPT) });
  await expect(ownedBadge(page.locator('[data-face="a"]'))).toBeVisible();
  await expectDomIdle(page);
});
