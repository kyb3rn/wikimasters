import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder } from '@/services/list-search';
import { RARITIES } from '@/site/rarity';
import { findTradeComposer, readTradeFilter, readTradeRarities, type TradeFilter } from '@/site/trades';
import { createSlot } from '@/ui/mount';
import { TradeFilters } from './TradeFilters';

const LINE = 'wm-trade-filter-line';
const FIELD = 'wm-trade-search-field';
const TAGS = 'wm-trade-tag-select';

/*
 * Rangée comme celle de la Collection : champ, cases de rareté, étiquette, liste de souhaits (les wikibidous ont
 * leur ligne au-dessus : trade-wikibidous). Les contrôles du site (groupe de droite) sont cachés : les nôtres
 * appellent les siens. Trop étroite, la rangée passe à la ligne.
 */
const CSS = `
.${LINE} { flex-direction: row; flex-wrap: wrap; align-items: stretch; }
.${LINE} > .${FIELD} { order: 0; flex: 1 1 15rem; width: auto; min-width: 12rem; }
.${TAGS} { flex: 0 1 11rem; min-width: 9rem; }
`;

const freshTab = () => findTradeComposer()?.tab;

/** Filtre du site tel qu'il est maintenant (ses props changent à chaque rendu). */
function withFilter(action: (filter: TradeFilter) => void): void {
  const button = freshTab()?.filterButton;
  const filter = button && readTradeFilter(button);
  if (filter) action(filter);
}

/**
 * Filtres de la fenêtre d'échange (les deux onglets) présentés comme ceux de la Collection : cases de rareté,
 * liste des étiquettes du site, liste de souhaits en bouton carré, même texte d'aide.
 */
export const tradeFilters: Feature = {
  id: 'trade-filters',
  name: 'Ligne des filtres',
  description: "Les filtres de la fenêtre d'échange sont présentés comme ceux de la Collection.",
  category: 'Échanges',
  // La fenêtre s'ouvre aussi depuis les amis et le catalogue.
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const slot = createSlot(signal);
    const marks = classMarks(signal);

    watchDom(
      () => {
        const tab = freshTab();
        marks.only(LINE, tab ? [tab.line] : []);
        marks.only(FIELD, tab ? [tab.search] : []);
        if (!tab) {
          slot.clear();
          return;
        }
        ctx.hide(tab.group);
        applySearchPlaceholder(tab.search, signal);
        const rarities = tab.rarityButton && readTradeRarities(tab.rarityButton);
        const vnode = h(TradeFilters, {
          rarities: rarities && new Set(RARITIES.filter((rarity) => rarities.checked.has(rarity))),
          onRarities: (next) => {
            const button = freshTab()?.rarityButton;
            if (button) readTradeRarities(button)?.choose(next);
          },
          filter: tab.filterButton && readTradeFilter(tab.filterButton),
          onTag: (id) => withFilter((filter) => filter.selectTag(id)),
          onWishlist: () => withFilter((filter) => filter.toggleWishlist(!filter.wishlistActive)),
          tagsClass: TAGS,
        });
        slot.render(vnode, { parent: tab.line, before: tab.group, inline: true });
      },
      { signal },
    );
  },
};
