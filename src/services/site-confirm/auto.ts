import { later } from '@/core/async';
import { classMarks, injectStyle } from '@/core/dom';
import type { NetRequest } from '@/core/net';
import { watchSiteRefusal } from '@/site/api';

/** Confirmation du site (« Défausser cette carte ? », « Défausser n cartes ? ») : son fond et ses deux boutons. */
export interface SiteConfirm {
  readonly root: HTMLElement;
  readonly cancelButton: HTMLButtonElement;
  readonly confirmButton: HTMLButtonElement;
}

export interface AutoConfirmOptions {
  /** La confirmation du site affichée, s'il y en a une. */
  readonly find: () => SiteConfirm | undefined;
  /** La requête que la confirmation envoie (du site). */
  readonly request: (request: NetRequest) => boolean;
  /** Refus du site (`status`) ou pas de réponse (`status` absent), message à montrer : sa confirmation, cachée, est refermée. */
  readonly onRefused: (message: string, status: number | undefined) => void;
  /** L'état a changé (attente expirée, refus) : la fonctionnalité resynchronise la page. */
  readonly onChange: () => void;
  readonly signal: AbortSignal;
}

export interface AutoConfirm {
  /**
   * Le clic qui ouvre la confirmation du site part : elle sera acceptée si elle s'ouvre dans les 2 s, tant que
   * `button` (le bouton cliqué) est encore dans la page.
   */
  arm(button?: Element): void;
  /** Confirmation acceptée, en attente de sa fermeture par le site : l'action est en cours. */
  readonly confirmed: boolean;
  /** Armée ou acceptée. */
  readonly pending: boolean;
  /** À chaque passage de watchDom : accepte la confirmation armée, la cache, referme celle d'une action refusée. */
  sync(): void;
}

/** Au-delà, une confirmation du site qui s'ouvre n'est plus la suite du clic. */
const ARM_WINDOW_MS = 2000;
const HIDDEN = 'wm-site-confirm-hidden';

/**
 * Confirmation du site acceptée à la place de l'utilisateur, qui a déjà dit oui (défaussage rapide, « Confirmer ? ») :
 * cachée (elle reste dans la page, que le site la ferme lui-même), son bouton cliqué. L'action, sa fermeture et ses
 * suites restent celles du site ; refusée ou sans réponse, la confirmation est refermée par son « Annuler », dès que le
 * site le réactive (il ne le fait qu'après avoir lu la réponse).
 */
export function autoConfirm({ find, request, onRefused, onChange, signal }: AutoConfirmOptions): AutoConfirm {
  let pending: { readonly at: number; readonly button: Element | undefined; confirmed: boolean } | undefined;
  /** Action refusée : sa confirmation, cachée, est à refermer. */
  let dismissing = false;
  const marks = classMarks(signal);
  injectStyle('site-confirm', `.${HIDDEN} { visibility: hidden !important; }`);

  watchSiteRefusal(
    (sent) => request(sent) && !sent.own,
    (message, status) => {
      if (!pending?.confirmed) return;
      pending = undefined;
      dismissing = true;
      onRefused(message, status);
      onChange();
    },
    { signal },
  );

  return {
    arm(button) {
      pending = { at: Date.now(), button, confirmed: false };
      later(onChange, ARM_WINDOW_MS + 20, signal);
    },
    get confirmed() {
      return pending?.confirmed === true;
    },
    get pending() {
      return pending !== undefined;
    },
    sync() {
      if (pending && !pending.confirmed && (Date.now() - pending.at > ARM_WINDOW_MS || pending.button?.isConnected === false)) {
        pending = undefined;
      }
      const confirm = find();
      if (!confirm) {
        // Refermée : action faite, ou annulée.
        if (pending?.confirmed) pending = undefined;
        dismissing = false;
        return;
      }
      if (pending && !pending.confirmed) {
        pending.confirmed = true;
        confirm.confirmButton.click();
      }
      if (dismissing && !confirm.cancelButton.disabled) {
        dismissing = false;
        confirm.cancelButton.click();
      }
      marks.set(confirm.root, HIDDEN, pending?.confirmed === true || dismissing);
    },
  };
}
