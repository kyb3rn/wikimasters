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
      <Icon name="market" busy={busy} size={16} />
      Marché
      {needsPro && <ProBadge />}
    </button>
  );
}

export interface TradeButtonProps {
  /** Offre déjà en cours avec cet ami : « Échange en attente », désactivé. */
  readonly pending: boolean;
  readonly onClick: () => void;
}

/** « Échanger » : déclenche « Proposer un échange » du site (caché), qui ouvre sa fenêtre d'échange par-dessus la modale. */
export function TradeButton({ pending, onClick }: TradeButtonProps) {
  return (
    <button type="button" class={buttonClass('window', { tone: 'accent' })} disabled={pending} title={pending ? undefined : 'Proposer un échange'} onClick={onClick}>
      <Icon name={pending ? 'pending' : 'handshake'} size={16} />
      {pending ? 'Échange en attente' : 'Échanger'}
    </button>
  );
}

export interface WishlistButtonProps {
  /** Carte dans la liste : vert plein, sinon vert en contour (comme le site, plus marqué quand elle y est). */
  readonly active: boolean;
  /** Texte complet du bouton du site et son texte d'aide, en info-bulle. */
  readonly title: string;
  /** Ajout ou retrait en cours. */
  readonly busy: boolean;
  readonly onClick: () => void;
}

/** « Liste de souhaits », dans la rangée d'actions : déclenche le bouton du site (caché). */
export function WishlistButton({ active, title, busy, onClick }: WishlistButtonProps) {
  return (
    <button
      type="button"
      class={buttonClass('window', { tone: 'accent', fill: active ? 'solid' : 'outline' })}
      disabled={busy}
      aria-busy={busy}
      aria-pressed={active}
      title={title}
      onClick={onClick}
    >
      <Icon name="bell" busy={busy} size={16} />
      Liste de souhaits
    </button>
  );
}

export interface ModalActionsProps {
  readonly trade: TradeButtonProps | undefined;
  readonly wishlist: WishlistButtonProps | undefined;
  readonly market: MarketButtonProps;
}

/**
 * Rangée d'actions quand la modale n'a pas celle du site (carte seule, exemplaire d'un ami, le mien réservé dans un
 * échange), faite comme la sienne sous les deux colonnes : échange · liste de souhaits · Marché. Textes courts pour que
 * les trois tiennent sur une ligne (demande de l'utilisateur).
 */
export function ModalActions({ trade, wishlist, market }: ModalActionsProps) {
  return (
    <div class={siteClass.cardModalActions}>
      <div class={siteClass.cardModalActionsRow}>
        {trade && <TradeButton {...trade} />}
        {wishlist && <WishlistButton {...wishlist} />}
        <MarketButton {...market} />
      </div>
    </div>
  );
}
