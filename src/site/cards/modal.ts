import { findPropsAbove } from '@/core/react';
import { textOf } from '@/core/text';
import { hasIcon, siteButtons } from '@/site/dom';
import { SITE_OVERLAY } from '@/site/modals';
import { findStarButton, parseStarLabel, type StarState } from './dom';
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
 * Un seul composant pour trois cas (`CardModalKind`, code du site du 02/10/2026), selon ses props :
 * - un de mes exemplaires : ci-dessus ; rangée d'actions absente s'il est réservé dans un échange, ou en favori
 *   (depuis le 10/10/2026 : « Carte en favori : verrouillée… » à sa place, cadenas) ;
 * - vue catalogue (Toutes les cartes) : la carte seule, ni favori, ni étiquettes, ni rangée d'actions ; dans la
 *   colonne de droite, « Proposer un échange » si un ami a la carte, puis la liste de souhaits (cloche) ;
 * - exemplaire d'un ami (sa collection) : favori, ses étiquettes en lecture seule, « Proposer un échange » (en
 *   favori chez lui : « Carte verrouillée par <pseudo> » à sa place), ni liste de souhaits ni rangée d'actions.
 *
 * Les boutons d'action sont reconnus à leur icône lucide (le script peut en changer le texte).
 */
export type CardModalKind = 'own' | 'catalog' | 'friend';

export interface CardModal {
  readonly root: HTMLElement;
  /** Cadre de la modale (`div.card-frame`), dans le fond. */
  readonly panel: HTMLElement | undefined;
  readonly title: string;
  readonly kind: CardModalKind;
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
  /** Texte d'aide sous le bouton (« Recevez une alerte si cette carte est mise en vente. », à l'ajout seulement). */
  readonly wishlistHint: string | undefined;
  /** Carte dans la liste de souhaits : le bouton propose de l'en retirer. */
  readonly wishlisted: boolean;
  /** « Proposer un échange » (vue catalogue quand un ami a la carte, exemplaire d'un ami). */
  readonly tradeButton: HTMLButtonElement | undefined;
  /** « Échange en attente » à sa place : une offre est déjà en cours avec cet ami. */
  readonly tradePending: boolean;
  /** Ce qu'il faut masquer pour sortir l'échange et la liste de souhaits de la colonne de droite. */
  readonly sideActions: readonly HTMLElement[];
  /**
   * Encart du site sur un exemplaire en favori, verrouillé (`div[role=status]`, cadenas, code du 10/10/2026) : le mien,
   * « Carte en favori : verrouillée. Retirez-la des favoris… » à la place de la rangée d'actions ; celui d'un ami,
   * « Carte verrouillée par <pseudo> » à la place de « Proposer un échange ».
   */
  readonly favoriteLock: { readonly element: HTMLElement; readonly text: string } | undefined;
  /** Carte en favori (étoile de la face) ; `undefined` si l'étoile est introuvable. */
  readonly starred: boolean | undefined;
  /** Étiquettes de l'exemplaire associé (chacune a son bouton « Retirer l'étiquette … »). */
  readonly tagCount: number;
  /** Colonne de droite : les deux cases ATK (épées) et DEF (bouclier), déjà écrites sur la face. */
  readonly statsBlock: HTMLElement | undefined;
}

/** Étoile de la face : contour seul, ou remplie (`fill="currentColor"`) en favori ; libellés : `parseStarLabel`. */
function readStar(face: HTMLElement | undefined): StarState | undefined {
  const star = face && findStarButton(face);
  if (!star) return undefined;
  return parseStarLabel(star.getAttribute('aria-label') ?? '', star.querySelector('path')?.getAttribute('fill') === 'currentColor');
}

/**
 * Échange et liste de souhaits de la colonne de droite (code du 02/10/2026) : bloc `div.space-y-2` avec « Proposer un
 * échange », « Échange en attente » ou « Carte verrouillée par <pseudo> » (`div[role=status]`), puis
 * `div.space-y-1.5 > (liste de souhaits, p d'aide)`. Le bloc n'est masqué en entier que s'il ne contient rien d'autre ;
 * sinon, chacun. L'encart du favori (`favoriteLock`), masqué à part, compte seulement pour savoir si le bloc est vide.
 */
function readSideActions(
  trade: HTMLElement | undefined,
  pending: HTMLElement | undefined,
  lock: HTMLElement | undefined,
  wishlist: HTMLButtonElement | undefined,
): Pick<CardModal, 'sideActions' | 'wishlistHint'> {
  const wishBlock = wishlist?.parentElement ?? undefined;
  const items = [trade, pending, lock, wishBlock].filter((item): item is HTMLElement => item !== undefined);
  const outer = items[0]?.parentElement;
  const alone = outer?.classList.contains('space-y-2') && [...outer.children].every((child) => items.includes(child as HTMLElement));
  const hint = wishBlock && [...wishBlock.children].find((child) => child.tagName === 'P');
  return {
    sideActions: outer && alone ? [outer] : items.filter((item) => item !== lock),
    wishlistHint: hint ? textOf(hint) || undefined : undefined,
  };
}

export function findCardModals(doc: Document = document): CardModal[] {
  const modals: CardModal[] = [];
  for (const root of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    const heading = root.querySelector('h2');
    const tablist = root.querySelector<HTMLElement>('[role="tablist"][aria-label="Vue de la carte"]');
    const tagInput = root.querySelector<HTMLInputElement>('input[placeholder^="Ajouter une étiquette"]');
    // Ceux de la modale seulement : pas ceux d'une modale du site ouverte dans son fond (confirmation, échange).
    const buttons = siteButtons(root).filter((button) => button.closest(SITE_OVERLAY) === root);
    // « Supprimer » (corbeille aussi) de chaque ligne de « Gérer les étiquettes » : sans cette exclusion, la fenêtre
    // passait pour une modale de carte (bouton « Marché » posé dans sa première ligne, capture du 06/10/2026).
    const discardButton = buttons.find(
      (button) => (hasIcon(button, 'trash-2', 'trash2') && textOf(button) !== 'Supprimer') || /^Défausser\b/.test(textOf(button)),
    );
    const auctionButton = buttons.find((button) => hasIcon(button, 'gavel') || ['Mettre aux enchères', 'Vendre'].includes(textOf(button)));
    const wishlistButton = buttons.find((button) => hasIcon(button, 'bell') && /liste de souhaits/i.test(textOf(button)));
    // Ses onglets Détails / Marché, ou au moins l'un de ces contrôles (sinon : autre modale du site).
    if (!heading || !(tablist || tagInput || discardButton || auctionButton || wishlistButton)) continue;

    const face = [...root.querySelectorAll<HTMLElement>(FACE)].find((el) => el.querySelector('h3'));
    const star = readStar(face);
    const tradeButton = buttons.find((button) => hasIcon(button, 'handshake') || textOf(button) === 'Proposer un échange');
    const statuses = [...root.querySelectorAll<HTMLElement>('[role="status"]')].filter((status) => status.closest(SITE_OVERLAY) === root);
    const pending = statuses.find((status) => hasIcon(status, 'refresh-cw') || textOf(status) === 'Échange en attente');
    const lock = statuses.find((status) => hasIcon(status, 'lock'));
    // Vue catalogue : la carte seule, sans favori ; exemplaire d'un ami : son étoile, de quoi lui proposer un échange.
    const kind: CardModalKind =
      wishlistButton !== undefined || (face !== undefined && star === undefined)
        ? 'catalog'
        : star?.friend || tradeButton !== undefined || pending !== undefined
          ? 'friend'
          : 'own';
    const tabs = tablist ? [...tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')] : [];
    const reportButton = buttons.find((button) => hasIcon(button, 'flag') || /Signaler l.image|Image signalée/i.test(textOf(button)));
    modals.push({
      root,
      panel: root.querySelector<HTMLElement>(':scope > div.card-frame') ?? undefined,
      title: textOf(heading),
      kind,
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
      wishlisted: wishlistButton !== undefined && /^Retirer/i.test(textOf(wishlistButton)),
      tradeButton,
      tradePending: pending !== undefined,
      ...readSideActions(tradeButton, pending, lock, wishlistButton),
      favoriteLock: lock && { element: lock, text: textOf(lock) },
      starred: star?.starred,
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
  return readModalView(modal.root)?.card;
}

/**
 * D'où vient une modale de carte, d'après les props de son composant (code du site du 01/10/2026) : vue catalogue
 * de Toutes les cartes (`catalogView`), exemplaire d'un ami (`friendUsername`), sinon un de mes exemplaires. Parcours
 * de l'arbre de React ; `findCardModals` déduit le même cas de ce que la modale affiche.
 */
export interface CardModalView {
  readonly card: CardRef;
  readonly from: CardModalKind;
  /** Exemplaire montré (`userCardId`) : celui que défausse ou met en vente la modale ; aucun en vue catalogue. */
  readonly userCardId: string | undefined;
}

export function readModalView(root: HTMLElement): CardModalView | undefined {
  const found = findPropsAbove(root, (props) => typeof props.onClose === 'function' && parseCardRef(props.card) !== undefined);
  const card = found && parseCardRef(found.props.card);
  if (!found || !card) return undefined;
  const { catalogView, friendUsername, userCardId } = found.props;
  return {
    card,
    from: catalogView === true ? 'catalog' : typeof friendUsername === 'string' && friendUsername !== '' ? 'friend' : 'own',
    userCardId: typeof userCardId === 'string' && userCardId !== '' ? userCardId : undefined,
  };
}

/** Fond de chaque modale ouverte qui montre une carte en grand, et sa face (`FACE` avec son `h3`). */
export function findModalFaces(doc: Document = document): { readonly root: HTMLElement; readonly face: HTMLElement }[] {
  return [...doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)].flatMap((root) => {
    const face = [...root.querySelectorAll<HTMLElement>(FACE)].find((el) => el.querySelector('h3'));
    return face ? [{ root, face }] : [];
  });
}
