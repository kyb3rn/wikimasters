import { h } from 'preact';
import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { NETWORK_ERROR } from '@/site/api';
import { findGuildCreationForm, findNoGuildCard, isGuildCreation, type GuildCreationForm } from '@/site/guild';
import { GUILD_ROUTE } from '@/site/routes';
import { mirrorSiteDialog } from '@/services/site-dialog';
import { CreateGuildModal } from './CreateGuildModal';

const CARD_COPY = 'wm-guild-card-copy';

export const guildCreateModal: Feature = {
  id: 'guild-create-modal',
  name: 'Créer une guilde',
  description: "Le formulaire de création d'une guilde s'ouvre dans une fenêtre, par-dessus la page.",
  category: 'Guilde',
  routes: [GUILD_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    /** Erreur sans message du site (requête sans réponse), effacée au prochain envoi. */
    let networkError: string | undefined;
    /**
     * Copie inerte de la carte « Vous n'êtes dans aucune guilde », tenue à jour tant qu'elle est affichée : React
     * la retire quand le formulaire s'ouvre, la copie reste derrière la fenêtre.
     */
    let cardCopy: HTMLElement | undefined;
    ctx.onDispose(() => cardCopy?.remove());

    watchDom(
      () => {
        const card = findNoGuildCard();
        if (card && cardCopy?.innerHTML !== card.root.innerHTML) {
          cardCopy?.remove();
          cardCopy = card.root.cloneNode(true) as HTMLElement;
          cardCopy.classList.add(CARD_COPY);
          cardCopy.classList.remove('animate-fade-in-up');
          cardCopy.inert = true;
          cardCopy.setAttribute('aria-hidden', 'true');
        }
        const form = findGuildCreationForm();
        if (card || !form) cardCopy?.remove();
        else if (cardCopy && cardCopy.previousElementSibling !== form.root) form.root.after(cardCopy);
      },
      { signal },
    );

    // Le formulaire du site reste le moteur (caché) : nos champs écrivent dans les siens, notre bouton clique le
    // sien. Requête, erreur, fermeture et chargement de la guilde restent ceux du site.
    const view = (form: GuildCreationForm) =>
      h(CreateGuildModal, {
        initialName: form.nameInput.value,
        initialDescription: form.descriptionInput.value,
        nameMax: form.nameInput.maxLength > 0 ? form.nameInput.maxLength : 30,
        descriptionMax: form.descriptionInput.maxLength > 0 ? form.descriptionInput.maxLength : 200,
        error: form.error ?? networkError,
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
          networkError = undefined;
          if (current && !current.submitButton.disabled) current.submitButton.click();
        },
        onClose: () => findGuildCreationForm()?.cancelButton.click(),
      });

    const dialog = mirrorSiteDialog(ctx, {
      find: findGuildCreationForm,
      render: view,
      onClose: () => {
        networkError = undefined;
      },
    });

    net.track(
      (request) => isGuildCreation(request) && !request.own,
      () => (status) => {
        if (status !== undefined || !findGuildCreationForm()) return;
        networkError = NETWORK_ERROR;
        dialog.refresh();
      },
      { signal },
    );
  },
};
