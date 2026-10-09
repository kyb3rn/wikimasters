import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findCollectionFilters, findManageTagsOption, findTagManager, tagManagerOpener, type TagManager } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { DEFAULT_FILTERS, pickTags, type TagFilters } from './filters';
import { ManageButton } from './ManageButton';
import { NoTagMatch, TagFiltersBar } from './TagFiltersBar';

const FRAME = 'wm-tag-manager';
const COUNT = 'wm-tag-count';
/** Cadre de la liste des étiquettes : sa liste et notre engrenage côte à côte. */
const SELECT = 'wm-tag-select';
const LIST = 'wm-tag-list';
const HIDDEN = 'wm-tag-hidden';
/** Rang d'une étiquette dans notre tri, posé sur sa ligne (les nœuds de React ne bougent pas). */
const ORDER_VAR = '--wm-tag-order';

/**
 * Largeur du site (`max-w-lg`, 512 px) + 20 %, arrondie : les noms longs se lisent mieux. Hors couche,
 * l'emporte sur ses classes Tailwind. « n cartes » ne se coupe plus ni ne rétrécit : quand le nom est long,
 * c'est lui qui est tronqué, et le compte vient se coller aux boutons.
 *
 * L'engrenage, carré, est collé à droite de la liste (coins et trait communs). Sur une ligne, le cadre garde
 * les bornes du site (`md:min-w-[12rem] md:max-w-[16rem]`) plus l'engrenage : la liste ne rétrécit pas.
 *
 * Filtres entre la création et la liste, séparés de la création par un trait comme la liste : la recherche sur
 * toute la largeur, les autres dessous. Liste en colonne flexible (même écart que son `space-y-2`) pour trier
 * par `order`.
 */
const CSS = `
.${FRAME} { max-width: 614px; max-height: min(90vh, 900px); }
.${COUNT} { white-space: nowrap; flex-shrink: 0; }
.${SELECT} { display: flex; }
.${SELECT} > button[aria-haspopup="listbox"] { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.wm-button.wm-tag-manage { border-left-width: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.wm-tag-filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-top: 1px solid ${tokens.border}; }
.wm-tag-filters > input { flex: 1 1 100%; min-width: 0; height: ${tokens.fieldHeight}; }
.wm-tag-filters > .wm-tag-filter { flex: 1 1 9rem; min-width: 0; }
.wm-tag-filters > .wm-tag-sort { flex: 1 1 12rem; }
.${LIST} { display: flex; flex-direction: column; gap: 0.5rem; }
.${LIST} > * { margin-block: 0; order: var(${ORDER_VAR}, 0); }
.${LIST} > .${HIDDEN} { display: none; }
.wm-tag-empty { padding: 24px 0; text-align: center; }
@media (min-width: 768px) {
  .${SELECT} { min-width: calc(12rem + ${tokens.fieldHeight}); max-width: calc(16rem + ${tokens.fieldHeight}); }
}
`;

export const tagManager: Feature = {
  id: 'tag-manager',
  name: 'Gestion des étiquettes',
  description:
    "La gestion des étiquettes s'ouvre par un engrenage plutôt que par la liste des étiquettes. Sa fenêtre est plus large et ne dépasse pas 900 px de haut ; le nombre de cartes reste sur une ligne. Les étiquettes se cherchent pendant la frappe, se filtrent par nombre de cartes et par couleur, et se trient.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    /** Listes des étiquettes (un bouton par rendu de la page) qui ont l'option « Gérer les étiquettes… ». */
    const manageable = new WeakMap<HTMLButtonElement, boolean>();
    const gear = createSlot(signal);
    const marks = classMarks(signal);

    function open(): void {
      const tag = findCollectionFilters()?.tag;
      const opener = tag && tagManagerOpener(tag);
      if (!tag || !opener) {
        log.warn('option « Gérer les étiquettes » introuvable');
        toast.error("La gestion des étiquettes n'a pas pu s'ouvrir. Rechargez la page.", { title: 'Étiquettes' });
        return;
      }
      // Menu ouvert : le site ne le ferme que sur un clic hors du cadre de la liste, où est l'engrenage.
      if (tag.getAttribute('aria-expanded') === 'true') tag.click();
      opener();
    }

    /** Engrenage collé à la liste des étiquettes, option du menu cachée. Idempotent. */
    function syncGear(): void {
      const tag = findCollectionFilters()?.tag;
      const frame = tag?.parentElement;
      if (tag && frame && !manageable.has(tag)) manageable.set(tag, tagManagerOpener(tag) !== undefined);
      // Sans l'option, rien à remplacer : la liste reste celle du site.
      if (!tag || !frame || !manageable.get(tag)) {
        gear.clear();
        marks.only(SELECT, []);
        return;
      }
      marks.only(SELECT, [frame]);
      const option = findManageTagsOption(tag);
      if (option) ctx.hide(option);
      gear.render(h(ManageButton, { onClick: open }), { parent: frame, inline: true });
    }

    const bar = createSlot(signal);
    const empty = createSlot(signal);
    let filters: TagFilters = DEFAULT_FILTERS;
    /** Cadre de la fenêtre ouverte : une autre ouverture repart sans filtre. */
    let opened: HTMLElement | undefined;

    function setOrder(row: HTMLElement, rank: number | undefined): void {
      const value = rank === undefined ? '' : String(rank);
      if (row.style.getPropertyValue(ORDER_VAR) === value) return;
      if (rank === undefined) row.style.removeProperty(ORDER_VAR);
      else row.style.setProperty(ORDER_VAR, value);
    }

    /** Filtres appliqués aux lignes de la fenêtre ouverte. Idempotent. */
    function syncFilters(manager: TagManager | undefined): void {
      if (manager?.frame !== opened) filters = DEFAULT_FILTERS;
      opened = manager?.frame;
      if (!manager?.scroller || !manager.list) {
        bar.clear();
        empty.clear();
        return;
      }
      const { frame, scroller, list, rows } = manager;
      const shown = pickTags(rows, filters);
      const kept = new Set(shown);
      marks.only(LIST, [list]);
      marks.only(HIDDEN, rows.filter((row) => !kept.has(row)).map((row) => row.root));
      // Nom de A à Z : l'ordre du site, sans rang.
      const siteOrder = filters.sort === 'name' && filters.order === 'asc';
      shown.forEach((row, index) => setOrder(row.root, siteOrder ? undefined : index + 1));
      const onChange = (next: TagFilters) => {
        filters = next;
        syncFilters(findTagManager());
      };
      bar.render(h(TagFiltersBar, { filters, tags: rows, onChange }), { parent: frame, before: scroller });
      if (rows.length > 0 && shown.length === 0) empty.render(h(NoTagMatch, {}), { parent: scroller, before: null });
      else empty.clear();
    }

    ctx.onDispose(() => {
      for (const row of findTagManager()?.rows ?? []) row.root.style.removeProperty(ORDER_VAR);
    });

    watchDom(() => {
      syncGear();
      const manager = findTagManager();
      syncFilters(manager);
      if (!manager) return;
      marks.only(FRAME, [manager.frame]);
      marks.only(COUNT, manager.counts);
    }, { signal });
  },
};
