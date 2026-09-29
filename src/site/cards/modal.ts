import { findStarButton, siteButtons, text } from './dom';

/**
 * Modale de carte du site (ouverte au clic sur une carte : paquet, collection…), rendue en portail
 * dans `body`. Relevé le 29/09/2026 :
 *
 *   div.fixed.inset-0.z-50 … bg-black/70 (fond)
 *     div.card-frame (panneau)
 *       button[aria-label=Fermer]
 *       div.flex.flex-col.md:flex-row
 *         colonne gauche : face `[class*="glow-"]` (image en haut : `div.absolute.top-0 … h-[45%]`,
 *                          « Ajouter aux favoris » en haut à droite)
 *         colonne droite : en-tête (h2 titre + ligne « rareté en toutes lettres · onglets Détails / Marché »),
 *                          description, « Étiquettes » (champ « Ajouter une étiquette… »), ATK/DEF, infos,
 *                          lien Wikipédia, bloc « Signaler l'image » (drapeau)
 *       div.mt-3 > div.flex (rangée d'actions) : « Mettre aux enchères » (marteau), « Défausser » (corbeille, « +1 »)
 *
 * Les boutons d'action sont reconnus à leur icône lucide (le script peut en changer le texte).
 */
export interface CardModal {
  readonly root: HTMLElement;
  readonly title: string;
  /** Croix « Fermer » en haut à droite. */
  readonly closeButton: HTMLButtonElement | undefined;
  /** Face de la carte (`[class*="glow-"]` avec son `h3`). */
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

/** Une modale du site est-elle ouverte (carte, mise aux enchères, confirmation…) ? Toutes sont `div.fixed.inset-0`. */
export function isSiteModalOpen(doc: Document = document): boolean {
  return doc.querySelector('div.fixed.inset-0') !== null;
}

export function findCardModals(doc: Document = document): CardModal[] {
  const modals: CardModal[] = [];
  for (const root of doc.querySelectorAll<HTMLElement>('div.fixed.inset-0')) {
    const heading = root.querySelector('h2');
    const tagInput = root.querySelector<HTMLInputElement>('input[placeholder^="Ajouter une étiquette"]');
    const buttons = siteButtons(root);
    const discardButton = buttons.find(
      (button) => button.querySelector('svg.lucide-trash-2, svg.lucide-trash2') || /^Défausser\b/.test(text(button)),
    );
    const auctionButton = buttons.find(
      (button) => button.querySelector('svg.lucide-gavel') || ['Mettre aux enchères', 'Vendre'].includes(text(button)),
    );
    // Une modale de carte a au moins l'un de ces contrôles (sinon : autre modale du site).
    if (!heading || (!tagInput && !discardButton && !auctionButton)) continue;

    const face = [...root.querySelectorAll<HTMLElement>('[class*="glow-"]')].find((el) => el.querySelector('h3'));
    const tablist = root.querySelector<HTMLElement>('[role="tablist"][aria-label="Vue de la carte"]');
    const tabs = tablist ? [...tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')] : [];
    const reportButton = buttons.find(
      (button) => button.querySelector('svg.lucide-flag') || /Signaler l.image|Image signalée/i.test(text(button)),
    );
    modals.push({
      root,
      title: text(heading),
      closeButton: buttons.find((button) => button.getAttribute('aria-label') === 'Fermer'),
      face,
      imageArea: face?.querySelector<HTMLElement>(':scope > div[class*="h-[45%]"]') ?? undefined,
      tabsRow: tablist?.parentElement ?? undefined,
      detailsTab: tabs.find((tab) => text(tab) === 'Détails'),
      marketTab: tabs.find((tab) => text(tab).startsWith('Marché')),
      reportButton,
      reportBlock: reportButton?.closest<HTMLElement>('.border-t') ?? undefined,
      actionsRow: (discardButton ?? auctionButton)?.parentElement ?? undefined,
      auctionButton,
      discardButton,
      tagInput: tagInput ?? undefined,
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
