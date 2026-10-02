import { expect, test, type Page, type Route } from '@playwright/test';
import { expectDomIdle, openSite, rect, sitePage } from './support/site';

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

// Profil d'un autre joueur (captures et code du 01/10/2026) : « Signaler » en haut à droite, et pour un ami « Retirer
// des amis » à côté et « Vu il y a… » dans la ligne ; sous l'en-tête, les onglets (ami) ou la demande d'ami.
const SMALL_BUTTON =
  'inline-flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium ' +
  'text-[var(--color-foreground)]/35 transition-colors hover:bg-red-500/10 hover:text-red-400/90';
const icon = (name: string) => `<svg class="lucide lucide-${name} size-2.5 shrink-0 opacity-80" viewBox="0 0 24 24"><path d="M4 22V4"/></svg>`;
const REPORT = (name: string) =>
  `<button id="site-report" type="button" title="Signaler ${name}" class="${SMALL_BUTTON}">${icon('flag')}<span>Signaler</span></button>`;
const line = (...parts: string[]) =>
  `<p class="text-xs text-[var(--color-foreground)]/45 mt-0.5">` +
  parts.map((part, i) => `<span>${i > 0 ? ' ' : ''}<span class="whitespace-nowrap">${i > 0 ? '· ' : ''}${part}</span></span>`).join('') +
  `</p>`;
const identity = (avatar: string, name: string, parts: string[]) => `
    <div class="flex items-center gap-3 flex-wrap">
      <div class="w-12 h-12 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">${avatar}</div>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg sm:text-xl font-bold truncate min-w-0">${name}</h1>
        ${line(...parts)}
      </div>
    </div>`;

// Demande d'ami sous l'en-tête d'un joueur qui n'est pas un ami : à envoyer, envoyée, ou reçue.
const SEND = `<button id="site-request" class="w-full py-3 rounded-xl disabled:opacity-50">+ Envoyer une demande d'ami</button>`;
const SENT = `<div class="card-frame p-4 flex items-center justify-between"><p class="text-sm">Demande d'ami envoyée</p></div>`;
const RECEIVED =
  `<div class="card-frame p-4 flex items-center justify-between"><p class="text-sm">Inconnu vous a envoyé une demande d'ami</p>` +
  `<div class="flex gap-2"><button id="site-accept" class="px-3 py-1.5 rounded-lg text-xs">${icon('check')}Accepter</button>` +
  `<button id="site-decline" class="px-3 py-1.5 rounded-lg text-xs">${icon('x')}Refuser</button></div></div>`;

const FRIEND_PROFILE = `
<div class="flex-1 p-4 md:p-6 space-y-5">
  <a id="back" class="text-sm inline-flex items-center gap-1" href="/friends">← Amis</a>
  <div id="site-header" class="card-frame p-3 sm:p-4 animate-fade-in-up">
    <div class="-mt-0.5 mb-1 flex justify-end"><div class="flex items-center gap-1">${REPORT('Ami')}<button id="site-unfriend" type="button" title="Retirer des amis" class="${SMALL_BUTTON} disabled:cursor-not-allowed disabled:opacity-40">${icon('user-minus')}<span>Retirer des amis</span></button></div></div>
    ${identity(
      '<img alt="Ami" class="w-full h-full object-cover" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="object-position: 39% 60%;">',
      'Ami',
      ['45 583 cartes', 'Depuis août 2026', 'Vu il y a 10 min'],
    )}
  </div>
  <div id="site-tabs" class="flex border-b animate-fade-in-up"><button>Vitrine</button><button>Collection</button></div>
</div>`;

// « Signaler » ouvre la fenêtre du site ; « Retirer des amis » : window.confirm, bouton « … » et désactivé pendant
// `DELETE /api/friends/<id>`, puis le profil relu n'est plus celui d'un ami.
const FRIEND_SCRIPT = `
document.getElementById('site-report').addEventListener('click', () => {
  const modal = document.createElement('div');
  modal.id = 'report-modal';
  modal.textContent = 'Signaler Ami';
  document.body.append(modal);
});
const unfriend = document.getElementById('site-unfriend');
unfriend.addEventListener('click', async () => {
  if (!window.confirm("Retirer Ami de votre liste d'amis ?")) return;
  unfriend.disabled = true;
  unfriend.lastElementChild.textContent = '…';
  try {
    const response = await fetch('/api/friends/f1', { method: 'DELETE' });
    if (!response.ok) return;
    unfriend.remove();
    document.querySelector('#site-header p > span:last-child').remove();
    document.getElementById('site-tabs').outerHTML = ${JSON.stringify(`<div id="site-request-block" class="animate-fade-in-up">${SEND}</div>`)};
  } finally {
    unfriend.disabled = false;
    unfriend.lastElementChild.textContent = 'Retirer des amis';
  }
});`;

// « Échanger » : état React de la page (profil `{ id, username }` sous un contexte, la session) et modules du site
// imités d'après Turbopack (code du 02/10/2026). React, react-dom/client instanciés ; modale de carte inscrite, avec
// son enveloppe de « Proposer un échange » et son chargeur 799047 ; celui-ci attend `window.tradeLoad()`, puis rend
// la fenêtre d'échange (#trade-window, « Annuler » appelle `onClose`).
const SITE_MODULES = `
const session = { $$typeof: Symbol.for('react.context') };
const pageFiber = {
  memoizedProps: {},
  memoizedState: { memoizedState: true, queue: { dispatch() {} }, next: { memoizedState: { id: 'u-ami', username: 'Ami' }, queue: { dispatch() {} }, next: null } },
  return: { type: session, memoizedProps: { value: 'u0', children: null }, return: null },
};
document.getElementById('site-header')['__reactFiber$test'] = { memoizedProps: {}, return: pageFiber };

const factories = new Map();
const cache = {};
const proto = { M: factories, c: cache, i: (id) => instantiate(id).exports, A(id) { return instantiate(id).exports(this.i); } };
function instantiate(id) {
  const key = String(id);
  if (cache[key]) return cache[key];
  const module = { exports: {} };
  cache[key] = module;
  factories.get(id)(Object.create(proto), module, module.exports);
  return module;
}
window.TURBOPACK = {
  push(chunk) {
    if (chunk.length === 2) return void Promise.resolve().then(() => chunk[1].runtimeModuleIds.forEach(instantiate));
    for (let i = 1; i < chunk.length; i += 2) if (!factories.has(chunk[i])) factories.set(chunk[i], chunk[i + 1]);
  },
};
const createElement = (type, props, child) => ({ type, props: { ...props, children: child } });
factories.set(1, (e, m) => { m.exports = { createElement, createContext() {}, useState() {} }; });
factories.set(2, (e, m) => {
  m.exports = {
    hydrateRoot() {},
    createRoot() {
      let shown;
      return {
        render(element) {
          window.tradeContexts = [];
          while (typeof element.type !== 'function') {
            window.tradeContexts.push(element.props.value);
            element = element.props.children;
          }
          shown = element.type(element.props);
          document.body.append(shown);
        },
        unmount() { shown?.remove(); window.tradeUnmounts = (window.tradeUnmounts ?? 0) + 1; },
      };
    },
  };
});
factories.set(3, function (e) {
  function $({friendUsername:r,friendProfileId:l,preselectedFriendCard:s,onClose:n}){let[o,i]=(0,a.useState)(null);return((0,a.useEffect)(()=>{e.A(799047).then(e=>{i(()=>e.default)})},[]),o)}
});
factories.set(799047, (e, m) => { m.exports = (load) => window.tradeLoad().then(() => load(273271)); });
factories.set(273271, (e, m, exports) => {
  exports.default = (props) => {
    window.tradeProps = { friendUsername: props.friendUsername, friendProfileId: props.friendProfileId };
    const root = document.createElement('div');
    root.id = 'trade-window';
    root.innerHTML = '<h2>Échanger avec <span>' + props.friendUsername + '</span></h2><button id="trade-cancel">Annuler</button>';
    root.querySelector('#trade-cancel').addEventListener('click', () => props.onClose());
    return root;
  };
});
instantiate(1);
instantiate(2);
window.tradeLoad = () => Promise.resolve();`;

const STRANGER_PROFILE = (request: string) => `
<div class="flex-1 p-4 md:p-6 space-y-5">
  <a id="back" class="text-sm inline-flex items-center gap-1" href="/friends">← Amis</a>
  <div id="site-header" class="card-frame p-3 sm:p-4 animate-fade-in-up">
    <div class="-mt-0.5 mb-1 flex justify-end">${REPORT('Inconnu')}</div>
    ${identity('<span class="text-base font-bold text-[var(--color-accent)]">IN</span>', 'Inconnu', ['6 060 cartes', 'Depuis sept. 2026'])}
  </div>
  <div id="site-request-block" class="animate-fade-in-up">${request}</div>
  <div id="showcase" class="animate-fade-in-up"><div class="card-frame overflow-hidden"><h2>Vitrine</h2></div></div>
</div>`;

// Envoi : « Envoi... » et désactivé pendant `POST /api/friends`, puis « Demande d'ami envoyée » (rien si refusé).
// Réponse : `PATCH /api/friends/f2` sans désactiver ses boutons, puis ami (onglets) ou de nouveau l'envoi.
const STRANGER_SCRIPT = `
const block = document.getElementById('site-request-block');
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (button?.id === 'site-request') {
    button.disabled = true;
    button.textContent = 'Envoi...';
    try {
      const response = await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ addressee_id: 'u1' }) });
      if (response.ok) block.innerHTML = ${JSON.stringify(SENT)};
    } finally {
      button.disabled = false;
      button.textContent = ${JSON.stringify("+ Envoyer une demande d'ami")};
    }
  }
  if (button?.id === 'site-accept' || button?.id === 'site-decline') {
    const action = button.id === 'site-accept' ? 'accept' : 'decline';
    await fetch('/api/friends/f2', { method: 'PATCH', body: JSON.stringify({ action }) });
    if (action === 'accept') block.outerHTML = '<div id="site-tabs" class="flex border-b"><button>Vitrine</button><button>Collection</button></div>';
    else block.innerHTML = ${JSON.stringify(SEND)};
  }
});`;

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
  const box = (selector: string) => rect(header(page).locator(selector));
  const frame = await rect(header(page));
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

async function openFriend(page: Page, remove?: (route: Route) => Promise<void>): Promise<{ deleted: number }> {
  const seen = { deleted: 0 };
  await openSite(page, '/profile/Ami', {
    html: sitePage(FRIEND_PROFILE, FRIEND_SCRIPT + SITE_MODULES),
    handle: async (route, url) => {
      if (url.pathname !== '/api/friends/f1' || route.request().method() !== 'DELETE') return false;
      seen.deleted++;
      if (remove) await remove(route);
      else await route.fulfill({ json: { success: true } });
      return true;
    },
  });
  await expect(header(page)).toBeVisible();
  return seen;
}

test('profil d’un ami : même en-tête, « Depuis … » puis sa dernière activité sous le pseudo, « Échanger » à droite, boutons du site en bas à droite', async ({ page }) => {
  await openFriend(page);
  await expect(page.locator('#site-header')).toBeHidden();
  await expect(page.locator('#back')).toBeVisible();
  await expect(page.locator('#site-tabs')).toBeVisible();

  await expect(header(page).getByRole('heading', { name: 'Ami' })).toBeVisible();
  const photo = header(page).locator('.wm-profile-photo img');
  await expect(photo).toHaveAttribute('alt', 'Ami');
  await expect(photo).toHaveCSS('object-position', '39% 60%');
  await expect(header(page).locator('.wm-profile-identity > p')).toHaveText(['Depuis août 2026', 'Vu il y a 10 min']);
  await expect(header(page).locator('.wm-profile-stat-left')).toHaveText('45 583Cartes');
  await expect(header(page).locator('.wm-profile-stat-right')).toHaveCount(0);
  await expect(header(page).locator('.wm-profile-trade').getByRole('button')).toHaveText(['Échanger']);
  await expect(header(page).locator('.wm-profile-actions').getByRole('button')).toHaveText(['Signaler', 'Retirer des amis']);
  await expect(header(page).getByRole('button', { name: 'Signaler' })).toHaveAttribute('title', 'Signaler Ami');
  await expect(header(page).getByRole('button', { name: 'Modifier la photo de profil' })).toHaveCount(0);
  await expect(header(page).getByRole('switch')).toHaveCount(0);
  await expect(header(page).getByRole('list', { name: 'Étiquettes' })).toHaveCount(0);
});

test('profil d’un ami, mise en page : celle de son profil, « Échanger » à droite de la photo, boutons du site en bas à droite ; sur téléphone, « Échanger » en bas sur toute la largeur', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openFriend(page);
  const box = (selector: string) => rect(header(page).locator(selector));
  const frame = await rect(header(page));
  const cover = await box('.wm-profile-cover');
  const avatar = await box('.wm-profile-avatar');
  const left = await box('.wm-profile-stat-left > :first-child');
  const seen = await box('.wm-profile-seen');
  const details = await box('.wm-profile-identity > p:not(.wm-profile-seen)');
  const right = await box('.wm-profile-trade button');
  const actions = await box('.wm-profile-actions');

  const center = frame.x + frame.width / 2;
  expect(Math.abs(avatar.x + avatar.width / 2 - center)).toBeLessThan(2);
  expect(Math.abs(avatar.y + avatar.height / 2 - (cover.y + cover.height))).toBeLessThan(2);
  expect(left.x + left.width).toBeLessThan(avatar.x);
  expect(right.x).toBeGreaterThan(avatar.x + avatar.width);
  expect(Math.abs(left.y - right.y)).toBeLessThan(8);
  expect(seen.y).toBeGreaterThan(details.y + details.height - 1);
  expect(Math.abs(seen.x + seen.width / 2 - center)).toBeLessThan(2);
  expect(actions.y).toBeGreaterThan(right.y + right.height);
  expect(frame.y + frame.height - (actions.y + actions.height)).toBeLessThan(20);
  expect(frame.x + frame.width - (actions.x + actions.width)).toBeLessThan(20);
  await expect(header(page).locator('.wm-profile-cover button')).toHaveCount(0);

  await page.setViewportSize({ width: 400, height: 800 });
  const narrow = await rect(header(page));
  const below = await box('.wm-profile-seen');
  const button = await box('.wm-profile-trade button');
  expect(button.y).toBeGreaterThan(below.y + below.height);
  expect(button.width).toBeGreaterThan(narrow.width - 40);
});

test('« Signaler » ouvre la fenêtre du site', async ({ page }) => {
  await openFriend(page);
  await header(page).getByRole('button', { name: 'Signaler' }).click();
  await expect(page.locator('#report-modal')).toHaveText('Signaler Ami');
});

test('« Retirer des amis » : notre confirmation, roue pendant la requête du site, puis profil d’un non-ami', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const seen = await openFriend(page, async (route) => {
    await held;
    await route.fulfill({ json: { success: true } });
  });
  const unfriend = header(page).getByRole('button', { name: 'Retirer des amis' });
  await unfriend.click();
  const dialog = page.getByRole('alertdialog', { name: 'Retirer cet ami ?' });
  await dialog.getByRole('button', { name: 'Retirer' }).click();
  await expect(unfriend).toBeDisabled();
  await expect(unfriend.locator('.wm-spin')).toBeVisible();
  release();
  await expect(dialog).toBeHidden();
  await expect(header(page).locator('.wm-profile-actions').getByRole('button')).toHaveText(['Signaler']);
  await expect(header(page).locator('.wm-profile-stat-right')).toHaveCount(0);
  await expect(header(page).getByRole('button', { name: 'Échanger' })).toHaveCount(0);
  await expect(header(page).getByRole('button', { name: "Envoyer une demande d'ami" })).toBeVisible();
  await expect(page.locator('#site-request')).toBeHidden();
  expect(seen.deleted).toBe(1);
});

/** Valeurs posées par les modules imités (`SITE_MODULES`). */
const tradeSeen = (page: Page) =>
  page.evaluate(() => {
    const seen = window as unknown as Record<string, unknown>;
    return { props: seen.tradeProps, contexts: seen.tradeContexts, unmounts: seen.tradeUnmounts };
  });

test('« Échanger » : la fenêtre d’échange du site s’ouvre sur place, pour cet ami, roue pendant son chargement', async ({ page }) => {
  await openFriend(page);
  await page.evaluate(() => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    Object.assign(window, { tradeLoad: () => gate, releaseTrade: release });
  });
  const trade = header(page).getByRole('button', { name: 'Échanger' });
  await trade.click();
  await expect(trade).toBeDisabled();
  await expect(trade.locator('.wm-spin')).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseTrade: () => void }).releaseTrade());

  await expect(page.locator('#trade-window h2')).toHaveText('Échanger avec Ami');
  await expect(trade).toBeEnabled();
  await expect(trade.locator('.wm-spin')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/profile/Ami');
  expect(await tradeSeen(page)).toEqual({ props: { friendUsername: 'Ami', friendProfileId: 'u-ami' }, contexts: ['u0'], unmounts: undefined });

  await page.locator('#trade-cancel').click();
  await expect(page.locator('#trade-window')).toHaveCount(0);
  expect((await tradeSeen(page)).unmounts).toBe(1);
  await trade.click();
  await expect(page.locator('#trade-window')).toBeVisible();
});

test('« Échanger » sans la fenêtre du site (le site a changé) : toast, le bouton revient', async ({ page }) => {
  await openFriend(page);
  await page.evaluate(() => Reflect.deleteProperty(window, 'TURBOPACK'));
  const trade = header(page).getByRole('button', { name: 'Échanger' });
  await trade.click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Échanges');
  await expect(alert).toContainText("La fenêtre d'échange du site n'a pas pu s'ouvrir.");
  await expect(trade).toBeEnabled();
  await expect(page.locator('#trade-window')).toHaveCount(0);
});

test('« Échanger », code du site pas reçu : erreur réseau en toast', async ({ page }) => {
  await openFriend(page);
  await page.evaluate(() => {
    const failure = Object.assign(new Error('Failed to load chunk'), { name: 'ChunkLoadError' });
    Object.assign(window, { tradeLoad: () => Promise.reject(failure) });
  });
  const trade = header(page).getByRole('button', { name: 'Échanger' });
  await trade.click();
  await expect(page.getByRole('alert')).toContainText("Le site n'a pas répondu (erreur réseau).");
  await expect(trade).toBeEnabled();
});

interface StrangerServer {
  /** Corps des `POST /api/friends`, puis des `PATCH /api/friends/f2`. */
  readonly sent: unknown[];
  readonly answers: unknown[];
}

async function openStranger(
  page: Page,
  request: string,
  respond: (route: Route) => Promise<void> = (route) => route.fulfill({ status: 201, json: { friendship: { id: 'f2' } } }),
): Promise<StrangerServer> {
  const server = { sent: [] as unknown[], answers: [] as unknown[] };
  await openSite(page, '/profile/Inconnu', {
    html: sitePage(STRANGER_PROFILE(request), STRANGER_SCRIPT),
    handle: async (route, url) => {
      const method = route.request().method();
      if (url.pathname === '/api/friends' && method === 'POST') server.sent.push(route.request().postDataJSON());
      else if (url.pathname === '/api/friends/f2' && method === 'PATCH') server.answers.push(route.request().postDataJSON());
      else return false;
      await respond(route);
      return true;
    },
  });
  await expect(header(page)).toBeVisible();
  return server;
}

test('autre joueur : « Depuis … » sous le pseudo, « Envoyer une demande d’ami » à droite de la photo, « Signaler » seul', async ({ page }) => {
  await openStranger(page, SEND);
  await expect(page.locator('#site-header')).toBeHidden();
  await expect(page.locator('#site-request-block')).toBeHidden();
  await expect(page.locator('#showcase')).toBeVisible();
  await expect(header(page).locator('.wm-profile-photo')).toHaveText('IN');
  await expect(header(page).locator('.wm-profile-identity > p')).toHaveText('Depuis sept. 2026');
  await expect(header(page).locator('.wm-profile-stat-left')).toHaveText('6 060Cartes');
  await expect(header(page).locator('.wm-profile-stat-right')).toHaveCount(0);
  await expect(header(page).locator('.wm-profile-request').getByRole('button')).toHaveText(["Envoyer une demande d'ami"]);
  await expect(header(page).locator('.wm-profile-actions').getByRole('button')).toHaveText(['Signaler']);
});

test('autre joueur, mise en page : la demande d’ami à droite de la photo ; sur téléphone, en bas sur toute la largeur', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openStranger(page, SEND);
  const send = header(page).getByRole('button', { name: "Envoyer une demande d'ami" });
  const avatar = await rect(header(page).locator('.wm-profile-avatar'));
  let button = await rect(send);
  const left = await rect(header(page).locator('.wm-profile-stat-left > :first-child'));
  expect(button.x).toBeGreaterThan(avatar.x + avatar.width);
  expect(button.y).toBeLessThan(avatar.y + avatar.height);
  expect(Math.abs(button.y - left.y)).toBeLessThan(8);

  await page.setViewportSize({ width: 400, height: 800 });
  const name = await rect(header(page).locator('.wm-profile-identity > p'));
  button = await rect(send);
  const frame = await rect(header(page));
  const actions = await rect(header(page).locator('.wm-profile-actions button').first());
  expect(button.y).toBeGreaterThan(name.y + name.height);
  expect(button.width).toBeGreaterThan(frame.width - 40);
  expect(actions.y).toBeGreaterThan(button.y + button.height);
  expect(frame.x + frame.width - (actions.x + actions.width)).toBeLessThan(20);
});

test('« Envoyer une demande d’ami » : bouton du site, roue pendant sa requête, puis « Demande d’ami envoyée »', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const server = await openStranger(page, SEND, async (route) => {
    await held;
    await route.fulfill({ status: 201, json: { friendship: { id: 'f2' } } });
  });
  const send = header(page).getByRole('button', { name: "Envoyer une demande d'ami" });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(send.locator('.wm-spin')).toBeVisible();
  release();
  await expect(header(page).locator('.wm-profile-request')).toHaveText("Demande d'ami envoyée");
  await expect(header(page).locator('.wm-profile-request').getByRole('button')).toHaveCount(0);
  await expect(page.locator('#site-request-block')).toBeHidden();
  expect(server.sent).toEqual([{ addressee_id: 'u1' }]);
});

test('demande d’ami refusée : message du site en toast (le site n’affiche rien), le bouton revient', async ({ page }) => {
  await openStranger(page, SEND, (route) => route.fulfill({ status: 429, json: { error: 'Trop de demandes, réessaie plus tard' } }));
  const send = header(page).getByRole('button', { name: "Envoyer une demande d'ami" });
  await send.click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Amis');
  await expect(alert).toContainText('Trop de demandes, réessaie plus tard');
  await expect(send).toBeEnabled();
});

test('demande reçue : son texte, Accepter et Refuser à droite de la photo ; roue sur la réponse, l’autre désactivé', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const server = await openStranger(page, RECEIVED, async (route) => {
    await held;
    await route.fulfill({ json: { success: true } });
  });
  const request = header(page).locator('.wm-profile-request');
  await expect(request.locator('p')).toHaveText("Inconnu vous a envoyé une demande d'ami");
  await expect(request.getByRole('button')).toHaveText(['Accepter', 'Refuser']);
  const accept = request.getByRole('button', { name: 'Accepter' });
  await accept.click();
  await expect(accept).toBeDisabled();
  await expect(accept.locator('.wm-spin')).toBeVisible();
  await expect(request.getByRole('button', { name: 'Refuser' })).toBeDisabled();
  release();
  await expect(request).toHaveCount(0);
  await expect(page.locator('#site-tabs')).toBeVisible();
  expect(server.answers).toEqual([{ action: 'accept' }]);
});

test('demande reçue refusée : de nouveau « Envoyer une demande d’ami »', async ({ page }) => {
  const server = await openStranger(page, RECEIVED, (route) => route.fulfill({ json: { success: true } }));
  await header(page).getByRole('button', { name: 'Refuser' }).click();
  await expect(header(page).locator('.wm-profile-request').getByRole('button')).toHaveText(["Envoyer une demande d'ami"]);
  expect(server.answers).toEqual([{ action: 'decline' }]);
});

test('au repos, le script ne resynchronise plus la page (pas de boucle)', async ({ page }) => {
  await openProfile(page);
  await expectDomIdle(page);
});

test('profil d’un ami, au repos : pas de boucle', async ({ page }) => {
  await openFriend(page);
  await expectDomIdle(page);
});

test('autre joueur, demande reçue, au repos : pas de boucle', async ({ page }) => {
  await openStranger(page, RECEIVED);
  await expectDomIdle(page);
});
