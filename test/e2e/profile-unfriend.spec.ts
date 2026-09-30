import { expect, test, type Page, type Route } from '@playwright/test';
import { openSite, sitePage } from './support/site';

// Profil d'un ami (code du site du 30/09/2026) : « Retirer des amis » demande confirmation par window.confirm,
// puis envoie `DELETE /api/friends/<id>` (refus ignoré), le bouton affiche « … » et se désactive pendant ce temps.
const PROFILE = `
<div class="flex-1 p-4 md:p-6 space-y-5">
  <p id="friend-state">amis</p>
  <button id="unfriend" type="button" title="Retirer des amis" class="inline-flex items-center gap-2"><svg class="lucide lucide-user-minus size-2.5"></svg><span>Retirer des amis</span></button>
</div>`;

const SCRIPT = `
const button = document.getElementById('unfriend');
button.addEventListener('click', async () => {
  if (!window.confirm("Retirer Ami de votre liste d'amis ?")) return;
  button.disabled = true;
  button.lastElementChild.textContent = '…';
  try {
    const response = await fetch('/api/friends/f1', { method: 'DELETE' });
    if (!response.ok) return;
    document.getElementById('friend-state').textContent = 'retiré';
  } finally {
    button.disabled = false;
    button.lastElementChild.textContent = 'Retirer des amis';
  }
});`;

const dialog = (page: Page) => page.getByRole('alertdialog', { name: 'Retirer cet ami ?' });

async function openProfile(page: Page, remove: (route: Route) => Promise<void>): Promise<{ deleted: number; native: string[] }> {
  const seen = { deleted: 0, native: [] as string[] };
  page.on('dialog', (native) => {
    seen.native.push(native.message());
    void native.dismiss();
  });
  await openSite(page, '/profile/Ami', {
    html: sitePage(PROFILE, SCRIPT),
    handle: async (route, url) => {
      if (url.pathname !== '/api/friends/f1' || route.request().method() !== 'DELETE') return false;
      seen.deleted++;
      await remove(route);
      return true;
    },
  });
  return seen;
}

test('« Retirer des amis » : notre confirmation à la place de celle du navigateur', async ({ page }) => {
  const seen = await openProfile(page, (route) => route.fulfill({ json: { success: true } }));
  await page.getByRole('button', { name: 'Retirer des amis' }).click();
  await expect(dialog(page)).toContainText('Ami ne fera plus partie de vos amis.');
  await dialog(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog(page)).toBeHidden();
  expect(seen).toEqual({ deleted: 0, native: [] });

  await page.getByRole('button', { name: 'Retirer des amis' }).click();
  await dialog(page).getByRole('button', { name: 'Retirer' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#friend-state')).toHaveText('retiré');
  expect(seen).toEqual({ deleted: 1, native: [] });

  // Les autres confirmations du site restent celles du navigateur.
  await page.evaluate(() => window.confirm('Autre question ?'));
  expect(seen.native).toEqual(['Autre question ?']);
});

test('confirmé : roue jusqu’à la réponse ; refus du site en toast', async ({ page }) => {
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  await openProfile(page, async (route) => {
    await answered;
    await route.fulfill({ status: 403, json: { error: 'Action impossible pour le moment' } });
  });
  await page.getByRole('button', { name: 'Retirer des amis' }).click();
  const confirm = dialog(page).getByRole('button', { name: 'Retirer' });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('Action impossible pour le moment');
  await expect(page.locator('#friend-state')).toHaveText('amis');
});
