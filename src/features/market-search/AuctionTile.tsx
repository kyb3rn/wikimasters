import { useState } from 'preact/hooks';
import { isPlainClick } from '@/core/dom';
import { AuctionTime, ensureMarketTileStyle } from '@/services/market-tile';
import { OWN_TILE, ownTileData } from '@/site/marketplace';
import { auctionPath } from '@/site/routes';
import { rarityBadgeStyle, type Rarity } from '@/site/rarity';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import type { Auction } from './data';
import { hasTransparency, imageFit, type ImageFit } from './face-image';

/** Fond des faces, par rareté (fichiers du site). */
const BACKGROUNDS: Readonly<Record<Rarity, string>> = {
  L: '/legendaire.png',
  UR: '/ultra_rare.png',
  SR: '/super_rare.png',
  R: '/rare.png',
  PC: '/peu_commun.png',
  C: '/commun.png',
};
const SHINY_BACKGROUND = '/shiny/onyx-art.webp';

const FILL = { position: 'absolute', height: '100%', width: '100%', inset: 0, color: 'transparent' } as const;

const formatNumber = (value: number) => value.toLocaleString('fr-FR');

// Une fonction, pas une table : lire `siteClass` au niveau du module le garderait dans le fichier de production.
function fitClass(fit: ImageFit): string {
  if (fit === 'portrait') return siteClass.faceImagePortrait;
  return fit === 'contain' ? siteClass.faceImageContain : siteClass.faceImageCover;
}

const FIT_STYLE: Readonly<Record<ImageFit, Record<string, string>>> = {
  cover: {},
  portrait: { objectPosition: 'center 28%' },
  contain: { transform: 'scale(0.9)' },
};

/** Image de la carte, cadrée comme chez le site une fois chargée. Introuvable : rien (le fond de rareté reste). */
function FaceImage({ src, title }: { readonly src: string; readonly title: string }) {
  const [fit, setFit] = useState<ImageFit>('cover');
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      alt={title}
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      class={fitClass(fit)}
      src={src}
      style={{ ...FILL, ...FIT_STYLE[fit] }}
      onLoad={(event) => {
        const image = event.currentTarget;
        setFit(imageFit(image.naturalHeight >= image.naturalWidth, hasTransparency(image)));
      }}
      onError={() => setFailed(true)}
    />
  );
}

/** Face `sm` d'une carte, comme dans les grilles du site. */
function Face({ auction }: { readonly auction: Auction }) {
  const { shiny, rarity, card } = auction;
  const title = card?.title ?? '…';
  return (
    <div
      class={shiny ? siteClass.faceShiny : `${siteClass.face} glow-${rarity.toLowerCase()}`}
      style={shiny ? { '--shiny-mx': '50%', '--shiny-my': '50%' } : undefined}
    >
      <img alt="" decoding="async" class={shiny ? siteClass.faceBackgroundShiny : siteClass.faceBackground} src={shiny ? SHINY_BACKGROUND : BACKGROUNDS[rarity]} style={FILL} />
      {shiny && (
        <>
          <div class={siteClass.shinyTint} aria-hidden="true" />
          <div class={siteClass.shinyShade} aria-hidden="true" />
          <div class={siteClass.shinyLines} aria-hidden="true" />
          <div class={siteClass.shinyLightAtRest} aria-hidden="true" />
          <div class={siteClass.shinyLightOnHover} aria-hidden="true" />
        </>
      )}
      <div class={siteClass.faceShade} />
      <div class={siteClass.faceImageBand}>
        <div class={siteClass.faceImageBox}>
          {card?.image && <FaceImage key={card.image} src={card.image} title={title} />}
          <div class={siteClass.faceImageFade} />
        </div>
      </div>
      {shiny ? (
        <div class={siteClass.faceBadgeShiny}>
          {rarity}
          <span aria-hidden="true" class={siteClass.faceBadgeStar}>
            ✦
          </span>
        </div>
      ) : (
        <div class={siteClass.faceBadge} style={rarityBadgeStyle(rarity)}>
          {rarity}
        </div>
      )}
      <div class={shiny ? siteClass.faceTextShiny : siteClass.faceText}>
        {shiny && <div class={siteClass.shinyWash} aria-hidden="true" />}
        <h3 class={shiny ? siteClass.faceTitleShiny : siteClass.faceTitle} style={{ fontFamily: tokens.heading }}>
          {title}
        </h3>
        <p class={shiny ? siteClass.faceCategoryShiny : siteClass.faceCategory}>{card?.category}</p>
        <div class={siteClass.faceStatsBox}>
          <div class={shiny ? siteClass.faceStatsShiny : siteClass.faceStats}>
            <div class={siteClass.faceStat}>
              <Icon name="swords" class={shiny ? siteClass.faceAtkIconShiny : siteClass.faceAtkIcon} />
              <span class={shiny ? siteClass.faceStatValueShiny : siteClass.faceStatValue}>{formatNumber(auction.atk ?? 0)}</span>
            </div>
            <div class={siteClass.faceStat}>
              <Icon name="shield" class={shiny ? siteClass.faceDefIconShiny : siteClass.faceDefIcon} />
              <span class={shiny ? siteClass.faceStatValueShiny : siteClass.faceStatValue}>{formatNumber(auction.def ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
      {shiny && (
        <>
          <div class={siteClass.shinyGlareAtRest} aria-hidden="true" />
          <div class={siteClass.shinyGlareOnHover} aria-hidden="true" />
        </>
      )}
    </div>
  );
}

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
            <Face auction={auction} />
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
