import type { Page, Route } from '@playwright/test';
import { filtersTitle } from './lists';
import { openSite, sitePage, type Gated } from './site';

/**
 * Imitation de la fenêtre « Échanger avec aelonka » (code du site, 30/09/2026), ouverte d'office : onglets
 * « Mes cartes » / « Cartes de aelonka » (contenu recréé au changement d'onglet, clé `tab-mine` / `tab-theirs`),
 * rangée des filtres (champ, groupe de droite : « Ajouter des WB » `{ value, onExpand }`, « Rareté »
 * `{ filter, onChange }`, « Filtre » `{ tags, activeTagId, onSelect, wishlist… }`), champ des wikibidous sous la
 * rangée (`{ label, value, onChange, onClose, balanceHint, maxBalance }`, solde de 250), erreur `p[role=status]`,
 * zone des cartes (voile pendant un chargement, grille ou « Aucune carte »). Chaque côté se charge dans un
 * « effet » qui dépend de la page, des raretés (identité du `Set`), de l'étiquette et de la liste de souhaits ;
 * une réponse en erreur vide la grille avec un message, un échec réseau ne change rien. États dans les hooks du
 * composant (`friendUsername`) : raretés des deux côtés, puis montants.
 */
const SCRIPT = `
(() => {
  const { el, fiber, hooks } = kit;
  // Positions de Tailwind dont se servent les cases (voile, case à cocher).
  const style = document.createElement('style');
  style.textContent = '.absolute { position: absolute; } .inset-0 { inset: 0; }';
  document.head.append(style);
  const friend = 'aelonka';
  const balance = 250;
  const side = (name) => ({ name, page: 1, rarities: new Set(), tag: null, wishlist: false, list: [], loading: false, error: null, wb: 0, wbOpen: false, deps: [], selected: [] });
  const sides = { mine: side('mine'), theirs: side('theirs') };
  let tab = 'mine';

  const states = hooks([
    [() => sides.mine.rarities, (v) => { sides.mine.rarities = v; update(); }],
    [() => sides.theirs.rarities, (v) => { sides.theirs.rarities = v; update(); }],
    [() => sides.mine.wb, (v) => { sides.mine.wb = v; update(); }],
    [() => sides.theirs.wb, (v) => { sides.theirs.wb = v; update(); }],
  ]);
  const composer = fiber(null, { friendUsername: friend, friendProfileId: 'p-aelonka', onClose() {} }, null, { memoizedState: states[0] });

  let scheduled = false;
  function update() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); effects(); });
  }
  function effects() {
    for (const s of Object.values(sides)) {
      const next = [s.page, s.rarities, s.tag, s.wishlist];
      if (s.deps.length > 0 && next.every((value, i) => value === s.deps[i])) continue;
      s.deps = next;
      load(s);
    }
  }
  async function load(s) {
    s.loading = true;
    update();
    const params = new URLSearchParams();
    let url;
    if (s.name === 'mine') {
      params.set('sort', 'rarity');
      for (const rarity of s.rarities) params.append('rarity', rarity);
      if (s.tag) params.set('tag_id', s.tag);
      if (s.wishlist) params.set('wishlisted_by', friend);
      params.set('page', String(s.page - 1));
      params.set('stats', '0');
      params.set('owned_by', friend);
      url = '/api/my-collection?' + params;
    } else {
      params.set('page', String(s.page - 1));
      params.set('sort', 'rarity');
      params.set('stats', s.page === 1 ? '1' : '0');
      for (const rarity of s.rarities) params.append('rarity', rarity);
      if (s.tag) params.set('tag_id', s.tag);
      if (s.wishlist) params.set('wishlisted_by_me', '1');
      params.set('pending', '1');
      url = '/api/profile/' + friend + '/collection?' + params;
    }
    try {
      const response = await fetch(url);
      if (response.ok) { s.error = null; s.list = (await response.json()).collection ?? []; }
      else { s.list = []; s.error = response.status === 504 ? 'La recherche a pris trop de temps.' : 'Le chargement de tes cartes a échoué. Réessaie dans un instant.'; }
    } catch {
      // Le site ne rattrape pas l'échec réseau : rien ne change.
    } finally {
      s.loading = false;
      update();
    }
  }

  const overlay = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-sm');
  const frame = el('div', 'w-full max-w-5xl h-[90vh] max-h-[90vh] min-h-0 flex flex-col rounded-2xl border');
  frame.style.cssText = 'background:#161b22;max-width:1024px;height:90vh';
  const head = el('div', 'flex flex-shrink-0 items-center justify-between gap-4 p-4 border-b');
  const title = el('h2', 'text-lg font-bold truncate', 'Échanger avec ');
  title.append(el('span', 'text-[var(--color-accent)]', friend));
  head.append(el('div', 'min-w-0 flex-1'));
  head.firstChild.append(title);
  const summary = el('div', 'flex flex-shrink-0 items-center justify-center gap-2 px-4 py-2 border-b text-xs');
  const mineSummary = el('span', 'font-semibold truncate');
  mineSummary.id = 'summary-mine';
  const theirsSummary = el('span', 'font-semibold truncate');
  theirsSummary.id = 'summary-theirs';
  summary.append(mineSummary, theirsSummary);
  const tabs = el('div', 'flex flex-shrink-0 border-b');
  const tabButtons = { mine: el('button', '', 'Mes cartes'), theirs: el('button', '', 'Cartes de ' + friend) };
  for (const [name, button] of Object.entries(tabButtons)) { button.onclick = () => { tab = name; build(); update(); }; tabs.append(button); }
  const body = el('div', 'flex-1 min-h-0 overflow-hidden flex flex-col');
  const scroll = el('div', 'flex-1 min-h-0 overflow-y-auto p-2 sm:p-4');
  body.append(scroll);
  frame.append(head, summary, tabs, body);
  overlay.append(frame);
  document.body.append(overlay);

  let view;
  function listbox(label) {
    const box = el('div', 'relative shrink-0');
    const button = el('button', 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium', label);
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'listbox');
    box.append(button);
    return { box, button };
  }
  function build() {
    const s = sides[tab];
    const content = el('div');
    fiber(content, {}, composer, { key: 'tab-' + tab });
    const filters = el('div', 'mb-4 flex flex-col gap-3');
    const line = el('div', 'flex flex-col gap-3 sm:flex-row sm:items-center');
    const search = el('input', 'order-2 sm:order-1 w-full sm:flex-1 sm:min-w-0 rounded-lg border px-4 py-2 text-sm');
    search.type = 'text';
    search.placeholder = 'Rechercher...';
    const group = el('div', 'order-1 sm:order-2 flex flex-wrap items-center justify-end gap-2 shrink-0 sm:ml-auto');
    const wbProps = { value: 0, onExpand: () => { s.wbOpen = true; update(); } };
    const wbButton = el('button', 'inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs', 'Ajouter des WB');
    wbButton.type = 'button';
    wbButton.onclick = () => wbProps.onExpand();
    const wbFiber = { memoizedProps: wbProps, return: composer };
    wbButton['__reactFiber$test'] = { memoizedProps: {}, stateNode: wbButton, return: wbFiber };
    const rarity = listbox('Rareté');
    const rarityProps = { filter: s.rarities, onChange: (next) => { s.rarities = next; s.page = 1; update(); } };
    rarity.button['__reactFiber$test'] = { memoizedProps: {}, stateNode: rarity.button, return: { memoizedProps: rarityProps, return: composer } };
    const filter = listbox('Filtre');
    const filterProps = {
      tags: [{ id: 't1', name: 'rouge', color: '#ef4444', cardCount: 3 }],
      activeTagId: null,
      onSelect: (id) => { s.tag = id; s.page = 1; update(); },
      wishlistLabel: tab === 'mine' ? 'Souhaits de ' + friend : 'Mes souhaits',
      wishlistTitle: tab === 'mine' ? "N'afficher que les cartes présentes dans la liste de souhaits de " + friend : "N'afficher que les cartes présentes dans ma liste de souhaits",
      wishlistActive: false,
      onWishlistToggle: (active) => { s.wishlist = active; s.page = 1; update(); },
    };
    filter.button['__reactFiber$test'] = { memoizedProps: {}, stateNode: filter.button, return: { memoizedProps: filterProps, return: composer } };
    group.append(wbButton, rarity.box, filter.box);
    line.append(search, group);
    filters.append(line);
    const error = el('p', 'text-xs text-red-400/90');
    error.setAttribute('role', 'status');
    const editor = el('div', 'rounded-xl border p-3 space-y-2');
    const editorInput = el('input', 'w-full rounded-lg border px-3 py-2 pr-9 text-sm');
    editorInput.type = 'number';
    const editorProps = {
      label: tab === 'mine' ? "Wikibidous que j'offre" : 'Wikibidous demandés à ' + friend,
      value: 0,
      onChange: (value) => { s.wb = value; update(); },
      onClose: () => { s.wbOpen = false; update(); },
      balanceHint: tab === 'mine' ? 'Solde : 250 wb' : undefined,
      maxBalance: tab === 'mine' ? balance : undefined,
    };
    editorInput['__reactFiber$test'] = { memoizedProps: {}, stateNode: editorInput, return: { memoizedProps: editorProps, return: composer } };
    const save = el('button', 'w-full rounded-lg py-2 text-xs', 'Enregistrer');
    save.onclick = () => { editorProps.onChange(Number(editorInput.value) || 0); editorProps.onClose(); };
    editor.append(editorInput, save);
    const cards = el('div', 'relative min-h-[200px]');
    const veil = el('div', 'absolute inset-0 z-10 flex items-center justify-center');
    veil.id = 'veil';
    const grid = el('div', 'grid w-full grid-cols-2 gap-1.5');
    grid.id = 'grid';
    const empty = el('p', 'text-center text-sm py-8', 'Aucune carte');
    const selectedBlock = el('div', 'mb-4');
    const selectedTitle = el('p', 'text-xs font-semibold mb-2');
    const selectedGrid = el('div', 'grid w-full grid-cols-2 gap-1.5');
    selectedGrid.id = 'selected-grid';
    selectedBlock.append(selectedTitle, selectedGrid, el('div', 'border-b mt-4'));
    content.append(filters, cards);
    scroll.replaceChildren(content);
    view = { content, selectedBlock, selectedTitle, selectedGrid, s, group, filters, error, editor, editorInput, cards, veil, grid, empty, wbButton, wbProps, rarityProps, filterProps, editorProps };
  }

  function render() {
    const { content, selectedBlock, selectedTitle, selectedGrid, s, group, filters, error, editor, editorInput, cards, veil, grid, empty, wbButton, wbProps, rarityProps, filterProps, editorProps } = view;
    const wbText = (n) => (n > 0 ? ' · ' + n + ' wb' : '');
    const count = (n) => n + ' carte' + (n !== 1 ? 's' : '');
    mineSummary.textContent = 'Moi : ' + count(sides.mine.selected.length) + wbText(sides.mine.wb);
    theirsSummary.textContent = friend + ' : ' + count(sides.theirs.selected.length) + wbText(sides.theirs.wb);
    const cell = (card, selected) => {
      const button = el('button', 'relative w-full min-w-0 rounded-2xl overflow-hidden border-2 ' + (selected ? 'border-[var(--color-accent)] shadow-lg' : 'border-transparent'));
      const face = el('div', 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-' + card.card.rarity.toLowerCase() + ' relative rounded-2xl');
      face.style.cssText = 'width:160px;height:224px';
      face.append(el('h3', '', card.card.wikipedia_title));
      button.append(face);
      if (selected) { const tint = el('div', 'absolute inset-0 rounded-2xl'); tint.id = 'site-tint'; button.append(tint); }
      button.onclick = () => { s.selected = selected ? s.selected.filter((c) => c !== card) : [...s.selected, card]; update(); };
      return button;
    };
    selectedTitle.textContent = 'Sélectionnées (' + s.selected.length + ')';
    selectedGrid.replaceChildren(...s.selected.map((card) => cell(card, true)));
    if (s.selected.length > 0) { if (!selectedBlock.isConnected) content.prepend(selectedBlock); } else selectedBlock.remove();
    for (const [name, button] of Object.entries(tabButtons)) button.className = name === tab ? 'flex-1 py-2 border-b-2' : 'flex-1 py-2';
    wbProps.value = s.wb;
    wbButton.textContent = s.wb > 0 ? s.wb + ' wb' : 'Ajouter des WB';
    if (s.wbOpen) wbButton.remove(); else if (!wbButton.isConnected) group.prepend(wbButton);
    rarityProps.filter = s.rarities;
    filterProps.activeTagId = s.tag;
    filterProps.wishlistActive = s.wishlist;
    error.textContent = s.error ?? '';
    if (s.error) filters.append(error); else error.remove();
    editorProps.value = s.wb;
    if (s.wbOpen) { if (!editor.isConnected) { editorInput.value = s.wb ? String(s.wb) : ''; filters.append(editor); } } else editor.remove();
    grid.replaceChildren(...s.list.filter((card) => !s.selected.includes(card)).map((card) => cell(card, false)));
    const children = [];
    if (s.loading) children.push(veil);
    children.push(s.list.length > 0 ? grid : empty);
    children.forEach((child, i) => { if (cards.children[i] !== child) cards.insertBefore(child, cards.children[i] ?? null); });
    while (cards.children.length > children.length) cards.lastElementChild.remove();
  }

  build();
  render();
  effects();
})();
`;

const TRADES_HTML = sitePage('<h1>Échanges</h1>', SCRIPT);

type TradeSideName = 'mine' | 'theirs';

export interface TradeServer extends Gated {
  /** Paramètres des listes demandées, par côté. */
  readonly requests: Record<TradeSideName, string[]>;
  /** Échec voulu des prochaines requêtes d'un côté : réponse 500, 504, ou pas de réponse. */
  readonly fail: Partial<Record<TradeSideName, 500 | 504 | 'network'>>;
}

/** Ouvre /trades avec la fenêtre d'échange imitée ; une carte par réponse, dont le titre dit le côté et les filtres. */
export async function openTradeComposer(page: Page): Promise<TradeServer> {
  const server: TradeServer = { requests: { mine: [], theirs: [] }, fail: {}, gate: undefined };
  const answer = async (route: Route, side: TradeSideName, params: URLSearchParams) => {
    server.requests[side].push(params.toString());
    await server.gate;
    const failure = server.fail[side];
    if (failure === 'network') return route.abort('failed');
    if (failure) return route.fulfill({ status: failure, json: { error: 'Erreur' } });
    return route.fulfill({
      json: { collection: [{ id: `u-${side}-${server.requests[side].length}`, card: { id: 'c1', wikipedia_title: filtersTitle(params, side), rarity: 'L' }, tags: [] }] },
    });
  };
  await openSite(page, '/trades', {
    html: TRADES_HTML,
    handle: async (route, url) => {
      if (url.pathname === '/api/my-collection') {
        await answer(route, 'mine', url.searchParams);
        return true;
      }
      if (url.pathname === '/api/profile/aelonka/collection') {
        await answer(route, 'theirs', url.searchParams);
        return true;
      }
      return false;
    },
  });
  return server;
}
