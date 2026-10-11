import { FAVORITE_LOCK } from '@/services/card-marks';
import { ProBadge } from '@/services/market';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface MarketButtonProps {
  /** Ventes en cours de chargement. */
  readonly busy: boolean;
  /** Compte sans PRO et rien en cache : badge PRO du site, le clic ouvre son offre. */
  readonly needsPro: boolean;
  readonly onClick: () => void;
}

/** « Marché », au centre des actions (gris en contour) : ouvre l'historique du marché de la carte, par-dessus la modale. */
export function MarketButton({ busy, needsPro, onClick }: MarketButtonProps) {
  return (
    <button
      type="button"
      class={`${buttonClass('window')}${needsPro ? ` ${siteClass.proBadgeHost}` : ''} wm-market-button`}
      disabled={busy}
      aria-busy={busy}
      title={needsPro ? 'Historique du marché de la carte (PRO)' : 'Historique du marché de la carte'}
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

export interface LockedButtonProps {
  /** Texte de l'encart du site qu'il remplace (caché), en info-bulle. */
  readonly title: string;
}

/**
 * « Verrouillée (favori) », désactivé, à la place de l'encart du site sur un exemplaire en favori (le mien : au lieu de
 * Vendre et Défausser ; celui d'un ami : au lieu d'Échanger). Texte court, comme celui du site sur une face verrouillée.
 */
export function LockedButton({ title }: LockedButtonProps) {
  return (
    <button type="button" class={buttonClass('window')} disabled title={title}>
      <Icon name="lock" size={16} />
      {FAVORITE_LOCK.label}
    </button>
  );
}

export interface ModalActionsProps {
  readonly locked: LockedButtonProps | undefined;
  readonly trade: TradeButtonProps | undefined;
  readonly wishlist: WishlistButtonProps | undefined;
  readonly market: MarketButtonProps;
}

/**
 * Rangée d'actions quand la modale n'a pas celle du site (carte seule, exemplaire d'un ami, le mien réservé dans un
 * échange ou en favori), faite comme la sienne sous les deux colonnes : verrou du favori · échange · liste de souhaits
 * · Marché. Textes courts pour que les trois tiennent sur une ligne (demande de l'utilisateur).
 */
export function ModalActions({ locked, trade, wishlist, market }: ModalActionsProps) {
  return (
    <div class={siteClass.cardModalActions}>
      <div class={siteClass.cardModalActionsRow}>
        {locked && <LockedButton {...locked} />}
        {trade && <TradeButton {...trade} />}
        {wishlist && <WishlistButton {...wishlist} />}
        <MarketButton {...market} />
      </div>
    </div>
  );
}
