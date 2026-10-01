import type { Page, Route } from '@playwright/test';
import { collectionScript, entry, type Entry } from './collection';
import { FAKE_JWT, openSite, sitePage, SUPABASE } from './site';

/** Étiquettes de l'utilisateur imité (table `tags` de Supabase). */
const FAKE_TAGS = [
  { id: 't1', name: 'rare', color: '#f472b6' },
  { id: 't2', name: 'sport', color: '#60a5fa' },
  { id: 't3', name: 'histoire', color: '#4ade80' },
];

/**
 * Mode sélection du site, inséré dans la page Collection imitée (`collectionScript`) : « Sélectionner » à droite
 * du titre (une fois les compteurs reçus), cases cochées au clic, barre du bas (compte, « Tout sélectionner
 * (page) », « Étiqueter », « Retirer l'étiquette », « Défausser (+n) »), modale d'étiquetage (`#bulk-tags`) et
 * confirmation de défausse (`#bulk-discard`). Au chargement, les étiquettes sont lues à Supabase avec la session.
 */
const SELECTION_SCRIPT = `
  const TAGS = ${JSON.stringify(FAKE_TAGS)};
  let discardError = null;
  // Comme React : n'écrit que ce qui change.
  const setHTML = (node, html) => { if (node.__html !== html) { node.__html = html; node.innerHTML = html; } };
  const svg = (name) => icon(name, '', 14);
  const chipStyle = (color) => {
    const n = parseInt(color.slice(1), 16);
    const rgb = (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255);
    return 'background-color: rgba(' + rgb + ', 0.22); border-color: rgba(' + rgb + ', 0.5); color: rgba(248, 250, 252, 0.95);';
  };
  const norm = (text) => text.normalize('NFD').replace(/\\p{M}/gu, '').toLowerCase().trim();

  // Titre et « Sélectionner » / « Quitter la sélection » (entrer ou sortir vide la sélection).
  const titleRow = el('div', 'flex items-center justify-between gap-3');
  titleRow.append(el('h1', 'text-2xl font-bold', 'Collection'));
  const modeButton = button('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', '', () => {
    selecting = !selecting;
    selected.clear();
    discardError = null;
    renderSelection();
  });

  // Barre du bas (portail dans body) : compte, puis les boutons ; erreur de défausse dessous.
  const selBar = el('div', 'fixed bottom-4 z-[80] flex flex-col gap-3 card-frame bg-[var(--color-background)] p-3 shadow-xl');
  selBar.style.cssText = 'left:0;bottom:16px;width:900px;display:flex;flex-direction:column;gap:12px;background:#161b22';
  const selRow = el('div', 'flex flex-wrap items-center gap-3');
  const countBox = el('div', 'flex items-center gap-2 text-sm');
  const actionsBox = el('div', 'ml-auto flex flex-wrap items-center gap-2');
  const barButton = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs';
  const pageButton = button(barButton, '', () => {
    const all = entries.every((e) => selected.has(e.id));
    for (const e of entries) all ? selected.delete(e.id) : selected.add(e.id);
    renderSelection();
  });
  const tagButton = button(barButton, svg('tag') + 'Étiqueter', () => openBulk('add'));
  const untagButton = button(barButton, svg('tag') + "Retirer l'étiquette", () => openBulk('remove'));
  const discardButton = button(barButton + ' bg-red-500/90', '', () => { discardError = null; renderSelection(); openDiscardConfirm(); });
  actionsBox.append(pageButton, tagButton, untagButton, discardButton);
  selRow.append(countBox, actionsBox);
  const selError = el('p', 'text-xs text-red-500');
  selBar.append(selRow);

  toggleEntry = (entry) => {
    if (selected.has(entry.id)) selected.delete(entry.id);
    else selected.add(entry.id);
    renderSelection();
  };

  renderSelection = () => {
    hooks.selecting.memoizedState = selecting;
    hooks.selected.memoizedState = new Set(selected);
    // Comme le site : son bouton n'est là qu'une fois les compteurs reçus, total non nul.
    if (total > 0) { if (!modeButton.isConnected) titleRow.append(modeButton); }
    else modeButton.remove();
    setHTML(modeButton, selecting ? svg('x') + 'Quitter la sélection' : svg('square-check-big') + 'Sélectionner');
    // Calque de chaque case : anneau d'accent si cochée.
    for (const item of grid.children) {
      let overlay = item.querySelector(':scope > div.pointer-events-none');
      if (!selecting) { overlay?.remove(); item.querySelector(':scope > span.pointer-events-none')?.remove(); continue; }
      if (!overlay) {
        overlay = el('div');
        overlay.style.cssText = 'position:absolute;inset:0';
        item.append(overlay);
      }
      const on = selected.has(item.__entry.id);
      const cls = 'pointer-events-none absolute inset-0 z-10 rounded-2xl transition-all duration-300 group-hover:scale-105 ' +
        (on ? 'ring-4 ring-[var(--color-accent)]' : 'bg-black/0 hover:bg-black/10');
      if (overlay.className !== cls) overlay.className = cls;
      // Case à cocher du coin (sans Tailwind : seulement sa position absolue).
      let box = item.querySelector(':scope > span.pointer-events-none');
      if (!box) {
        box = el('span');
        box.style.position = 'absolute';
        item.append(box);
      }
      const boxCls = 'pointer-events-none absolute top-1.5 right-1.5 z-30 flex size-6 items-center justify-center rounded-md border-2 text-white shadow ' +
        (on ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'bg-black/60 border-white/70');
      if (box.className !== boxCls) box.className = boxCls;
    }
    if (!selecting) { selBar.remove(); return; }
    if (!selBar.isConnected) document.body.append(selBar);
    const n = entries.filter((e) => selected.has(e.id)).length;
    setHTML(countBox, loading
      ? '<span class="animate-spin"></span>Actualisation…'
      : '<span class="font-semibold text-[var(--color-accent)]">' + n + '</span><span class="text-[var(--color-foreground)]/60">' + (n > 1 ? 'cartes sélectionnées' : 'carte sélectionnée') + '</span>');
    const all = entries.length > 0 && entries.every((e) => selected.has(e.id));
    setHTML(pageButton, all ? svg('square') + 'Désélectionner la page' : svg('square-check-big') + 'Tout sélectionner (page)');
    setDisabled(pageButton, loading || entries.length === 0);
    setDisabled(tagButton, loading || n === 0);
    setDisabled(untagButton, loading || !entries.some((e) => selected.has(e.id) && e.tags.length > 0));
    setHTML(discardButton, svg('trash-2') + 'Défausser (+' + n + ')');
    setDisabled(discardButton, loading || n === 0);
    if (discardError) { selError.textContent = discardError; if (!selError.isConnected) selBar.append(selError); }
    else selError.remove();
  };

  /**
   * Modale « Appliquer / Retirer une étiquette » : props React (mode, cards…) au-dessus du cadre, un bouton
   * par étiquette (clé React = son id, gardé d'un rendu à l'autre), ligne « Créer » + couleur quand le nom
   * tapé n'existe pas. Le site appliquerait l'étiquette au clic : siteTagActions compte ces clics.
   */
  function openBulk(mode) {
    const cards = entries.filter((e) => selected.has(e.id));
    let query = '';
    let color = '#60a5fa';
    const back = el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'bulk-tags';
    const close = () => back.remove();
    back.onclick = close;
    const frame = el('div', 'card-frame relative max-w-md w-full max-h-[90vh] overflow-y-auto p-6');
    frame.style.cssText = 'background:#161b22;width:448px;padding:24px';
    frame.onclick = (event) => event.stopPropagation();
    frame['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: { mode, cards, tagsCatalog: TAGS, onClose: close, onApplied() {} }, return: null } };
    const closeButton = button('absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full', svg('x'), close);
    closeButton.setAttribute('aria-label', 'Fermer');
    const head = el('div', 'flex items-start gap-3 mb-4');
    const headText = el('div');
    headText.append(
      el('h2', 'text-lg font-bold', mode === 'remove' ? 'Retirer une étiquette' : 'Appliquer une étiquette'),
      el('p', 'text-xs', 'Sur ' + cards.length + ' cartes sélectionnées.'),
    );
    head.append(headText);
    const body = el('div', 'space-y-3');
    const input = el('input', 'w-full rounded-lg px-3 py-2.5 text-sm');
    input.type = 'text';
    input.maxLength = 48;
    input.placeholder = mode === 'remove' ? 'Chercher une étiquette…' : 'Chercher ou créer une étiquette…';
    input.oninput = () => { query = input.value; renderList(); };
    const list = el('div', 'max-h-64 overflow-y-auto space-y-1');
    const siteAction = () => { window.__collection.siteTagActions++; };
    const tagButtons = new Map();
    const createRow = el('div', 'flex items-center gap-1 pr-2 rounded-lg');
    const createButton = button('min-w-0 flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm', '', siteAction);
    const createLabel = el('label', 'relative flex size-7 shrink-0 items-center justify-center rounded-lg border');
    const colorInput = el('input', 'absolute inset-0 size-full cursor-pointer opacity-0');
    colorInput.type = 'color';
    colorInput.value = color;
    colorInput.setAttribute('aria-label', 'Couleur de la nouvelle étiquette');
    colorInput.oninput = () => { color = colorInput.value; renderList(); };
    createLabel.append(el('span', 'size-[1.125rem] rounded'), colorInput);
    createRow.append(createButton, createLabel);
    body.append(input, list);
    frame.append(closeButton, head, body);
    back.append(frame);
    document.body.append(back);

    function renderList() {
      const typed = query.trim();
      const wanted = norm(typed);
      const counts = new Map();
      for (const card of cards) for (const tag of card.tags) counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
      const shown = TAGS.filter((tag) => (mode !== 'remove' || counts.has(tag.id)) && (!typed || norm(tag.name).includes(wanted)));
      const exists = typed && TAGS.some((tag) => norm(tag.name) === wanted);
      const nodes = shown.map((tag) => {
        let node = tagButtons.get(tag.id);
        if (!node) {
          node = button('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left', '', siteAction);
          node.innerHTML = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border" style="' + chipStyle(tag.color) + '">' + tag.name + '</span>' +
            (mode === 'remove' ? '<span class="text-xs tabular-nums">' + counts.get(tag.id) + '</span>' : '');
          node['__reactFiber$test'] = { key: tag.id, memoizedProps: {}, return: null };
          tagButtons.set(tag.id, node);
        }
        return node;
      });
      if (mode !== 'remove' && typed && !exists) {
        setHTML(createButton, '<span>Créer</span><span class="min-w-0 truncate inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border" style="' + chipStyle(color) + '">' + typed + '</span>');
        if (colorInput.value !== color) colorInput.value = color;
        nodes.push(createRow);
      }
      if (nodes.length !== list.children.length || nodes.some((node, i) => list.children[i] !== node)) list.replaceChildren(...nodes);
    }
    renderList();
  }

  /** Confirmation de « Défausser (+n) », puis POST /api/user-cards/bulk-discard ; refusée : erreur affichée, reste ouverte. */
  function openDiscardConfirm() {
    const cards = entries.filter((e) => selected.has(e.id));
    let sending = false;
    const back = el('div', 'fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'bulk-discard';
    back.onclick = () => { if (!sending) back.remove(); };
    const box = el('div', 'card-frame max-w-sm w-full p-5');
    box.onclick = (event) => event.stopPropagation();
    const title = el('h3', 'text-base font-bold mb-2', 'Défausser ' + cards.length + ' carte' + (cards.length > 1 ? 's' : '') + ' ?');
    const error = el('p', 'text-xs text-red-500 mb-3');
    const cancel = button('flex-1 py-2.5 rounded-lg border', 'Annuler', () => back.remove());
    const confirm = button('flex-1 py-2.5 rounded-lg bg-red-500 text-white', 'Défausser', async () => {
      sending = true;
      cancel.disabled = confirm.disabled = true;
      confirm.textContent = '…';
      try {
        const response = await fetch('/api/user-cards/bulk-discard', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_ids: cards.map((c) => c.id) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          discardError = result.error ?? 'Erreur lors de la défausse';
          error.textContent = discardError;
          box.append(error);
          renderSelection();
          return;
        }
        back.remove();
        selected.clear();
        renderSelection();
        load();
      } finally {
        sending = false;
        cancel.disabled = confirm.disabled = false;
        confirm.textContent = 'Défausser';
      }
    });
    box.append(title, cancel, confirm);
    back.append(box);
    document.body.append(back);
  }

  stage.prepend(titleRow);
  renderSelection();
  // Comme le site : ses étiquettes, lues à Supabase avec la clé publique et le jeton de la session.
  fetch('${SUPABASE}/rest/v1/tags?select=*&user_id=eq.u0&order=name.asc', {
    headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' },
  }).then((r) => r.json()).then((rows) => { hooks.catalog.memoizedState = rows; }).catch(() => {});
`;

const COLLECTION_SELECTION_HTML = sitePage('<div id="stage"></div>', collectionScript(SELECTION_SCRIPT));

export interface SelectionServer {
  /** Requêtes à Supabase, dans l'ordre : méthode, adresse (chemin et paramètres), corps, en-têtes de session. */
  readonly supabase: { method: string; url: string; body: unknown; apikey: string | null; authorization: string | null }[];
  /** Défausses de la sélection demandées (`card_ids`). */
  readonly discards: string[][];
}

export interface SelectionOptions {
  readonly entries?: Entry[];
  /** Réponse sur mesure à une requête Supabase : renvoie vrai si elle a été traitée (sinon : réussie). */
  readonly supabase?: (route: Route, url: URL) => Promise<boolean>;
  /** Réponse sur mesure à la défausse de la sélection (sinon : réussie, exemplaires retirés de la liste). */
  readonly bulkDiscard?: (route: Route) => Promise<void>;
  /** Attendue avant de répondre aux compteurs (compteurs lents). */
  readonly beforeStats?: () => Promise<void>;
}

/** Page Collection avec le mode sélection, servie avec Supabase imité (étiquettes, associations). */
export async function openSelectionPage(page: Page, options: SelectionOptions = {}): Promise<SelectionServer> {
  const server: SelectionServer = { supabase: [], discards: [] };
  let list = options.entries ?? [entry('u1', 'Tour Eiffel'), entry('u2', 'Musée du Louvre', 'R'), entry('u3', 'Mont Blanc', 'SR')];
  let created = 0;
  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const raw = request.postData();
    server.supabase.push({
      method: request.method(),
      url: decodeURIComponent(url.pathname + url.search),
      body: raw ? (JSON.parse(raw) as unknown) : undefined,
      apikey: await request.headerValue('apikey'),
      authorization: await request.headerValue('authorization'),
    });
    if (options.supabase && (await options.supabase(route, url))) return;
    if (url.pathname === '/rest/v1/tags' && request.method() === 'GET') return route.fulfill({ json: FAKE_TAGS });
    if (url.pathname === '/rest/v1/tags' && request.method() === 'POST') {
      const rows = JSON.parse(raw ?? '[]') as { name: string; color: string }[];
      return route.fulfill({ status: 201, json: rows.map((row) => ({ id: `n${++created}`, user_id: 'u0', ...row })) });
    }
    return route.fulfill({ status: request.method() === 'DELETE' ? 204 : 201, body: '' });
  });
  await openSite(page, '/collection', {
    html: COLLECTION_SELECTION_HTML,
    handle: async (route, url) => {
      if (url.pathname === '/api/my-collection') {
        await route.fulfill({ json: { collection: list, total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        await options.beforeStats?.();
        const tagOptions = FAKE_TAGS.map((tag) => ({ ...tag, cardCount: list.filter((e) => e.tags.some((t) => t.id === tag.id)).length })).filter(
          (tag) => tag.cardCount > 0,
        );
        await route.fulfill({ json: { total: list.length, rarityCounts: {}, tagOptions } });
        return true;
      }
      if (url.pathname === '/api/user-cards/bulk-discard') {
        const { card_ids } = JSON.parse(route.request().postData() ?? '{}') as { card_ids: string[] };
        server.discards.push(card_ids);
        if (options.bulkDiscard) await options.bulkDiscard(route);
        else {
          list = list.filter((e) => !card_ids.includes(e.id));
          await route.fulfill({ json: { discarded_count: card_ids.length, failed: [] } });
        }
        return true;
      }
      return false;
    },
  });
  return server;
}
