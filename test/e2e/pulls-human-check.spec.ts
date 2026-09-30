import { expect, test, type Page, type Route } from '@playwright/test';
import { openSite, sitePage } from './support/site';

/**
 * Choix du paquet sur `/pulls` avec l'encart « Vérification rapide » (balisage du 29/09/2026). Le titre
 * garde l'animation réelle du site (« forwards » : un transform reste une fois finie). Comme le site :
 * « Continuer » s'active avec la case, envoie le champ-piège, retire l'encart en cas de succès, sinon
 * écrit l'erreur sous le cadre des paquets.
 */
const LAYOUT = `<style>
*, ::before, ::after { box-sizing: border-box; }
main { height: 600px; overflow-y: auto; }
.flex-1 { flex: 1 1 0%; } .absolute { position: absolute; } .-left-\\[9999px\\] { left: -9999px; }
.max-w-lg { max-width: 32rem; } .mx-auto { margin-inline: auto; } .mb-4 { margin-bottom: 1rem; } .p-4 { padding: 1rem; }
.animate-fade-in-up { animation: .5s ease-out forwards site-fade-in-up; }
@keyframes site-fade-in-up { 0% { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>`;

const PAGE = sitePage(
  `${LAYOUT}
<div class="flex-1 flex flex-col items-center justify-center gap-4 md:gap-8 p-4 md:p-6">
  <div class="text-center animate-fade-in-up">
    <h1 class="text-3xl md:text-4xl font-bold mb-2">Ouvrir un paquet</h1>
    <div id="check" class="relative mx-auto max-w-lg mb-4 p-4 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-left text-sm">
      <label class="absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">Site web<input autocomplete="off" tabindex="-1" type="text" value="" name="website"></label>
      <p class="font-semibold text-[var(--color-accent)] mb-2">Vérification rapide</p>
      <p class="text-xs mb-3">Pour continuer à ouvrir des paquets, confirme que tu utilises l'application manuellement (pas de script ni bot).</p>
      <label class="flex cursor-pointer gap-3 mb-3"><input type="checkbox"><span>Je ne suis pas un robot</span></label>
      <button type="button" disabled class="w-full px-4 py-2.5 rounded-lg">Continuer</button>
    </div>
    <p class="text-sm">Découvrez 5 nouvelles cartes Wikipédia</p>
  </div>
  <button id="open" disabled style="width:256px;height:256px">Ouvrir</button>
  <div id="error"></div>
</div>`,
  `
(() => {
  const check = document.getElementById('check');
  const box = check.querySelector('input[type=checkbox]');
  const button = check.querySelector('button');
  box.onchange = () => { button.disabled = !box.checked; };
  button.onclick = async () => {
    button.disabled = true;
    button.textContent = 'Enregistrement...';
    try {
      const response = await fetch('/api/packs/verify-human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: check.querySelector('input[name=website]').value }),
      });
      const body = await response.json();
      if (!response.ok) { document.getElementById('error').textContent = body.error || 'Erreur inconnue'; return; }
      check.remove();
      document.getElementById('open').disabled = false;
    } catch {
      document.getElementById('error').textContent = 'Erreur réseau. Réessayez.';
    } finally {
      if (check.isConnected) { button.textContent = 'Continuer'; button.disabled = !box.checked; }
    }
  };
})();
`,
);

const VERIFIED = { pack_human_verified_at: '2026-09-29T08:00:00.000Z' };

async function open(page: Page, verify: (route: Route) => Promise<void>): Promise<string[]> {
  const bodies: string[] = [];
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSite(page, '/pulls', {
    html: PAGE,
    handle: async (route, url) => {
      if (url.pathname !== '/api/packs/verify-human') return false;
      bodies.push(route.request().postData() ?? '');
      await verify(route);
      return true;
    },
  });
  await expect(page.locator('#check')).toHaveClass(/wm-human-check/);
  return bodies;
}

/** Élément touché par un clic à cet endroit de l'écran. */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id || document.elementFromPoint(px, py)?.className, [x, y] as const);

test('/pulls : la vérification s’ouvre au centre de l’écran, par-dessus toute la page', async ({ page }) => {
  await open(page, (route) => route.fulfill({ json: VERIFIED }));
  const check = await page.locator('#check').boundingBox();
  if (!check) throw new Error('encart introuvable');
  expect(Math.abs(check.x + check.width / 2 - 640)).toBeLessThan(1);
  expect(Math.abs(check.y + check.height / 2 - 360)).toBeLessThan(1);
  expect(check.width).toBeCloseTo(512, 0);
  // Fond assombri : ni « Ouvrir » ni le solde ne sont cliquables à travers.
  const openBox = await page.locator('#open').boundingBox();
  if (!openBox) throw new Error('bouton « Ouvrir » introuvable');
  expect(await hitAt(page, openBox.x + 4, openBox.y + openBox.height - 4)).toContain('wm-human-check-host');
  const balance = page.getByRole('button', { name: 'Ouvrir la boutique WikiBidous' }).filter({ visible: true });
  const balanceBox = await balance.boundingBox();
  if (!balanceBox) throw new Error('solde introuvable');
  expect(await hitAt(page, balanceBox.x + balanceBox.width / 2, balanceBox.y + balanceBox.height / 2)).toContain('wm-human-check-host');
});

test('/pulls : cocher puis « Continuer » (clics de l’utilisateur) vérifie, la modale disparaît, le contenu ne bouge pas', async ({ page }) => {
  const bodies = await open(page, (route) => route.fulfill({ json: VERIFIED }));
  const title = page.getByRole('heading', { name: 'Ouvrir un paquet' });
  const before = await title.boundingBox();
  await page.getByRole('checkbox', { name: 'Je ne suis pas un robot' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#check')).toHaveCount(0);
  expect(bodies).toEqual(['{"website":""}']);
  await expect(page.locator('#open')).toBeEnabled();
  // Plus de fond : « Ouvrir » reçoit de nouveau les clics.
  await page.locator('#open').click({ trial: true, timeout: 2000 });
  // Ni déplacé ni réanimé (l'animation du titre ne se rejoue pas).
  expect(await title.boundingBox()).toEqual(before);
});

test('/pulls : pendant l’envoi, une roue à la place d’« Enregistrement... », bouton désactivé', async ({ page }) => {
  let answer = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await open(page, async (route) => {
    await answered;
    await route.fulfill({ status: 500, json: { error: 'Erreur inconnue' } });
  });
  await page.getByRole('checkbox', { name: 'Je ne suis pas un robot' }).check();
  const button = page.locator('#check button');
  const look = () =>
    button.evaluate((el) => {
      const spinner = getComputedStyle(el, '::after');
      return {
        text: el.textContent,
        textFill: getComputedStyle(el).webkitTextFillColor,
        cursor: getComputedStyle(el).cursor,
        spinner: spinner.content === 'none' ? null : spinner.animationName,
      };
    });
  expect((await look()).spinner).toBeNull();
  await button.click();
  await expect(button).toBeDisabled();
  // Le texte du site reste (lecteurs d'écran), invisible.
  expect(await look()).toEqual({ text: 'Enregistrement...', textFill: 'rgba(0, 0, 0, 0)', cursor: 'not-allowed', spinner: 'wm-spin' });
  answer();
  await expect(button).toBeEnabled();
  expect((await look()).spinner).toBeNull();
  expect((await look()).text).toBe('Continuer');
});

test('/pulls : un refus du site s’affiche en toast, la modale reste pour réessayer', async ({ page }) => {
  await open(page, (route) => route.fulfill({ status: 429, json: { error: 'Trop de tentatives, réessaie plus tard.' } }));
  await page.getByRole('checkbox', { name: 'Je ne suis pas un robot' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Vérification impossible');
  await expect(alert).toContainText('Trop de tentatives, réessaie plus tard.');
  await expect(page.locator('#check')).toHaveClass(/wm-human-check/);
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled();
});

test('/pulls : sans réponse du site, un toast le dit', async ({ page }) => {
  await open(page, (route) => route.abort('failed'));
  await page.getByRole('checkbox', { name: 'Je ne suis pas un robot' }).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "Le site n'a pas répondu (erreur réseau)." })).toBeVisible();
});
