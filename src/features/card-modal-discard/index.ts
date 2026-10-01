import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { quickDiscardProtection } from '@/services/quick-discard';
import { autoConfirm, confirmStep } from '@/services/site-confirm';
import { readDiscard } from '@/site/api';
import { findCardModals, findDiscardConfirm } from '@/site/cards';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';

const CONFIRMING = 'wm-discard-confirming';
const CONFIRM_WAIT = 'wm-discard-confirm-wait';
const ASKING_LABEL = 'Confirmer ?';

// Classe répétée : doit l'emporter sur le rouge en contour du bouton (site-buttons), survol compris. « Confirmer ? » : rouge plein.
const STRONG = `.${CONFIRMING}.${CONFIRMING}.${CONFIRMING}.${CONFIRMING}`;

const CSS = `
/* Carte protégée, après un premier clic : le bouton devient « Confirmer ? » (son contenu est masqué, pas modifié). */
${STRONG} { font-size: 0 !important; background: var(--wm-fill, ${tokens.danger}) !important; border-color: transparent !important;
  color: var(--wm-on, #fff) !important; }
${STRONG} > * { display: none !important; }
${STRONG}::after { content: '${ASKING_LABEL}'; font-size: 0.875rem; font-weight: 600; }
${STRONG}.${CONFIRM_WAIT} { opacity: 0.55 !important; cursor: not-allowed !important; }
`;

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
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    const step = confirmStep<HTMLButtonElement>({ onChange: () => sync(), signal });
    const confirm = autoConfirm({
      find: findDiscardConfirm,
      request: (request) => readDiscard(request) !== undefined,
      onRefused: (message, status) => {
        log.warn('défausse refusée', status ?? 'sans réponse', message);
        toast.error(message, { title: 'Défausse impossible' });
      },
      onChange: () => sync(),
      signal,
    });

    window.addEventListener(
      'click',
      (event) => {
        if (!event.isTrusted || !(event.target instanceof Node) || confirm.confirmed) return;
        const target = event.target;
        const modal = findCardModals().find((candidate) => candidate.discardButton?.contains(target));
        const button = modal?.discardButton;
        if (!modal || !button || button.disabled) return;
        // Étoile illisible : on la suppose en favori.
        const reason = quickDiscardProtection({ starred: modal.starred !== false, tagged: modal.tagCount > 0 });
        const first = step.stage(button) === 'idle';
        if (reason && !step.press(button)) {
          // Premier clic (ou clic trop rapproché) : le site n'en voit rien.
          event.preventDefault();
          event.stopImmediatePropagation();
          if (first) log.debug('carte protégée, second clic attendu', reason);
          return;
        }
        confirm.arm(button);
        sync();
      },
      { capture: true, signal },
    );

    function sync(): void {
      confirm.sync();
      for (const modal of findCardModals()) {
        const button = modal.discardButton;
        if (!button) continue;
        const stage = step.stage(button);
        marks.set(button, CONFIRMING, stage !== 'idle');
        marks.set(button, CONFIRM_WAIT, stage === 'waiting');
        nameAsking(button, stage !== 'idle');
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
      document.querySelectorAll<HTMLButtonElement>('[data-wm-asking-label]').forEach((button) => nameAsking(button, false));
    });
  },
};
