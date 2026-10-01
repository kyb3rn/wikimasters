import { textOf } from '@/core/text';
import { siteButtons } from '@/site/dom';
import { SITE_OVERLAY } from '@/site/modals';

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

export function findDiscardConfirm(doc: Document = document): DiscardConfirm | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    // Rendue dans le fond de la modale de carte, qui contient aussi son propre « Défausser » : ne
    // regarder que ce qui appartient à ce fond-ci.
    const own = (element: Element) => element.closest(SITE_OVERLAY) === root;
    if (![...root.querySelectorAll('h3')].some((h3) => own(h3) && textOf(h3).startsWith('Défausser cette carte'))) continue;
    const buttons = siteButtons(root).filter(own);
    const cancelButton = buttons.find((button) => textOf(button) === 'Annuler');
    const confirmButton = buttons.find((button) => ['Défausser', '…'].includes(textOf(button)));
    if (cancelButton && confirmButton) return { root, cancelButton, confirmButton };
  }
  return undefined;
}
