import { expect, test } from '@playwright/test';
import { openSite, sitePage } from './support/site';

const PAGE = sitePage(`
<button id="off" disabled><svg width="16" height="16"></svg><span style="cursor: pointer">Désactivé</span></button>
<button id="on" style="cursor: pointer">Actif</button>
<input id="field" disabled>
<div id="aria" role="button" aria-disabled="true" style="cursor: pointer">ARIA</div>
`);

test('curseur « interdit » sur tout contrôle désactivé du site, contenu compris', async ({ page }) => {
  await openSite(page, '/collection', { html: PAGE });
  for (const selector of ['#off', '#off span', '#field', '#aria']) {
    await expect(page.locator(selector)).toHaveCSS('cursor', 'not-allowed');
  }
  await expect(page.locator('#on')).toHaveCSS('cursor', 'pointer');

  await page.locator('#on').evaluate((button: HTMLButtonElement) => (button.disabled = true));
  await expect(page.locator('#on')).toHaveCSS('cursor', 'not-allowed');
});
