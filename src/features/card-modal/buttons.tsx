import { ProBadge } from '@/services/market';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface MarketButtonProps {
  /** Ventes en cours de chargement. */
  readonly busy: boolean;
  /** Compte sans PRO : badge PRO du site, le clic ouvre son offre. */
  readonly needsPro: boolean;
  readonly onClick: () => void;
}

/** « Marché », au centre des actions (gris en contour) : ouvre l'historique des ventes de la carte, par-dessus la modale. */
export function MarketButton({ busy, needsPro, onClick }: MarketButtonProps) {
  return (
    <button
      type="button"
      class={`${buttonClass('window')}${needsPro ? ` ${siteClass.proBadgeHost}` : ''} wm-market-button`}
      disabled={busy}
      aria-busy={busy}
      title={needsPro ? 'Historique des ventes de la carte (PRO)' : 'Historique des ventes de la carte'}
      onClick={onClick}
    >
      <Icon name={busy ? 'spinner' : 'market'} size={16} class={busy ? 'wm-spin' : undefined} />
      Marché
      {needsPro && <ProBadge />}
    </button>
  );
}

export interface WishlistButtonProps {
  /** Carte dans la liste : vert plein, sinon vert en contour (comme le site, plus marqué quand elle y est). */
  readonly active: boolean;
  /** Texte du bouton du site. */
  readonly label: string;
  readonly hint: string | undefined;
  /** Ajout ou retrait en cours. */
  readonly busy: boolean;
  readonly onClick: () => void;
}

/** Liste de souhaits, déplacée dans la rangée d'actions : déclenche le bouton du site (caché). */
export function WishlistButton({ active, label, hint, busy, onClick }: WishlistButtonProps) {
  return (
    <button type="button" class={buttonClass('window', { tone: 'accent', fill: active ? 'solid' : 'outline' })} disabled={busy} aria-busy={busy} title={hint} onClick={onClick}>
      <Icon name={busy ? 'spinner' : 'bell'} size={16} class={busy ? 'wm-spin' : undefined} />
      {label}
    </button>
  );
}

export interface CatalogActionsProps {
  readonly wishlist: WishlistButtonProps | undefined;
  readonly market: MarketButtonProps;
}

/** Rangée d'actions de la vue catalogue, faite comme celle du site sous ses deux colonnes : liste de souhaits · Marché. */
export function CatalogActions({ wishlist, market }: CatalogActionsProps) {
  return (
    <div class={siteClass.cardModalActions}>
      <div class={siteClass.cardModalActionsRow}>
        {wishlist && <WishlistButton {...wishlist} />}
        <MarketButton {...market} />
      </div>
    </div>
  );
}
