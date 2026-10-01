import type { Feature } from '@/core/runtime';

/* Le contenu d'un bouton (icône, texte) hérite du curseur, sauf s'il en impose un : on l'impose aussi. */
const CSS = `
:is(:disabled, [aria-disabled="true"]), :is(:disabled, [aria-disabled="true"]) * { cursor: not-allowed !important; }
`;

export const disabledCursor: Feature = {
  id: 'disabled-cursor',
  name: 'Curseur « interdit »',
  description: 'Sur tout contrôle désactivé, du site ou du script, le curseur « interdit ».',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    if (await ctx.ready()) ctx.style(CSS);
  },
};
