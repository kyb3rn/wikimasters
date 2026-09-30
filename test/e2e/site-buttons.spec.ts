import { expect, test, type Page } from '@playwright/test';
import { openSite, sitePage } from './support/site';

const TRASH = '<svg class="lucide lucide-trash-2 size-4" width="16" height="16" viewBox="0 0 24 24"></svg>';
const CLOSE = '<svg class="lucide lucide-x size-4" width="16" height="16" viewBox="0 0 24 24"></svg>';

/** Boutons relevés sur le site (classes recopiées) : d'action, et autres contrôles qui gardent leur allure. */
const MAIN = `
<div id="actions">
  <button id="launch" class="flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] text-sm font-semibold">Lancer l'enchère</button>
  <button id="sell" class="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-semibold">Vendre</button>
  <button id="discard" class="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-foreground)]/70">${TRASH}Défausser</button>
  <button id="counter" class="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/10 text-amber-400">Contre-offre</button>
  <button id="close" class="flex items-center justify-center size-7 rounded-full text-[var(--color-foreground)]/50">${CLOSE}</button>
</div>
<div id="others">
  <button id="pill" class="px-3 py-1 rounded-full text-xs font-semibold opacity-50">SR</button>
  <button id="tab" class="px-4 py-3 text-sm font-medium whitespace-nowrap text-[var(--color-foreground)]/50">Mes enchères</button>
  <button id="link" class="inline-flex items-center gap-1.5 text-xs text-[var(--color-foreground)]/55">Comment ça marche ?</button>
</div>
<div class="wm-root"><button id="ours" class="border py-2">À nous</button></div>
`;

async function openButtons(page: Page) {
  await openSite(page, '/trades', { html: sitePage(MAIN) });
  await expect(page.locator('#launch')).toHaveClass(/wm-button/);
}

test('boutons d’action du site : forme, couleur, remplissage et taille standard', async ({ page }) => {
  await openButtons(page);
  await expect(page.locator('#launch')).toHaveClass(/wm-button-standard wm-button-md wm-tone-accent wm-solid/);
  await expect(page.locator('#sell')).toHaveClass(/wm-tone-accent/);
  await expect(page.locator('#sell')).not.toHaveClass(/wm-solid|wm-ghost/);
  // Corbeille : rouge.
  await expect(page.locator('#discard')).toHaveClass(/wm-tone-danger/);
  await expect(page.locator('#counter')).toHaveClass(/wm-tone-warning/);
  await expect(page.locator('#close')).toHaveClass(/wm-button-round wm-button-sm wm-tone-neutral wm-ghost/);
  // Classes du site gardées (sa mise en page), nos mesures appliquées.
  await expect(page.locator('#launch')).toHaveClass(/flex-1/);
  await expect(page.locator('#launch')).toHaveCSS('padding-left', '16px');
  await expect(page.locator('#launch')).toHaveCSS('border-top-width', '1px');
  await expect(page.locator('#close')).toHaveCSS('width', '30px');
});

test('onglets, pastilles, liens en texte et nos propres boutons gardent leur allure', async ({ page }) => {
  await openButtons(page);
  for (const id of ['pill', 'tab', 'link', 'ours']) await expect(page.locator(`#${id}`)).not.toHaveClass(/wm-button/);
});

test('React réécrit les classes d’un bouton : il est rhabillé selon les nouvelles', async ({ page }) => {
  await openButtons(page);
  await page.evaluate(() => {
    const button = document.getElementById('sell');
    if (button) button.className = 'flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] text-sm';
  });
  await expect(page.locator('#sell')).toHaveClass(/wm-tone-accent wm-solid/);
});
