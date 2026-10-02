import type { Page } from '@playwright/test';
import { filtersTitle, listServer, type ListServer } from './lists';
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
 * Un clic sur une face ouvre la modale de carte de l'exemplaire (`kit.cardModal` : `friendUsername`, étiquettes en
 * lecture seule, « Échange en attente » si son identifiant est dans `pendingTradeCardIds`).
 */
const SCRIPT = `
(() => {
  const { el, button, tailwindBase, hooks, listbox, rarityPills, cardModal } = kit;
  tailwindBase();

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
    const states = hooks(values.map((get, i) => [get, (value) => { setters[i]?.(value); update(); }]));
    const pageFiber = { memoizedProps: {}, return: null, memoizedState: states[0] };

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
        pending = new Set(body.pendingTradeCardIds ?? []);
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

    const tagList = listbox({
      label: 'Filtrer par étiquette',
      className: 'min-w-0 flex-1 md:min-w-[9.5rem] md:max-w-[12rem]',
      value: () => tag ?? '',
      options: () => [{ value: '', label: 'Toutes les étiquettes' }, ...tagOptions.map((option) => ({ value: option.id, label: '#' + option.name }))],
      onChange(value) { tag = value === '' ? null : value; page = 0; update(); },
      parent: pageFiber,
    });
    const sortOptions = [{ value: 'rarity', label: 'Rareté' }, { value: 'name', label: 'Nom' }, { value: 'added', label: "Date d'ajout" }];
    const sortList = listbox({
      label: 'Trier la collection',
      className: 'min-w-0 flex-1 md:min-w-[8.5rem] md:max-w-[10rem]',
      value: () => sort,
      options: () => sortOptions,
      onChange(value) { sort = value; page = 0; update(); },
      parent: pageFiber,
    });
    line.append(field, lists);

    const pills = rarityPills({
      checked: () => rarities,
      toggle(rarity) {
        const next = new Set(rarities);
        if (next.has(rarity)) next.delete(rarity); else next.add(rarity);
        rarities = next; page = 0; update();
      },
      reset() { rarities = new Set(); page = 0; update(); },
    });
    const errorText = el('p', 'text-xs text-red-400/90 px-1');
    area.append(line, pills.row);

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
      pills.render();
      errorText.textContent = error ?? '';
      if (error) area.append(errorText); else errorText.remove();
      count.textContent = total + ' cartes dans la collection de aelonka';
      // Case de clé React = id de l'exemplaire, face dedans (texte, bas de la face, ATK · DEF).
      grid.replaceChildren(...cards.map((card) => {
        const cell = el('div', 'relative');
        cell['__reactFiber$test'] = { key: card.id, memoizedProps: {}, stateNode: cell, return: pageFiber };
        const face = el('div', 'glow-' + card.card.rarity.toLowerCase() + ' relative rounded-2xl');
        face.innerHTML = '<div class="absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20"><h3>' +
          card.card.wikipedia_title + '</h3><div class="mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1">' +
          '<div class="flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1"><span>9 000</span><span>9 371</span></div>' +
          '</div></div>';
        face.onclick = () => openCopy(card);
        cell.append(face);
        return cell;
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
    let modal;
    const closeCopy = () => { modal?.back.remove(); modal = undefined; };
    function openCopy(copy) {
      closeCopy();
      modal = cardModal({
        card: copy.card, userCardId: copy.id, starred: false, count: 1, tags: copy.tags ?? [], tagsReadOnly: true,
        friendUsername: 'aelonka', friendProfileId: 'p-aelonka', friendOfferPending: pending.has(copy.id), onClose: closeCopy,
      }, pageFiber);
    }

    render();
    effect();
    return () => { alive = false; clearTimeout(typing); closeCopy(); };
  }

  show('collection');
})();
`;

const PROFILE_COLLECTION_HTML = sitePage('', SCRIPT);

/**
 * Ouvre le profil imité, sur l'onglet Collection. Serveur : une carte par page, dont le titre dit les filtres ;
 * 120 cartes (3 pages), aucune pour la recherche « zzz » ; une étiquette « rouge » (`t1`) si `tags`. `collection` :
 * d'autres exemplaires à la place ; `pending` : exemplaires déjà dans une offre d'échange.
 */
export async function openFriendCollection(
  page: Page,
  { tags = true, collection, pending = [] }: { tags?: boolean; collection?: (count: number) => object[]; pending?: string[] } = {},
): Promise<ListServer> {
  const { server, handle } = listServer('/api/profile/aelonka/collection', (params, count) => {
    const none = params.get('q') === 'zzz';
    const copy = { id: `u-${count}`, card_id: 'c1', card: { id: 'c1', wikipedia_title: filtersTitle(params), rarity: 'L' }, tags: [], owned_by_viewer: false };
    return {
      collection: none ? [] : (collection?.(count) ?? [copy]),
      total: params.get('stats') === '1' ? (none ? 0 : 120) : undefined,
      rarityCounts: {},
      tagOptions: tags ? [{ id: 't1', name: 'rouge', color: '#ef4444' }] : [],
      pendingTradeCardIds: pending,
      profileId: 'p-aelonka',
    };
  });
  await openSite(page, '/profile/aelonka', { html: PROFILE_COLLECTION_HTML, handle });
  return server;
}
