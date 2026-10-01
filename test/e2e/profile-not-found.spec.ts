import { expect, test } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/** Mise en page du site : `<main>` de hauteur fixe, qui défile, non flex (voir page-spinner.spec.ts). */
const LAYOUT = `document.head.insertAdjacentHTML('beforeend', '<style>main { height: 500px; min-height: 0; overflow-y: auto; } .flex-1 { flex: 1 1 0%; } .flex { display: flex; } .flex-col { flex-direction: column; } .items-center { align-items: center; } .justify-center { justify-content: center; }</style>');`;

/** « Profil introuvable », tel que le site le rend (capture du 30/09/2026). */
const NOT_FOUND =
  '<div id="message" class="flex-1 flex flex-col items-center justify-center gap-4 p-6">' +
  '<svg class="lucide lucide-lock size-12" width="48" height="48" viewBox="0 0 24 24"></svg>' +
  '<p class="text-center">Profil introuvable</p>' +
  '<a class="text-sm hover:underline" href="/friends">← Retour aux amis</a></div><!--$--><!--/$-->';

test('« Profil introuvable » est au milieu de la page', async ({ page }) => {
  await openSite(page, '/profile/Inconnu', { html: sitePage(NOT_FOUND, LAYOUT) });
  await expect(page.locator('main')).toHaveClass(/wm-profile-not-found/);
  const [main, message] = [await rect(page.locator('main')), await rect(page.locator('#message > p'))];
  expect(Math.abs(message.y + message.height / 2 - (main.y + main.height / 2))).toBeLessThan(20);
});

test('un profil trouvé garde sa mise en page', async ({ page }) => {
  await openSite(page, '/profile/Ami', {
    html: sitePage('<div class="flex-1 p-4 md:p-6 space-y-6"><h1 id="content">Ami</h1></div>', LAYOUT),
  });
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('main')).not.toHaveClass(/wm-profile-not-found/);
});
