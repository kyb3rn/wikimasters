import { expect, test, type Locator, type Page } from '@playwright/test';
import { animationsDone, letTimePass, nextFrame, openSettings, openSite, rect, sitePage } from './support/site';

/**
 * Modales du site, une de chaque sorte (balisage des captures et du code du 29/09/2026). Comme sur le site : le
 * clic sur le fond ferme (ou, dans l'invitation de guilde, décline), les boutons marqués `data-close` ferment en
 * notant leur effet dans `siteLog`, une modale imbriquée ne ferme pas sa parente.
 */
const CSS = `<style>
.fixed { position: fixed; } .inset-0 { inset: 0; } .absolute { position: absolute; } .relative { position: relative; }
.sticky { position: sticky; } .top-0 { top: 0; } .flex { display: flex; } .items-center { align-items: center; }
.justify-center { justify-content: center; } .justify-between { justify-content: space-between; }
.p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } .p-6 { padding: 1.5rem; } .px-5 { padding-inline: 1.25rem; }
.py-4 { padding-block: 1rem; } .w-full { width: 100%; } .max-w-md { max-width: 28rem; } .max-h-60 { max-height: 15rem; }
.overflow-y-auto { overflow-y: auto; } .top-3 { top: .75rem; } .right-3 { right: .75rem; } .h-9 { height: 2.25rem; }
.w-9 { width: 2.25rem; } .z-20 { z-index: 20; } .z-50 { z-index: 50; } .z-\\[60\\] { z-index: 60; } .z-\\[70\\] { z-index: 70; }
.z-\\[80\\] { z-index: 80; } .bg-black\\/70 { background: rgb(0 0 0 / 70%); } .bg-black\\/60 { background: rgb(0 0 0 / 60%); }
.bg-black\\/80 { background: rgb(0 0 0 / 80%); } .backdrop-blur-md { backdrop-filter: blur(12px); }
.max-w-lg { max-width: 32rem; } .mt-5 { margin-top: 1.25rem; }
</style>`;

const X = '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
const SHADE = 'class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-shade';

const MODALS: Record<string, string> = {
  friends: `<div ${SHADE}><div class="w-full max-w-md flex flex-col rounded-2xl border" id="friends">
    <div class="flex items-center justify-between p-5 border-b" id="friends-head"><h2 class="text-lg font-bold">Choisir un ami</h2>
    <button type="button" class="p-1 cursor-pointer" aria-label="Fermer" data-close="croix">${X}</button></div>
    <div class="p-4">Amis</div></div></div>`,
  report: `<div class="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" id="report">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" data-shade></div>
    <div class="relative w-full max-w-md card-frame p-5"><div class="flex items-start justify-between gap-3 mb-4">
    <div class="flex items-center gap-2"><div><h2>Signaler wikimaster59</h2><p>Votre signalement est envoyé.</p></div></div>
    <button type="button" class="p-1.5 rounded-lg" aria-label="Fermer" data-close="croix">${X}</button></div>
    <form><button type="button" data-close="annulé">Annuler</button></form></div></div>`,
  showcase: `<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" data-shade>
    <div class="w-full max-w-md rounded-2xl flex flex-col overflow-hidden" id="showcase">
    <div class="flex items-center justify-between px-5 py-4 border-b"><div class="min-w-0"><h3>Choisir une carte</h3></div>
    <button class="cursor-pointer" data-close="croix"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 2l14 14M16 2L2 16"></path></svg></button></div>
    <div class="p-4"><button aria-label="Retirer de la vitrine" data-close="retirée">${X}</button></div></div></div>`,
  guild: `<div ${SHADE}><div class="card-frame w-full max-w-md p-6" id="guild">
    <div class="flex items-center justify-between"><h2>Modifier la guilde</h2>
    <button type="button" class="text-sm cursor-pointer" data-close="croix">Fermer</button></div>
    <button type="button" id="save">Enregistrer</button></div></div>`,
  card: `<div ${SHADE}><div class="card-frame relative w-full max-w-md p-6" id="card">
    <button type="button" class="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full" aria-label="Fermer" data-close="croix">${X}</button>
    <h2 class="pr-10">100 mètres aux Jeux olympiques</h2><button type="button" id="ask">Ouvrir une confirmation</button></div></div>`,
  confirm: `<div class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-shade>
    <div class="card-frame max-w-sm w-full p-5" id="confirm"><h3>Confirmer ?</h3>
    <div class="flex"><button type="button" data-close="annulé">Annuler</button><button type="button" data-close="validé">Valider</button></div></div></div>`,
  invite: `<div ${SHADE} data-backdrop="décliné"><div class="w-full max-w-sm card-frame p-6" id="invite"><h2>Invitation de guilde</h2>
    <div class="flex"><button data-close="décliné">Décliner</button><button data-close="rejoint">Rejoindre</button></div></div></div>`,
  trade: `<div class="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-sm" data-shade>
    <div class="w-full max-w-md rounded-2xl flex flex-col" id="trade"><div class="flex items-center justify-between p-4 border-b">
    <div class="min-w-0 flex-1"><h2>Échanger avec Latina_Wife</h2></div>
    <button type="button" class="p-1" aria-label="Fermer" data-close="croix">${X}</button></div></div></div>`,
  unsaved: `<div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" data-shade>
    <div class="w-full max-w-md rounded-2xl p-5" id="unsaved"><h3>Modifications non enregistrées</h3>
    <button type="button" data-close="resté">Rester</button><button type="button" data-close="quitté">Quitter</button></div></div>`,
  shop: `<div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-label="Boutique" data-shade>
    <div class="w-full max-w-md overflow-y-auto max-h-60 rounded-2xl" id="shop">
    <div class="sticky top-0 z-10 flex items-center justify-between px-5 py-4" id="shop-head"><h2>Boutique</h2>
    <button class="flex items-center justify-center size-7 rounded-full" aria-label="Fermer la boutique" data-close="croix">${X}</button></div>
    <div style="height: 800px">Offres</div></div></div>`,
  // Aide de /pulls : « Compris ! » seul pour fermer, au bas du cadre ; aide des batailles : croix, et « Compris » en plus.
  help: `<div ${SHADE}><div class="card-frame max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 animate-fade-in-up" id="help">
    <h2 class="text-xl font-bold mb-4">Comment ça marche ?</h2><div class="space-y-5 text-sm"><p>Chaque carte est générée à partir d’un article.</p></div>
    <button class="mt-5 w-full py-2.5 rounded-xl" data-close="compris">Compris !</button></div></div>`,
  battles: `<div ${SHADE}><div class="card-frame w-full max-w-lg overflow-y-auto p-5 md:p-6 animate-fade-in-up" id="battles">
    <div class="flex items-start justify-between gap-3"><h2 class="text-xl font-bold">Comment fonctionnent les batailles ?</h2>
    <button type="button" class="rounded-lg p-1.5" aria-label="Fermer" data-close="croix">${X}</button></div>
    <div class="mt-4 space-y-3 text-sm"><p>Commence par défier un ami.</p></div>
    <div class="mt-5" id="battles-ok"><button type="button" class="w-full rounded-lg px-4 py-2.5" data-close="compris">Compris</button></div></div></div>`,
};

const PAGE = sitePage(
  `${CSS}<h1>Guilde</h1>`,
  `
window.siteLog = [];
const TEMPLATES = ${JSON.stringify(MODALS)};
window.openModal = (name, parent) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = TEMPLATES[name].trim();
  const overlay = wrap.firstElementChild;
  const shade = overlay.matches('[data-shade]') ? overlay : overlay.querySelector('[data-shade]');
  const escape = window.siteEscape?.[name];
  const close = (why) => {
    window.siteLog.push(name + ' : ' + why);
    overlay.remove();
    if (escape) document.removeEventListener('keydown', escape);
  };
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('div.fixed.inset-0') !== overlay) return;
    const button = event.target.closest('[data-close]');
    if (button) { if (!button.disabled) close(button.dataset.close); return; }
    if (event.target === shade) close(overlay.dataset.backdrop || 'fond');
  });
  overlay.close = close;
  if (escape) document.addEventListener('keydown', escape);
  (parent || document.body).append(overlay);
  return overlay;
};
// Le site gère lui-même Échap dans Signaler et dans l'éditeur d'échange (qui demande confirmation).
window.siteEscape = {
  report: (event) => { if (event.key === 'Escape') document.getElementById('report').closest('div.fixed').close('échap du site'); },
  trade: (event) => {
    if (event.key !== 'Escape') return;
    const unsaved = document.getElementById('unsaved');
    if (unsaved) unsaved.closest('div.fixed').close('resté');
    else window.openModal('unsaved');
  },
};
document.addEventListener('click', (event) => {
  if (event.target.id === 'ask') window.openModal('confirm', event.target.closest('div.fixed'));
  if (event.target.id === 'save') document.querySelector('#guild [data-close]').disabled = true;
});
`,
);

async function open(page: Page, name: string): Promise<Locator> {
  await page.evaluate((modal) => (window as unknown as { openModal: (name: string) => void }).openModal(modal), name);
  const frame = page.locator(`#${name}`);
  await expect(frame).toBeVisible();
  await nextFrame(page); // passe du script faite : fond, croix, Échap
  return frame;
}

const siteLog = (page: Page) => page.evaluate(() => (window as unknown as { siteLog: string[] }).siteLog);

/** Notre croix : le bouton rond « Fermer » posé par le script. */
const ourCross = (frame: Locator) => frame.locator('.wm-root button[aria-label="Fermer"]');

type Point = { x: number; y: number };

/** Appuie en `from`, glisse, relâche en `to` (le navigateur envoie le clic à leur ancêtre commun). */
async function drag(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

/** Point du cadre loin de ses boutons : au milieu, 10 px au-dessus du bas. */
async function inside(frame: Locator): Promise<Point> {
  const { x, y, width, height } = await rect(frame);
  return { x: x + width / 2, y: y + height - 10 };
}

/** Coin bas gauche de l'écran : le fond de la modale du dessus. */
const BACKDROP: Point = { x: 10, y: 700 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSite(page, '/guild', { html: PAGE });
});

test('modales du site : la croix de la barre de titre devient la croix ronde dans le coin', async ({ page }) => {
  const frame = await open(page, 'friends');
  const cross = ourCross(frame);
  await expect(cross).toHaveClass(/absolute top-3 right-3 z-20 .*wm-button-round.*wm-ghost/);
  await expect(frame.getByRole('button', { name: 'Fermer' })).toHaveCount(1);
  const [outer, inner] = await Promise.all([rect(frame), rect(cross)]);
  expect(outer.x + outer.width - (inner.x + inner.width)).toBeCloseTo(12, 0);
  expect(inner.y - outer.y).toBeCloseTo(12, 0);
  // La rangée du titre recule jusqu'à la croix (12 + 36 px) plus 8 px d'écart.
  expect(await page.locator('#friends-head').evaluate((el) => getComputedStyle(el).paddingRight)).toBe('56px');
  await cross.click();
  await expect(frame).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['friends : croix']);
});

test('modales du site : même fond partout, y compris un calque de fond à part', async ({ page }) => {
  const shade = (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.backgroundColor} ${style.backdropFilter}`;
    });
  await open(page, 'showcase');
  expect(await shade('div.fixed:has(#showcase)')).toBe('rgba(0, 0, 0, 0.7) blur(8px)');
  await page.locator('div.fixed:has(#showcase)').evaluate((el) => el.remove());
  await open(page, 'report');
  expect(await shade('#report > [data-shade]')).toBe('rgba(0, 0, 0, 0.7) blur(8px)');
  expect(await shade('#report')).toBe('rgba(0, 0, 0, 0) none');
});

test('modales du site : croix SVG sans nom et « Fermer » en texte remplacés ; croix déjà ronde laissée', async ({ page }) => {
  const showcase = await open(page, 'showcase');
  await expect(ourCross(showcase)).toBeVisible();
  await expect(showcase.locator('button[data-close="croix"]')).toBeHidden();
  // Les autres petites croix de la modale ne sont pas touchées.
  await expect(showcase.getByRole('button', { name: 'Retirer de la vitrine' })).toBeVisible();
  await ourCross(showcase).click();
  await expect(showcase).toHaveCount(0);

  const guild = await open(page, 'guild');
  await expect(guild.getByText('Fermer', { exact: true })).toBeHidden();
  await expect(ourCross(guild)).toBeEnabled();
  // Enregistrement en cours : le site désactive « Fermer », notre croix aussi.
  await guild.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ourCross(guild)).toBeDisabled();

  await page.locator('div.fixed:has(#guild)').evaluate((el) => el.remove());
  const card = await open(page, 'card');
  await expect(card.getByRole('button', { name: 'Fermer' })).toHaveCount(1);
  await expect(ourCross(card)).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['showcase : croix']);
});

test('modales du site : la croix reste en haut d’une modale qui défile sous un en-tête collant', async ({ page }) => {
  const shop = await open(page, 'shop');
  const cross = ourCross(shop);
  await expect(cross).toBeVisible();
  await shop.evaluate((el) => (el.scrollTop = 300));
  const [outer, inner] = await Promise.all([rect(shop), rect(cross)]);
  expect(inner.y - outer.y).toBeCloseTo(12, 0);
  await cross.click();
  expect(await siteLog(page)).toEqual(['shop : croix']);
});

test('Échap ferme la modale du dessus par sa croix, sinon « Annuler », jamais par le fond', async ({ page }) => {
  const card = await open(page, 'card');
  await card.getByRole('button', { name: 'Ouvrir une confirmation' }).click();
  await expect(page.locator('#confirm')).toBeVisible();
  // La confirmation, dessus : « Annuler » ; la modale de carte reste.
  await page.keyboard.press('Escape');
  await expect(page.locator('#confirm')).toHaveCount(0);
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['confirm : annulé', 'card : croix']);

  // Invitation : ni croix ni « Annuler », et le fond déclinerait : Échap ne fait rien.
  const invite = await open(page, 'invite');
  await page.keyboard.press('Escape');
  await letTimePass(page, 100);
  await expect(invite).toBeVisible();
  expect(await siteLog(page)).toEqual(['confirm : annulé', 'card : croix']);
});

test('Échap laisse faire le site quand il le gère lui-même (fermeture, demande de confirmation)', async ({ page }) => {
  await open(page, 'report');
  await page.keyboard.press('Escape');
  await expect(page.locator('#report')).toHaveCount(0);
  await letTimePass(page, 100);
  expect(await siteLog(page)).toEqual(['report : échap du site']);

  const trade = await open(page, 'trade');
  await page.keyboard.press('Escape');
  await expect(page.locator('#unsaved')).toBeVisible();
  await letTimePass(page, 100);
  await expect(trade).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#unsaved')).toHaveCount(0);
  await letTimePass(page, 100);
  await expect(trade).toBeVisible();
  expect(await siteLog(page)).toEqual(['report : échap du site', 'unsaved : resté']);
});

test('glisser de la modale jusqu’au fond, ou du fond jusqu’à la modale, ne la ferme pas ; un clic sur le fond, si', async ({ page }) => {
  // Pas la copie qui s'efface (même id) : la modale elle-même.
  const live = (id: string) => page.locator(`#${id}:not(.wm-modal-ghost *)`);
  await open(page, 'friends');
  await drag(page, await inside(live('friends')), BACKDROP);
  await drag(page, BACKDROP, await inside(live('friends')));
  await letTimePass(page, 100);
  await expect(live('friends')).toBeVisible();
  expect(await siteLog(page)).toEqual([]);

  // Modale imbriquée : ni elle ni sa parente.
  const card = await open(page, 'card');
  await card.locator('#ask').click();
  await drag(page, await inside(live('confirm')), BACKDROP);
  await letTimePass(page, 100);
  await expect(live('confirm')).toBeVisible();
  await expect(live('card')).toBeVisible();
  expect(await siteLog(page)).toEqual([]);

  await page.mouse.click(BACKDROP.x, BACKDROP.y);
  await expect(live('confirm')).toHaveCount(0);
  await page.mouse.click(BACKDROP.x, BACKDROP.y);
  await expect(live('card')).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['confirm : fond', 'card : fond']);
});

test('aide sans croix (/pulls) : « Compris ! » devient la croix ronde dans le coin, Échap aussi', async ({ page }) => {
  const help = await open(page, 'help');
  await expect(help.getByRole('button', { name: 'Compris !' })).toBeHidden();
  const cross = ourCross(help);
  await animationsDone(help);
  const [outer, inner] = await Promise.all([rect(help), rect(cross)]);
  expect(outer.x + outer.width - (inner.x + inner.width)).toBeCloseTo(12, 0);
  expect(inner.y - outer.y).toBeCloseTo(12, 0);
  // Le titre, seul sur sa ligne, s'arrête 8 px avant la croix (cadre `p-6` : 24 px déjà).
  expect(await help.locator('h2').evaluate((el) => getComputedStyle(el).paddingRight)).toBe('32px');
  // Un clic dans la fenêtre ne la ferme pas ; la croix, si (par « Compris ! »).
  await help.locator('p').click();
  await cross.click();
  await expect(help).toHaveCount(0);

  await open(page, 'help');
  await page.keyboard.press('Escape');
  await expect(page.locator('#help')).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['help : compris', 'help : compris']);
});

test('aide avec croix (batailles) : « Compris » en trop est caché, avec sa marge', async ({ page }) => {
  const battles = await open(page, 'battles');
  await expect(page.locator('#battles-ok')).toBeHidden();
  await expect(battles.getByRole('button', { name: 'Fermer' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(battles).toHaveCount(0);
  expect(await siteLog(page)).toEqual(['battles : croix']);
});

/** Ferme la modale comme le site (retrait d'un coup), puis décrit, à l'image suivante, la copie qui s'efface. */
const closeAndLook = (page: Page, id: string) =>
  page.evaluate(async (name) => {
    const overlay = document.getElementById(name)!.closest<HTMLElement & { close: (why: string) => void }>('div.fixed')!;
    overlay.close('fermée');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const copy = document.querySelector<HTMLElement>(`.wm-modal-ghost #${name}`);
    const ghost = copy?.closest<HTMLElement>('div.fixed');
    return copy && ghost
      ? {
          animation: getComputedStyle(ghost).animationName,
          frame: getComputedStyle(copy).animationName,
          inert: ghost.inert,
          scroll: copy.scrollTop,
          sameParent: ghost.parentElement?.parentElement === document.body,
        }
      : undefined;
  }, id);

test('une modale du site fermée s’efface en fondu : copie inerte, défilement gardé, puis retirée', async ({ page }) => {
  await open(page, 'shop');
  await page.locator('#shop').evaluate((el) => (el.scrollTop = 300));
  await page.locator('#shop').dispatchEvent('scroll');
  expect(await closeAndLook(page, 'shop')).toEqual({
    animation: 'wm-modal-out',
    frame: 'wm-modal-frame-out',
    inert: true,
    scroll: 300,
    sameParent: true,
  });
  // Rien n'y répond, et les recherches des modales ouvertes l'ignorent : Échap ne vise plus rien.
  await expect(page.locator('.wm-modal-ghost')).toHaveCount(0);
  await expect(page.locator('#shop')).toHaveCount(0);
});

test('une modale du site cachée par le script, ou avec moins d’animations demandé, disparaît d’un coup', async ({ page }) => {
  await open(page, 'friends');
  await page.locator('#friends').evaluate((el) => (el.parentElement!.style.visibility = 'hidden'));
  expect(await closeAndLook(page, 'friends')).toBeUndefined();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'guild');
  expect(await closeAndLook(page, 'guild')).toBeUndefined();
});

test('une modale imbriquée s’efface dans sa parente, qui reste', async ({ page }) => {
  const card = await open(page, 'card');
  await card.locator('#ask').click();
  await expect(page.locator('#confirm')).toBeVisible();
  const look = await page.evaluate(async () => {
    document.getElementById('confirm')!.closest<HTMLElement & { close: (why: string) => void }>('div.fixed')!.close('annulé');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const ghost = document.querySelector('.wm-modal-ghost #confirm')?.closest('.wm-modal-ghost');
    return ghost?.parentElement === document.getElementById('card')!.closest('div.fixed');
  });
  expect(look).toBe(true);
  await expect(page.locator('#confirm')).toHaveCount(0);
  await expect(card).toBeVisible();
});

test('nos modales : glisser jusqu’au fond ne les ferme pas, un clic sur le fond, si (paramètres)', async ({ page }) => {
  const dialog = await openSettings(page);
  await expect(dialog).toBeVisible();
  await drag(page, await inside(dialog), BACKDROP);
  await drag(page, BACKDROP, await inside(dialog));
  await letTimePass(page, 100);
  await expect(dialog).toBeVisible();
  await page.mouse.click(BACKDROP.x, BACKDROP.y);
  await expect(dialog).toHaveCount(0);
});

test('nos modales s’effacent aussi en fondu (paramètres)', async ({ page }) => {
  const dialog = await openSettings(page);
  await expect(dialog).toBeVisible();
  const look = await page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const ghost = document.querySelector<HTMLElement>('.wm-modal-ghost .wm-modal-backdrop');
    return ghost && { animation: getComputedStyle(ghost).animationName, frame: getComputedStyle(ghost.firstElementChild!).animationName };
  });
  expect(look).toEqual({ animation: 'wm-modal-out', frame: 'wm-modal-frame-out' });
  // La copie n'est pas une fenêtre ouverte, puis s'en va.
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.wm-modal-ghost')).toHaveCount(0);
});
