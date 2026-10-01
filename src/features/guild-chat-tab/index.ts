import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findGuildChatTab, findGuildHeader } from '@/site/guild';
import { GUILD_ROUTE } from '@/site/routes';

/**
 * /guild : onglet « Chat » caché (demande de l'utilisateur : le chat de la guilde est dans /dms, guild-chat). Ouvert
 * quand même (adresse `?tab=chat`), la page revient à l'Accueil.
 */
export const guildChatTab: Feature = {
  id: 'guild-chat-tab',
  name: 'Chat de guilde',
  description: "L'onglet Chat de la guilde est retiré : le chat est dans les messages.",
  category: 'Messages',
  routes: [GUILD_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    let hidden: HTMLElement | undefined;
    watchDom(
      () => {
        const header = findGuildHeader();
        const chat = header && findGuildChatTab(header);
        if (hidden && hidden !== chat?.tab) ctx.hide(hidden, false);
        hidden = chat?.tab;
        if (!chat) return;
        ctx.hide(chat.tab);
        if (chat.active) chat.home?.click();
      },
      { signal: ctx.signal },
    );
  },
};
