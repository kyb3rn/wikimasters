import type { Page } from '@playwright/test';
import { filtersTitle, listServer, type ListServer } from './lists';
import { openSite, sitePage, SUPABASE } from './site';

/**
 * Imitation de la page « Toutes les cartes » (code du site, 10/10/2026) : titre et « Sélectionner » à sa droite
 * (désactivé sans carte) ; ligne des filtres (champ et « Rechercher », désactivé tant que le champ vaut la recherche en
 * cours ; liste « Trier les cartes » comme celles du site, menu en portail, props React `ariaLabel`, `value`,
 * `options`, `onChange`), pastilles (« Liste de souhaits », raretés, « Réinitialiser rareté »). La liste se charge dans
 * un « effet » qui dépend de la page, de la recherche lancée, des raretés (identité du `Set`), du tri et du filtre :
 * roue à la place de la grille pendant un chargement, requête précédente interrompue, pages gardées en
 * `sessionStorage['gc_v12_<adresse>']` (sauf liste de souhaits) et relues sans requête. Grille : une case
 * `div.relative.isolate.group` par carte, sa face dedans. États de la page dans ses hooks, dans l'ordre du site ;
 * pagination « Page x / y » (« Page x · suite disponible » pendant une recherche). Au-dessus des filtres, un
 * `div.card-frame` : compteurs par rareté, ou pendant une recherche « Recherche active : pas de décompte… » (même
 * nœud). `window.__catalog.loads` : listes reçues du réseau.
 *
 * Mode sélection comme le site : un clic sur une carte la coche (sauf pendant un chargement ou une requête) ; dans sa
 * case, calque (anneau si cochée), case à cocher, signet si la carte est dans la liste de souhaits ; barre du bas
 * (compte, « Tout sélectionner (page) », « Retirer des souhaits (n) », « Ajouter aux souhaits (n) », erreur dessous).
 * Ajout (`POST` groupé) ou retrait (`DELETE … in.(…)`) à Supabase : réussi, message au-dessus des compteurs et
 * sélection quittée ; refusé, erreur dans la barre. Sélection réduite aux cartes affichées après un chargement.
 */
const SCRIPT = `
(() => {
  const { el, button, icon, tailwindBase, hooks, listbox, rarityPills } = kit;
  tailwindBase();
  window.__catalog = { loads: 0 };

  let cards = [], total = 0, hasMore = false, wishlistOn = false, loading = true;
  let input = '', sort = 'rarity', rarities = new Set(), page = 0, applied = '';
  let wishlist = new Set();
  let selecting = false, selected = new Set(), busy = false, selError = null, message = null;
  let fetchId = 0, controller;

  // États de la page, dans l'ordre du site (seuls certains comptent pour le script).
  const values = [
    () => cards, () => total, () => hasMore, () => ({}), () => ({}), () => new Set(), () => wishlist, () => new Set(),
    () => wishlistOn, () => null, () => loading, () => input, () => sort, () => rarities, () => page, () => null,
    () => selecting, () => selected, () => busy, () => selError, () => message, () => applied,
  ];
  const setters = {
    13: (value) => { rarities = value; },
    14: (value) => { page = value; },
  };
  const states = hooks(values.map((get, i) => [get, (value) => { setters[i]?.(value); update(); }]));
  const pageFiber = { memoizedProps: {}, return: null, memoizedState: states[0] };

  let scheduled = false;
  function update() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); effect(); });
  }
  let deps = [];
  function effect() {
    const next = [page, applied, rarities, sort, wishlistOn];
    if (deps.length > 0 && next.every((value, i) => value === deps[i])) return;
    deps = next;
    load();
  }
  const address = () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (applied) params.set('q', applied);
    for (const rarity of rarities) params.append('rarity', rarity);
    params.set('sort', sort);
    if (wishlistOn) params.set('wishlist', '1');
    return '/api/cards?' + params;
  };
  const show = (body) => {
    cards = body.cards ?? [];
    total = body.total ?? total;
    hasMore = body.searchHasMore === true;
    wishlist = new Set([...wishlist, ...(wishlistOn ? cards.map((card) => card.id) : body.wishlistCardIds ?? [])]);
    // Comme le site : la sélection est réduite aux cartes affichées.
    const shown = new Set(cards.map((card) => card.id));
    if ([...selected].some((id) => !shown.has(id))) selected = new Set([...selected].filter((id) => shown.has(id)));
  };
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const id = ++fetchId;
    const url = address();
    const kept = wishlistOn ? null : sessionStorage.getItem('gc_v12_' + url);
    if (kept) { show(JSON.parse(kept)); loading = false; update(); return; }
    loading = true;
    update();
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) { if (id === fetchId) { cards = []; } return; }
      const body = await response.json();
      if (id !== fetchId) return;
      if (!wishlistOn) sessionStorage.setItem('gc_v12_' + url, JSON.stringify(body));
      show(body);
      window.__catalog.loads++;
    } catch {
    } finally {
      if (id === fetchId) { loading = false; update(); }
    }
  }

  /** « Ajouter aux souhaits » / « Retirer des souhaits » : les cartes cochées qui n'y sont pas, ou qui y sont. */
  const toChange = (add) => [...selected].filter((id) => wishlist.has(id) !== add);
  async function changeWishlist(add) {
    const ids = toChange(add);
    if (busy || loading || ids.length === 0) return;
    busy = true;
    selError = null;
    update();
    try {
      const query = add ? '?on_conflict=user_id%2Ccard_id' : '?user_id=eq.u0&card_id=in.(' + ids.join(',') + ')';
      const response = await fetch('${SUPABASE}/rest/v1/wishlist_items' + query, {
        method: add ? 'POST' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: add ? JSON.stringify(ids.map((id) => ({ user_id: 'u0', card_id: id }))) : undefined,
      }).catch(() => null);
      if (!response?.ok) {
        selError = add ? "Impossible d'ajouter ces cartes à la liste de souhaits." : 'Impossible de retirer ces cartes de la liste de souhaits.';
        return;
      }
      wishlist = new Set(wishlist);
      for (const id of ids) { if (add) wishlist.add(id); else wishlist.delete(id); }
      if (!add && wishlistOn) cards = cards.filter((card) => !ids.includes(card.id));
      const n = ids.length;
      message = n > 1 ? n + ' cartes ' + (add ? 'ajoutées à' : 'retirées de') + ' ta liste de souhaits.' : '1 carte ' + (add ? 'ajoutée à' : 'retirée de') + ' ta liste de souhaits.';
      selecting = false;
      selected = new Set();
    } finally {
      busy = false;
      update();
    }
  }

  // Comme React : n'écrit que ce qui change.
  const setHTML = (node, html) => { if (node.__html !== html) { node.__html = html; node.innerHTML = html; } };
  const setDisabled = (node, disabled) => { if (node.disabled !== disabled) node.disabled = disabled; };
  const svg = (name) => icon(name, '', 14);

  const main = document.querySelector('main');
  const root = el('div', 'flex-1 p-4 md:p-6 space-y-6');
  const titleRow = el('div', 'flex items-start justify-between gap-3');
  const titleBox = el('div');
  titleBox.append(el('h1', 'text-2xl font-bold', 'Collection Globale'), el('p', 'text-sm', 'Toutes les cartes existantes dans le jeu'));
  const modeButton = button('shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', '', () => {
    if (!selecting) message = null;
    selecting = !selecting;
    selected = new Set();
    selError = null;
    update();
  });
  titleRow.append(titleBox, modeButton);
  const messageBox = el('div', 'card-frame p-3 flex items-start gap-2 text-sm');
  messageBox.id = 'catalog-message';

  const area = el('div', 'space-y-3 animate-fade-in-up');
  const line = el('div', 'flex flex-col gap-3 md:flex-row md:items-stretch');
  line.style.gap = '12px';
  line['__reactFiber$test'] = { memoizedProps: {}, stateNode: line, return: pageFiber };
  const fieldRow = el('div', 'flex w-full min-w-0 flex-1 gap-2');
  const fieldBox = el('div', 'relative min-w-0 flex-1');
  const field = el('input', 'w-full rounded-lg border px-4 py-2.5 pr-9 text-sm');
  field.type = 'text';
  field.placeholder = 'Rechercher par titre ou catégorie...';
  const submit = button('shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold', 'Rechercher', () => { applied = input.trim(); page = 0; update(); });
  field.addEventListener('input', () => { input = field.value; update(); });
  field.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit.click(); } });
  const clear = button('absolute right-2 p-1 rounded-full', icon('x', 'size-4'), () => {
    input = ''; field.value = ''; applied = ''; page = 0; update();
  });
  clear.setAttribute('aria-label', 'Effacer la recherche');
  fieldBox.append(field);
  fieldRow.append(fieldBox, submit);

  const options = [['rarity', 'Rareté'], ['name', 'Nom'], ['atk', 'ATK'], ['def', 'DEF']];
  const sortList = listbox({
    label: 'Trier les cartes',
    className: 'min-w-0 flex-1 md:min-w-[8.5rem] md:max-w-[10rem]',
    value: () => sort,
    options: () => options.map(([value, label]) => ({ value, label })),
    onChange(value) { sort = value; page = 0; update(); },
    parent: pageFiber,
  });
  line.append(fieldRow, sortList.box);

  const wish = button('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs', icon('bookmark', 'size-3.5', 14) + 'Liste de souhaits', () => {
    wishlistOn = !wishlistOn; page = 0; update();
  });
  const pills = rarityPills({
    checked: () => rarities,
    toggle(rarity) {
      const next = new Set(rarities);
      if (next.has(rarity)) next.delete(rarity); else next.add(rarity);
      rarities = next; page = 0; update();
    },
    reset() { rarities = new Set(); page = 0; update(); },
  });
  pills.row.prepend(wish);
  area.append(line, pills.row);

  const spinner = el('div', 'flex items-center justify-center py-16');
  spinner.innerHTML = '<div class="w-8 h-8 border-2 rounded-full animate-spin"></div>';
  const grid = el('div', 'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]');
  grid.id = 'grid';
  const bar = el('div', 'flex items-center justify-center gap-2 py-4');
  const previous = button('px-4 py-2 rounded-lg text-sm', '← Précédent', () => { page = Math.max(0, page - 1); update(); main.scrollTo({ top: 0 }); });
  const label = el('span', 'text-sm');
  const next = button('px-4 py-2 rounded-lg text-sm', 'Suivant →', () => { page = page + 1; update(); main.scrollTo({ top: 0 }); });
  bar.append(previous, label, next);
  const stats = el('div', 'card-frame p-4 animate-fade-in-up');
  root.append(titleRow, stats, area);
  main.append(root);

  // Barre du bas (portail dans body) : compte, puis les boutons ; erreur dessous.
  const selBar = el('div', 'fixed bottom-4 z-[80] flex flex-col gap-3 card-frame bg-[var(--color-background)] p-3 shadow-xl');
  selBar.style.cssText = 'bottom:16px;display:flex;flex-direction:column;gap:12px;background:#161b22';
  // Comme le site : calée sur la largeur de <main> moins 48 px, 768 px au plus, centrée sur lui.
  const placeBar = () => {
    const box = document.querySelector('main').getBoundingClientRect();
    const width = Math.max(280, Math.min(768, Math.max(0, box.width - (innerWidth >= 768 ? 48 : 32))));
    selBar.style.left = box.left + (box.width - width) / 2 + 'px';
    selBar.style.width = width + 'px';
  };
  const selRow = el('div', 'flex flex-wrap items-center gap-3');
  const countBox = el('div', 'flex items-center gap-2 text-sm');
  const actionsBox = el('div', 'ml-auto flex flex-wrap items-center gap-2');
  const barButton = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs';
  const pageButton = button(barButton, '', () => {
    if (loading) return;
    const all = cards.every((card) => selected.has(card.id));
    selected = new Set(selected);
    for (const card of cards) { if (all) selected.delete(card.id); else selected.add(card.id); }
    update();
  });
  const removeButton = button(barButton, '', () => void changeWishlist(false));
  const addButton = button(barButton + ' bg-[var(--color-accent)]', '', () => void changeWishlist(true));
  actionsBox.append(pageButton, removeButton, addButton);
  selRow.append(countBox, actionsBox);
  const selErrorBox = el('p', 'text-xs text-red-500');
  selBar.append(selRow);

  /** Case d'une carte (clé React : son id), gardée d'un rendu à l'autre. */
  const cells = new Map();
  function cell(card) {
    let node = cells.get(card.id);
    if (!node) {
      node = el('div', 'relative isolate group');
      node.style.position = 'relative';
      const face = el('div', 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden cursor-pointer');
      face.style.cssText = 'width:160px;height:224px;background:#30363d;position:relative';
      face.innerHTML = '<h3>' + card.wikipedia_title + '</h3>';
      face.onclick = () => {
        if (!selecting || loading || busy) return;
        selected = new Set(selected);
        if (selected.has(card.id)) selected.delete(card.id); else selected.add(card.id);
        update();
      };
      node.append(face);
      cells.set(card.id, node);
    }
    // Calque, case à cocher et signet du mode sélection (sans Tailwind : seulement leur position absolue).
    const parts = [...node.querySelectorAll(':scope > .pointer-events-none')];
    if (!selecting) { for (const part of parts) part.remove(); return node; }
    const on = selected.has(card.id);
    let [overlay, box, badge] = [node.querySelector(':scope > div.pointer-events-none'), node.querySelector(':scope > span.right-1\\\\.5'), node.querySelector(':scope > span.left-1\\\\.5')];
    if (!overlay) { overlay = el('div'); overlay.style.cssText = 'position:absolute;inset:0'; node.append(overlay); }
    const overlayCls = 'pointer-events-none absolute inset-0 z-10 rounded-2xl transition-all duration-300 group-hover:scale-105 ' + (on ? 'ring-4 ring-[var(--color-accent)]' : 'bg-black/0 hover:bg-black/10');
    if (overlay.className !== overlayCls) overlay.className = overlayCls;
    if (!box) { box = el('span'); box.style.position = 'absolute'; node.append(box); }
    const boxCls = 'pointer-events-none absolute top-1.5 right-1.5 z-30 flex size-6 items-center justify-center rounded-md border-2 ' + (on ? 'bg-[var(--color-accent)]' : 'bg-black/60');
    if (box.className !== boxCls) box.className = boxCls;
    if (wishlist.has(card.id)) {
      if (!badge) {
        badge = el('span', 'pointer-events-none absolute top-1.5 left-1.5 z-30 flex size-6 items-center justify-center rounded-md bg-black/60');
        badge.style.position = 'absolute';
        badge.title = 'Dans ta liste de souhaits';
        badge.innerHTML = icon('bookmark', 'size-3.5 fill-current', 14);
        node.append(badge);
      }
    } else badge?.remove();
    return node;
  }

  function renderSelection() {
    modeButton.className = selecting ? 'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border' : 'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border disabled:opacity-40';
    setHTML(modeButton, selecting ? svg('x') + 'Quitter la sélection' : svg('square-check-big') + 'Sélectionner');
    setDisabled(modeButton, !selecting && cards.length === 0);
    if (message) {
      setHTML(messageBox, svg('check') + '<span>' + message + '</span>');
      if (messageBox.parentElement !== root) titleRow.after(messageBox);
    } else messageBox.remove();
    if (!selecting) { selBar.remove(); return; }
    if (!selBar.isConnected) { placeBar(); document.body.append(selBar); }
    setHTML(countBox, loading
      ? '<span class="animate-spin"></span>Actualisation…'
      : '<span class="font-semibold text-[var(--color-accent)]">' + selected.size + '</span><span class="text-[var(--color-foreground)]/60">' + (selected.size > 1 ? 'cartes sélectionnées' : 'carte sélectionnée') + '</span>');
    const all = cards.length > 0 && cards.every((card) => selected.has(card.id));
    setHTML(pageButton, all ? svg('square') + 'Désélectionner la page' : svg('square-check-big') + 'Tout sélectionner (page)');
    setDisabled(pageButton, loading || cards.length === 0);
    setHTML(removeButton, svg('bookmark-minus') + 'Retirer des souhaits (' + toChange(false).length + ')');
    setDisabled(removeButton, loading || busy || toChange(false).length === 0);
    setHTML(addButton, svg('bookmark-plus') + 'Ajouter aux souhaits (' + toChange(true).length + ')');
    setDisabled(addButton, loading || busy || toChange(true).length === 0);
    if (selError) { selErrorBox.textContent = selError; if (!selErrorBox.isConnected) selBar.append(selErrorBox); }
    else selErrorBox.remove();
  }

  function render() {
    sortList.render();
    submit.disabled = input.trim() === applied;
    if (input) fieldBox.append(clear); else clear.remove();
    wish.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ' + (wishlistOn ? 'ring-2 active' : 'opacity-70');
    pills.render();
    const searching = applied.trim().length >= 3;
    setHTML(stats, searching
      ? '<p class="text-xs mb-1">Recherche active : pas de décompte par rareté ni de total exact (évite de parcourir des millions de lignes).</p><div class="flex items-center gap-2 text-xs"><span>Résultats paginés — utilise Suivant / Précédent.</span></div>'
      : '<div class="flex flex-wrap items-center gap-3 mb-3"><div class="flex items-center gap-1.5 text-sm"><span>L:</span><span class="font-bold">1704</span></div></div>');
    const pages = searching ? null : Math.ceil(total / 50);
    const paged = searching ? page > 0 || hasMore : pages > 1;
    const content = loading ? spinner : grid;
    if (content === grid) {
      const nodes = cards.map(cell);
      if (nodes.length !== grid.children.length || nodes.some((node, i) => grid.children[i] !== node)) grid.replaceChildren(...nodes);
    }
    for (const node of [spinner, grid]) if (node !== content) node.remove();
    if (content.parentElement !== root) root.insertBefore(content, bar.parentElement === root ? bar : null);
    if (paged) {
      previous.disabled = page === 0;
      next.disabled = searching ? !hasMore : page >= pages - 1;
      label.textContent = searching ? 'Page ' + (page + 1) + (hasMore ? ' · suite disponible' : '') : 'Page ' + (page + 1) + ' / ' + pages;
      if (bar.parentElement !== root) root.append(bar);
    } else {
      bar.remove();
    }
    renderSelection();
  }
  render();
  effect();
})();
`;

const GLOBAL_COLLECTION_LIST_HTML = sitePage('', SCRIPT);

export interface GlobalCollectionOptions {
  /** Cartes par page (une par défaut), titrées des filtres, puis « #2 », « #3 »… */
  readonly perPage?: number;
  /** Cartes déjà dans la liste de souhaits (`wishlistCardIds`). */
  readonly wishlisted?: readonly string[];
}

/**
 * Ouvre la page imitée. Serveur : une carte par page (`perPage`), dont le titre dit les filtres ; 120 cartes (3 pages)
 * sans recherche, sinon pas de total et une suite jusqu'à la page 3. `requests` : paramètres des listes demandées ;
 * `gate` retient les réponses tant qu'il n'est pas résolu. Cartes de la page n de la liste : `c-<n>`, `c-<n>-2`…
 */
export async function openGlobalCollection(page: Page, { perPage = 1, wishlisted = [] }: GlobalCollectionOptions = {}): Promise<ListServer> {
  const { server, handle } = listServer('/api/cards', (params, count) => {
    const searching = (params.get('q') ?? '').length >= 3;
    const title = filtersTitle(params);
    return {
      cards: Array.from({ length: perPage }, (_, i) => ({
        id: i === 0 ? `c-${count}` : `c-${count}-${i + 1}`,
        wikipedia_title: i === 0 ? title : `${title} #${i + 1}`,
        rarity: 'L',
      })),
      total: searching ? null : 120,
      searchHasMore: searching && Number(params.get('page')) < 2,
      rarityCounts: {},
      friendOwners: {},
      ownedCardIds: [],
      wishlistCardIds: wishlisted,
      friendPendingOfferKeys: [],
    };
  });
  await openSite(page, '/global-collection', { html: GLOBAL_COLLECTION_LIST_HTML, handle });
  return server;
}
