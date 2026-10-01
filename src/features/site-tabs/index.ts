import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { ACTIVE_SEGMENT_TAB, findSegmentTabBars, RESTYLED_SEGMENT_TABS as TABS } from '@/site/tabs';
import { tokens } from '@/ui/theme';

/*
 * Menus en segments à l'allure des onglets soulignés du site (voir site/tabs.ts) : cadre sans fond ni arrondi,
 * trait du bas ; onglets à sa hauteur (`py-3`), choisi en texte d'accent souligné de 2 px au lieu du fond plein.
 * Les autres gardent leurs classes, déjà celles des onglets soulignés.
 */
const CSS = `
.${TABS} { gap: 0; padding: 0; border-radius: 0; background: none; border-bottom: 1px solid ${tokens.border}; }
.${TABS} > button { padding-block: 0.75rem; border-radius: 0; }
.${TABS} > ${ACTIVE_SEGMENT_TAB} { background: none; color: ${tokens.accent}; border-bottom: 2px solid ${tokens.accent}; }
`;

export const siteTabs: Feature = {
  id: 'site-tabs',
  name: 'Onglets',
  description: "Tous les menus d'onglets du site ont la même allure que ceux du marché : onglet choisi souligné.",
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(ctx.signal);
    watchDom(() => marks.only(TABS, findSegmentTabBars()), { signal: ctx.signal });
  },
};
