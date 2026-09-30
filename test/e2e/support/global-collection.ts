import { SUPABASE, sitePage } from './site';

/** Carte du catalogue (modèle, sans exemplaire), comme dans `/api/cards`. */
export const CATALOG_CARD = { id: 'c-5g', wikipedia_title: '5G', rarity: 'L', atk: 10000, def: 8765 };

/**
 * Page « Toutes les cartes » (`/global-collection`) : une carte ; un clic ouvre la modale de carte en vue
 * catalogue, structure relevée sur le site (capture du 29/09/2026) : face, colonne de droite (titre, ligne
 * rareté + onglets, ATK / DEF, liste de souhaits et son texte d'aide, « Signaler l'image »), aucune rangée d'actions.
 */
export const CATALOG_HTML = sitePage(
  `<div class="flex flex-wrap justify-center gap-3"><div id="grid-card" class="glow-l relative rounded-2xl"><h3>5G</h3></div></div>`,
  `
  const card = ${JSON.stringify(CATALOG_CARD)};
  const el = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  const icon = (name) => '<svg class="lucide lucide-' + name + '" width="16" height="16"></svg>';
  const button = (cls, html, onclick) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = onclick; return b; };
  let wished = false;
  const closeModal = () => document.getElementById('card-modal')?.remove();
  function openModal() {
    closeModal();
    const back = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'card-modal';
    back['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: { card, onClose: closeModal }, return: null } };
    const panel = el('div', 'card-frame relative w-full p-6');
    const close = button('absolute top-3 right-3', '×', closeModal); close.setAttribute('aria-label', 'Fermer');

    const face = el('div', 'w-72 h-[420px] glow-l relative rounded-2xl overflow-hidden');
    face.style.cssText = 'width:200px;height:280px;background:#30363d';
    const image = el('div', 'absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20');
    image.style.cssText = 'position:absolute;top:0;left:0;right:0;height:45%;background:#57606a';
    const faceTitle = el('h3', 'text-base font-bold'); faceTitle.textContent = card.wikipedia_title;
    const faceStats = el('div', 'face-stats'); faceStats.innerHTML = icon('swords') + card.atk + icon('shield') + card.def;
    face.append(image, faceTitle, faceStats);
    const left = el('div', 'flex-shrink-0 flex justify-center'); left.append(face);

    const title = el('h2', 'text-xl font-bold'); title.textContent = card.wikipedia_title;
    const rarityRow = el('div', 'flex items-center justify-between gap-2 mt-1');
    const rarity = el('span', 'inline-block px-2 py-0.5 rounded text-xs font-bold'); rarity.textContent = 'Légendaire';
    const tablist = el('div', 'flex shrink-0 gap-0.5 rounded-md border');
    tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', 'Vue de la carte');
    for (const label of ['Détails', 'Marché']) {
      const tab = button('rounded px-2 py-0.5 text-[10px]', label, () => {});
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(label === 'Détails'));
      tablist.append(tab);
    }
    rarityRow.append(rarity, tablist);
    const header = el('div', ''); header.append(title, rarityRow);
    const stats = el('div', 'grid grid-cols-2 gap-3');
    stats.innerHTML = '<div class="card-frame p-3 text-center"><div>' + icon('swords') + card.atk + '</div><div>ATK</div></div>' +
      '<div class="card-frame p-3 text-center"><div>' + icon('shield') + card.def + '</div><div>DEF</div></div>';
    // Comme le site : bouton changé tout de suite (optimiste), texte d'aide à l'ajout seulement, requête Supabase.
    const wishBlock = el('div', 'space-y-2'); const wishInner = el('div', 'space-y-1.5');
    const wish = button('', '', () => {
      wished = !wished; renderWish();
      fetch('${SUPABASE}/rest/v1/wishlist_items' + (wished ? '' : '?user_id=eq.u0&card_id=eq.' + card.id), {
        method: wished ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' },
        body: wished ? JSON.stringify({ user_id: 'u0', card_id: card.id }) : undefined,
      });
    });
    const hint = el('p', 'text-xs leading-snug'); hint.textContent = 'Recevez une alerte si cette carte est mise en vente.';
    const renderWish = () => {
      wish.className = 'inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 ' + (wished ? 'border wished' : 'not-wished');
      wish.innerHTML = icon('bell') + (wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits');
      if (wished) hint.remove(); else wishInner.append(hint);
    };
    wishInner.append(wish); renderWish(); wishBlock.append(wishInner);
    const report = button('inline-flex items-center gap-1.5 rounded-lg', icon('flag') + "Signaler l'image", () => {});
    report.setAttribute('aria-pressed', 'false');
    const reportBlock = el('div', 'border-t border-[var(--color-border)] pt-3');
    const reportInner = el('div', 'space-y-1.5'); reportInner.append(report); reportBlock.append(reportInner);
    const right = el('div', 'flex-1 flex flex-col min-w-0 md:pr-2 gap-4'); right.append(header, stats, wishBlock, reportBlock);
    const columns = el('div', 'flex flex-col md:flex-row gap-6'); columns.append(left, right);

    panel.append(close, columns);
    back.append(panel);
    document.body.append(back);
  }
  document.getElementById('grid-card').onclick = openModal;
  `,
);
