import { expect, test, type Page } from '@playwright/test';
import { CAROUSEL, openPulls as openFakePulls, PACK } from './support/pulls';
import { expectDomIdle, nextFrame, presetSettings, rect } from './support/site';

const GAVEL = '.wm-auction-quick';
const TRASH = '.wm-discard-next';
const AUCTION_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const CHUNK = '/_next/static/chunks/auction-modal.js';

const index = (page: Page) => page.evaluate(() => (window as unknown as { __pulls: { index: number } }).__pulls.index);
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mise en vente' });

/** Réponse qu'on libère quand on veut, pour observer l'état « en cours ». */
function held() {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => (release = resolve));
  return { ready, release };
}

interface Options {
  /** Défausse (`POST /api/user-cards/…/discard`) : réponse retenue jusqu'à ce qu'on la libère. */
  readonly discard?: Promise<void>;
  /** Chargement de la modale d'enchère du site (sa première ouverture). */
  readonly chunk?: Promise<void>;
  /** Toutes les cartes d'un coup (réglage par défaut) plutôt que le carrousel. */
  readonly grid?: boolean;
}

async function openPulls(page: Page, options: Options = {}) {
  const posted: unknown[] = [];
  if (!options.grid) await presetSettings(page, CAROUSEL);
  await openFakePulls(page, {
    api: { '/api/marketplace/mine': { sellingCount: 2, maxConcurrentAuctions: 10 } },
    discard: async (route) => {
      await options.discard;
      await route.fulfill({ json: { balance: 12661 } });
    },
    handle: async (route, url) => {
      if (url.pathname === '/api/marketplace' && route.request().method() === 'POST') {
        posted.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: { auction_id: AUCTION_ID } });
        return true;
      }
      if (url.pathname === CHUNK) {
        await options.chunk;
        await route.fulfill({ contentType: 'text/javascript', body: '' });
        return true;
      }
      return false;
    },
  });
  await page.click('#open');
  return posted;
}

test.beforeEach(async ({ page }) => {
  await presetSettings(page, { features: {}, values: { 'pulls-discard-next': { delayMs: 300 }, 'pulls-grid': { waveMs: 100 } } });
});

test('le marteau vert se place juste à gauche de la corbeille, après les pastilles', async ({ page }) => {
  await openPulls(page);
  const gavel = page.locator(GAVEL);
  await expect(gavel).toBeVisible();
  const layout = await gavel.evaluate((button) => {
    const container = button.parentElement;
    return {
      afterDots: container?.previousElementSibling?.querySelectorAll('button.w-3').length ?? 0,
      beforeTrash: container?.nextElementSibling?.querySelector('.wm-discard-next') !== null,
      classes: button.getAttribute('class') ?? '',
    };
  });
  expect(layout.afterDots).toBe(PACK.cards.length);
  expect(layout.beforeTrash).toBe(true);
  // Marteau, corbeille et flèche « suivante » resserrés ; l'écart des pastilles ne change pas.
  const box = (selector: string) => rect(page.locator(selector));
  const [dotsBox, gavelBox, trashBox, nextBox] = [
    await box('main div.flex.items-center.gap-2:has(> button.w-3)'),
    await box(GAVEL),
    await box(TRASH),
    await box('main button.w-12 >> nth=-1'),
  ];
  expect(Math.round(gavelBox.x - (dotsBox.x + dotsBox.width))).toBe(16);
  expect(Math.round(trashBox.x - (gavelBox.x + gavelBox.width))).toBe(8);
  expect(Math.round(nextBox.x - (trashBox.x + trashBox.width))).toBe(8);
  // Rond vert en contour, comme les flèches (rhabillées par site-buttons).
  expect(layout.classes).toContain('wm-button-round wm-button-md wm-tone-accent');
  await expect(gavel).toHaveCSS('color', 'rgb(227, 179, 65)');
  await expect(gavel).toHaveAttribute('title', 'Mettre aux enchères');
});

test('ouvre directement la mise en vente de la carte affichée ; Annuler ramène au carrousel', async ({ page }) => {
  await openPulls(page);
  await page.locator('main button.w-12').last().click();
  await page.locator(GAVEL).click();

  const sale = dialog(page);
  await expect(sale).toBeVisible();
  await expect(sale.locator('.wm-sale-card h3')).toHaveText('Musée du Louvre');
  // La modale de carte du site, ouverte pour l'occasion, ne se voit pas.
  await expect(page.locator('#card-modal')).toBeHidden();

  await sale.getByRole('button', { name: 'Annuler' }).click();
  await expect(sale).toHaveCount(0);
  await expect(page.locator('#card-modal')).toHaveCount(0);
  await expect(page.locator(GAVEL)).toHaveAttribute('data-status', 'ready');
  expect(await index(page)).toBe(1);
  await expect(page.locator('main .wm-pagination-locked, main .wm-carousel-locked')).toHaveCount(0);
  await page.locator('main button.w-12').first().click();
  expect(await index(page)).toBe(0);
});

test('Échap ferme la mise en vente et la modale de carte cachée', async ({ page }) => {
  await openPulls(page);
  await page.locator(GAVEL).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('#card-modal')).toHaveCount(0);
});

test('après la mise en vente : retour au carrousel, carte « En vente », marteau et corbeille verrouillés', async ({ page }) => {
  const posted = await openPulls(page);
  await page.locator(GAVEL).click();
  await dialog(page).getByLabel('Mise de départ').fill('25');
  await dialog(page).getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toContainText('« Tour Eiffel »');
  expect(posted).toEqual([{ card_id: 'u1', base_amount: 25, duration_minutes: 10 }]);
  await expect(page.locator('#card-modal')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/pulls');
  await expect(page.locator('main .wm-stamp')).toHaveText('En vente');
  await expect(page.locator(GAVEL)).toHaveAttribute('data-status', 'listed');
  await expect(page.locator(GAVEL)).toBeDisabled();
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'listed');

  // Carrousel rendu : flèches à pleine opacité, curseur normal, changement de carte possible.
  const next = page.locator('main button.w-12').last();
  await expect(page.locator('main .wm-pagination-locked, main .wm-carousel-locked')).toHaveCount(0);
  await expect(next).toHaveCSS('opacity', '1');
  await expect(next).not.toHaveCSS('cursor', 'not-allowed');
  await next.click();
  await expect.poll(() => index(page)).toBe(1);
});

test('pendant une défausse rapide, le marteau est grisé', async ({ page }) => {
  const discard = held();
  await openPulls(page, { discard: discard.ready });
  await page.locator(TRASH).click();

  const gavel = page.locator(GAVEL);
  await expect(gavel).toHaveAttribute('data-status', 'blocked');
  await expect(gavel).toHaveAttribute('title', 'Défausse en cours…');
  await expect(gavel).toBeDisabled();

  discard.release();
  await expect.poll(() => index(page)).toBe(1);
  await expect(gavel).toHaveAttribute('data-status', 'ready');
});

test('pendant le chargement de la mise en vente : roue, corbeille et carrousel verrouillés', async ({ page }) => {
  const chunk = held();
  await openPulls(page, { chunk: chunk.ready });
  await page.locator(GAVEL).click();

  await expect(page.locator(GAVEL)).toHaveAttribute('data-status', 'busy');
  await expect(page.locator(GAVEL)).toHaveCSS('cursor', 'not-allowed');
  await expect(page.locator(TRASH)).toHaveAttribute('data-status', 'blocked');
  await expect(page.locator(TRASH)).toHaveAttribute('title', 'Ouverture de la mise aux enchères…');
  await page.locator('main button.w-12').last().click({ force: true });
  expect(await index(page)).toBe(0);
  await expect(page.locator('#card-modal')).toBeHidden();

  chunk.release();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.wm-sale-card h3')).toHaveText('Tour Eiffel');
});

test('une carte défaussée ne se met pas aux enchères', async ({ page }) => {
  await openPulls(page);
  await page.locator(TRASH).click();
  await expect.poll(() => index(page)).toBe(1);
  await page.locator('main button.w-12').first().click();

  await expect(page.locator(GAVEL)).toHaveAttribute('data-status', 'discarded');
  await expect(page.locator(GAVEL)).toBeDisabled();
});

test('après un glissement, le site ignore le premier clic sur la carte : la mise en vente s’ouvre quand même', async ({ page }) => {
  await openPulls(page);
  await nextFrame(page); // zone mesurée une fois la page mise en place par le script
  const area = await rect(page.locator('main .relative').first());
  await page.mouse.move(area.x + area.width - 5, area.y + 20);
  await page.mouse.down();
  await page.mouse.move(area.x + 5, area.y + 20);
  await page.mouse.up();
  expect(await index(page)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __pulls: { swiped: boolean } }).__pulls.swiped)).toBe(true);

  await page.locator(GAVEL).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.wm-sale-card h3')).toHaveText('Musée du Louvre');
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openPulls(page);
  await page.locator(GAVEL).click();
  await expect(dialog(page)).toBeVisible();
  await expectDomIdle(page);
});

test.describe('toutes les cartes d’un coup', () => {
  const slot = (page: Page, index: number) => page.locator('main .wm-pulls-grid > .wm-pulls-slot').nth(index);
  const gavel = (page: Page, index: number) => slot(page, index).locator(`.wm-pulls-actions ${GAVEL}`);
  const trash = (page: Page, index: number) => slot(page, index).locator(`.wm-pulls-actions ${TRASH}`);

  async function openGrid(page: Page, options: Options = {}) {
    const posted = await openPulls(page, { ...options, grid: true });
    await expect(page.locator('main .wm-pulls-slot[data-state="arrived"]')).toHaveCount(PACK.cards.length);
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled();
    return posted;
  }

  test('un marteau sous chaque carte, juste à gauche de la corbeille (écart de la grille inchangé)', async ({ page }) => {
    await openGrid(page);
    await expect(page.locator(`main .wm-pulls-grid ${GAVEL}`)).toHaveCount(PACK.cards.length);
    const [gavelBox, trashBox] = [await rect(gavel(page, 1)), await rect(trash(page, 1))];
    expect(Math.round(trashBox.x - (gavelBox.x + gavelBox.width))).toBe(16);
    expect(Math.abs(gavelBox.y - trashBox.y)).toBe(0);
    await expect(gavel(page, 1)).toHaveCSS('color', 'rgb(227, 179, 65)');
  });

  test('ouvre la mise en vente de la carte choisie ; Annuler ramène à la grille', async ({ page }) => {
    const posted = await openGrid(page);
    await gavel(page, 0).click();

    const sale = dialog(page);
    await expect(sale.locator('.wm-sale-card h3')).toHaveText('Tour Eiffel');
    await expect(page.locator('#card-modal')).toBeHidden();
    await sale.getByRole('button', { name: 'Annuler' }).click();
    await expect(sale).toHaveCount(0);
    await expect(page.locator('#card-modal')).toHaveCount(0);
    await expect(page.locator('main .wm-pulls-grid')).toBeVisible();

    await gavel(page, 1).click();
    await expect(sale.locator('.wm-sale-card h3')).toHaveText('Musée du Louvre');
    await sale.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enchère publiée' })).toContainText('« Musée du Louvre »');
    expect(posted).toEqual([{ card_id: 'u2', base_amount: 10, duration_minutes: 10 }]);
    await expect(page.locator('#card-modal')).toHaveCount(0);
    await expect(gavel(page, 1)).toHaveAttribute('data-status', 'listed');
    await expect(trash(page, 1)).toHaveAttribute('data-status', 'listed');
    await expect(gavel(page, 0)).toHaveAttribute('data-status', 'ready');
    // Comme « Défaussée » : tampon « En vente » sur la carte de la grille, et seulement sur elle.
    await expect(slot(page, 1).locator('.wm-pulls-card .wm-stamp')).toHaveText('En vente');
    await expect(slot(page, 0).locator('.wm-stamp')).toHaveCount(0);
    await expect(slot(page, 2).locator('.wm-stamp')).toHaveCount(0);
    // Sa modale, ouverte depuis la grille : tamponnée, Vendre et Défausser verrouillés.
    await slot(page, 1).locator('.wm-pulls-card > *').click();
    const modal = page.locator('#card-modal');
    await expect(modal.locator('.wm-stamp')).toHaveText('En vente');
    await expect(modal.getByRole('button', { name: 'Vendre' })).toBeDisabled();
    await expect(modal.getByRole('button', { name: /Défausser/ })).toBeDisabled();
  });

  test('pendant l’ouverture, les autres marteaux et les corbeilles attendent', async ({ page }) => {
    const chunk = held();
    await openGrid(page, { chunk: chunk.ready });
    await gavel(page, 2).click();

    await expect(gavel(page, 2)).toHaveAttribute('data-status', 'busy');
    await expect(gavel(page, 0)).toHaveAttribute('data-status', 'blocked');
    await expect(gavel(page, 0)).toBeDisabled();
    for (const index of [0, 2]) {
      await expect(trash(page, index)).toHaveAttribute('data-status', 'blocked');
      await expect(trash(page, index)).toHaveAttribute('title', 'Ouverture de la mise aux enchères…');
    }

    chunk.release();
    await expect(dialog(page).locator('.wm-sale-card h3')).toHaveText('Mont Blanc');
    await dialog(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(trash(page, 0)).toHaveAttribute('data-status', 'ready');
    await expect(gavel(page, 0)).toHaveAttribute('data-status', 'ready');
  });

  test('dès le clic sur le marteau, la corbeille de la carte attend, avant même l’ouverture de sa modale', async ({ page }) => {
    await openGrid(page);
    // La carte du carrousel ne s'ouvre plus : l'enchère rapide reste à attendre la modale de carte.
    await page.evaluate(() =>
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('main [class*="glow-"]') && !target.closest('.wm-root')) event.stopImmediatePropagation();
        },
        true,
      ),
    );
    await gavel(page, 1).click();
    await expect(gavel(page, 1)).toHaveAttribute('data-status', 'busy');
    await expect(trash(page, 1)).toHaveAttribute('data-status', 'blocked');
    await expect(trash(page, 1)).toHaveAttribute('title', 'Ouverture de la mise aux enchères…');
    await expect(trash(page, 0)).toHaveAttribute('data-status', 'ready');

    // Faute de modale, l'enchère rapide abandonne : la corbeille est rendue.
    await expect(page.getByRole('alert')).toContainText("la carte ne s'est pas ouverte");
    await expect(trash(page, 1)).toHaveAttribute('data-status', 'ready');
  });

  test('pendant la défausse d’une carte, son marteau attend ; défaussée, il reste grisé', async ({ page }) => {
    const discard = held();
    await openGrid(page, { discard: discard.ready });
    await trash(page, 1).click();

    await expect(gavel(page, 1)).toHaveAttribute('data-status', 'blocked');
    await expect(gavel(page, 1)).toHaveAttribute('title', 'Défausse en cours…');
    await expect(gavel(page, 0)).toHaveAttribute('data-status', 'ready');

    discard.release();
    await expect(gavel(page, 1)).toHaveAttribute('data-status', 'discarded');
    await expect(gavel(page, 1)).toBeDisabled();
  });
});
