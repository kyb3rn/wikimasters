import type { JSX } from 'preact';
import { injectStyle } from '@/core/dom';
import { buttonClass, type ButtonFill } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { formatNumber } from './format';
import type { MarketPrice } from './price';
import { ProBadge } from './ProOffer';

/** Ventes de la carte : absentes du cache, en cache mais anciennes (durée du cache dépassée), récentes. */
export type PriceState = 'missing' | 'stale' | 'fresh';

const FILL: Readonly<Record<PriceState, ButtonFill>> = { missing: 'ghost', stale: 'outline', fresh: 'solid' };

const COUNT = 'wm-price-count';
// En boîte flexible : sans ligne de texte autour du bouton, la case ne grandit que de sa hauteur.
const CSS = `.wm-price { display: flex; }
.${COUNT} { font-weight: 400; opacity: 0.75; }`;

export interface PriceButtonProps {
  readonly state: PriceState;
  /** Prix moyen ; ventes en cache, mais aucune dans la rareté de la carte : `undefined`. */
  readonly price: MarketPrice | undefined;
  /** Montant affiché à la place de la moyenne (revente estimée d'une annonce). */
  readonly shown: number | undefined;
  readonly busy: boolean;
  /** Compte sans PRO : badge PRO du site, le clic ouvre son offre. */
  readonly needsPro: boolean;
  readonly title: string;
  readonly onClick: () => void;
}

/** Le bouton peut être dans un lien (vignette du marché) : un clic dessus (même désactivé) n'y mène pas. */
const stay = (event: JSX.TargetedMouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Prix moyen d'une carte, vert, très petit et arrondi, sur toute la largeur : « Charger le prix » (ghost) tant que
 * ses ventes ne sont pas en cache, puis la moyenne et le nombre de ventes, en contour si elles datent (le clic les
 * redemande), plein si elles sont récentes (le clic ouvre l'historique des ventes).
 */
export function PriceButton({ state, price, shown, busy, needsPro, title, onClick }: PriceButtonProps) {
  injectStyle('market-price', CSS);
  return (
    <div class="wm-price" onClick={stay} onAuxClick={stay}>
      <button
        type="button"
        class={cx(buttonClass('wide', { tone: 'accent', fill: FILL[state], size: 'xs', pill: true }), needsPro && siteClass.proBadgeHost)}
        disabled={busy}
        aria-busy={busy}
        title={title}
        onClick={onClick}
      >
        <Icon name={state === 'fresh' ? 'coin' : 'reload'} busy={busy} size={12} />
        {state === 'missing' ? (
          'Charger le prix'
        ) : price ? (
          <>
            {formatNumber(shown ?? price.average)}
            <span class={COUNT}>({formatNumber(price.count)})</span>
          </>
        ) : (
          'Aucune vente'
        )}
        {needsPro && <ProBadge />}
      </button>
    </div>
  );
}
