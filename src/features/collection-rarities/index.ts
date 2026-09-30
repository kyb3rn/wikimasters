import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { COLLECTION_ROUTE, findCollectionFilters, findRarityPills } from '@/site/collection';
import type { Rarity } from '@/site/rarity';
import { mountUi, type MountedUi } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { RarityFilter } from './RarityFilter';

/** Rangée des pastilles du site (et « Réinitialiser rareté »), cachée : nos cases les cliquent. */
const PILLS = 'wm-rarity-pills';
/** Barre du champ de recherche et des listes, où nos cases s'insèrent. */

/*
 * Case de rareté cochée : bordure intérieure et lettres de la couleur de la rareté (`--wm-rarity`, posée sur chaque case),
 * sans fond ; au survol, cochée ou non, fond de cette couleur, léger. La première reprend
 * l'arrondi du cadre (moins sa bordure), sinon il rognerait les coins de la bordure intérieure. La mise en
 * page de la ligne (largeurs, passage à la ligne) est celle de collection-filter-line.
 */
const CSS = `
.wm-rarity-filter > .wm-rarity { color: color-mix(in srgb, ${tokens.foreground} 60%, transparent); background-color: transparent;
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease; }
.wm-rarity-filter > .wm-rarity:hover { color: ${tokens.foreground};
  background-color: color-mix(in srgb, var(--wm-rarity) 15%, transparent); }
.wm-rarity-filter > .wm-rarity[aria-pressed="true"] { color: var(--wm-rarity); box-shadow: inset 0 0 0 2px var(--wm-rarity); }
.wm-rarity-filter > .wm-rarity:first-child { border-radius: calc(var(--radius-lg, 0.5rem) - 1px) 0 0 calc(var(--radius-lg, 0.5rem) - 1px); }
.${PILLS} { display: none !important; }
`;

/**
 * Les pastilles de rareté du site deviennent des cases collées, entre le champ de recherche et les listes :
 * à la hauteur des champs, cochées dans la couleur de la rareté. Chaque case clique la pastille du site
 * (cachée) : le filtre reste le sien, et `collection-search` retient son changement comme celui des listes.
 */
export const collectionRarities: Feature = {
  id: 'collection-rarities',
  name: 'Filtre des raretés',
  description: 'Les raretés se cochent dans une rangée de cases collées, entre la recherche et les listes.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    let placed: { ui: MountedUi; controller: AbortController } | undefined;

    await whenBody();
    if (signal.aborted) return;
    injectStyle('collection-rarities', CSS);

    function toggle(rarity: Rarity): void {
      findRarityPills()?.pills.find((pill) => pill.rarity === rarity)?.button.click();
    }

    function reset(): void {
      findRarityPills()?.reset?.click();
    }

    function sync(): void {
      const filters = findCollectionFilters();
      const bar = filters?.row.parentElement;
      const pills = findRarityPills();
      if (!filters || !bar || !pills) {
        placed?.controller.abort();
        placed = undefined;
        return;
      }
      setClass(pills.row, PILLS, true);
      const vnode = h(RarityFilter, {
        rarities: pills.pills.map((pill) => pill.rarity),
        checked: new Set(pills.pills.filter((pill) => pill.checked).map((pill) => pill.rarity)),
        onToggle: toggle,
        onReset: reset,
      });
      if (placed?.ui.element.parentElement === bar && placed.ui.element.nextElementSibling === filters.row) {
        placed.ui.update(vnode);
        return;
      }
      placed?.controller.abort();
      const controller = childController(signal);
      placed = { ui: mountUi(vnode, { parent: bar, before: filters.row, inline: true, signal: controller.signal }), controller };
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => document.querySelectorAll(`.${PILLS}`).forEach((el) => el.classList.remove(PILLS)));
  },
};
