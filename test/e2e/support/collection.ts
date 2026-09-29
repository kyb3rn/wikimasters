import { sitePage } from './site';

/** Exemplaire de la liste (données inventées, même forme que `GET /api/my-collection`). */
export function entry(id: string, title: string, rarity = 'C', count = 1) {
  return {
    id,
    card_id: `card-${id}`,
    card: { id: `card-${id}`, wikipedia_title: title, rarity, atk: 100, def: 100 },
    tags: [],
    count,
    starred: false,
    is_shiny: false,
    user_id: 'u0',
  };
}

/**
 * Imitation de la page Collection : liste et compteurs chargés ensemble (`/api/my-collection`,
 * `/api/my-collection/stats`), grille dans l'ordre de la liste, pagination, modale de carte du site
 * (confirmation de défausse, « Mettre aux enchères » qui crée directement l'enchère). Comme le site,
 * une défausse ou une mise aux enchères réussie recharge la liste. `window.__collection.loads` : listes
 * affichées.
 */
const SCRIPT = `
(() => {
  const el = (tag, cls) => { const node = document.createElement(tag); node.className = cls; return node; };
  const button = (cls, html, onclick) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = onclick; return b; };
  const icon = (name) => '<svg class="lucide lucide-' + name + '" width="16" height="16"></svg>';
  const stage = document.getElementById('stage');
  let page = 0;
  window.__collection = { loads: 0 };

  // Routeur Next.js imité (contexte React au-dessus de <main>), comme sur /pulls.
  const router = { push(href) { history.pushState(null, '', href); }, replace(href) { this.push(href); }, prefetch() {} };
  document.querySelector('main')['__reactFiber$test'] = {
    memoizedProps: {},
    return: { memoizedProps: { value: router, children: null }, return: null },
  };

  const previous = button('px-4 py-2 rounded-lg', '← Précédent', () => { page--; load(); });
  const label = el('span', 'text-sm');
  const next = button('px-4 py-2 rounded-lg', 'Suivant →', () => { page++; load(); });
  const pagination = el('div', 'flex items-center justify-center gap-2 py-3');
  pagination.append(previous, label, next);
  const grid = el('div', 'flex flex-wrap justify-center gap-3');
  stage.append(pagination, grid);

  async function load() {
    const [list] = await Promise.all([
      fetch('/api/my-collection?sort=rarity&page=' + page + '&stats=0').then((r) => r.json()),
      fetch('/api/my-collection/stats?sort=rarity').then((r) => r.json()),
    ]);
    grid.replaceChildren(...list.collection.map((entry) => {
      const item = el('div', 'relative isolate group');
      const face = el('div', 'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-' + entry.card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden cursor-pointer');
      face.style.cssText = 'width:160px;height:224px;background:#30363d;position:relative';
      const title = el('h3', 'text-xs shrink-0 font-bold');
      title.textContent = entry.card.wikipedia_title;
      face.append(title);
      face.onclick = () => openModal(entry);
      item.append(face);
      return item;
    }));
    label.textContent = 'Page ' + (page + 1);
    previous.disabled = page === 0;
    window.__collection.loads++;
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

  load();
})();
`;

export const COLLECTION_HTML = sitePage('<div id="stage"></div>', SCRIPT);
