import { expect, test } from '@playwright/test';
import { loadSharedApi } from './support/modules';

// Outils communs du socle (ui, site) qui agissent sur le DOM : vérifiés seuls, dans une page vide.

test('createSlot : posée à sa place, mise à jour sur place, remontée si React l’a retirée ou si la place change', async ({ page }) => {
  await loadSharedApi(page, '<div id="row"><span id="a">a</span><span id="b">b</span></div>');
  const steps = await page.evaluate(() => {
    const { createSlot, h } = window.wmTest;
    const row = document.getElementById('row') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;
    const count = () => row.querySelectorAll('.wm-root').length;
    const controller = new AbortController();
    const slot = createSlot(controller.signal);

    const first = slot.render(h('i', null, '1'), { parent: row, before: b, inline: true });
    const placed = first.element.nextElementSibling === b && first.element.textContent === '1';
    const inline = getComputedStyle(first.element).display === 'contents';
    const second = slot.render(h('i', null, '2'), { parent: row, before: b, inline: true });
    const kept = second.element === first.element && first.element.textContent === '2';
    first.element.remove();
    const third = slot.render(h('i', null, '3'), { parent: row, before: b, inline: true });
    const remounted = third.element !== first.element && third.element.nextElementSibling === b && count() === 1;
    const fourth = slot.render(h('i', null, '4'), { parent: row, after: b, inline: true });
    const after = fourth.element.previousElementSibling === b && count() === 1;
    const fifth = slot.render(h('i', null, '5'), { parent: row, after: b, inline: true, className: 'x' });
    const restyled = fifth.element !== fourth.element && fifth.element.classList.contains('x') && count() === 1;
    slot.clear();
    const cleared = slot.ui === undefined && count() === 0;
    slot.render(h('i', null, '6'), { parent: row });
    const anywhere = slot.ui?.element.parentElement === row && row.lastElementChild === slot.ui.element;
    controller.abort();
    const aborted = slot.ui === undefined && count() === 0;
    return { placed, inline, kept, remounted, after, restyled, cleared, anywhere, aborted };
  });
  expect(steps).toEqual({
    placed: true,
    inline: true,
    kept: true,
    remounted: true,
    after: true,
    restyled: true,
    cleared: true,
    anywhere: true,
    aborted: true,
  });
});

test('createSlots : une interface par clé, celles qui ne sont plus à garder démontées', async ({ page }) => {
  await loadSharedApi(page, '<ul id="list"><li id="l1"></li><li id="l2"></li><li id="l3"></li></ul>');
  const steps = await page.evaluate(() => {
    const { createSlots, h } = window.wmTest;
    const ids = () => [...document.querySelectorAll('.wm-root')].map((root) => root.textContent).join(',');
    const controller = new AbortController();
    const slots = createSlots<string>(controller.signal);
    for (const id of ['l1', 'l2', 'l3']) slots.render(id, h('b', null, id), { parent: document.getElementById(id) as HTMLElement });
    const all = ids();
    slots.prune((id) => id !== 'l2');
    const pruned = `${ids()}|${slots.keys().join(',')}`;
    slots.clear('l1');
    const cleared = ids();
    controller.abort();
    return { all, pruned, cleared, aborted: ids() };
  });
  expect(steps).toEqual({ all: 'l1,l2,l3', pruned: 'l1,l3|l1,l3', cleared: 'l3', aborted: '' });
});

test('modales : Échap ferme celle du dessus seulement ; fond et croix ; verrouillée, rien ne la ferme', async ({ page }) => {
  await loadSharedApi(page);
  const open = (locked: boolean) =>
    page.evaluate((locked) => {
      const { h, Modal, mountUi } = window.wmTest;
      const controller = new AbortController();
      const modal = h(Modal, { title: 'Fenêtre', locked, padded: true, onClose: () => controller.abort(), children: h('p', null, 'contenu') });
      mountUi(modal, { signal: controller.signal });
    }, locked);
  const modalOpen = () => page.evaluate(() => window.wmTest.isModalOpen());
  const dialog = page.getByRole('dialog', { name: 'Fenêtre' });

  await open(false);
  await expect(dialog).toBeFocused();
  await expect(dialog.locator('.wm-modal-body')).toHaveCSS('padding', '20px');
  await page.evaluate(() =>
    window.wmTest.openConfirm({ title: 'Sûr ?', confirmLabel: 'Oui', onConfirm: () => undefined, signal: new AbortController().signal }),
  );
  const confirm = page.getByRole('alertdialog', { name: 'Sûr ?' });
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(await modalOpen()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await modalOpen()).toBe(false);

  await open(false);
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);

  await open(true);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeDisabled();
});

test('lockControl en cours : la roue à la place de l’icône lucide, ou devant le texte ; opacité de 50 %', async ({ page }) => {
  await loadSharedApi(
    page,
    '<button id="icon"><svg class="lucide lucide-trash-2" width="16" height="16"><path d="M3 6h18"/></svg> Défausser</button>' +
      '<button id="text">Envoyer</button>',
  );
  await page.evaluate(() => {
    for (const id of ['icon', 'text']) {
      const button = document.getElementById(id) as HTMLButtonElement;
      window.wmTest.lockControl(button, { owner: 'test', locked: true, busy: true, reason: 'En cours…' });
    }
  });
  const icon = page.locator('#icon');
  await expect(icon).toBeDisabled();
  await expect(icon).toHaveAttribute('aria-busy', 'true');
  await expect(icon).toHaveCSS('opacity', '0.5');
  await expect(icon.locator('svg')).toHaveCSS('border-top-width', '2px');
  await expect(icon.locator('svg')).toHaveCSS('animation-name', 'wm-spin');
  await expect(icon.locator('path')).toBeHidden();
  const before = (selector: string) =>
    page.evaluate((selector) => getComputedStyle(document.querySelector(selector) as Element, '::before').content, selector);
  expect(await before('#icon')).toBe('none');
  expect(await before('#text')).toBe('""');

  await page.evaluate(() => {
    for (const id of ['icon', 'text']) {
      window.wmTest.lockControl(document.getElementById(id) as HTMLButtonElement, { owner: 'test', locked: false });
    }
  });
  await expect(icon).toBeEnabled();
  await expect(icon).not.toHaveAttribute('aria-busy');
  await expect(icon.locator('svg')).toHaveCSS('border-top-width', '0px');
  expect(await before('#text')).toBe('none');
});

test('isSiteModalOpen : ni les feux d’artifice de /pulls, ni nos copies qui s’effacent, ni une modale intégrée', async ({ page }) => {
  await loadSharedApi(
    page,
    '<div class="fixed inset-0 pointer-events-none"></div>' +
      '<div class="wm-root wm-modal-ghost"><div class="fixed inset-0"><div class="card-frame"></div></div></div>' +
      '<div class="fixed inset-0 wm-embedded-modal"><div class="card-frame"></div></div>',
  );
  expect(await page.evaluate(() => window.wmTest.isSiteModalOpen())).toBe(false);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="fixed inset-0 z-50"><div class="card-frame"></div></div>'));
  expect(await page.evaluate(() => window.wmTest.isSiteModalOpen())).toBe(true);
});

test('site/dom : nos nœuds, les boutons du site, ses icônes lucide', async ({ page }) => {
  await loadSharedApi(
    page,
    '<div id="root"><button id="site"><svg class="lucide lucide-trash2"></svg></button>' +
      '<span class="wm-root"><button id="ours">nous</button></span></div>',
  );
  const seen = await page.evaluate(() => {
    const { hasIcon, isOwn, siteButtons } = window.wmTest;
    const root = document.getElementById('root') as HTMLElement;
    const site = document.getElementById('site') as HTMLElement;
    const ours = document.getElementById('ours') as HTMLElement;
    return {
      buttons: siteButtons(root).map((button) => button.id),
      own: [isOwn(ours), isOwn(ours.firstChild as Node), isOwn(site)],
      icons: [hasIcon(site, 'trash-2', 'trash2'), hasIcon(site, 'gavel'), hasIcon(root, 'trash2')],
    };
  });
  expect(seen).toEqual({ buttons: ['site'], own: [true, true, false], icons: [true, false, true] });
});

test('findUnderlinedTabBars : onglets soulignés de la page et de la fenêtre d’échange, pas les autres rangées', async ({ page }) => {
  await loadSharedApi(
    page,
    // Marché, fenêtre d'échange (avec un bouton à nous), en-tête de fenêtre, rangée d'un seul bouton.
    '<div id="market" class="flex overflow-x-auto border-b"><button class="px-4 py-3 border-b-2">Parcourir</button><button class="px-4 py-3">Mes ventes</button></div>' +
      '<div id="trade" class="flex flex-shrink-0 border-b"><button class="flex-1 py-2">Mes cartes</button><button class="flex-1 py-2">Cartes de X</button><span class="wm-root"><button>nous</button></span></div>' +
      '<div class="flex items-center justify-between p-5 border-b"><h2>Titre</h2><button class="py-2">×</button></div>' +
      '<div class="flex border-b"><button class="py-3">Seul</button></div>',
  );
  const bars = await page.evaluate(() => window.wmTest.findUnderlinedTabBars().map((bar) => bar.id));
  expect(bars).toEqual(['market', 'trade']);
});

test('leaveSmoothly : la copie s’efface, la vraie modale n’est pas touchée', async ({ page }) => {
  await loadSharedApi(page, '<div id="overlay" class="fixed inset-0"><div id="frame">cadre</div></div>');
  const result = await page.evaluate(() => {
    const overlay = document.getElementById('overlay') as HTMLElement;
    const frame = document.getElementById('frame') as HTMLElement;
    const observer = new MutationObserver(() => undefined);
    observer.observe(overlay, { attributes: true, subtree: true });
    window.wmTest.leaveSmoothly(overlay, { parent: document.body, before: overlay.nextSibling, frame });
    const touched = observer.takeRecords().length;
    observer.disconnect();
    const ghost = document.querySelector('.wm-modal-ghost');
    return {
      touched,
      frameClass: frame.className,
      ghostInline: getComputedStyle(ghost as Element).display,
      ghostFrame: ghost?.querySelector('.wm-modal-leaving-frame')?.textContent,
    };
  });
  expect(result).toEqual({ touched: 0, frameClass: '', ghostInline: 'contents', ghostFrame: 'cadre' });
  await expect(page.locator('.wm-modal-ghost')).toHaveCount(0);
});

test('Listbox : menu dans un calque à nous au bout de body, au-dessus des modales, retiré à la fermeture', async ({ page }) => {
  await loadSharedApi(page);
  await page.evaluate(() => {
    const { h, Listbox, mountUi } = window.wmTest;
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Bêta' },
    ];
    const signal = new AbortController().signal;
    const ui = mountUi(null, { signal });
    const render = (value: string) => ui.update(h(Listbox, { ariaLabel: 'Tri', value, options, onChange: render }));
    render('a');
  });
  const roots = () => page.evaluate(() => document.querySelectorAll('body > .wm-root').length);
  expect(await roots()).toBe(1);
  await page.getByRole('button', { name: 'Tri' }).click();
  const menu = page.getByRole('listbox', { name: 'Tri' });
  await expect(menu).toBeVisible();
  expect(await roots()).toBe(2);
  const z = await page.evaluate(() => window.wmTest.layers.menu);
  await expect(menu).toHaveCSS('z-index', String(z));
  await page.getByRole('option', { name: 'Bêta' }).click();
  await expect(menu).toHaveCount(0);
  expect(await roots()).toBe(1);
  await expect(page.getByRole('button', { name: 'Tri' })).toHaveText(/Bêta/);
});

test('placeHeaderItem : nos boutons devant chaque solde, par rang, reposés si retirés, retirés quand ils ne sont plus voulus', async ({ page }) => {
  const balance = '<button aria-label="Ouvrir la boutique WikiBidous">Solde</button>';
  await loadSharedApi(page, `<div id="mobile">${balance}</div><div id="desktop"><span>logo</span>${balance}</div>`);
  const steps = await page.evaluate(async () => {
    const { h, HEADER_RANKS, placeHeaderItem } = window.wmTest;
    const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const labels = (id: string) =>
      [...(document.getElementById(id)?.querySelectorAll('button') ?? [])].map((button) => button.textContent);
    const signal = new AbortController().signal;
    let bellShown = true;
    // La cloche avant l'engrenage : chacun se range à son rang quel que soit l'ordre d'arrivée.
    const bells = placeHeaderItem(HEADER_RANKS.notifications, () => h('button', null, 'Cloche'), {
      signal,
      shown: () => bellShown,
    });
    placeHeaderItem(HEADER_RANKS.gear, () => h('button', null, 'Engrenage'), { signal });
    await frames();
    const placed = [labels('mobile'), labels('desktop')];
    document.querySelector('#desktop .wm-root')?.remove();
    await frames();
    const reposed = labels('desktop');
    bellShown = false;
    bells.sync();
    const hidden = labels('mobile');
    return { placed, reposed, hidden };
  });
  expect(steps).toEqual({
    placed: [
      ['Engrenage', 'Cloche', 'Solde'],
      ['Engrenage', 'Cloche', 'Solde'],
    ],
    reposed: ['Engrenage', 'Cloche', 'Solde'],
    hidden: ['Engrenage', 'Solde'],
  });
});

test('soleMainChild : le bloc `flex-1` seul dans `<main>`, rien s’il a un voisin', async ({ page }) => {
  await loadSharedApi(page, '<main id="a"><div class="flex-1">page</div><!--$--></main><main id="b"><div class="flex-1"></div><div></div></main>');
  const found = await page.evaluate(() => {
    const { soleMainChild } = window.wmTest;
    return ['a', 'b'].map((id) => soleMainChild(document.getElementById(id) as Element)?.textContent ?? null);
  });
  expect(found).toEqual(['page', null]);
});
