import type { Page, Route } from '@playwright/test';
import { openSite, sitePage, SUPABASE } from './site';

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

/**
 * Imitation de la page Collection : champ de recherche (pris en compte 300 ms après la frappe, 3 caractères
 * au moins), deux listes déroulantes (étiquette, tri) et pastilles de rareté (L UR SR R PC C) qui remettent la page à 0
 * et relancent aussitôt la liste, liste et compteurs
 * (`/api/my-collection`, `/api/my-collection/stats`, en page 0 seulement), réponse périmée ignorée, voile
 * avec roue sur la grille pendant un chargement, affiché comme React dans une tâche suivante (`overlayShown`
 * compte ses apparitions), grille
 * dans l'ordre de la liste, modale de carte du site (confirmation de défausse, « Mettre aux
 * enchères » qui crée directement l'enchère). Comme le site, une défausse ou une mise aux enchères réussie
 * recharge la liste. Pagination au-dessus et au-dessous de la grille, dès que le total des compteurs dépasse
 * 50 : « Page x / y » (numéro changé en texte seul), « Chargement… » pendant un chargement, état `page` de la
 * page dans ses hooks. Composant « tirer pour rafraîchir » : `onRefresh` dans l'arbre React affiché ; les
 * fibers notés sur la rangée des listes et les barres sont la version précédente, dont l'`onRefresh` ne charge
 * rien (`staleRefresh`) et les états ont gardé leurs valeurs du début (`staleSetPage`). Listes déroulantes
 * comme celles du site (menu en portail, props React `ariaLabel`, `value`, `options`, `onChange`), dont
 * « Gérer les étiquettes… », qui ouvre la fenêtre du même nom (`manageOpened`).
 * `window.__collection.loads` : listes affichées.
 */
const SCRIPT = `
(() => {
  const el = (tag, cls) => { const node = document.createElement(tag); node.className = cls; return node; };
  const button = (cls, html, onclick) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = onclick; return b; };
  const icon = (name) => '<svg class="lucide lucide-' + name + '" width="16" height="16"></svg>';
  const stage = document.getElementById('stage');
  // Comme la base de Tailwind et le site (16 px imposés aux champs).
  const base = document.createElement('style');
  base.textContent = '*, ::before, ::after { box-sizing: border-box; } input, select, textarea { font-size: 16px !important; }';
  document.head.append(base);
  let page = 0;
  /** Exemplaires d'après les compteurs : 50 par page. */
  let total = 0;
  let sort = 'rarity';
  let tag = '';
  let requestId = 0;
  let loading = false;
  let loaded = false;
  window.__collection = { loads: 0, staleRefresh: 0, staleSetPage: 0, overlayShown: 0, manageOpened: 0, siteTagActions: 0 };

  // Routeur Next.js imité (contexte React au-dessus de <main>), comme sur /pulls.
  const router = { push(href) { history.pushState(null, '', href); }, replace(href) { this.push(href); }, prefetch() {} };
  document.querySelector('main')['__reactFiber$test'] = {
    memoizedProps: {},
    return: { memoizedProps: { value: router, children: null }, return: null },
  };

  // Fenêtre « Gérer les étiquettes », ouverte par l'option du même nom de la liste des étiquettes.
  function openManager() {
    window.__collection.manageOpened++;
    const back = el('div', 'fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4');
    back.id = 'tag-manager';
    const panel = el('div', 'card-frame-solid relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden');
    const close = button('absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full', '×', () => back.remove());
    close.setAttribute('aria-label', 'Fermer');
    const head = el('div', 'border-b border-[var(--color-border)] p-4 pr-12');
    const title = el('h2', 'text-lg font-bold');
    title.textContent = 'Gérer les étiquettes';
    head.append(title);
    panel.append(close, head);
    back.append(panel);
    document.body.append(back);
  }

  let menus = 0;
  /**
   * Liste déroulante du site : bouton (aria-controls, aria-expanded), menu rendu dans body (portail) sous le
   * bouton tant qu'elle est ouverte, fermée par un mousedown hors du cadre et du menu. Composant React :
   * \`props\` (ariaLabel, value, options, onChange), placé dans l'arbre plus bas. Son onChange est celui de la
   * page : « Gérer les étiquettes… » ouvre la fenêtre, toute autre valeur change le filtre et recharge.
   */
  function select(ariaLabel, options, get, set) {
    const wrap = el('div', 'relative min-w-0 flex-1');
    const id = 'listbox-' + ++menus;
    const toggle = button('flex w-full min-h-[42px] items-center rounded-lg', '', () => (list.isConnected ? close() : open()));
    toggle.id = id + '-button';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', id);
    toggle.setAttribute('aria-label', ariaLabel);
    const list = el('ul', 'max-h-52 overflow-y-auto rounded-xl border py-1');
    list.id = id;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-labelledby', toggle.id);
    const open = () => {
      const box = toggle.getBoundingClientRect();
      list.style.cssText = 'position:fixed;z-index:45;background:#161b22;top:' + (box.bottom + 6) + 'px;left:' + box.left + 'px;width:' + box.width + 'px';
      document.body.append(list);
      toggle.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      list.remove();
      toggle.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('mousedown', (event) => { if (!wrap.contains(event.target) && !list.contains(event.target)) close(); });
    const show = () => { toggle.textContent = options.find(([value]) => value === get())[1]; props.value = get(); };
    const props = {
      ariaLabel,
      value: get(),
      options: options.map(([value, label]) => ({ value, label })),
      onChange(value) {
        if (value === '__manage_tags__') return openManager();
        set(value);
        show();
        page = 0;
        queueMicrotask(load);
      },
    };
    for (const [value, text] of options) {
      const item = el('li', '');
      item.setAttribute('role', 'none');
      const option = button('flex w-full cursor-pointer items-center justify-start px-3 py-2 text-left text-sm', '', () => { close(); props.onChange(value); });
      option.setAttribute('role', 'option');
      option.textContent = text;
      item.append(option);
      list.append(item);
    }
    show();
    wrap.append(toggle);
    return { wrap, toggle, props };
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
  filters.append(...lists.map(({ wrap }) => wrap));
  bar.append(search, filters);
  // Pastilles de rareté, comme celles du site (couleur en style, cochée : ring-2) : chaque clic recharge aussitôt.
  const rarities = new Set();
  const pills = el('div', 'flex flex-wrap gap-2');
  const pillClass = (on) => 'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ' + (on ? 'ring-2 ring-white/30' : 'opacity-50 hover:opacity-80');
  // « Réinitialiser rareté » en fin de rangée, dès qu'une rareté est cochée.
  const reset = button('px-3 py-1 text-xs cursor-pointer', 'Réinitialiser rareté', () => {
    rarities.clear();
    for (const pill of pills.querySelectorAll('button[style]')) pill.className = pillClass(false);
    reset.remove();
    page = 0;
    queueMicrotask(load);
  });
  for (const rarity of ['L', 'UR', 'SR', 'R', 'PC', 'C']) {
    const color = 'var(--color-rarity-' + rarity.toLowerCase() + ')';
    const pill = button(pillClass(false), rarity, () => {
      if (rarities.has(rarity)) rarities.delete(rarity);
      else rarities.add(rarity);
      pill.className = pillClass(rarities.has(rarity));
      if (rarities.size > 0) pills.append(reset);
      else reset.remove();
      page = 0;
      queueMicrotask(load);
    });
    pill.setAttribute('style', 'background-color: ' + color + '30; color: ' + color + ';');
    pills.append(pill);
  }

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
  stage.append(bar, pills, frame);

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
  // sélection (booléen) puis exemplaires cochés (Set), comme le site.
  const hookList = (dispatchPage, dispatchSelecting = () => {}, dispatchSelected = () => {}, dispatchList = () => {}, dispatchTagOptions = () => {}, dispatchCatalog = () => {}) => {
    const list = {
      list: { memoizedState: [], queue: { dispatch: dispatchList } },
      total: { memoizedState: 0, queue: { dispatch() {} } },
      tagOptions: { memoizedState: [], queue: { dispatch: dispatchTagOptions } },
      catalog: { memoizedState: null, queue: { dispatch: dispatchCatalog } },
      loading: { memoizedState: false, queue: { dispatch() {} } },
      ref: { memoizedState: { current: 0 }, queue: null },
      page: { memoizedState: 0, queue: { dispatch: dispatchPage } },
      ...(window.__fakeSelection === true && {
        selecting: { memoizedState: false, queue: { dispatch: dispatchSelecting } },
        selected: { memoizedState: new Set(), queue: { dispatch: dispatchSelected } },
      }),
    };
    const order = Object.values(list);
    order.forEach((hook, i) => { hook.next = order[i + 1] ?? null; });
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
  const listFibers = lists.map(({ wrap, toggle, props }) => {
    const component = fiber(props, null, filtersFiber);
    toggle['__reactFiber$test'] = fiber({}, toggle, fiber({}, wrap, component));
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
      const title = el('h3', 'text-xs shrink-0 font-bold');
      title.textContent = entry.card.wikipedia_title;
      face.append(title);
      if (entry.tags.length > 0) {
        const tags = el('div', 'fake-tags');
        for (const tag of entry.tags) {
          const chip = el('span', 'fake-tag');
          chip.textContent = tag.name;
          chip.dataset.color = tag.color ?? '';
          tags.append(chip);
        }
        face.append(tags);
      }
      face.onclick = () => (selecting ? toggleEntry(entry) : openModal(entry));
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
    const panel = el('div', 'card-frame relative w-full p-6');
    const close = button('absolute top-3 right-3', '×', closeModal);
    close.setAttribute('aria-label', 'Fermer');
    const face = el('div', 'w-72 h-[420px] glow-' + entry.card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden');
    face.style.cssText = 'width:200px;height:280px;background:#30363d;position:relative';
    const faceTitle = el('h3', 'text-base font-bold');
    faceTitle.textContent = entry.card.wikipedia_title;
    const star = button('p-0.5 rounded-md', '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"></path></svg>', () => {});
    star.setAttribute('aria-label', 'Ajouter aux favoris');
    face.append(faceTitle, star);
    const title = el('h2', 'text-xl font-bold');
    title.textContent = entry.card.wikipedia_title;
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
      const heading = el('h3', 'text-base font-bold'); heading.textContent = 'Défausser cette carte ?';
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
      box.append(heading, cancel, confirm);
      confirmBack.append(box);
      back.append(confirmBack);
    });
    const row = el('div', 'flex gap-2');
    row.append(auction, discard);
    const actions = el('div', 'mt-3');
    actions.append(row);
    panel.append(close, face, title, tag, actions);
    back.append(panel);
    document.body.append(back);
  }

  // ---- Mode sélection (COLLECTION_SELECTION_HTML seulement) ----
  const SELECTION = window.__fakeSelection === true;
  const TAGS = window.__fakeTags ?? [];
  let entries = [];
  let selecting = false;
  const selected = new Set();
  let discardError = null;
  const svg = (name) => '<svg class="lucide lucide-' + name + '" width="14" height="14"></svg>';
  // Comme React : n'écrit que ce qui change.
  const setHTML = (node, html) => { if (node.__html !== html) { node.__html = html; node.innerHTML = html; } };
  const chipStyle = (color) => {
    const n = parseInt(color.slice(1), 16);
    const rgb = (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255);
    return 'background-color: rgba(' + rgb + ', 0.22); border-color: rgba(' + rgb + ', 0.5); color: rgba(248, 250, 252, 0.95);';
  };
  const norm = (text) => text.normalize('NFD').replace(/\\p{M}/gu, '').toLowerCase().trim();

  // Titre et « Sélectionner » / « Quitter la sélection » (entrer ou sortir vide la sélection).
  const titleRow = el('div', 'flex items-center justify-between gap-3');
  const heading = el('h1', 'text-2xl font-bold');
  heading.textContent = 'Collection';
  const modeButton = button('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', '', () => {
    selecting = !selecting;
    selected.clear();
    discardError = null;
    renderSelection();
  });
  titleRow.append(heading);

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

  function toggleEntry(entry) {
    if (selected.has(entry.id)) selected.delete(entry.id);
    else selected.add(entry.id);
    renderSelection();
  }

  function renderSelection() {
    if (!SELECTION) return;
    hooks.selecting.memoizedState = selecting;
    hooks.selected.memoizedState = new Set(selected);
    // Comme le site : son bouton n'est là qu'une fois les compteurs reçus, total non nul.
    if (total > 0) { if (!modeButton.isConnected) titleRow.append(modeButton); }
    else modeButton.remove();
    setHTML(modeButton, selecting ? svg('x') + 'Quitter la sélection' : svg('square-check-big') + 'Sélectionner');
    // Calque de chaque case : anneau d'accent si cochée.
    for (const item of grid.children) {
      let overlay = item.querySelector(':scope > div.pointer-events-none');
      if (!selecting) { overlay?.remove(); continue; }
      if (!overlay) {
        overlay = el('div', '');
        overlay.style.cssText = 'position:absolute;inset:0';
        item.append(overlay);
      }
      const on = selected.has(item.__entry.id);
      const cls = 'pointer-events-none absolute inset-0 z-10 rounded-2xl transition-all duration-300 group-hover:scale-105 ' +
        (on ? 'ring-4 ring-[var(--color-accent)]' : 'bg-black/0 hover:bg-black/10');
      if (overlay.className !== cls) overlay.className = cls;
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
  }

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
    const headText = el('div', '');
    const title = el('h2', 'text-lg font-bold');
    title.textContent = mode === 'remove' ? 'Retirer une étiquette' : 'Appliquer une étiquette';
    const sub = el('p', 'text-xs');
    sub.textContent = 'Sur ' + cards.length + ' cartes sélectionnées.';
    headText.append(title, sub);
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
    const title = el('h3', 'text-base font-bold mb-2');
    title.textContent = 'Défausser ' + cards.length + ' carte' + (cards.length > 1 ? 's' : '') + ' ?';
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

  if (SELECTION) {
    stage.prepend(titleRow);
    renderSelection();
    // Comme le site : ses étiquettes, lues à Supabase avec la clé publique et le jeton de la session.
    fetch('${SUPABASE}/rest/v1/tags?select=*&user_id=eq.u0&order=name.asc', {
      headers: { apikey: 'cle-publique', authorization: 'Bearer ' + window.__fakeJwt },
    }).then((r) => r.json()).then((rows) => { hooks.catalog.memoizedState = rows; }).catch(() => {});
  }

  load();
})();
`;

export const COLLECTION_HTML = sitePage('<div id="stage"></div>', SCRIPT);

/** Étiquettes de l'utilisateur imité (table `tags` de Supabase). */
export const FAKE_TAGS = [
  { id: 't1', name: 'rare', color: '#f472b6' },
  { id: 't2', name: 'sport', color: '#60a5fa' },
  { id: 't3', name: 'histoire', color: '#4ade80' },
];

/** Jeton de session imité : son `sub` est l'utilisateur `u0`. */
export const FAKE_JWT = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"sub":"u0"}').toString('base64url')}.signature`;

/**
 * La même page avec le mode sélection du site : « Sélectionner » à droite du titre, cases cochées au clic,
 * barre du bas (compte, « Tout sélectionner (page) », « Étiqueter », « Retirer l'étiquette », « Défausser
 * (+n) »), modale d'étiquetage (`#bulk-tags`) et confirmation de défausse (`#bulk-discard`). Au chargement,
 * les étiquettes sont lues à Supabase avec la session : les tests servent ces requêtes.
 */
export const COLLECTION_SELECTION_HTML = sitePage(
  '<div id="stage"></div>',
  `window.__fakeSelection = true; window.__fakeTags = ${JSON.stringify(FAKE_TAGS)}; window.__fakeJwt = '${FAKE_JWT}';` + SCRIPT,
);

type Entry = ReturnType<typeof entry>;

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
