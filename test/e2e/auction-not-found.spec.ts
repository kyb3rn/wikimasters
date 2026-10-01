import { expect, test } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/** Mise en page du site : `<main>` de hauteur fixe, qui défile, non flex (voir page-spinner.spec.ts). */
const LAYOUT = `document.head.insertAdjacentHTML('beforeend', '<style>main { height: 500px; min-height: 0; overflow-y: auto; } .flex-1 { flex: 1 1 0%; } .p-6 { padding: 1.5rem; } .text-center { text-align: center; }</style>');`;

/** « Enchère introuvable », tel que le site le rend (capture du 30/09/2026). */
const NOT_FOUND =
  '<div id="message" class="flex-1 p-6 text-center text-[var(--color-foreground)]/50">Enchère introuvable.</div>';

test('« Enchère introuvable » est au milieu de la page, avec icône et retour au marché', async ({ page }) => {
  await openSite(page, '/marketplace/inconnue', { html: sitePage(NOT_FOUND, LAYOUT) });
  await expect(page.locator('main')).toHaveClass(/wm-auction-not-found/);
  const link = page.locator('#message a[href="/marketplace"]');
  await expect(link).toHaveText('← Retour au marché');
  const icon = page.locator('#message svg');
  const [main, box, iconBox, linkBox] = [await rect(page.locator('main')), await rect(page.locator('#message')), await rect(icon), await rect(link)];
  expect(box.height).toBeGreaterThan(400);
  // Icône au-dessus du texte, lien dessous, le tout centré dans `<main>`.
  expect(iconBox.y).toBeLessThan(linkBox.y);
  const middle = (iconBox.y + linkBox.y + linkBox.height) / 2;
  expect(Math.abs(middle - (main.y + main.height / 2))).toBeLessThan(20);
  expect(Math.abs(iconBox.x + iconBox.width / 2 - (main.x + main.width / 2))).toBeLessThan(20);
});

test('une enchère trouvée garde sa mise en page', async ({ page }) => {
  await openSite(page, '/marketplace/abc', {
    html: sitePage('<div class="flex-1 p-6 text-center"><h1 id="content">Carte</h1></div>', LAYOUT),
  });
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('main')).not.toHaveClass(/wm-auction-not-found/);
  await expect(page.locator('main svg')).toHaveCount(0);
});
