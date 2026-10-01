import type { Feature } from '@/core/runtime';
import { findGuildHeader, GUILD_GRADIENT_LAYER } from '@/site/guild';
import { GUILD_ROUTE } from '@/site/routes';
import { placeTabLineButton } from '@/services/tab-line';

/**
 * /guild : « Inviter » au bout de la rangée des onglets (celui de l'en-tête caché, avec le nombre de membres, et
 * cliqué par le nôtre) ; fond des cadres de l'Accueil uni.
 */
export const guildLayout: Feature = {
  id: 'guild-layout',
  name: 'Page de guilde',
  description: '« Inviter » sur la ligne des onglets, fonds unis.',
  category: 'Guilde',
  routes: [GUILD_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(`${GUILD_GRADIENT_LAYER} { display: none; }`);
    placeTabLineButton(ctx, {
      find: () => {
        const header = findGuildHeader();
        return header && { tabBar: header.tabBar, source: header.invite, hidden: header.actions };
      },
      label: 'Inviter',
      size: 'lg',
      className: 'wm-guild-invite',
      scrolling: true,
    });
  },
};
