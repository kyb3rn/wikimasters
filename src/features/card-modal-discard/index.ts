import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { quickDiscardProtection } from '@/services/quick-discard';
import { findCardModals, findDiscardConfirm, readDiscard } from '@/site/cards';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';

const CONFIRM_HIDDEN = 'wm-discard-confirm-hidden';
const CONFIRMING = 'wm-discard-confirming';
const CONFIRM_WAIT = 'wm-discard-confirm-wait';
/** Au-delà, une confirmation du site qui s'ouvre n'est plus la suite du clic sur « Défausser ». */
const ARM_WINDOW_MS = 2000;
/** Carte protégée : le second clic n'est pris qu'après ce délai (un double-clic ne défausse pas). */
const CONFIRM_DELAY_MS = 750;
/** Carte protégée : puis « Confirmer ? » reste actif ce temps-là. */
const CONFIRM_ACTIVE_MS = 3500;
const CONFIRM_WINDOW_MS = CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS;
const ASKING_LABEL = 'Confirmer ?';

// Classe répétée : doit l'emporter sur le rouge du bouton (`wm-danger`, card-modal), survol compris.
const STRONG = `.${CONFIRMING}.${CONFIRMING}.${CONFIRMING}.${CONFIRMING}`;

const CSS = `
.${CONFIRM_HIDDEN} { visibility: hidden !important; }

/* Carte protégée, après un premier clic : le bouton devient « Confirmer ? » (son contenu est masqué, pas modifié). */
${STRONG} { font-size: 0 !important; background: ${tokens.danger} !important; border-color: ${tokens.danger} !important;
  color: #fff !important; }
${STRONG} > * { display: none !important; }
${STRONG}::after { content: '${ASKING_LABEL}'; font-size: 0.875rem; font-weight: 600; }
${STRONG}.${CONFIRM_WAIT} { opacity: 0.55 !important; cursor: not-allowed !important; }
`;

interface Pending {
  readonly at: number;
  readonly button: HTMLButtonElement;
  /** Confirmation du site acceptée : la défausse est partie. */
  confirmed: boolean;
}

interface Confirming {
  readonly button: HTMLButtonElement;
  readonly since: number;
}

/**
 * Le site garde la main : le clic de l'utilisateur sur « Défausser » ouvre sa confirmation, qu'on cache
 * et accepte aussitôt. Défausse, fermeture de la modale et mise à jour du solde restent les siennes.
 * Carte protégée (favori, étiquette selon les réglages) : un premier clic passe le bouton en
 * « Confirmer ? », seul un second clic défausse.
 */
export const cardModalDiscard: Feature = {
  id: 'card-modal-discard',
  name: 'Défaussage rapide',
  toggleLabel: 'Utiliser le défaussage rapide',
  description: 'Le bouton Défausser défausse sans ouvrir de confirmation. Une carte protégée demande un second clic.',
  category: 'Modale de carte',
  routes: 'all',
  async mount(ctx) {
    const { signal, log } = ctx;
    let pending: Pending | undefined;
    let confirming: Confirming | undefined;
    /**
     * Défausse refusée ou sans réponse : sa confirmation (cachée) est à fermer. Le site ne réactive ses
     * boutons qu'après avoir lu la réponse : « Annuler » attend d'être de nouveau cliquable.
     */
    let dismissing = false;

    function refused(message: string): void {
      pending = undefined;
      dismissing = true;
      toast.error(message, { title: 'Défausse impossible' });
      sync();
    }
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const syncIn = (ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        sync();
      }, ms);
      timers.add(timer);
    };

    net.observe(
      (request) => readDiscard(request) !== undefined && !request.own,
      async (exchange) => {
        if (!pending?.confirmed) return;
        if (exchange.ok) {
          pending = undefined;
          sync();
          return;
        }
        const body = await exchange.json().catch(() => undefined);
        const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur ${exchange.status} du site.`;
        log.warn('défausse refusée', exchange.status, message);
        refused(message);
      },
      { signal },
    );
    // Pas de réponse du tout : les observateurs n'en voient rien.
    net.track(
      (request) => readDiscard(request) !== undefined && !request.own,
      () => (status) => {
        if (status !== undefined || !pending?.confirmed) return;
        log.warn('défausse sans réponse du site');
        refused("Le site n'a pas répondu (erreur réseau).");
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('card-modal-discard', CSS);

    window.addEventListener(
      'click',
      (event) => {
        if (!event.isTrusted || !(event.target instanceof Node) || pending?.confirmed) return;
        const target = event.target;
        const modal = findCardModals().find((candidate) => candidate.discardButton?.contains(target));
        const button = modal?.discardButton;
        if (!modal || !button || button.disabled) return;
        // Étoile illisible : on la suppose en favori.
        const reason = quickDiscardProtection({ starred: modal.starred !== false, tagged: modal.tagCount > 0 });
        if (reason) {
          const now = Date.now();
          const confirmed = confirming?.button === button && now - confirming.since >= CONFIRM_DELAY_MS;
          if (!confirmed) {
            // Premier clic (ou clic trop rapproché) : le site n'en voit rien.
            event.preventDefault();
            event.stopImmediatePropagation();
            if (confirming?.button !== button) {
              log.debug('carte protégée, second clic attendu', reason);
              confirming = { button, since: now };
              syncIn(CONFIRM_DELAY_MS + 20);
              syncIn(CONFIRM_WINDOW_MS + 20);
              sync();
            }
            return;
          }
        }
        confirming = undefined;
        pending = { at: Date.now(), button, confirmed: false };
        sync();
      },
      { capture: true, signal },
    );

    function sync(): void {
      const now = Date.now();
      if (confirming && (now - confirming.since >= CONFIRM_WINDOW_MS || !confirming.button.isConnected)) confirming = undefined;
      const confirm = findDiscardConfirm();
      if (pending && !pending.confirmed && (now - pending.at > ARM_WINDOW_MS || !pending.button.isConnected)) {
        pending = undefined;
      }
      if (confirm && pending && !pending.confirmed) {
        pending.confirmed = true;
        confirm.confirmButton.click();
      }
      // Confirmation refermée (défausse faite, ou annulée par le site) : plus rien en attente.
      if (!confirm && pending?.confirmed) pending = undefined;
      if (!confirm) dismissing = false;
      if (confirm && dismissing && !confirm.cancelButton.disabled) {
        dismissing = false;
        confirm.cancelButton.click();
      }
      if (confirm) setClass(confirm.root, CONFIRM_HIDDEN, pending?.confirmed === true || dismissing);
      for (const modal of findCardModals()) {
        const button = modal.discardButton;
        if (!button) continue;
        const asking = confirming?.button === button;
        setClass(button, CONFIRMING, asking);
        setClass(button, CONFIRM_WAIT, asking && now - (confirming?.since ?? 0) < CONFIRM_DELAY_MS);
        nameAsking(button, asking);
      }
    }

    /** Le texte « Défausser » n'est que masqué : le nom lu par les lecteurs d'écran doit suivre. */
    function nameAsking(button: HTMLButtonElement, asking: boolean): void {
      if (asking && button.getAttribute('aria-label') !== ASKING_LABEL) {
        button.setAttribute('aria-label', ASKING_LABEL);
        button.dataset.wmAskingLabel = '';
      } else if (!asking && button.dataset.wmAskingLabel !== undefined) {
        button.removeAttribute('aria-label');
        delete button.dataset.wmAskingLabel;
      }
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      for (const timer of timers) clearTimeout(timer);
      document.querySelectorAll<HTMLButtonElement>('[data-wm-asking-label]').forEach((button) => nameAsking(button, false));
      document
        .querySelectorAll(`.${CONFIRM_HIDDEN}, .${CONFIRMING}`)
        .forEach((el) => el.classList.remove(CONFIRM_HIDDEN, CONFIRMING, CONFIRM_WAIT));
    });
  },
};
