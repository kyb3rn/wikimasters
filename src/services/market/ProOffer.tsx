import { openProUpgrade } from '@/site/pro';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import type { MarketCard } from './market';

/** Courbe en filigrane de l'encadré, celle du site. */
const ART_LINE = 'M0,90 L60,70 L120,75 L180,45 L240,50 L300,25 L400,15';

const heading = { fontFamily: 'var(--font-heading)' };

export interface ProOfferProps {
  readonly card: MarketCard;
  readonly onClose: () => void;
}

/**
 * Sans PRO : l'offre que le site montre à la place de sa vue du marché (textes et encadré repris de son code du
 * 30/09/2026), dans notre modale. « Débloquer » la ferme et ouvre l'abonnement du site, comme le sien.
 */
export function ProOffer({ card, onClose }: ProOfferProps) {
  return (
    <Modal
      title="Vue du marché"
      titleBefore={<Icon name="market" size={22} class="wm-pro-offer-icon" />}
      width={560}
      onClose={onClose}
    >
      <div class="wm-pro-offer">
        <div class={siteClass.proOffer}>
          <div class={siteClass.proOfferArt} aria-hidden="true">
            <svg viewBox="0 0 400 120" class={siteClass.proOfferArtSvg} preserveAspectRatio="none">
              <path d={ART_LINE} fill="none" stroke="currentColor" stroke-width="3" class={siteClass.proOfferArtLine} />
            </svg>
          </div>
          <div class={siteClass.proOfferBody}>
            <div class={siteClass.proOfferHead}>
              <div class={siteClass.proOfferIcon}>
                <Icon name="market" class={siteClass.proOfferIconSvg} />
              </div>
              <div class={siteClass.proOfferHeading}>
                <div class={siteClass.proOfferTitleRow}>
                  <h3 class={siteClass.proOfferTitle} style={heading}>
                    Vue du marché PRO
                  </h3>
                  <span class={siteClass.proTag}>
                    <Icon name="sparkles" class={siteClass.proTagIcon} />
                    PRO
                  </span>
                </div>
                <p class={siteClass.proOfferText}>
                  {card.title
                    ? `Découvre l’historique des ventes de « ${card.title} » et fixe le bon prix avant d’acheter ou de vendre.`
                    : 'Historique des ventes, courbe de prix et stats par rareté — pour acheter malin et vendre au bon moment.'}
                </p>
              </div>
            </div>
            <ul class={siteClass.proOfferList}>
              <li class={siteClass.proOfferItem}>
                <Icon name="trending-up" class={siteClass.proOfferItemIcon} />
                Graphique d'évolution des prix et ventes récentes
              </li>
              <li class={siteClass.proOfferItem}>
                <Icon name="trending-up" class={siteClass.proOfferItemIcon} />
                Moyenne, min, max et filtre par rareté
              </li>
            </ul>
            <button
              type="button"
              class={buttonClass('wide', { tone: 'pro', fill: 'solid' })}
              onClick={() => {
                onClose();
                openProUpgrade();
              }}
            >
              Débloquer avec WikiMasters PRO
            </button>
            <p class={siteClass.proOfferPrice}>9,99&nbsp;$&nbsp;CAD / mois · annulable à tout moment</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Badge PRO du site dans le coin d'un bouton de marché (compte sans PRO) ; le bouton porte `siteClass.proBadgeHost`. */
export function ProBadge() {
  return (
    <span class={siteClass.proBadge} aria-hidden="true">
      <Icon name="sparkles" class={siteClass.proBadgeIcon} />
    </span>
  );
}
