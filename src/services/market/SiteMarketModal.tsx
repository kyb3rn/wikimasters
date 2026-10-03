import { useMemo, useState } from 'preact/hooks';
import type { Sale } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { rarityColor, SITE_RARITY_LABELS, type Rarity } from '@/site/rarity';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { alpha } from '@/ui/theme';
import type { MarketEntry } from './cache';
import { formatNumber } from './format';
import { SiteRarityBadge } from './SiteRarityBadge';
import { SiteSalesChart } from './SiteSalesChart';
import { lastSales, saleDate, siteRarities, siteSales, siteSelection, type SiteSelection } from './site-view';

function RarityPills({
  rarities,
  selected,
  onSelect,
}: {
  readonly rarities: readonly Rarity[];
  readonly selected: SiteSelection;
  readonly onSelect: (selection: SiteSelection) => void;
}) {
  return (
    <div class={siteClass.marketViewPills}>
      {rarities.length > 1 && (
        <button
          type="button"
          class={cx(siteClass.marketViewPill, selected === 'any' ? siteClass.marketViewPillAll : siteClass.marketViewPillIdle)}
          aria-pressed={selected === 'any'}
          onClick={() => onSelect('any')}
        >
          Toutes
        </button>
      )}
      {rarities.map((rarity) => {
        const on = selected === rarity;
        const color = rarityColor(rarity);
        return (
          <button
            key={rarity}
            type="button"
            class={cx(siteClass.marketViewPill, !on && siteClass.marketViewPillIdle)}
            style={on ? { color, borderColor: color, backgroundColor: alpha(color, 16, 'srgb') } : undefined}
            aria-pressed={on}
            onClick={() => onSelect(rarity)}
          >
            {SITE_RARITY_LABELS[rarity]}
          </button>
        );
      })}
    </div>
  );
}

/** Raretés en pastilles, « Évolution des prix » (tuiles et graphique), « 10 dernières ventes ». */
function SiteMarketView({ sales }: { readonly sales: readonly Sale[] }) {
  const [wanted, setWanted] = useState<SiteSelection>();
  const rarities = useMemo(() => siteRarities(sales), [sales]);
  const selected = siteSelection(rarities, wanted);
  const shown = useMemo(() => siteSales(sales, selected), [sales, selected]);
  const last = useMemo(() => lastSales(shown), [shown]);

  return (
    <div class={siteClass.marketView}>
      {selected && <RarityPills rarities={rarities} selected={selected} onSelect={setWanted} />}
      {shown.length > 0 && (
        <div class={siteClass.marketViewSection}>
          <h3 class={siteClass.fieldLabel}>Évolution des prix</h3>
          <SiteSalesChart sales={shown} />
        </div>
      )}
      <div class={siteClass.marketViewSection}>
        <h3 class={siteClass.fieldLabel}>
          10 dernières ventes
          {selected && <span class={siteClass.marketViewNote}>· {selected === 'any' ? 'Toutes' : SITE_RARITY_LABELS[selected]}</span>}
        </h3>
        {last.length === 0 ? (
          <p class={siteClass.marketViewEmpty}>{rarities.length === 0 ? "Aucune vente pour l'instant." : 'Aucune vente pour cette rareté.'}</p>
        ) : (
          <ul class={siteClass.marketViewList}>
            {last.map((sale) => (
              <li key={sale.id} class={siteClass.marketViewRow}>
                <div class={siteClass.marketViewRowStart}>
                  {selected === 'any' && <SiteRarityBadge rarity={sale.rarity} />}
                  <span class={siteClass.marketViewRowDate}>{saleDate(sale.time)}</span>
                </div>
                <span class={siteClass.marketViewRowPrice}>
                  <Icon name="coin" class={siteClass.marketViewCoin} />
                  {formatNumber(sale.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export interface SiteMarketModalProps {
  readonly card: CardRef;
  readonly entry: MarketEntry;
  readonly onClose: () => void;
}

/**
 * La vue du marché du site, recopiée (textes, classes, graphique : son code du 02/10/2026), sur les ventes déjà
 * chargées : rien n'est demandé au site. Titrée du nom de la carte plutôt que de son « Vue du marché » (demande de
 * l'utilisateur).
 */
export function SiteMarketModal({ card, entry, onClose }: SiteMarketModalProps) {
  return (
    <Modal
      title={card.title || entry.title}
      titleBefore={<Icon name="market" size={22} class="wm-market-heading-icon" />}
      width={672}
      maxHeight={900}
      padded
      onClose={onClose}
    >
      <SiteMarketView sales={entry.sales} />
    </Modal>
  );
}
