import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, letTimePass, openSite, rect, sitePage } from './support/site';

/**
 * Page /dms imitée (captures du 29/09/2026) : titre, une ligne par conversation, conversation en modale (portail
 * dans `body`). Comme le site, fermer la conversation relit la liste (lignes recréées un peu plus tard) ; `window.log`
 * note chaque ouverture et fermeture. Mise en page du site (menu latéral, `main` qui défile) en CSS.
 */
const NAMES = ['AlakazM', 'Poloz30', 'aelonka'];

const LAYOUT = `<style>
body { display: flex; height: 100vh; padding: 0 !important; box-sizing: border-box; }
#sidebar { width: 200px; flex: none; }
main { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; }
.md\\:p-6 { padding: 24px; } .space-y-6 > * + * { margin-top: 24px; }
.card-frame { background: #161b22; border: 1px solid #30363d; border-radius: 16px; }
.sm\\:max-w-md { max-width: 28rem; width: 100%; } .sm\\:h-\\[600px\\] { height: 600px; }
.rows::after { content: ""; display: block; height: 2000px; }
</style><div id="sidebar"></div>`;

const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6" id="page">
    <div class="animate-fade-in-up"><h1>Messages</h1><p>Toutes vos conversations</p></div>
    <div class="space-y-1 animate-fade-in-up rows" id="list"></div>
  </div>`,
  `window.log = [];
  const NAMES = ${JSON.stringify(NAMES)};
  window.renderList = () => {
    document.getElementById('list').innerHTML = NAMES.map((name) =>
      '<button class="w-full flex items-center gap-3 p-3 rounded-xl text-left">' +
        '<div class="relative flex-shrink-0"><div class="w-11 h-11 rounded-full"><span>' + name.slice(0, 2) + '</span></div></div>' +
        '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2">' +
          '<p class="font-medium text-sm truncate">' + name + '</p><span>18:26</span></div>' +
          '<p class="text-xs truncate mt-0.5">Salut</p></div>' +
      '</button>').join('');
  };
  window.closeChat = () => {
    const chat = document.getElementById('chat');
    if (!chat) return;
    window.log.push('close:' + chat.dataset.peer);
    chat.remove();
    document.getElementById('list').innerHTML = '';
    setTimeout(window.renderList, window.refetchDelay);
  };
  window.openChat = (name) => {
    window.log.push('open:' + name);
    document.getElementById('chat')?.remove();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" id="chat" data-peer="' + name + '">' +
        '<div class="w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col card-frame animate-fade-in-up rounded-t-2xl sm:rounded-2xl overflow-hidden">' +
          '<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">' +
            '<div class="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden"><span>' + name.slice(0, 2) + '</span></div>' +
            '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">' + name + '</p></div>' +
            '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>' +
          '</div>' +
          '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"><p>Message de ' + name + '</p></div>' +
        '</div>' +
      '</div>');
    const chat = document.getElementById('chat');
    chat.querySelector('button[aria-label="Fermer"]').addEventListener('click', window.closeChat);
    chat.addEventListener('click', (event) => { if (event.target === chat) window.closeChat(); });
  };
  document.getElementById('list').addEventListener('click', (event) => {
    const row = event.target.closest('button');
    if (row) window.openChat(row.querySelector('p').textContent);
  });
  window.renderList();`,
).replace('<main>', `${LAYOUT}<main>`);

type DmsWindow = Window & { log: string[] };

const log = (page: Page) => page.evaluate(() => (window as unknown as DmsWindow).log);
const row = (page: Page, name: string) => page.locator('#list button', { hasText: name });

/** Animations d'entrée du site terminées. */
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

const box = (page: Page, selector: string) => rect(page.locator(selector));

test('/dms en deux colonnes : la conversation du site à droite, une ligne passe à une autre', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await openSite(page, '/dms', { html: HTML });

  const panel = page.locator('.wm-dms-panel');
  await expect(panel).toContainText('Choisissez une conversation.');
  // `main` ne défile plus (après l'animation d'entrée du site, qui décale la liste de quelques pixels).
  await settled(page);
  expect(await page.locator('main').evaluate((main) => main.scrollHeight <= main.clientHeight)).toBe(true);
  // Titre au-dessus, liste à gauche (elle défile seule), cadre à droite du haut de la première conversation au bas
  // de la page.
  const [title, list, first, frame] = await Promise.all([
    box(page, 'h1'),
    box(page, '#list'),
    box(page, '#list button >> nth=0'),
    box(page, '.wm-dms-panel'),
  ]);
  expect(title.x).toBe(list.x);
  expect(title.y + title.height).toBeLessThan(list.y);
  expect(frame.x).toBe(list.x + 340 + 24);
  expect(frame.y).toBe(first.y);
  expect(frame.y + frame.height).toBe(800 - 24);

  await row(page, 'AlakazM').click();
  const chat = page.locator('#chat');
  await expect(chat).toHaveClass(/wm-dms-docked/);
  // Posée exactement sur le cadre de droite : ni fond, ni croix, ni en-tête masqué.
  await expect.poll(() => box(page, '#chat')).toEqual(await box(page, '.wm-dms-panel'));
  expect(await chat.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect(chat.getByRole('button', { name: 'Fermer' })).toHaveCount(0);
  await expect(chat.getByRole('link', { name: 'AlakazM', exact: true })).toBeVisible();
  await expect(row(page, 'AlakazM')).toHaveClass(/wm-dms-active/);

  // Échap ne la ferme pas : elle fait partie de la page.
  await page.keyboard.press('Escape');
  await letTimePass(page, 100);
  await expect(chat).toBeVisible();

  // Autre ligne : la conversation affichée est fermée (le site relit sa liste), puis la ligne est cliquée.
  await row(page, 'Poloz30').click();
  await expect(chat).toHaveAttribute('data-peer', 'Poloz30');
  expect(await log(page)).toEqual(['open:AlakazM', 'close:AlakazM', 'open:Poloz30']);
  await expect(row(page, 'Poloz30')).toHaveClass(/wm-dms-active/);
  await expect(row(page, 'AlakazM')).not.toHaveClass(/wm-dms-active/);
  await expect(page.locator('.wm-modal-ghost')).toHaveCount(0);
  await expect.poll(() => box(page, '#chat')).toEqual(await box(page, '.wm-dms-panel'));

  // La même ligne : rien.
  await row(page, 'Poloz30').click();
  await letTimePass(page, 300);
  expect(await log(page)).toHaveLength(3);

  // La fenêtre change : la conversation suit le cadre.
  await page.setViewportSize({ width: 1200, height: 700 });
  await expect.poll(() => box(page, '#chat')).toEqual(await box(page, '.wm-dms-panel'));

  await expectDomIdle(page);

  // Trop étroit pour deux colonnes : la modale du site, avec son fond et la croix du script.
  await page.setViewportSize({ width: 800, height: 700 });
  await expect(chat).not.toHaveClass(/wm-dms-docked/);
  await expect(page.locator('.wm-dms-panel')).toHaveCount(0);
  expect(await box(page, '#chat')).toEqual({ x: 0, y: 0, width: 800, height: 700 });
  await expect(chat.getByRole('button', { name: 'Fermer' })).toBeVisible();
  await chat.getByRole('button', { name: 'Fermer' }).click();
  await expect(chat).toHaveCount(0);
});

test('/dms sur un grand écran : les deux colonnes centrées, 1500 px au plus', async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await openSite(page, '/dms', { html: HTML });
  await expect(page.locator('.wm-dms-panel')).toBeVisible();
  await settled(page);
  const [main, title, list, frame] = await Promise.all([box(page, 'main'), box(page, 'h1'), box(page, '#list'), box(page, '.wm-dms-panel')]);
  expect(frame.x + frame.width - list.x).toBe(1500);
  expect(list.x - main.x).toBe(main.x + main.width - (frame.x + frame.width));
  expect(title.x).toBe(list.x);
});

test('/dms : roue dans le cadre tant que la liste relue n’est pas revenue', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await openSite(page, '/dms', { html: HTML });
  await page.evaluate(() => ((window as unknown as { refetchDelay: number }).refetchDelay = 1000));

  await row(page, 'AlakazM').click();
  await expect(page.locator('#chat')).toHaveClass(/wm-dms-docked/);
  await row(page, 'Poloz30').click();
  await expect(page.locator('.wm-dms-panel [aria-busy="true"]')).toBeVisible();
  await expect(page.locator('#chat')).toHaveCount(0);
  await expect(page.locator('#chat')).toHaveAttribute('data-peer', 'Poloz30');
  await expect(page.locator('.wm-dms-panel [aria-busy="true"]')).toHaveCount(0);
  await expect(row(page, 'Poloz30')).toHaveClass(/wm-dms-active/);
  expect(await log(page)).toEqual(['open:AlakazM', 'close:AlakazM', 'open:Poloz30']);
});
