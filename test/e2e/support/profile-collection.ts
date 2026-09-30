import type { Page } from '@playwright/test';
import { openSite, sitePage } from './site';

/**
 * Imitation du profil d'un ami, onglets « Vitrine » et « Collection » (code du site, 30/09/2026). L'onglet
 * Collection est recréé à chaque ouverture, aux filtres par défaut. Sa ligne des filtres : champ (pris en
 * compte 300 ms après la frappe), rangée des listes (« Filtrer par étiquette » si l'ami en a, « Trier la
 * collection » ; props React `ariaLabel`, `value`, `options`, `onChange`, menu en portail), pastilles de
 * rareté. La liste se charge dans un « effet » qui dépend de la page, du tri, de la recherche, des raretés
 * (identité du `Set`) et de l'étiquette ; **aucune requête interrompue, toute réponse affichée** (une erreur
 * vide la grille et affiche son message). Pendant un chargement : roue au-dessus de la grille, ou à la place
 * de tout l'onglet si la grille est vide. États dans les hooks, dans l'ordre du site ; pagination « Page x / y ».
 */
const SCRIPT = `
(() => {
  const el = (tag, cls) => { const node = document.createElement(tag); node.className = cls; return node; };
  const button = (cls, html, onclick) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = onclick; return b; };
  const base = document.createElement('style');
  base.textContent = '*, ::before, ::after { box-sizing: border-box; } input, select, textarea { font-size: 16px !important; }';
  document.head.append(base);

  const main = document.querySelector('main');
  const tabs = el('div', 'flex border-b');
  const vitrineTab = button('flex-1 py-3 text-sm', 'Vitrine', () => show('vitrine'));
  const collectionTab = button('flex-1 py-3 text-sm', 'Collection', () => show('collection'));
  tabs.append(vitrineTab, collectionTab);
  const content = el('div', 'animate-fade-in-up');
  main.append(tabs, content);
  let unmount = () => {};
  function show(tab) {
    unmount();
    content.replaceChildren();
    if (tab === 'vitrine') { content.textContent = 'Vitrine'; unmount = () => {}; }
    else unmount = collection(content);
  }

  function collection(container) {
    let alive = true;
    let cards = [], total = 0, tagOptions = [], pending = new Set(), loading = true;
    let input = '', applied = '', sort = 'rarity', rarities = new Set(), tag = null, page = 0, error = null;
    let typing;

    const values = [
      () => cards, () => total, () => tagOptions, () => pending, () => loading, () => input, () => applied,
      () => sort, () => rarities, () => tag, () => page, () => null, () => error,
    ];
    const setters = { 8: (value) => { rarities = value; }, 10: (value) => { page = value; } };
    const hooks = values.map((get, i) => ({ get memoizedState() { return get(); }, queue: { dispatch: (value) => { setters[i]?.(value); update(); } }, next: null }));
    hooks.forEach((hook, i) => { hook.next = hooks[i + 1] ?? null; });
    const pageFiber = { memoizedProps: {}, return: null, memoizedState: hooks[0] };

    let scheduled = false;
    function update() {
      if (scheduled || !alive) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; if (alive) { render(); effect(); } });
    }
    let deps = [];
    function effect() {
      const next = [page, sort, applied, rarities, tag];
      if (deps.length > 0 && next.every((value, i) => value === deps[i])) return;
      deps = next;
      load();
    }
    async function load() {
      loading = true;
      update();
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('sort', sort);
        params.set('stats', page === 0 ? '1' : '0');
        if (applied) params.set('q', applied);
        for (const rarity of rarities) params.append('rarity', rarity);
        if (tag) params.set('tag_id', tag);
        params.set('pending', '1');
        const response = await fetch('/api/profile/aelonka/collection?' + params);
        if (!response.ok) { cards = []; error = 'Le chargement de la collection a échoué. Réessaie dans un instant.'; return; }
        error = null;
        const body = await response.json();
        cards = body.collection ?? [];
        if (page === 0) { if (typeof body.total === 'number') total = body.total; tagOptions = body.tagOptions ?? []; }
      } finally {
        loading = false;
        update();
      }
    }

    const root = el('div', 'space-y-4');
    const bigSpinner = el('div', 'flex justify-center py-12');
    bigSpinner.innerHTML = '<div class="w-8 h-8 border-2 rounded-full animate-spin"></div>';
    const area = el('div', 'space-y-3');
    const line = el('div', 'flex flex-col gap-3 md:flex-row md:items-stretch');
    line.style.gap = '12px';
    line['__reactFiber$test'] = { memoizedProps: {}, stateNode: line, return: pageFiber };
    const field = el('input', 'w-full min-w-0 flex-1 rounded-lg border px-4 py-2.5 text-sm');
    field.type = 'text';
    field.placeholder = 'Rechercher par titre ou catégorie...';
    field.addEventListener('input', () => {
      input = field.value;
      page = 0;
      clearTimeout(typing);
      typing = setTimeout(() => { applied = input.trim(); update(); }, 300);
      update();
    });
    const lists = el('div', 'flex w-full min-w-0 flex-row gap-2 md:w-auto md:shrink-0 md:max-w-full');
    lists.style.gap = '8px';

    function listbox(label, boxClass, getValue, getOptions, choose) {
      const box = el('div', 'relative ' + boxClass);
      const props = { ariaLabel: label, value: getValue(), options: getOptions(), onChange: (value) => choose(value) };
      const toggle = button('flex w-full min-h-[42px] items-center rounded-lg border', '', () => (menu.isConnected ? menu.remove() : open()));
      toggle.setAttribute('aria-haspopup', 'listbox');
      toggle.setAttribute('aria-label', label);
      toggle['__reactFiber$test'] = { memoizedProps: {}, stateNode: toggle, return: { memoizedProps: props, return: pageFiber } };
      const menu = el('ul', 'rounded-xl border py-1');
      menu.setAttribute('role', 'listbox');
      const open = () => {
        const rect = toggle.getBoundingClientRect();
        menu.style.cssText = 'position:fixed;z-index:45;background:#161b22;top:' + (rect.bottom + 6) + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px';
        menu.replaceChildren(...props.options.map(({ value, label: text }) => {
          const item = el('li', '');
          const option = button('flex w-full px-3 py-2 text-left text-sm', text, () => { menu.remove(); props.onChange(value); });
          option.setAttribute('role', 'option');
          item.append(option);
          return item;
        }));
        document.body.append(menu);
      };
      box.append(toggle);
      return {
        box,
        render() {
          props.value = getValue();
          props.options = getOptions();
          toggle.textContent = props.options.find((option) => option.value === props.value)?.label ?? '';
        },
      };
    }
    const tagList = listbox('Filtrer par étiquette', 'min-w-0 flex-1 md:min-w-[9.5rem] md:max-w-[12rem]', () => tag ?? '',
      () => [{ value: '', label: 'Toutes les étiquettes' }, ...tagOptions.map((option) => ({ value: option.id, label: '#' + option.name }))],
      (value) => { tag = value === '' ? null : value; page = 0; update(); });
    const sortOptions = [{ value: 'rarity', label: 'Rareté' }, { value: 'name', label: 'Nom' }, { value: 'added', label: "Date d'ajout" }];
    const sortList = listbox('Trier la collection', 'min-w-0 flex-1 md:min-w-[8.5rem] md:max-w-[10rem]', () => sort, () => sortOptions,
      (value) => { sort = value; page = 0; update(); });
    line.append(field, lists);

    const pills = el('div', 'flex flex-wrap gap-2');
    const rarityButtons = ['L', 'UR', 'SR', 'R', 'PC', 'C'].map((rarity) => {
      const pill = button('px-3 py-1 rounded-full text-xs font-semibold', rarity, () => {
        const next = new Set(rarities);
        if (next.has(rarity)) next.delete(rarity); else next.add(rarity);
        rarities = next; page = 0; update();
      });
      pill.setAttribute('style', 'background-color: var(--color-rarity-' + rarity.toLowerCase() + ')30; color: var(--color-rarity-' + rarity.toLowerCase() + ');');
      return pill;
    });
    const reset = button('px-3 py-1 rounded-full text-xs', '<span class="inline-flex items-center gap-1"><svg class="lucide lucide-x size-3.5" width="14" height="14"></svg>Réinitialiser rareté</span>', () => {
      rarities = new Set(); page = 0; update();
    });
    pills.append(...rarityButtons);
    const errorText = el('p', 'text-xs text-red-400/90 px-1');
    area.append(line, pills);

    const count = el('p', 'text-xs');
    const spinner = el('div', 'flex justify-center py-4');
    spinner.innerHTML = '<div class="w-6 h-6 border-2 rounded-full animate-spin"></div>';
    const grid = el('div', 'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]');
    grid.id = 'grid';
    const empty = el('div', 'text-center py-12');
    const bar = el('div', 'flex items-center justify-center gap-2 py-4');
    const previous = button('px-4 py-2 rounded-lg text-sm', '← Précédent', () => { page = Math.max(0, page - 1); update(); });
    const label = el('span', 'text-sm');
    const next = button('px-4 py-2 rounded-lg text-sm', 'Suivant →', () => { page = page + 1; update(); });
    bar.append(previous, label, next);

    function render() {
      if (loading && cards.length === 0) { container.replaceChildren(bigSpinner); return; }
      tagList.render();
      sortList.render();
      if (tagOptions.length > 0) { if (!tagList.box.isConnected) lists.prepend(tagList.box); } else tagList.box.remove();
      if (!sortList.box.isConnected) lists.append(sortList.box);
      rarityButtons.forEach((pill) => {
        pill.className = 'px-3 py-1 rounded-full text-xs font-semibold ' + (rarities.has(pill.textContent) ? 'ring-2 ring-white/30' : 'opacity-50');
      });
      if (rarities.size > 0) pills.append(reset); else reset.remove();
      errorText.textContent = error ?? '';
      if (error) area.append(errorText); else errorText.remove();
      count.textContent = total + ' cartes dans la collection de aelonka';
      grid.replaceChildren(...cards.map((card) => {
        const face = el('div', 'glow-' + card.card.rarity.toLowerCase() + ' relative rounded-2xl');
        face.innerHTML = '<h3>' + card.card.wikipedia_title + '</h3>';
        return face;
      }));
      empty.textContent = total === 0 ? 'Collection vide.' : 'Aucune carte avec ces filtres.';
      const pages = Math.ceil(total / 50);
      previous.disabled = page === 0;
      next.disabled = page >= pages - 1;
      label.textContent = 'Page ' + (page + 1) + ' / ' + pages;
      const children = [area, count];
      if (loading) children.push(spinner);
      children.push(loading || cards.length > 0 ? grid : empty);
      if (pages > 1) children.push(bar);
      children.forEach((child, i) => { if (root.children[i] !== child) root.insertBefore(child, root.children[i] ?? null); });
      while (root.children.length > children.length) root.lastElementChild.remove();
      if (root.parentElement !== container) container.replaceChildren(root);
    }
    render();
    effect();
    return () => { alive = false; clearTimeout(typing); };
  }

  show('collection');
})();
`;

export const PROFILE_COLLECTION_HTML = sitePage('', SCRIPT);

/** Titre de la carte renvoyée : il dit les filtres de la requête. */
export function friendCardTitle(params: URLSearchParams): string {
  const rarities = params.getAll('rarity').sort().join('+') || 'toutes';
  const tag = params.get('tag_id') ? ` #${params.get('tag_id')}` : '';
  const search = params.get('q') ? ` «${params.get('q')}»` : '';
  return `${params.get('sort')} ${rarities}${tag}${search} p${params.get('page')}`;
}

export interface FriendCollectionServer {
  /** Paramètres des listes demandées. */
  readonly requests: string[];
  /** Retient les réponses tant qu'il n'est pas résolu. */
  gate: Promise<void> | undefined;
}

/**
 * Ouvre le profil imité, sur l'onglet Collection. Serveur : une carte par page, dont le titre dit les filtres ;
 * 120 cartes (3 pages), aucune pour la recherche « zzz » ; une étiquette « rouge » (`t1`) si `tags`.
 */
export async function openFriendCollection(page: Page, { tags = true } = {}): Promise<FriendCollectionServer> {
  const server: FriendCollectionServer = { requests: [], gate: undefined };
  await openSite(page, '/profile/aelonka', {
    html: PROFILE_COLLECTION_HTML,
    handle: async (route, url) => {
      if (url.pathname !== '/api/profile/aelonka/collection') return false;
      const params = url.searchParams;
      server.requests.push(params.toString());
      await server.gate;
      const none = params.get('q') === 'zzz';
      await route.fulfill({
        json: {
          collection: none ? [] : [{ id: `u-${server.requests.length}`, card: { id: 'c1', wikipedia_title: friendCardTitle(params), rarity: 'L' }, tags: [] }],
          total: params.get('stats') === '1' ? (none ? 0 : 120) : undefined,
          rarityCounts: {},
          tagOptions: tags ? [{ id: 't1', name: 'rouge', color: '#ef4444' }] : [],
          pendingTradeCardIds: [],
          profileId: 'p-aelonka',
        },
      });
      return true;
    },
  });
  return server;
}
