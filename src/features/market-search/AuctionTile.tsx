import { isPlainClick } from '@/core/dom';
import { CardFace } from '@/services/card-face';
import { AuctionTime, ensureMarketTileStyle } from '@/services/market-tile';
import { OWN_TILE, ownTileData } from '@/site/marketplace';
import { auctionPath } from '@/site/routes';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import type { Auction } from './data';

const formatNumber = (value: number) => value.toLocaleString('fr-FR');

export interface AuctionTileProps {
  readonly auction: Auction;
  readonly leading: boolean;
  readonly onOpen: (href: string) => void;
}

/**
 * Vignette d'annonce au balisage de celles du site : elle reçoit le même habillage (carte sans cadre et appendice,
 * vendeur sur l'image, prix moyen), son annonce en attributs.
 */
export function AuctionTile({ auction, leading, onOpen }: AuctionTileProps) {
  ensureMarketTileStyle();
  const href = auctionPath(auction.id);
  const data = ownTileData({
    card: { id: auction.cardId, title: auction.card?.title ?? '', rarity: auction.rarity },
    amount: auction.currentBid ?? auction.baseAmount,
    // La recherche ne demande que les annonces en cours.
    status: 'active',
  });
  return (
    <div class={`${OWN_TILE} wm-msearch-tile`} {...data}>
      <a
        class={siteClass.tile}
        href={href}
        onClick={(event) => {
          // Ctrl, Maj, clic du milieu : autre onglet, par le navigateur.
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onOpen(href);
        }}
      >
        <div class={siteClass.tileBody}>
          {leading && <span class={siteClass.tileLeading}>Vous menez</span>}
          <div class={siteClass.tileFaceBox}>
            <CardFace
              card={{
                title: auction.card?.title ?? '…',
                category: auction.card?.category ?? '',
                image: auction.card?.image,
                rarity: auction.rarity,
                shiny: auction.shiny,
                atk: auction.atk ?? 0,
                def: auction.def ?? 0,
              }}
            />
          </div>
          <div class={siteClass.tileInfo}>
            <div class={siteClass.tilePrice}>
              <span class={siteClass.tileLabel}>{auction.currentBid === null ? 'Mise de départ' : 'Mise actuelle'}</span>
              <span class={siteClass.tileAmount}>
                <Icon name="coin" class={siteClass.tileCoin} />
                {formatNumber(auction.currentBid ?? auction.baseAmount)}
              </span>
            </div>
            <div class={siteClass.tileDuration}>
              <span class={siteClass.tileLabel}>
                <Icon name="gavel" class={siteClass.tileGavel} />
                Durée
              </span>
              <AuctionTime endAt={auction.endAt} />
            </div>
          </div>
          {auction.seller && <p class={siteClass.tileSeller}>Vendu par {auction.seller}</p>}
        </div>
      </a>
    </div>
  );
}
