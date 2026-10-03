import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { rarityBadgeStyle, type Rarity } from '@/site/rarity';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { hasTransparency, imageFit, type ImageFit } from './face-image';

/** Ce que montre une face : la carte aux valeurs de l'exemplaire (rareté, ATK, DEF, shiny). */
export interface FaceCard {
  readonly title: string;
  readonly category: string;
  /** Absente si la carte cache son image (images sensibles) : le fond de rareté seul. */
  readonly image: string | undefined;
  readonly rarity: Rarity;
  /** Shiny (une L seulement, comme chez le site) : autre visuel, badge « L✦ ». */
  readonly shiny: boolean;
  readonly atk: number;
  readonly def: number;
}

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

export interface CardFaceProps {
  readonly card: FaceCard;
  /** Clic sur la carte (la face du site ouvre sa modale). */
  readonly onClick?: (event: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
}

/** Face `sm` d'une carte, au balisage de celles des grilles du site (`siteClass.face…`, captures du 29/09/2026). */
export function CardFace({ card, onClick }: CardFaceProps) {
  const { shiny, rarity } = card;
  return (
    <div
      class={shiny ? siteClass.faceShiny : `${siteClass.face} glow-${rarity.toLowerCase()}`}
      style={shiny ? { '--shiny-mx': '50%', '--shiny-my': '50%' } : undefined}
      onClick={onClick}
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
          {card.image && <FaceImage key={card.image} src={card.image} title={card.title} />}
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
          {card.title}
        </h3>
        <p class={shiny ? siteClass.faceCategoryShiny : siteClass.faceCategory}>{card.category}</p>
        <div class={siteClass.faceStatsBox}>
          <div class={shiny ? siteClass.faceStatsShiny : siteClass.faceStats}>
            <div class={siteClass.faceStat}>
              <Icon name="swords" class={shiny ? siteClass.faceAtkIconShiny : siteClass.faceAtkIcon} />
              <span class={shiny ? siteClass.faceStatValueShiny : siteClass.faceStatValue}>{formatNumber(card.atk)}</span>
            </div>
            <div class={siteClass.faceStat}>
              <Icon name="shield" class={shiny ? siteClass.faceDefIconShiny : siteClass.faceDefIcon} />
              <span class={shiny ? siteClass.faceStatValueShiny : siteClass.faceStatValue}>{formatNumber(card.def)}</span>
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
