import { expect, test, type Page, type Route } from '@playwright/test';
import { openSite, sitePage } from './support/site';

// En-tête de son profil relevé sur le site (captures du 29/09/2026), données inventées. Le faux site n'a pas
// Tailwind : seule la mise en page du script compte ici.
const TAG = (name: string, count: number, rgb: string) =>
  `<span class="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none" ` +
  `style="background-color: rgba(${rgb}, 0.22); border-color: rgba(${rgb}, 0.5); color: rgba(248, 250, 252, 0.95);">` +
  `<span class="min-w-0 truncate">${name}</span><span class="shrink-0 opacity-75 font-medium tabular-nums">×${count}</span></span>`;

const PENCIL =
  '<svg class="lucide lucide-pencil size-2.5" viewBox="0 0 24 24"><path d="m15 5 4 4"/></svg>';

const OWN_PROFILE = `
<div class="flex-1 p-4 md:p-6 space-y-5">
  <div class="animate-fade-in-up"><h1 class="text-2xl md:text-3xl font-bold">Mon Profil</h1></div>
  <div id="site-header" class="card-frame p-3 sm:p-4 animate-fade-in-up">
    <div class="flex items-center gap-3 flex-wrap">
      <button id="site-avatar" type="button" title="Modifier la photo de profil" class="group relative w-12 h-12 rounded-full">
        <span class="text-base font-bold text-[var(--color-accent)]">JO</span>
        <span class="absolute inset-0 rounded-full" aria-hidden="true"></span>
        <span class="absolute bottom-0 right-0 w-5 h-5 rounded-full">${PENCIL}</span>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-xl font-bold truncate min-w-0">Joueur</h1>
        <p class="text-xs text-[var(--color-foreground)]/45 mt-0.5"><span><span class="whitespace-nowrap">1 416 cartes</span></span><span> <span class="whitespace-nowrap">· Depuis sept. 2026</span></span></p>
        <div class="mt-2 flex flex-wrap gap-1">${TAG('keep', 966, '255, 0, 0')}${TAG('trade', 353, '171, 46, 255')}${TAG('autre', 129, '0, 0, 0')}</div>
      </div>
      <div class="flex items-center gap-3 w-full sm:w-auto sm:flex-col sm:items-end sm:ml-auto">
        <div class="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
          <span id="site-visibility" class="text-xs text-[var(--color-foreground)]/40 order-2 sm:order-1">Visible de tous</span>
          <button id="site-switch" class="relative w-11 h-6 rounded-full bg-[var(--color-accent)]" aria-label="Rendre privé"><span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-5"></span></button>
        </div>
        <span class="text-xs font-medium text-[var(--color-foreground)]/50 sm:hidden">Profil public</span>
      </div>
    </div>
  </div>
  <div id="site-unique" class="animate-fade-in-up"><div class="card-frame p-4 text-center"><div class="text-2xl font-bold text-[var(--color-accent)]">1 380</div><div class="text-xs text-[var(--color-foreground)]/40 mt-1">Cartes uniques</div></div></div>
  <div id="showcase" class="card-frame">Vitrine</div>
</div>`;

// Interrupteur : le site change d'état à la réponse de `PATCH /api/profile/<pseudo>` ; la photo ouvre sa fenêtre.
const OWN_SCRIPT = `
const button = document.getElementById('site-switch');
const label = document.getElementById('site-visibility');
button.addEventListener('click', async () => {
  const next = button.getAttribute('aria-label') === 'Rendre public';
  const response = await fetch('/api/profile/Joueur', { method: 'PATCH', body: JSON.stringify({ is_public: next }) });
  if (!response.ok) return;
  button.setAttribute('aria-label', next ? 'Rendre privé' : 'Rendre public');
  button.className = 'relative w-11 h-6 rounded-full ' + (next ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-light)]');
  label.textContent = next ? 'Visible de tous' : 'Amis seulement';
});
document.getElementById('site-avatar').addEventListener('click', () => {
  const modal = document.createElement('div');
  modal.id = 'photo-modal';
  modal.innerHTML = '<h3>Photo de profil</h3>';
  document.body.append(modal);
});`;

const OTHER_PROFILE = `
<div class="flex-1 p-4 md:p-6 space-y-5">
  <div id="site-header" class="card-frame p-3 sm:p-4 animate-fade-in-up">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="w-12 h-12 rounded-full"><span class="text-base font-bold">AU</span></div>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-xl font-bold truncate min-w-0">Autre</h1>
        <p class="text-xs"><span><span class="whitespace-nowrap">6 060 cartes</span></span><span> <span class="whitespace-nowrap">· Depuis sept. 2026</span></span></p>
      </div>
    </div>
  </div>
</div>`;

const header = (page: Page) => page.getByRole('region', { name: 'Profil' });
const visibility = (page: Page) => header(page).getByRole('switch');

async function openProfile(page: Page, patch?: (route: Route) => Promise<void>): Promise<{ bodies: unknown[] }> {
  const bodies: unknown[] = [];
  await openSite(page, '/profile', {
    html: sitePage(OWN_PROFILE, OWN_SCRIPT),
    handle: async (route, url) => {
      if (url.pathname !== '/api/profile/Joueur' || route.request().method() !== 'PATCH') return false;
      bodies.push(route.request().postDataJSON());
      if (patch) await patch(route);
      else await route.fulfill({ json: { profile: {} } });
      return true;
    },
  });
  await expect(header(page)).toBeVisible();
  return { bodies };
}

test('remplace l’en-tête du site et sa carte « Cartes uniques » : photo, pseudo, ancienneté, cartes, étiquettes', async ({ page }) => {
  await openProfile(page);
  await expect(page.locator('#site-header')).toBeHidden();
  await expect(page.locator('#site-unique')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Mon Profil' })).toBeVisible();

  await expect(header(page).getByRole('heading', { name: 'Joueur' })).toBeVisible();
  await expect(header(page).locator('.wm-profile-photo')).toHaveText('JO');
  await expect(header(page)).toContainText('Depuis sept. 2026');
  await expect(header(page).locator('.wm-profile-stat-left')).toHaveText('1 416Cartes');
  await expect(header(page).locator('.wm-profile-stat-right')).toHaveText('1 380Cartes uniques');
  const tags = header(page).getByRole('list', { name: 'Étiquettes' }).getByRole('listitem');
  await expect(tags).toHaveText(['keep×966', 'trade×353', 'autre×129']);
  await expect(tags.first()).toHaveAttribute('style', /background-color: rgba\(255, 0, 0, 0\.22\)/);
});

test('mise en page : photo au centre à cheval sur le bas du fond, cartes de part et d’autre, visibilité en haut à droite', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openProfile(page);
  const box = async (selector: string) => {
    const found = await header(page).locator(selector).boundingBox();
    if (!found) throw new Error(`${selector} introuvable`);
    return found;
  };
  const frame = await header(page).boundingBox();
  if (!frame) throw new Error('en-tête introuvable');
  const cover = await box('.wm-profile-cover');
  const avatar = await box('.wm-profile-avatar');
  const name = await box('.wm-profile-name');
  const left = await box('.wm-profile-stat-left > :first-child');
  const right = await box('.wm-profile-stat-right > :first-child');
  const toggle = await box('.wm-profile-visibility');
  const tags = await box('.wm-profile-tags');

  const center = frame.x + frame.width / 2;
  expect(Math.abs(avatar.x + avatar.width / 2 - center)).toBeLessThan(2);
  expect(Math.abs(avatar.y + avatar.height / 2 - (cover.y + cover.height))).toBeLessThan(2);
  expect(Math.abs(name.x + name.width / 2 - center)).toBeLessThan(2);
  expect(name.y).toBeGreaterThan(avatar.y + avatar.height);
  expect(left.x + left.width).toBeLessThan(avatar.x);
  expect(right.x).toBeGreaterThan(avatar.x + avatar.width);
  expect(Math.abs(left.y - right.y)).toBeLessThan(1);
  expect(left.y).toBeGreaterThan(cover.y + cover.height);
  expect(toggle.y + toggle.height).toBeLessThan(cover.y + cover.height);
  expect(frame.x + frame.width - (toggle.x + toggle.width)).toBeLessThan(20);
  expect(tags.y).toBeGreaterThan(name.y + name.height);
});

test('visibilité : l’interrupteur passe par celui du site, roue et désactivé pendant sa requête', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const server = await openProfile(page, async (route) => {
    await held;
    await route.fulfill({ json: { profile: {} } });
  });
  await expect(visibility(page)).toHaveAccessibleName('Visible de tous');
  await expect(visibility(page)).toHaveAttribute('aria-checked', 'true');

  await visibility(page).click();
  await expect(visibility(page)).toBeDisabled();
  await expect(visibility(page).locator('.wm-spin')).toBeVisible();
  release();
  await expect(visibility(page)).toHaveAccessibleName('Amis seulement');
  await expect(visibility(page)).toHaveAttribute('aria-checked', 'false');
  await expect(visibility(page)).toBeEnabled();
  await expect(visibility(page).locator('.wm-spin')).toHaveCount(0);
  expect(server.bodies).toEqual([{ is_public: false }]);
});

test('visibilité refusée : message du site en toast, l’état ne change pas', async ({ page }) => {
  await openProfile(page, (route) => route.fulfill({ status: 429, json: { error: 'Trop de changements, réessaie plus tard' } }));
  await visibility(page).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Visibilité du profil');
  await expect(alert).toContainText('Trop de changements, réessaie plus tard');
  await expect(visibility(page)).toHaveAccessibleName('Visible de tous');
  await expect(visibility(page)).toBeEnabled();
});

test('photo changée par le site : son image, avec son cadrage, remplace les initiales', async ({ page }) => {
  await openProfile(page);
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.alt = 'Joueur';
    image.className = 'w-full h-full object-cover';
    image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    image.style.objectPosition = '30% 70%';
    document.querySelector('#site-avatar > span')?.replaceWith(image);
  });
  const photo = header(page).locator('.wm-profile-photo img');
  await expect(photo).toHaveAttribute('alt', 'Joueur');
  await expect(photo).toHaveCSS('object-position', '30% 70%');
  await expect(header(page).locator('.wm-profile-photo')).not.toContainText('JO');
});

test('la pastille de la photo ouvre la fenêtre « Photo de profil » du site', async ({ page }) => {
  await openProfile(page);
  await header(page).getByRole('button', { name: 'Modifier la photo de profil' }).click();
  await expect(page.locator('#photo-modal')).toContainText('Photo de profil');
});

test('profil d’un autre joueur : en-tête du site inchangé', async ({ page }) => {
  await openSite(page, '/profile/Autre', { html: sitePage(OTHER_PROFILE) });
  await expect(page.locator('#site-header')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(header(page)).toHaveCount(0);
});

test('au repos, le script ne resynchronise plus la page (pas de boucle)', async ({ page }) => {
  await openProfile(page);
  const syncs = () => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
  await page.waitForTimeout(300);
  const before = await syncs();
  await page.waitForTimeout(600);
  expect(await syncs()).toBe(before);
});
