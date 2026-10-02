import type { Page } from '@playwright/test';
import { openSite, sitePage, type FakeSite } from './site';

/** Exemplaire de la liste (données inventées, même forme que `GET /api/my-collection`). */
export function entry(id: string, title: string, rarity = 'C', count = 1) {
  return {
    id,
    card_id: `card-${id}`,
    card: { id: `card-${id}`, wikipedia_title: title, rarity, atk: 100, def: 100 },
    tags: [] as { id: string; name: string; color: string }[],
    count,
    starred: false,
    is_shiny: false,
    user_id: 'u0',
  };
}

export type Entry = ReturnType<typeof entry>;

/**
 * Imitation de la page Collection : champ de recherche (pris en compte 300 ms après la frappe, 3 caractères
 * au moins), deux listes déroulantes du site (étiquette, tri) et pastilles de rareté (L UR SR R PC C) qui
 * remettent la page à 0 et relancent aussitôt la liste, liste et compteurs (`/api/my-collection`,
 * `/api/my-collection/stats`, en page 0 seulement), réponse périmée ignorée, voile avec roue sur la grille
 * pendant un chargement, affiché comme React dans une tâche suivante (`overlayShown` compte ses apparitions),
 * grille dans l'ordre de la liste, modale de carte du site (confirmation de défausse, « Mettre aux enchères »
 * qui crée directement l'enchère). Comme le site, une défausse ou une mise aux enchères réussie recharge la
 * liste. Pagination au-dessus et au-dessous de la grille, dès que le total des compteurs dépasse 50 : « Page x
 * / y » (numéro changé en texte seul), « Chargement… » pendant un chargement, état `page` de la page dans ses
 * hooks. Composant « tirer pour rafraîchir » : `onRefresh` dans l'arbre React affiché ; les fibers notés sur la
 * rangée des listes et les barres sont la version précédente, dont l'`onRefresh` ne charge rien
 * (`staleRefresh`) et les états ont gardé leurs valeurs du début (`staleSetPage`). « Gérer les étiquettes… »
 * de la liste des étiquettes ouvre la fenêtre du même nom (`manageOpened`). `window.__collection.loads` :
 * listes affichées.
 *
 * `selection` : le mode sélection (`collection-selection.ts`), inséré dans la fonction de la page. Il y voit
 * `hooks`, `entries`, `grid`, `stage`, `load`, `loading`, `total`, `setDisabled` et remplace `renderSelection`
 * et `toggleEntry` ; `selecting` et `selected` sont l'état de la page.
 */
export function collectionScript(selection = ''): string {
  return `
(() => {
  const { el, button, icon, tailwindBase, chain, nextRouter, listbox, rarityPills } = kit;
  const SELECTION = ${selection ? 'true' : 'false'};
  const stage = document.getElementById('stage');
  tailwindBase();
  let page = 0;
  /** Exemplaires d'après les compteurs : 50 par page. */
  let total = 0;
  let sort = 'rarity';
  let tag = '';
  let requestId = 0;
  let loading = false;
  let loaded = false;
  let entries = [];
  let selecting = false;
  const selected = new Set();
  let renderSelection = () => {};
  let toggleEntry = () => {};
  window.__collection = { loads: 0, staleRefresh: 0, staleSetPage: 0, overlayShown: 0, manageOpened: 0, siteTagActions: 0 };
  nextRouter();

  // Fenêtre « Gérer les étiquettes », ouverte par l'option du même nom de la liste des étiquettes.
  function openManager() {
    window.__collection.manageOpened++;
    const back = el('div', 'fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4');
    back.id = 'tag-manager';
    const panel = el('div', 'card-frame-solid relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden');
    const close = button('absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full', '×', () => back.remove());
    close.setAttribute('aria-label', 'Fermer');
    const head = el('div', 'border-b border-[var(--color-border)] p-4 pr-12');
    head.append(el('h2', 'text-lg font-bold', 'Gérer les étiquettes'));
    panel.append(close, head);
    back.append(panel);
    document.body.append(back);
  }

  /** Liste déroulante du site ; son onChange est celui de la page : toute valeur change le filtre et recharge. */
  function select(label, options, get, set) {
    const list = listbox({
      label,
      value: get,
      options: () => options.map(([value, text]) => ({ value, label: text })),
      onChange(value) {
        if (value === '__manage_tags__') return openManager();
        set(value);
        list.render();
        page = 0;
        queueMicrotask(load);
      },
    });
    return list;
  }
  // Champ de recherche puis rangée des listes, sur une ligne (écran large).
  const bar = el('div', 'flex flex-col gap-3 md:flex-row md:items-stretch');
  bar.style.cssText = 'display:flex;flex-direction:row;align-items:stretch;gap:12px';
  const search = el('input', 'w-full min-w-0 flex-1 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-4 py-2.5 text-sm');
  search.type = 'text';
  search.placeholder = 'Rechercher par titre ou catégorie...';
  // Comme le site : prise en compte 300 ms après la dernière frappe, 3 caractères au moins.
  let query = '';
  let typing;
  search.oninput = () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const text = search.value.trim();
      const next = text.length >= 3 ? text : '';
      if (next === query) return;
      query = next;
      page = 0;
      queueMicrotask(load);
    }, 300);
  };
  const filters = el('div', 'flex w-full min-w-0 flex-row gap-2 md:w-auto md:shrink-0 md:max-w-full');
  filters.style.cssText = 'display:flex;gap:8px';
  const lists = [
    select(
      'Filtrer par étiquette',
      [['', 'Toutes les étiquettes'], ['__untagged__', 'Sans étiquette'], ['t1', '#rare'], ['__manage_tags__', 'Gérer les étiquettes…']],
      () => tag,
      (value) => { tag = value; },
    ),
    select('Trier la collection', [['rarity', 'Rareté'], ['name', 'Nom'], ['added', "Date d'ajout"]], () => sort, (value) => { sort = value; }),
  ];
  filters.append(...lists.map(({ box }) => box));
  bar.append(search, filters);
  // Pastilles de rareté : chaque clic recharge aussitôt.
  const rarities = new Set();
  const rarityChanged = () => {
    pills.render();
    page = 0;
    queueMicrotask(load);
  };
  const pills = rarityPills({
    checked: () => rarities,
    toggle(rarity) {
      if (rarities.has(rarity)) rarities.delete(rarity);
      else rarities.add(rarity);
      rarityChanged();
    },
    reset() {
      rarities.clear();
      rarityChanged();
    },
  });

  const overlay = el('div', 'absolute inset-0 z-20');
  // Comme Tailwind : position de « absolute » (inset-0 laissé aux feuilles de style).
  overlay.style.position = 'absolute';
  overlay.setAttribute('aria-busy', 'true');
  overlay.hidden = true;
  const spinner = el('div', 'w-8 h-8 border-2 rounded-full animate-spin');
  spinner.style.cssText = 'width:32px;height:32px';
  overlay.append(spinner);
  const grid = el('div', 'flex flex-wrap justify-center gap-3');
  const content = el('div', 'relative');
  content.append(overlay, grid);
  // Cadre de la grille : pagination au-dessus et au-dessous, s'il y a plus d'une page.
  const frame = el('div', 'scroll-mt-4 space-y-3');
  frame.append(content);
  stage.append(bar, pills.row, frame);

  // Changer de page : l'état « page », puis le défilement ; la liste part dans l'effet qui suit le rendu.
  const setPage = (next) => {
    if (next === page) return;
    page = next;
    render();
    queueMicrotask(load);
  };
  const goTo = (next) => {
    setPage(next);
    requestAnimationFrame(() => frame.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const pagination = () => {
    const previous = button('px-4 py-2 rounded-lg', '← Précédent', () => goTo(Math.max(0, page - 1)));
    const label = el('span', 'text-sm');
    const next = button('px-4 py-2 rounded-lg', 'Suivant →', () => goTo(Math.min(pages() - 1, page + 1)));
    const node = el('div', 'flex items-center justify-center gap-2 py-3');
    node.append(previous, label, next);
    return { node, previous, label, next };
  };
  const bars = [pagination(), pagination()];
  const pages = () => Math.ceil(total / 50);

  // Comme React, n'écrit que ce qui change : « disabled » selon la valeur rendue précédente (pas celle
  // du DOM, qu'un verrou du script a pu changer), numéro de page en texte seul.
  const setDisabled = (node, value) => {
    if (node.__rendered === value) return;
    node.__rendered = value;
    node.disabled = value;
  };
  function renderBar({ previous, label, next }) {
    setDisabled(previous, page === 0 || loading);
    setDisabled(next, page >= pages() - 1 || loading);
    if (loading) {
      if (label.querySelector('.animate-spin')) return;
      label.replaceChildren(el('span', 'w-4 h-4 border-2 rounded-full animate-spin'), document.createTextNode('Chargement…'));
      return;
    }
    const parts = ['Page ', String(page + 1), ' / ', String(pages())];
    if (label.querySelector('.animate-spin') || label.childNodes.length !== parts.length) {
      label.replaceChildren(...parts.map((part) => document.createTextNode(part)));
      return;
    }
    parts.forEach((part, i) => { if (label.childNodes[i].nodeValue !== part) label.childNodes[i].nodeValue = part; });
  }

  // Comme React : l'affichage suit l'état dans une tâche suivante, qui regroupe les changements d'ici là
  // (« chargement » puis « fini » dans la même tâche : la roue n'est jamais dessinée).
  const channel = new MessageChannel();
  let renderQueued = false;
  channel.port1.onmessage = () => {
    renderQueued = false;
    const busy = loading && loaded;
    if (busy && overlay.hidden) window.__collection.overlayShown++;
    overlay.hidden = !busy;
    const [top, bottom] = bars;
    if (pages() > 1) {
      if (!top.node.isConnected) frame.insertBefore(top.node, content);
      if (!bottom.node.isConnected) frame.append(bottom.node);
      bars.forEach(renderBar);
    } else {
      top.node.remove();
      bottom.node.remove();
    }
    hooks.total.memoizedState = total;
    hooks.loading.memoizedState = loading;
    hooks.page.memoizedState = page;
    renderSelection();
  };
  const render = () => {
    if (renderQueued) return;
    renderQueued = true;
    channel.port2.postMessage(null);
  };

  // Arbre React : racine affichée > page (états) > « tirer pour rafraîchir » (onRefresh) > [rangée des
  // listes > listes, cadre > barres]. Version précédente notée sur la rangée et les barres : son onRefresh ne
  // charge rien (\`staleRefresh\`), ses états ont gardé leurs valeurs du début (\`staleSetPage\`).
  const fiber = (props, stateNode, parent) => {
    const node = { memoizedProps: props, return: parent, child: null, sibling: null, stateNode };
    if (parent) parent.child = node;
    return node;
  };
  const siblings = (...nodes) => nodes.forEach((node, i) => { node.sibling = nodes[i + 1] ?? null; });
  // Hooks de la page : liste, total, chargement, un useRef (sans file), page ; avec la sélection : mode
  // sélection (booléen) puis exemplaires cochés (Set), comme le site. Valeurs écrites au rendu, comme React.
  const hookList = (dispatchPage, dispatchSelecting = () => {}, dispatchSelected = () => {}, dispatchList = () => {}, dispatchTagOptions = () => {}, dispatchCatalog = () => {}) => {
    const list = {
      list: { memoizedState: [], queue: { dispatch: dispatchList } },
      total: { memoizedState: 0, queue: { dispatch() {} } },
      tagOptions: { memoizedState: [], queue: { dispatch: dispatchTagOptions } },
      catalog: { memoizedState: null, queue: { dispatch: dispatchCatalog } },
      loading: { memoizedState: false, queue: { dispatch() {} } },
      ref: { memoizedState: { current: 0 }, queue: null },
      page: { memoizedState: 0, queue: { dispatch: dispatchPage } },
      ...(SELECTION && {
        selecting: { memoizedState: false, queue: { dispatch: dispatchSelecting } },
        selected: { memoizedState: new Set(), queue: { dispatch: dispatchSelected } },
      }),
    };
    chain(Object.values(list));
    return list;
  };
  const root = fiber(null, null, null);
  root.stateNode = { current: root };
  const hooks = hookList(
    setPage,
    (value) => { selecting = value; renderSelection(); },
    (value) => { selected.clear(); for (const id of value) selected.add(id); renderSelection(); },
    (value) => { entries = value; hooks.list.memoizedState = value; renderGrid(); },
    (value) => { hooks.tagOptions.memoizedState = value; },
    (value) => { hooks.catalog.memoizedState = value; },
  );
  window.__collection.page = hooks;
  const pageFiber = fiber({}, null, root);
  pageFiber.memoizedState = hooks.list;
  const refresh = fiber({ onRefresh: () => load() }, null, pageFiber);
  const filtersFiber = fiber({}, filters, refresh);
  const frameFiber = fiber({}, frame, null);
  frameFiber.return = refresh;
  siblings(filtersFiber, frameFiber);
  const [topFiber, bottomFiber] = bars.map(({ node }) => fiber({}, node, frameFiber));
  frameFiber.child = topFiber;
  siblings(topFiber, bottomFiber);
  // Listes : composant (ariaLabel, value, options, onChange) > cadre > bouton, noté sur le bouton.
  const listFibers = lists.map(({ box, toggle, props }) => {
    const component = fiber(props, null, filtersFiber);
    toggle['__reactFiber$test'] = fiber({}, toggle, fiber({}, box, component));
    return component;
  });
  filtersFiber.child = listFibers[0];
  siblings(...listFibers);

  const staleRoot = fiber(null, root.stateNode, null);
  const stalePage = fiber({}, null, staleRoot);
  stalePage.memoizedState = hookList(() => { window.__collection.staleSetPage++; }).list;
  const staleRefresh = fiber({ onRefresh: () => { window.__collection.staleRefresh++; } }, null, stalePage);
  filters['__reactFiber$test'] = fiber({}, filters, staleRefresh);
  const staleFrame = fiber({}, frame, staleRefresh);
  for (const { node } of bars) node['__reactFiber$test'] = fiber({}, node, staleFrame);

  async function load() {
    const id = ++requestId;
    loading = true;
    render();
    try {
      const params = new URLSearchParams({ sort });
      if (query) params.set('q', query);
      for (const rarity of rarities) params.append('rarity', rarity);
      if (tag === '__untagged__') params.set('untagged', '1');
      else if (tag) params.set('tag_id', tag);
      const stats = page === 0 ? fetch('/api/my-collection/stats?' + params) : null;
      params.set('page', String(page));
      params.set('stats', '0');
      const response = await fetch('/api/my-collection?' + params);
      if (id !== requestId) return;
      const list = await response.json();
      if (id !== requestId) return;
      showList(list);
      // Comme le site : compteurs en échec ignorés.
      stats?.then((r) => (r.ok ? r.json() : null)).then((body) => {
        if (id !== requestId || !body) return;
        total = body.total;
        hooks.tagOptions.memoizedState = body.tagOptions ?? [];
        render();
      });
    } finally {
      if (id === requestId) { loading = false; loaded = true; render(); }
    }
  }

  function showList(list) {
    // Comme le site : sélection réduite aux cartes encore affichées.
    entries = list.collection;
    hooks.list.memoizedState = entries;
    for (const id of [...selected]) if (!entries.some((e) => e.id === id)) selected.delete(id);
    renderGrid();
    window.__collection.loads++;
  }

  /** Grille dessinée d'après les exemplaires (état « liste » de la page) : face, titre, étiquettes. */
  function renderGrid() {
    grid.replaceChildren(...entries.map((entry) => {
      const item = el('div', 'relative isolate group');
      const face = el('div', 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-' + entry.card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden cursor-pointer');
      face.style.cssText = 'width:160px;height:224px;background:#30363d;position:relative';
      face.append(el('h3', 'text-xs shrink-0 font-bold', entry.card.wikipedia_title));
      if (entry.tags.length > 0) {
        const tags = el('div', 'fake-tags');
        for (const tag of entry.tags) {
          const chip = el('span', 'fake-tag', tag.name);
          chip.dataset.color = tag.color ?? '';
          tags.append(chip);
        }
        face.append(tags);
      }
      face.onclick = () => (selecting ? toggleEntry(entry) : openModal(entry));
      // Comme le site : le composant de la face reçoit la carte, juste au-dessus de son élément.
      face['__reactFiber$test'] = { memoizedProps: { className: face.className }, return: { memoizedProps: { card: entry.card, size: 'sm' }, return: null } };
      item.append(face);
      item.__entry = entry;
      return item;
    }));
    renderSelection();
  }

  function closeModal() { document.getElementById('card-modal')?.remove(); }

  function openModal(entry) {
    closeModal();
    const back = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'card-modal';
    // Comme le site : le composant de la modale (props card, userCardId, onClose…) rend lui-même le fond.
    back['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: { card: entry.card, starred: entry.starred, count: entry.count, onClose: closeModal, userCardId: entry.id, tags: entry.tags }, return: null } };
    const panel = el('div', 'card-frame relative w-full p-6');
    const close = button('absolute top-3 right-3', '×', closeModal);
    close.setAttribute('aria-label', 'Fermer');
    const face = el('div', 'w-72 h-[420px] glow-' + entry.card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden');
    face.style.cssText = 'width:200px;height:280px;background:#30363d;position:relative';
    const star = button('p-0.5 rounded-md', '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"></path></svg>');
    star.setAttribute('aria-label', 'Ajouter aux favoris');
    face.append(el('h3', 'text-base font-bold', entry.card.wikipedia_title), star);
    const tag = el('input', 'w-full rounded-lg');
    tag.placeholder = 'Ajouter une étiquette…';
    const auction = button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg', icon('gavel') + 'Mettre aux enchères', async () => {
      const response = await fetch('/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_id: entry.id, base_amount: 10, duration_minutes: 60 }) });
      if (response.ok) load();
    });
    // Comme le site : confirmation dans le fond de la modale, puis défausse, fermeture et rechargement.
    const discard = button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border', icon('trash-2') + 'Défausser<span>+1</span>', () => {
      const confirmBack = el('div', 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70');
      confirmBack.id = 'discard-confirm';
      confirmBack.onclick = (event) => event.stopPropagation();
      const box = el('div', 'card-frame max-w-sm w-full p-5');
      const cancel = button('flex-1', 'Annuler', () => confirmBack.remove());
      const confirm = button('flex-1 bg-red-500', 'Défausser', async () => {
        confirm.disabled = cancel.disabled = true;
        const response = await fetch('/api/user-cards/' + entry.id + '/discard', { method: 'POST' });
        await response.json();
        confirm.disabled = cancel.disabled = false;
        if (!response.ok) return;
        closeModal();
        load();
      });
      box.append(el('h3', 'text-base font-bold', 'Défausser cette carte ?'), cancel, confirm);
      confirmBack.append(box);
      back.append(confirmBack);
    });
    const row = el('div', 'flex gap-2');
    row.append(auction, discard);
    const actions = el('div', 'mt-3');
    actions.append(row);
    panel.append(close, face, el('h2', 'text-xl font-bold', entry.card.wikipedia_title), tag, actions);
    back.append(panel);
    document.body.append(back);
  }

  ${selection}

  load();
})();
`;
}

const COLLECTION_HTML = sitePage('<div id="stage"></div>', collectionScript());

/** Faces de la grille. */
export const faces = (page: Page) => page.locator('#stage [class*="glow-"]');
/** Titres des cartes de la grille, dans l'ordre. */
export const titles = (page: Page) => faces(page).locator('h3');

export interface CollectionServer {
  /** Listes et compteurs demandés, notés par `noteList` et `noteStats`, dans l'ordre d'arrivée. */
  readonly requests: string[];
  /** Retient les réponses de la liste tant qu'il n'est pas résolu (`hold`). */
  gate: Promise<void> | undefined;
  /** Retient les réponses des compteurs tant qu'il n'est pas résolu. */
  statsGate: Promise<void> | undefined;
  /** Total des compteurs (50 exemplaires par page). */
  total: number;
}

export interface CollectionOptions {
  /** Exemplaires de la liste demandée (par défaut : « Tour Eiffel », rare). */
  readonly list?: (params: URLSearchParams) => Entry[];
  /** Total des compteurs (par défaut : 1). */
  readonly total?: number;
  /** Ce qui est noté dans `requests` pour une liste (absent : rien). */
  readonly noteList?: (params: URLSearchParams) => string;
  /** Ce qui est noté dans `requests` pour des compteurs (absent : rien). */
  readonly noteStats?: (params: URLSearchParams) => string;
  /** Autres requêtes (défausse, enchère…). */
  readonly handle?: FakeSite['handle'];
}

/** Ouvre la page Collection imitée, servie par un serveur imité ; n'attend pas la première liste. */
export async function openCollection(page: Page, options: CollectionOptions = {}): Promise<CollectionServer> {
  const server: CollectionServer = { requests: [], gate: undefined, statsGate: undefined, total: options.total ?? 1 };
  const list = options.list ?? (() => [entry('u1', 'Tour Eiffel', 'R')]);
  await openSite(page, '/collection', {
    html: COLLECTION_HTML,
    handle: async (route, url) => {
      const params = url.searchParams;
      if (url.pathname === '/api/my-collection') {
        if (options.noteList) server.requests.push(options.noteList(params));
        await server.gate;
        await route.fulfill({ json: { collection: list(params), total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] } });
        return true;
      }
      if (url.pathname === '/api/my-collection/stats') {
        if (options.noteStats) server.requests.push(options.noteStats(params));
        await server.statsGate;
        await route.fulfill({ json: { total: server.total, rarityCounts: {}, tagOptions: [] } });
        return true;
      }
      return (await options.handle?.(route, url)) ?? false;
    },
  });
  return server;
}
