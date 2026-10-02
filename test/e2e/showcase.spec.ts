import { expect, test, type Page } from '@playwright/test';
import { collectLogs, letTimePass, openSite, rect, sitePage } from './support/site';

/**
 * Page 404 de Next.js telle que le site la rend à une adresse inconnue (capture du 30/09/2026) : ni en-tête ni solde,
 * mais sa feuille de style, dont les fenêtres du site reprises par le script ont besoin (ici, leur seule position).
 */
const NOT_FOUND = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>404: This page could not be found.</title>
<style>.fixed { position: fixed; } .inset-0 { inset: 0; }</style></head>
<body><div style="height:100vh;display:flex;align-items:center;justify-content:center"><div>
<style>body{color:#000;background:#fff;margin:0}</style>
<h1 class="next-error-h1">404</h1><div><h2>This page could not be found.</h2></div>
</div></div></body></html>`;

/** Groupe de la vitrine, par son titre. */
const group = (page: Page, title: string) => page.locator('.wm-showcase-group', { has: page.getByText(title, { exact: true }) });

async function openShowcase(page: Page): Promise<void> {
  await openSite(page, '/wm-ui', { html: NOT_FOUND });
  await expect(page.getByRole('heading', { name: 'Vitrine', level: 1 })).toBeVisible();
}

test('la vitrine recouvre la page 404 de /wm-ui, sans retirer ce que le site a rendu', async ({ page }) => {
  const logs = collectLogs(page);
  await openShowcase(page);

  const showcase = page.locator('.wm-showcase');
  await expect(showcase).toHaveCSS('position', 'fixed');
  for (const title of ['Boutons', 'Champs et choix', 'Toasts et modales', 'Badges, étiquettes, tampons', 'Icônes']) {
    await expect(showcase.getByRole('heading', { name: title, level: 2 })).toBeAttached();
  }
  await expect(page.locator('h1.next-error-h1')).toHaveText('404');
  expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.wm-showcase') !== null)).toBe(true);

  await page.getByRole('button', { name: 'Icônes' }).click();
  await expect(showcase.locator('.wm-showcase-icon').first()).toBeInViewport();
  expect(logs.filter((log) => log.type === 'error')).toEqual([]);
});

test('retirée de la page (React à l’hydratation), la vitrine est reposée', async ({ page }) => {
  await openShowcase(page);
  await page.evaluate(() => document.querySelector('.wm-showcase')?.remove());
  await expect(page.locator('.wm-showcase')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Vitrine', level: 1 })).toBeVisible();
});

test('les boutons de démonstration tournent le temps d’une requête simulée', async ({ page }) => {
  await openShowcase(page);
  const refresh = group(page, 'Standard').getByRole('button', { name: 'Actualiser' }).first();
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh.locator('.wm-spin')).toBeVisible();
  await expect(refresh).toBeEnabled();

  const twoStep = page.locator('.wm-showcase-two-step');
  await twoStep.click();
  await expect(twoStep).toHaveText('Confirmer ?');
  await expect(twoStep).toBeDisabled();
  await expect(twoStep).toBeEnabled();
  await twoStep.click();
  await expect(twoStep).toHaveText('Défausser tout');
  await expect(twoStep.locator('.wm-spin')).toBeVisible();
  await expect(twoStep).toBeEnabled();
});

test('chaque forme de bouton dans les six couleurs, pleine, en contour et ghost, en trois tailles', async ({ page }) => {
  await openShowcase(page);
  const shapes = [
    ['Standard', 4],
    ['Standard arrondi', 4],
    ['Fenêtre', 3],
    ['Fenêtre arrondie', 3],
    ['Pleine largeur', 3],
    ['Pleine largeur arrondie', 3],
    ['Carré', 3],
    ['Rond', 3],
  ] as const;
  for (const [shape, states] of shapes) {
    for (const tone of ['neutral', 'danger', 'info', 'accent', 'warning', 'pro']) {
      const buttons = group(page, shape).locator(`button.wm-tone-${tone}`);
      for (const fill of ['.wm-solid', '.wm-ghost']) {
        expect(await buttons.and(page.locator(fill)).count()).toBeGreaterThanOrEqual(states * 3);
      }
      expect(await buttons.and(page.locator(':not(.wm-solid, .wm-ghost)')).count()).toBeGreaterThanOrEqual(states * 3);
    }
  }
  // Une taille = une hauteur, quelle que soit la forme : grand 48 px, moyen = champs (45 px), petit 30 px.
  for (const [size, height] of [['lg', 48], ['md', 45], ['sm', 30]] as const) {
    for (const shape of ['Standard', 'Standard arrondi', 'Carré', 'Rond']) {
      const box = await rect(group(page, shape).locator(`button.wm-button-${size}`).first());
      expect(Math.round(box.height), `${shape} ${size}`).toBe(height);
    }
  }
  // Arrondi : bords à 100 % sur les formes longues, dans chaque groupe arrondi seulement.
  for (const shape of ['Standard arrondi', 'Fenêtre arrondie', 'Pleine largeur arrondie']) {
    const buttons = group(page, shape).locator('button');
    expect(await buttons.count()).toBe(await group(page, shape).locator('button.wm-pill').count());
    await expect(buttons.first()).toHaveCSS('border-top-left-radius', '9999px');
  }
  await expect(group(page, 'Standard').locator('button.wm-pill')).toHaveCount(0);
  await expect(group(page, 'Standard').locator('button').first()).toHaveCSS('border-top-left-radius', '8px');
  const info = group(page, 'Standard').locator('button.wm-tone-info');
  const transparent = 'rgba(0, 0, 0, 0)';
  const outline = info.and(page.locator(':not(.wm-solid, .wm-ghost)')).first();
  await expect(outline).toHaveCSS('background-color', transparent);
  expect(await outline.evaluate((button) => getComputedStyle(button).borderTopColor)).not.toBe(transparent);
  await expect(info.and(page.locator('.wm-ghost')).first()).toHaveCSS('border-top-color', transparent);
  expect(await info.and(page.locator('.wm-solid')).first().evaluate((button) => getComputedStyle(button).backgroundColor)).not.toBe(transparent);
});

test('le son est un rond ghost : vert allumé, gris éteint', async ({ page }) => {
  await openShowcase(page);
  const sound = group(page, 'Rond').getByRole('button', { name: 'Son' });
  await expect(sound).toHaveClass(/wm-tone-accent/);
  await sound.click();
  await expect(sound).toHaveClass(/wm-tone-neutral/);
  await expect(sound).toHaveClass(/wm-ghost/);
});

test('chaque sorte de toast s’affiche à sa place', async ({ page }) => {
  await openShowcase(page);
  await page.getByRole('button', { name: 'Erreur', exact: true }).click();
  await expect(page.locator('.wm-toaster[data-position="top-right"] .wm-toast[data-variant="error"]')).toContainText('Défausse refusée');

  await page.getByRole('button', { name: 'Tout d’un coup' }).click();
  await expect(page.locator('.wm-toaster[data-position="bottom-right"] .wm-toast')).toHaveCount(3);
  await expect(page.locator('.wm-toaster[data-position="top-right"] .wm-toast')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Voir l’enchère' })).toBeVisible();
});

test('un toast fermé s’efface en fondu, puis la pile se referme sur sa place', async ({ page }) => {
  await openShowcase(page);
  await page.getByRole('button', { name: 'Tout d’un coup' }).click();
  const stack = page.locator('.wm-toaster[data-position="top-right"] .wm-toast');
  await expect(stack).toHaveCount(2);
  const first = stack.nth(0);
  const second = stack.filter({ hasText: (await stack.nth(1).locator('.wm-toast-message').textContent())! });
  const top = (toast: typeof first) => toast.evaluate((el: HTMLElement) => el.offsetTop);
  const firstTop = await top(first);

  await first.getByRole('button', { name: 'Fermer' }).click();
  // Encore là, en sortie : ne répond plus, invisible pour les lecteurs d'écran.
  await expect(first).toHaveAttribute('data-leaving', 'true');
  await expect(first).toHaveAttribute('aria-hidden', 'true');
  await expect(first).toHaveCSS('animation-name', 'wm-toast-out, wm-toast-close-below');
  // Puis retiré ; le suivant a glissé jusqu'à sa place.
  await expect(stack).toHaveCount(1);
  expect(await top(second)).toBe(firstTop);
});

test('la barre de progression d’un toast minuté s’arrête sous le curseur et reprend quand il part', async ({ page }) => {
  await openShowcase(page);
  await page.getByRole('button', { name: 'Sans durée' }).click();
  await page.getByRole('button', { name: 'Info', exact: true }).click();
  await expect(page.locator('.wm-toast[data-variant="error"] .wm-toast-progress')).toHaveCount(0);

  const info = page.locator('.wm-toast[data-variant="info"]');
  const bar = info.locator('.wm-toast-progress');
  await expect(bar).toHaveCSS('animation-duration', '6s');
  const elapsed = () => bar.evaluate((el) => Number(el.getAnimations()[0]?.currentTime ?? -1));

  await info.hover();
  await expect(info).toHaveAttribute('data-paused', 'true');
  await expect(bar).toHaveCSS('animation-play-state', 'paused');
  const paused = await elapsed();
  await letTimePass(page, 400);
  expect(await elapsed()).toBe(paused);

  await page.mouse.move(0, 0);
  await expect(info).not.toHaveAttribute('data-paused');
  await expect(bar).toHaveCSS('animation-play-state', 'running');
  await expect.poll(elapsed).toBeGreaterThan(paused);
});

test('les modales s’ouvrent et se ferment : modale, confirmation, historique, offre PRO', async ({ page }) => {
  await openShowcase(page);

  await page.getByRole('button', { name: 'Modale', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Titre' });
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();

  await page.getByRole('button', { name: 'Confirmation', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Défausser cette carte ?' });
  await confirm.getByRole('button', { name: 'Défausser' }).click();
  await expect(confirm.getByRole('button', { name: 'Annuler' })).toBeDisabled();
  await expect(confirm).toBeHidden();
  await expect(page.locator('.wm-toast[data-variant="success"]')).toContainText('Carte défaussée');

  await page.getByRole('button', { name: 'Historique des ventes' }).click();
  const market = page.getByRole('dialog', { name: 'Tour Eiffel' });
  await expect(market).toContainText('140 ventes');
  await page.keyboard.press('Escape');
  await expect(market).toBeHidden();

  await page.getByRole('button', { name: 'Offre PRO' }).click();
  const offer = page.getByRole('dialog', { name: 'Vue du marché' });
  await expect(offer).toContainText('Vue du marché PRO');
  await page.keyboard.press('Escape');
  await expect(offer).toBeHidden();
});

test('absente des autres pages', async ({ page }) => {
  await openSite(page, '/collection', { html: sitePage() });
  await expect(page.getByRole('heading', { name: 'Page de test' })).toBeVisible();
  await expect(page.locator('.wm-showcase')).toHaveCount(0);
});
