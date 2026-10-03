import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder } from '@/services/list-search';
import { RARITIES } from '@/site/rarity';
import {
  findTradeComposer,
  isTradeMineStats,
  readTradeFilter,
  readTradeRarities,
  tradeCardsSide,
  withUntaggedFilter,
  type TradeFilter,
} from '@/site/trades';
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
 * Recharge « Mes cartes » depuis la page 1, sans étiquette du site : le total (pagination) n'est relu qu'en page 1,
 * avec la liste. Une étiquette choisie est retirée (retour en page 1) ; sinon, mêmes raretés dans un nouvel
 * ensemble (même effet). Faux si rien n'est lisible.
 */
function reloadFromStart(): boolean {
  const tab = freshTab();
  const filter = tab?.filterButton && readTradeFilter(tab.filterButton);
  if (filter?.activeTagId) {
    filter.selectTag(null);
    return true;
  }
  const rarities = tab?.rarityButton && readTradeRarities(tab.rarityButton);
  rarities?.choose(rarities.checked);
  return !!rarities;
}

/**
 * Filtres de la fenêtre d'échange (les deux onglets) présentés comme ceux de la Collection : cases de rareté,
 * liste des étiquettes du site, liste de souhaits en bouton carré, même texte d'aide. Côté « Mes cartes », la liste
 * propose aussi « Sans étiquette », que le site n'a pas ici : `untagged=1` ajouté à ses requêtes (liste et compteurs).
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
    /** Fenêtre dont « Mes cartes » est en « Sans étiquette » (le site, lui, est sur « Toutes les cartes »). */
    let untaggedFrame: HTMLElement | undefined;

    function isUntaggedLoad(request: NetRequest): boolean {
      if (request.own || !untaggedFrame) return false;
      const composer = findTradeComposer();
      if (composer?.frame !== untaggedFrame) return false;
      return tradeCardsSide(request, composer.friend) === 'mine' || isTradeMineStats(request);
    }

    net.intercept(
      isUntaggedLoad,
      async (request) => {
        try {
          return await net.fetch(withUntaggedFilter(request.url).href);
        } catch {
          // Pas de réponse : un échec plutôt que la requête d'origine (intercepteur en échec), qui montrerait
          // toutes les cartes sous « Sans étiquette ». Le site affiche son erreur, trade-cards-error « Réessayer ».
          return new Response(null, { status: 503 });
        }
      },
      { signal },
    );

    function chooseUntagged(): void {
      const composer = findTradeComposer();
      if (!composer || untaggedFrame === composer.frame) return;
      untaggedFrame = composer.frame;
      if (!reloadFromStart()) untaggedFrame = undefined;
      sync();
    }

    function chooseTag(id: string | null): void {
      if (untaggedFrame && !id) {
        untaggedFrame = undefined;
        reloadFromStart();
      } else {
        untaggedFrame = undefined;
        withFilter((filter) => filter.selectTag(id));
      }
      sync();
    }

    function sync(): void {
      const composer = findTradeComposer();
      if (untaggedFrame && untaggedFrame !== composer?.frame) untaggedFrame = undefined;
      const tab = composer?.tab;
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
        onTag: chooseTag,
        untagged: tab.side === 'mine' ? untaggedFrame === composer.frame : undefined,
        onUntagged: chooseUntagged,
        onWishlist: () => withFilter((filter) => filter.toggleWishlist(!filter.wishlistActive)),
        tagsClass: TAGS,
      });
      slot.render(vnode, { parent: tab.line, before: tab.group, inline: true });
    }

    watchDom(sync, { signal });
  },
};
