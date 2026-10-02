import { h } from 'preact';
import { childController } from '@/core/async';
import type { Feature } from '@/core/runtime';
import { createGuild, siteErrorText } from '@/site/api';
import { findNoGuildCard, reloadSiteGuild } from '@/site/guild';
import { GUILD_ROUTE } from '@/site/routes';
import { mountUi } from '@/ui/mount';
import { CreateGuildModal } from './CreateGuildModal';

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
    /** Saisie gardée d'une ouverture à l'autre (comme le site après « Annuler »), effacée après une création. */
    let draft = { name: '', description: '' };
    let modal: AbortController | undefined;

    async function create(name: string, description: string, close: () => void): Promise<string | undefined> {
      try {
        await createGuild(name, description);
      } catch (error) {
        return siteErrorText(error);
      }
      draft = { name: '', description: '' };
      close();
      if (signal.aborted) return undefined;
      // Comme le site après une création : son chargeur relit la guilde, qui remplace la carte dans la page.
      const card = findNoGuildCard();
      if (card && reloadSiteGuild(card.root)) return undefined;
      ctx.log.warn('chargeur de la guilde introuvable : rechargement de la page');
      location.reload();
      return undefined;
    }

    function open(): void {
      if (modal && !modal.signal.aborted) return;
      const controller = childController(signal);
      modal = controller;
      const close = () => controller.abort();
      const view = h(CreateGuildModal, {
        initialName: draft.name,
        initialDescription: draft.description,
        onDraft: (name, description) => {
          draft = { name, description };
        },
        onSubmit: (name, description) => create(name, description, close),
        onClose: close,
      });
      mountUi(view, { signal: controller.signal });
    }

    // Avant React (écouteur de la racine) : le site n'ouvre pas son formulaire, qui remplacerait la carte dans la page.
    window.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Node ? event.target : null;
        if (!target || !findNoGuildCard()?.createButton.contains(target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        open();
      },
      { capture: true, signal },
    );
  },
};
