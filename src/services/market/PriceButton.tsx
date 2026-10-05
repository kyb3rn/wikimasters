import type { JSX } from 'preact';
import { injectStyle } from '@/core/dom';
import { buttonClass, type ButtonFill } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { alpha, palette, tokens } from '@/ui/theme';
import { formatNumber } from './format';
import type { MarketPrice } from './price';
import { ProBadge } from './ProOffer';

/** Ventes de la carte : absentes du cache, en cache mais anciennes (durée du cache dépassée), récentes. */
export type PriceState = 'missing' | 'stale' | 'fresh';

const FILL: Readonly<Record<PriceState, ButtonFill>> = { missing: 'ghost', stale: 'outline', fresh: 'solid' };

/** Contour des ventes périmées : vert du site tout juste périmées, puis jaune, orange, et rouge à une semaine. */
const STALE_COLORS = [tokens.accent, palette.yellow[400], palette.orange[400], palette.red[400]];

/** Couleurs du contour (celles de `buttonClass`) à cette ancienneté (`staleness`), en dégradé entre les paliers. */
function staleStyle(staleness: number): Record<string, string> {
  const segments = STALE_COLORS.length - 1;
  const at = Math.min(1, Math.max(0, staleness)) * segments;
  const index = Math.min(segments - 1, Math.floor(at));
  const from = STALE_COLORS[index] ?? tokens.accent;
  const to = STALE_COLORS[index + 1] ?? from;
  const color = `color-mix(in oklab, ${to} ${Math.round((at - index) * 100)}%, ${from})`;
  return { '--wm-text': color, '--wm-hot': color, '--wm-line': alpha(color, 45), '--wm-wash': alpha(color, 12) };
}

const COUNT = 'wm-price-count';
// En boîte flexible : sans ligne de texte autour du bouton, la case ne grandit que de sa hauteur.
const CSS = `.wm-price { display: flex; }
.${COUNT} { font-weight: 400; opacity: 0.75; }`;

export interface PriceButtonProps {
  readonly state: PriceState;
  /** Ventes périmées : de 0 (durée du cache) à 1 (une semaine et plus), couleur du contour. */
  readonly staleness: number;
  /** Prix moyen ; ventes en cache, mais aucune dans la rareté de la carte : `undefined`. */
  readonly price: MarketPrice | undefined;
  /** Montant affiché à la place de la moyenne (revente estimée d'une annonce). */
  readonly shown: number | undefined;
  readonly busy: boolean;
  /** Compte sans PRO et rien en cache : badge PRO du site, le clic ouvre son offre. */
  readonly needsPro: boolean;
  /** Le clic ouvre l'historique (pièce) plutôt que de charger les ventes (flèche). */
  readonly opensHistory: boolean;
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
 * ses ventes ne sont pas en cache, puis la moyenne et le nombre de ventes, en contour si elles datent (du vert au
 * rouge avec l'âge ; le clic les redemande, sauf sans PRO), plein si elles sont récentes (le clic ouvre l'historique
 * du marché).
 */
export function PriceButton({ state, staleness, price, shown, busy, needsPro, opensHistory, title, onClick }: PriceButtonProps) {
  injectStyle('market-price', CSS);
  return (
    <div class="wm-price" onClick={stay} onAuxClick={stay}>
      <button
        type="button"
        class={cx(buttonClass('wide', { tone: 'accent', fill: FILL[state], size: 'xs', pill: true }), needsPro && siteClass.proBadgeHost)}
        style={state === 'stale' ? staleStyle(staleness) : undefined}
        disabled={busy}
        aria-busy={busy}
        title={title}
        onClick={onClick}
      >
        <Icon name={opensHistory ? 'coin' : 'reload'} busy={busy} size={12} />
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
