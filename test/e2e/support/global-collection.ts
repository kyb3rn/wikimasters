import { SUPABASE, sitePage } from './site';

/** Carte du catalogue (modèle, sans exemplaire), comme dans `/api/cards`. */
const CATALOG_CARD = { id: 'c-5g', wikipedia_title: '5G', rarity: 'L', atk: 10000, def: 8765 };

/**
 * Page « Toutes les cartes » (`/global-collection`) : une carte ; un clic ouvre la modale de carte du site en vue
 * catalogue (`kit.cardModal`, `catalogView`) avec la liste de souhaits : comme le site, bouton changé tout de suite
 * (optimiste), puis requête Supabase. `friend` : un ami a la carte (« Proposer un échange ») ; `pending` : une offre
 * est déjà en cours avec lui.
 */
export function catalogHtml({ friend = false, pending = false }: { friend?: boolean; pending?: boolean } = {}): string {
  return sitePage(
    `<div class="flex flex-wrap justify-center gap-3"><div id="grid-card" class="glow-l relative rounded-2xl"><h3>5G</h3></div></div>`,
    `
  const card = ${JSON.stringify(CATALOG_CARD)};
  let modal;
  const close = () => { modal?.back.remove(); modal = undefined; };
  function toggleWishlist() {
    const wished = !modal.props.wishlisted;
    modal.props.wishlisted = wished;
    modal.render();
    fetch('${SUPABASE}/rest/v1/wishlist_items' + (wished ? '' : '?user_id=eq.u0&card_id=eq.' + card.id), {
      method: wished ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' },
      body: wished ? JSON.stringify({ user_id: 'u0', card_id: card.id }) : undefined,
    });
  }
  document.getElementById('grid-card').onclick = () => {
    close();
    modal = kit.cardModal({
      card, catalogView: true, wishlisted: false, onToggleWishlist: toggleWishlist, onClose: close,
      ${friend ? `friendUsername: 'aelonka', friendProfileId: 'p-aelonka', friendOfferPending: ${pending},` : ''}
    });
  };
  `,
  );
}

export const CATALOG_HTML = catalogHtml();
