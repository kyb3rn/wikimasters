import { textOf } from '@/core/text';
import { hasIcon, siteButtons } from '@/site/dom';

/**
 * Demande d'ami, juste sous l'en-tête du profil d'un joueur qui n'est pas un ami (captures et code du 01/10/2026) :
 *
 *   div.animate-fade-in-up › button.w-full « + Envoyer une demande d'ami »   « Envoi... » et désactivé pendant
 *                                                                           `POST /api/friends` `{ addressee_id }`
 *   div.animate-fade-in-up › div.card-frame.p-4.flex.items-center.justify-between
 *     p « Demande d'ami envoyée »
 *     ou p « <pseudo> vous a envoyé une demande d'ami », div.flex.gap-2 › Accepter (lucide `check`), Refuser (`x`) :
 *       `PATCH /api/friends/<id>` `{ action }`, jamais désactivés ; le site change d'état même si la requête échoue.
 */
export type ProfileFriendRequest = { readonly root: HTMLElement } & (
  | { readonly kind: 'send'; readonly button: HTMLButtonElement; readonly label: string }
  | { readonly kind: 'sent'; readonly text: string }
  | {
      readonly kind: 'received';
      readonly text: string;
      readonly accept: HTMLButtonElement;
      readonly decline: HTMLButtonElement;
    }
);

/** Demande d'ami qui suit l'en-tête `header` du site ; `undefined` s'il est suivi d'autre chose (onglets d'un ami…). */
export function findProfileFriendRequest(header: Element): ProfileFriendRequest | undefined {
  const root = header.nextElementSibling;
  const child = root?.firstElementChild;
  if (!(root instanceof HTMLElement) || root.children.length !== 1 || !child) return undefined;
  if (child instanceof HTMLButtonElement) {
    const text = textOf(child).replace(/^\+\s*/, '');
    // Pendant l'envoi, le bouton ne dit plus que « Envoi... ».
    return { root, kind: 'send', button: child, label: /^Envoi\b/.test(text) ? "Envoyer une demande d'ami" : text };
  }
  const message = child.firstElementChild;
  if (!child.classList.contains('card-frame') || message?.tagName !== 'P') return undefined;
  const buttons = siteButtons(child);
  const accept = buttons.find((button) => hasIcon(button, 'check'));
  const decline = buttons.find((button) => hasIcon(button, 'x'));
  if (accept && decline) return { root, kind: 'received', text: textOf(message), accept, decline };
  return buttons.length === 0 ? { root, kind: 'sent', text: textOf(message) } : undefined;
}
