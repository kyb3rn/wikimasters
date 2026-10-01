import { findPropsAbove } from '@/core/react';
import { textOf } from '@/core/text';
import { hasIcon, siteButtons } from '@/site/dom';
import { SITE_OVERLAY } from '@/site/modals';
import { findStarButton } from './dom';
import { FACE, findFaceImage } from './face';
import { parseCardRef, type CardRef } from './ref';

/**
 * Modale de carte du site (ouverte au clic sur une carte : paquet, collection…), rendue en portail
 * dans `body`. Relevé le 29/09/2026 :
 *
 *   div.fixed.inset-0.z-50 … bg-black/70 (fond)
 *     div.card-frame (panneau)
 *       button[aria-label=Fermer]
 *       div.flex.flex-col.md:flex-row
 *         colonne gauche : face (`FACE`, image en haut : `div.absolute.top-0 … h-[45%]`,
 *                          « Ajouter aux favoris » en haut à droite)
 *         colonne droite : en-tête (h2 titre + ligne « rareté en toutes lettres · onglets Détails / Marché »),
 *                          description, « Étiquettes » (champ « Ajouter une étiquette… »), ATK/DEF, infos,
 *                          lien Wikipédia, bloc « Signaler l'image » (drapeau)
 *       div.mt-3 > div.flex (rangée d'actions) : « Mettre aux enchères » (marteau), « Défausser » (corbeille, « +1 »)
 *
 * « Vue catalogue » (Toutes les cartes, capture du 29/09/2026) : même modale, sans exemplaire : ni favori, ni
 * étiquettes, ni rangée d'actions ; à la place, dans la colonne de droite, « Ajouter à / Retirer de la liste de
 * souhaits » (cloche) et parfois « Proposer un échange ».
 *
 * Les boutons d'action sont reconnus à leur icône lucide (le script peut en changer le texte).
 */
export interface CardModal {
  readonly root: HTMLElement;
  /** Cadre de la modale (`div.card-frame`), dans le fond. */
  readonly panel: HTMLElement | undefined;
  readonly title: string;
  /** Vue catalogue : la carte seule, sans exemplaire (aucune action d'exemplaire). */
  readonly catalog: boolean;
  /** Croix « Fermer » en haut à droite. */
  readonly closeButton: HTMLButtonElement | undefined;
  /** Face de la carte (`FACE` avec son `h3`). */
  readonly face: HTMLElement | undefined;
  /** Zone de l'image, en haut de la face. */
  readonly imageArea: HTMLElement | undefined;
  /** Ligne sous le titre : rareté en toutes lettres et onglets. */
  readonly tabsRow: HTMLElement | undefined;
  readonly detailsTab: HTMLButtonElement | undefined;
  readonly marketTab: HTMLButtonElement | undefined;
  readonly reportButton: HTMLButtonElement | undefined;
  /** Bloc du bouton « Signaler l'image » (séparé par un trait). */
  readonly reportBlock: HTMLElement | undefined;
  /** Rangée des boutons d'action (mise aux enchères, défausse). */
  readonly actionsRow: HTMLElement | undefined;
  readonly auctionButton: HTMLButtonElement | undefined;
  readonly discardButton: HTMLButtonElement | undefined;
  readonly tagInput: HTMLInputElement | undefined;
  /** « Ajouter à / Retirer de la liste de souhaits » (vue catalogue). */
  readonly wishlistButton: HTMLButtonElement | undefined;
  /** Bloc de ce bouton dans la colonne de droite (avec son texte d'aide), à masquer pour le déplacer. */
  readonly wishlistBlock: HTMLElement | undefined;
  /** Texte d'aide sous le bouton (« Recevez une alerte si cette carte est mise en vente. », à l'ajout seulement). */
  readonly wishlistHint: string | undefined;
  /** Carte dans la liste de souhaits : le bouton propose de l'en retirer. */
  readonly wishlisted: boolean;
  /** Carte en favori (étoile de la face) ; `undefined` si l'étoile est introuvable. */
  readonly starred: boolean | undefined;
  /** Étiquettes de l'exemplaire associé (chacune a son bouton « Retirer l'étiquette … »). */
  readonly tagCount: number;
  /** Colonne de droite : les deux cases ATK (épées) et DEF (bouclier), déjà écrites sur la face. */
  readonly statsBlock: HTMLElement | undefined;
}

/**
 * Étoile de la face (captures du 29/09/2026) : « Ajouter aux favoris » et contour seul, ou « Retirer des
 * favoris » et étoile remplie (`fill="currentColor"`). Libellé inattendu : compté en favori, par prudence.
 */
function readStarred(face: HTMLElement | undefined): boolean | undefined {
  const star = face && findStarButton(face);
  if (!star) return undefined;
  const fill = star.querySelector('path')?.getAttribute('fill');
  return star.getAttribute('aria-label') !== 'Ajouter aux favoris' || fill === 'currentColor';
}

/**
 * Bloc de la liste de souhaits (capture du 30/09/2026) : `div.space-y-2 > div.space-y-1.5 > (bouton, p d'aide)`.
 * Le bloc extérieur n'est pris que s'il ne contient rien d'autre (« Proposer un échange » y est peut-être).
 */
function readWishlistBlock(button: HTMLButtonElement | undefined): Pick<CardModal, 'wishlistBlock' | 'wishlistHint'> {
  const inner = button?.parentElement;
  if (!button || !inner) return { wishlistBlock: undefined, wishlistHint: undefined };
  const outer = inner.parentElement;
  const hint = [...inner.children].find((child) => child.tagName === 'P');
  return {
    wishlistBlock: outer && outer.childElementCount === 1 && outer.classList.contains('space-y-2') ? outer : inner,
    wishlistHint: hint ? textOf(hint) || undefined : undefined,
  };
}

export function findCardModals(doc: Document = document): CardModal[] {
  const modals: CardModal[] = [];
  for (const root of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    const heading = root.querySelector('h2');
    const tagInput = root.querySelector<HTMLInputElement>('input[placeholder^="Ajouter une étiquette"]');
    const buttons = siteButtons(root);
    const discardButton = buttons.find((button) => hasIcon(button, 'trash-2', 'trash2') || /^Défausser\b/.test(textOf(button)));
    const auctionButton = buttons.find((button) => hasIcon(button, 'gavel') || ['Mettre aux enchères', 'Vendre'].includes(textOf(button)));
    const wishlistButton = buttons.find((button) => hasIcon(button, 'bell') && /liste de souhaits/i.test(textOf(button)));
    const catalog = !tagInput && !discardButton && !auctionButton;
    // Une modale de carte a au moins l'un de ces contrôles (sinon : autre modale du site).
    if (!heading || (catalog && !wishlistButton)) continue;

    const face = [...root.querySelectorAll<HTMLElement>(FACE)].find((el) => el.querySelector('h3'));
    const tablist = root.querySelector<HTMLElement>('[role="tablist"][aria-label="Vue de la carte"]');
    const tabs = tablist ? [...tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')] : [];
    const reportButton = buttons.find((button) => hasIcon(button, 'flag') || /Signaler l.image|Image signalée/i.test(textOf(button)));
    modals.push({
      root,
      panel: root.querySelector<HTMLElement>(':scope > div.card-frame') ?? undefined,
      title: textOf(heading),
      catalog,
      closeButton: buttons.find((button) => button.getAttribute('aria-label') === 'Fermer'),
      face,
      imageArea: face && findFaceImage(face),
      tabsRow: tablist?.parentElement ?? undefined,
      detailsTab: tabs.find((tab) => textOf(tab) === 'Détails'),
      marketTab: tabs.find((tab) => textOf(tab).startsWith('Marché')),
      reportButton,
      reportBlock: reportButton?.closest<HTMLElement>('.border-t') ?? undefined,
      actionsRow: (discardButton ?? auctionButton)?.parentElement ?? undefined,
      auctionButton,
      discardButton,
      tagInput: tagInput ?? undefined,
      wishlistButton,
      ...readWishlistBlock(wishlistButton),
      wishlisted: wishlistButton !== undefined && /^Retirer/i.test(textOf(wishlistButton)),
      starred: readStarred(face),
      tagCount: buttons.filter((button) => /^Retirer l.étiquette/.test(button.getAttribute('aria-label') ?? '')).length,
      statsBlock: [...root.querySelectorAll('svg.lucide-swords')]
        .filter((svg) => !face?.contains(svg))
        .map((svg) => svg.closest<HTMLElement>('div.grid'))
        .find((grid) => grid?.querySelector('svg.lucide-shield')) ?? undefined,
    });
  }
  return modals;
}

/**
 * Carte affichée, lue dans l'état React de la modale (code du site du 30/09/2026) : son composant reçoit
 * `{ card, starred, count, onClose, userCardId, tags, … }`, `card` étant la carte (`id`, `wikipedia_title`,
 * `rarity`…), et rend lui-même le fond (`createPortal`). Lu au moment voulu (clic), pas à chaque passage de
 * `watchDom` : c'est un parcours de l'arbre de React.
 */
export function readModalCard(modal: CardModal): CardRef | undefined {
  const found = findPropsAbove(modal.root, (props) => typeof props.onClose === 'function' && parseCardRef(props.card) !== undefined);
  return found && parseCardRef(found.props.card);
}
