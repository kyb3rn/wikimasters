import type { Page } from '@playwright/test';
import { filtersTitle, listServer, type ListServer } from './lists';
import { openSite, sitePage } from './site';

/**
 * Imitation de la page « Toutes les cartes » (code du site, 30/09/2026) : ligne des filtres (champ et
 * « Rechercher », désactivé tant que le champ vaut la recherche en cours ; liste « Trier les cartes » comme
 * celles du site, menu en portail, props React `ariaLabel`, `value`, `options`, `onChange`), pastilles
 * (« Liste de souhaits », raretés, « Réinitialiser rareté »). La liste se charge dans un « effet » qui dépend
 * de la page, de la recherche lancée, des raretés (identité du `Set`), du tri et du filtre : roue à la place
 * de la grille pendant un chargement, requête précédente interrompue, pages gardées en
 * `sessionStorage['gc_v11_<adresse>']` (sauf liste de souhaits) et relues sans requête. États de la page dans
 * ses hooks, dans l'ordre du site ; pagination « Page x / y » (« Page x · suite disponible » pendant une
 * recherche). Au-dessus des filtres, un `div.card-frame` : compteurs par rareté, ou pendant une recherche
 * « Recherche active : pas de décompte… » (même nœud). `window.__catalog.loads` : listes reçues du réseau.
 */
const SCRIPT = `
(() => {
  const { el, button, icon, tailwindBase, hooks, listbox, rarityPills } = kit;
  tailwindBase();
  window.__catalog = { loads: 0 };

  let cards = [], total = 0, hasMore = false, wishlistOn = false, loading = true;
  let input = '', sort = 'rarity', rarities = new Set(), page = 0, applied = '';
  let fetchId = 0, controller;

  // États de la page, dans l'ordre du site (seuls les derniers comptent pour le script).
  const values = [
    () => cards, () => total, () => hasMore, () => ({}), () => ({}), () => new Set(), () => new Set(), () => new Set(),
    () => wishlistOn, () => null, () => loading, () => input, () => sort, () => rarities, () => page, () => null, () => applied,
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
  const show = (body) => { cards = body.cards ?? []; total = body.total ?? total; hasMore = body.searchHasMore === true; };
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const id = ++fetchId;
    const url = address();
    const kept = wishlistOn ? null : sessionStorage.getItem('gc_v11_' + url);
    if (kept) { show(JSON.parse(kept)); loading = false; update(); return; }
    loading = true;
    update();
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) { if (id === fetchId) { cards = []; } return; }
      const body = await response.json();
      if (id !== fetchId) return;
      if (!wishlistOn) sessionStorage.setItem('gc_v11_' + url, JSON.stringify(body));
      show(body);
      window.__catalog.loads++;
    } catch {
    } finally {
      if (id === fetchId) { loading = false; update(); }
    }
  }

  const main = document.querySelector('main');
  const root = el('div', 'flex-1 p-4 md:p-6 space-y-6');
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
  root.append(stats, area);
  main.append(root);

  function render() {
    sortList.render();
    submit.disabled = input.trim() === applied;
    if (input) fieldBox.append(clear); else clear.remove();
    wish.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ' + (wishlistOn ? 'ring-2 active' : 'opacity-70');
    pills.render();
    const searching = applied.trim().length >= 3;
    stats.innerHTML = searching
      ? '<p class="text-xs mb-1">Recherche active : pas de décompte par rareté ni de total exact (évite de parcourir des millions de lignes).</p><div class="flex items-center gap-2 text-xs"><span>Résultats paginés — utilise Suivant / Précédent.</span></div>'
      : '<div class="flex flex-wrap items-center gap-3 mb-3"><div class="flex items-center gap-1.5 text-sm"><span>L:</span><span class="font-bold">1704</span></div></div>';
    const pages = searching ? null : Math.ceil(total / 50);
    const paged = searching ? page > 0 || hasMore : pages > 1;
    const content = loading ? spinner : grid;
    if (content === grid) {
      grid.replaceChildren(...cards.map((card) => {
        const face = el('div', 'glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl');
        face.innerHTML = '<h3>' + card.wikipedia_title + '</h3>';
        return face;
      }));
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
  }
  render();
  effect();
})();
`;

const GLOBAL_COLLECTION_LIST_HTML = sitePage('', SCRIPT);

/**
 * Ouvre la page imitée. Serveur : une carte par page, dont le titre dit les filtres ; 120 cartes (3 pages)
 * sans recherche, sinon pas de total et une suite jusqu'à la page 3. `requests` : paramètres des listes
 * demandées ; `gate` retient les réponses tant qu'il n'est pas résolu.
 */
export async function openGlobalCollection(page: Page): Promise<ListServer> {
  const { server, handle } = listServer('/api/cards', (params, count) => {
    const searching = (params.get('q') ?? '').length >= 3;
    return {
      cards: [{ id: `c-${count}`, wikipedia_title: filtersTitle(params), rarity: 'L' }],
      total: searching ? null : 120,
      searchHasMore: searching && Number(params.get('page')) < 2,
      rarityCounts: {},
      friendOwners: {},
      ownedCardIds: [],
      wishlistCardIds: [],
      friendPendingOfferKeys: [],
    };
  });
  await openSite(page, '/global-collection', { html: GLOBAL_COLLECTION_LIST_HTML, handle });
  return server;
}
