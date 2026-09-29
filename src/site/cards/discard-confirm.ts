import { siteButtons, text } from './dom';

/**
 * Confirmation « Défausser cette carte ? » que la modale de carte ouvre par-dessus elle (capture du
 * 29/09/2026) : div.fixed.inset-0.z-[70] > div.card-frame > h3, textes (« C'est votre dernière copie… »,
 * « Vous recevrez 1 wikibidou »), « Annuler » · « Défausser » (rouge). Le second lance
 * `POST /api/user-cards/<exemplaire>/discard` : pendant la requête, les deux boutons sont désactivés et
 * « Défausser » devient « … » (code du site). Une fois défaussée, le site ferme la confirmation et la
 * modale de carte ; sinon il y affiche l'erreur (`p.text-red-500`, « Erreur réseau » si pas de réponse).
 */
export interface DiscardConfirm {
  readonly root: HTMLElement;
  readonly cancelButton: HTMLButtonElement;
  readonly confirmButton: HTMLButtonElement;
}

const OVERLAY = 'div.fixed.inset-0';

export function findDiscardConfirm(doc: Document = document): DiscardConfirm | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>(OVERLAY)) {
    // Rendue dans le fond de la modale de carte, qui contient aussi son propre « Défausser » : ne
    // regarder que ce qui appartient à ce fond-ci.
    const own = (element: Element) => element.closest(OVERLAY) === root;
    if (![...root.querySelectorAll('h3')].some((h3) => own(h3) && text(h3).startsWith('Défausser cette carte'))) continue;
    const buttons = siteButtons(root).filter(own);
    const cancelButton = buttons.find((button) => text(button) === 'Annuler');
    const confirmButton = buttons.find((button) => ['Défausser', '…'].includes(text(button)));
    if (cancelButton && confirmButton) return { root, cancelButton, confirmButton };
  }
  return undefined;
}
