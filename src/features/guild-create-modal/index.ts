import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { net } from '@/core/net';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { findGuildCreationForm, findNoGuildCard, GUILD_ROUTE, isGuildCreation, type GuildCreationForm } from '@/site/guild';
import { mountUi, type MountedUi } from '@/ui/mount';
import { CreateGuildModal } from './CreateGuildModal';

const HIDDEN = 'wm-guild-form-hidden';
const CARD_COPY = 'wm-guild-card-copy';

const CSS = `.${HIDDEN} { display: none !important; }`;

const NETWORK_ERROR = 'Le site n’a pas répondu. Réessayez.';

interface Open {
  readonly form: HTMLElement;
  readonly controller: AbortController;
  readonly ui: MountedUi;
  /** Erreur sans message du site (requête sans réponse), effacée au prochain envoi. */
  networkError?: string;
}

export const guildCreateModal: Feature = {
  id: 'guild-create-modal',
  name: 'Créer une guilde',
  description: 'Le formulaire de création d’une guilde s’ouvre dans une fenêtre, par-dessus la page.',
  category: 'Guilde',
  routes: [GUILD_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('guild-create-modal', CSS);
    let open: Open | undefined;
    /**
     * Copie inerte de la carte « Vous n'êtes dans aucune guilde », tenue à jour tant qu'elle est affichée : React
     * la retire quand le formulaire s'ouvre, la copie reste derrière la fenêtre.
     */
    let cardCopy: HTMLElement | undefined;

    // Le formulaire du site reste le moteur (caché) : nos champs écrivent dans les siens, notre bouton clique le
    // sien. Requête, erreur, fermeture et chargement de la guilde restent ceux du site.
    function view(form: GuildCreationForm, state: Open | undefined) {
      return h(CreateGuildModal, {
        initialName: form.nameInput.value,
        initialDescription: form.descriptionInput.value,
        nameMax: form.nameInput.maxLength > 0 ? form.nameInput.maxLength : 30,
        descriptionMax: form.descriptionInput.maxLength > 0 ? form.descriptionInput.maxLength : 200,
        error: form.error ?? state?.networkError,
        sending: form.sending,
        onName: (value) => {
          const current = findGuildCreationForm();
          if (current) setReactInputValue(current.nameInput, value);
        },
        onDescription: (value) => {
          const current = findGuildCreationForm();
          if (current) setReactInputValue(current.descriptionInput, value);
        },
        onSubmit: () => {
          const current = findGuildCreationForm();
          if (open) open.networkError = undefined;
          if (current && !current.submitButton.disabled) current.submitButton.click();
        },
        onClose: () => findGuildCreationForm()?.cancelButton.click(),
      });
    }

    net.track(
      (request) => isGuildCreation(request) && !request.own,
      () => (status) => {
        if (status !== undefined || !open) return;
        open.networkError = NETWORK_ERROR;
        const form = findGuildCreationForm();
        if (form) open.ui.update(view(form, open));
      },
      { signal },
    );

    function close(): void {
      open?.controller.abort();
      open = undefined;
      cardCopy?.remove();
    }

    watchDom(
      () => {
        const card = findNoGuildCard();
        if (card) {
          if (cardCopy?.innerHTML !== card.root.innerHTML) {
            cardCopy?.remove();
            cardCopy = card.root.cloneNode(true) as HTMLElement;
            cardCopy.classList.add(CARD_COPY);
            cardCopy.classList.remove('animate-fade-in-up');
            cardCopy.inert = true;
            cardCopy.setAttribute('aria-hidden', 'true');
          }
          cardCopy.remove();
        }

        const form = findGuildCreationForm();
        if (open && open.form !== form?.root) close();
        if (!form) return;
        setClass(form.root, HIDDEN, true);
        if (cardCopy && cardCopy.previousElementSibling !== form.root) form.root.after(cardCopy);
        if (!open) {
          const controller = childController(signal);
          open = { form: form.root, controller, ui: mountUi(view(form, undefined), { signal: controller.signal }) };
        } else {
          open.ui.update(view(form, open));
        }
      },
      { signal },
    );
    ctx.onDispose(() => {
      cardCopy?.remove();
      document.querySelectorAll(`.${HIDDEN}`).forEach((element) => element.classList.remove(HIDDEN));
    });
  },
};
