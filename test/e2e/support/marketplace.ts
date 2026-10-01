import type { Page } from '@playwright/test';
import { filtersTitle, listServer, type ListServer } from './lists';
import { openSite, sitePage } from './site';

/**
 * Imitation de l'onglet « Parcourir » du marché (code du site, 30/09/2026) : roue de page jusqu'à la première
 * liste, puis ligne des filtres (champ `type="search"` et « Rechercher », désactivé tant que le champ vaut la
 * recherche en cours ; `<select>` du tri), pastilles de rareté (« Réinitialiser »). La liste (page 1, `mine=1`
 * jusqu'à ses listes personnelles) se recharge dès que la recherche lancée, le tri ou les raretés changent,
 * sans roue, réponse périmée ignorée ; « Charger la suite » ajoute la page suivante. « Tirer pour
 * rafraîchir » : `onRefresh` dans l'arbre React au-dessus de la ligne (recharge la page 1, listes
 * personnelles comprises). Croix « Effacer la recherche » tant que le champ a du texte : vide le champ et la
 * recherche lancée. Au retour d'une annonce (`sessionStorage['marketplace_list_v3']`), liste et filtres
 * remis sans requête de liste, seules les listes personnelles relues (`page=1&limit=1&mine=1`).
 */
const SCRIPT = `
(() => {
  const { el, button, icon, tailwindBase, rarityPills } = kit;
  tailwindBase();

  let initial = true, list = [], hasMore = false, nextPage = 2, mineLoaded = false, loadingMore = false;
  let input = '', submitted = '', sort = 'recent', rarities = new Set();
  let run = 0;

  const main = document.querySelector('main');
  const spinner = el('div', 'flex-1 flex items-center justify-center');
  spinner.innerHTML = '<div class="w-8 h-8 border-2 rounded-full animate-spin"></div>';
  main.append(spinner);

  const address = (page) => {
    const params = new URLSearchParams({ page: String(page), limit: '50', sort, ...(!mineLoaded && { mine: '1' }) });
    if (submitted) params.set('q', submitted);
    for (const rarity of rarities) params.append('rarity', rarity);
    return '/api/marketplace?' + params;
  };
  async function fetchPage(page) {
    const response = await fetch(address(page));
    return response.ok ? response.json() : null;
  }
  async function reload(cancelled = () => false) {
    const body = await fetchPage(1);
    if (cancelled()) return;
    if (!body) { list = []; hasMore = false; nextPage = 2; render(); return; }
    list = body.auctions ?? [];
    hasMore = body.hasMore === true;
    nextPage = 2;
    if (body.mine) mineLoaded = true;
    initial = false;
    render();
  }
  let key;
  let cancel = () => {};
  function effect() {
    const next = submitted + '|' + sort + '|' + [...rarities].sort().join(',');
    if (next === key) return;
    key = next;
    cancel();
    let done = false;
    cancel = () => { done = true; };
    void reload(() => done);
  }
  const update = () => queueMicrotask(() => { render(); effect(); });
  const refresh = async () => { mineLoaded = false; await reload(); };

  const root = el('div', 'flex-1 p-4 md:p-6 space-y-6');
  const area = el('div', 'space-y-3 animate-fade-in-up');
  const line = el('div', 'flex flex-col sm:flex-row gap-2');
  line['__reactFiber$test'] = { memoizedProps: {}, stateNode: line, return: { memoizedProps: { onRefresh: refresh }, return: null } };
  const fieldBox = el('div', 'relative flex-1');
  const field = el('input', 'w-full pl-9 pr-9 py-2.5 rounded-lg border text-sm');
  field.type = 'search';
  field.placeholder = 'Rechercher une carte…';
  field.addEventListener('input', () => { input = field.value; update(); });
  field.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit.click(); } });
  fieldBox.innerHTML = '<svg class="lucide lucide-search absolute left-3 size-4" style="position:absolute;width:16px;height:16px"></svg>';
  fieldBox.append(field);
  const clear = button('absolute right-2 p-1 rounded-full', icon('x', 'size-4'), () => {
    input = ''; field.value = ''; submitted = ''; update();
  });
  clear.setAttribute('aria-label', 'Effacer la recherche');
  const submit = button('py-2.5 px-4 rounded-lg text-sm font-semibold', '<span class="inline-flex items-center gap-1.5">' + icon('search', 'size-4') + 'Rechercher</span>', () => {
    submitted = input.trim(); update();
  });
  const select = el('select', 'sm:w-56 py-2.5 px-3 rounded-lg border text-sm');
  for (const [value, label] of [['recent', 'Récemment listées'], ['price_asc', 'Mise la plus basse'], ['price_desc', 'Mise la plus haute'], ['ending_soon', 'Fin imminente']]) {
    const option = el('option', '');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.addEventListener('change', () => { sort = select.value; update(); });
  line.append(fieldBox, submit, select);
  const pills = rarityPills({
    checked: () => rarities,
    toggle(rarity) {
      const next = new Set(rarities);
      if (next.has(rarity)) next.delete(rarity); else next.add(rarity);
      rarities = next; update();
    },
    reset() { rarities = new Set(); update(); },
    resetLabel: 'Réinitialiser',
  });
  area.append(line, pills.row);
  const results = el('div', 'animate-fade-in-up');
  const grid = el('div', 'flex flex-wrap justify-center gap-4 md:gap-5');
  grid.id = 'grid';
  const moreRow = el('div', 'flex justify-center pt-4');
  const more = button('px-5 py-2.5 rounded-xl text-sm font-semibold', 'Charger la suite', async () => {
    if (loadingMore || !hasMore) return;
    loadingMore = true; render();
    try {
      const body = await fetchPage(nextPage);
      if (!body || !body.auctions?.length) { hasMore = false; return; }
      list = [...list, ...body.auctions]; hasMore = body.hasMore === true; nextPage++;
    } finally { loadingMore = false; render(); }
  });
  moreRow.append(more);
  results.append(grid);
  root.append(area, results);

  function render() {
    if (initial) return;
    if (spinner.isConnected) { spinner.remove(); main.append(root); }
    submit.disabled = input.trim() === submitted;
    if (input) fieldBox.append(clear); else clear.remove();
    pills.render();
    grid.replaceChildren(...list.map((auction) => {
      const item = el('div', '');
      item.id = 'marketplace-auction-' + auction.id;
      item.innerHTML = '<a class="card-frame block p-3" href="/marketplace/' + auction.id + '"><div class="glow-l relative"><h3>' + auction.card.wikipedia_title + '</h3></div></a>';
      return item;
    }));
    more.textContent = loadingMore ? 'Chargement…' : 'Charger la suite';
    more.disabled = loadingMore;
    if (hasMore) results.append(moreRow); else moreRow.remove();
  }
  let kept = null;
  try { kept = JSON.parse(sessionStorage.getItem('marketplace_list_v3') ?? 'null'); } catch {}
  if (kept) {
    sessionStorage.removeItem('marketplace_list_v3');
    list = kept.browse; hasMore = kept.browseHasMore; nextPage = kept.nextBrowsePage;
    input = kept.search; field.value = input; submitted = kept.submittedSearch; sort = kept.sort; select.value = sort;
    rarities = new Set(kept.rarityFilter);
    key = submitted + '|' + sort + '|' + [...rarities].sort().join(',');
    initial = false;
    render();
    void fetch('/api/marketplace?page=1&limit=1&mine=1').then(() => { mineLoaded = true; });
  } else {
    effect();
  }
})();
`;

const MARKETPLACE_HTML = sitePage('', SCRIPT);

/**
 * Ouvre l'onglet imité. Serveur : une annonce par page, dont le titre dit les filtres ; une suite jusqu'à la
 * page 3 ; listes personnelles avec `mine=1`. `requests` : paramètres des listes demandées ; `gate` retient
 * les réponses tant qu'il n'est pas résolu.
 */
export async function openMarketplace(page: Page): Promise<ListServer> {
  const { server, handle } = listServer('/api/marketplace', (params, count) => ({
    auctions: [{ id: `a-${count}`, card: { id: 'c', wikipedia_title: filtersTitle(params), rarity: 'L' } }],
    page: Number(params.get('page')),
    limit: 50,
    hasMore: Number(params.get('page')) < 3,
    ...(params.get('mine') === '1' && { mine: true, selling: [], bidding: [], won: [], history: [], maxConcurrentAuctions: 5 }),
  }));
  await openSite(page, '/marketplace', { html: MARKETPLACE_HTML, handle });
  return server;
}
