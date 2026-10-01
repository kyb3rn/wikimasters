import { textOf } from '@/core/text';
import { findListbox } from '@/site/listbox';
import { checkedRarities, type ListSource } from '@/site/list-query';
import { findRarityPills, type RarityPills } from '@/site/rarity-pills';
import {
  isGlobalCollectionList,
  readGlobalCollectionQuery,
  sameGlobalCollectionChoice,
  type GlobalCollectionQuery,
} from './list';

/**
 * Filtres de « Toutes les cartes » (code et capture du 30/09/2026), dans `div.space-y-3` :
 * - ligne `div.flex.flex-col.gap-3.md:flex-row` : rangée du champ (`div.flex.w-full.min-w-0.flex-1.gap-2` :
 *   champ dans `div.relative` avec sa croix « Effacer la recherche », puis « Rechercher »), puis la liste
 *   « Trier les cartes » (Rareté, Nom, ATK, DEF) dans son `div.relative` ;
 * - rangée des pastilles : « Liste de souhaits » (lucide `bookmark`, active : `ring-2`), raretés,
 *   « Réinitialiser rareté ».
 * La recherche ne part qu'à Entrée ou « Rechercher » (désactivé tant que le champ, sans ses espaces, vaut la
 * recherche en cours) ; tout autre changement remet la page à 0 et charge aussitôt. Sous le cadre des
 * filtres, dans la page : pendant un chargement, une roue (`div.py-16`) à la place de la grille ; la pagination.
 */
export interface GlobalCollectionFilters {
  readonly area: HTMLElement;
  readonly line: HTMLElement;
  /** Rangée du champ et de « Rechercher ». */
  readonly fieldRow: HTMLElement;
  readonly field: HTMLInputElement;
  readonly submit: HTMLButtonElement;
  /** Cadre de la liste du tri, dans la ligne. */
  readonly sortBox: HTMLElement;
  readonly sort: HTMLButtonElement;
  readonly pills: RarityPills;
  readonly wishlist: { readonly button: HTMLButtonElement; readonly active: boolean } | undefined;
}

export function findGlobalCollectionFilters(doc: Document = document): GlobalCollectionFilters | undefined {
  const sort = doc.querySelector('main')?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"][aria-label="Trier les cartes"]');
  const sortBox = sort?.parentElement;
  const line = sortBox?.parentElement;
  const fieldRow = line?.firstElementChild;
  const area = line?.parentElement;
  if (!sort || !sortBox || !line || !(fieldRow instanceof HTMLElement) || fieldRow === sortBox || !area) return undefined;
  const field = fieldRow.querySelector<HTMLInputElement>('input[type="text"]');
  const submit = [...fieldRow.children].find((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
  const pills = findRarityPills(area);
  if (!field || !submit || !pills) return undefined;
  const wish = [...pills.row.querySelectorAll<HTMLButtonElement>(':scope > button')].find((button) => button.querySelector('.lucide-bookmark'));
  return {
    area,
    line,
    fieldRow,
    field,
    submit,
    sortBox,
    sort,
    pills,
    wishlist: wish && { button: wish, active: wish.classList.contains('ring-2') },
  };
}

/**
 * Cadre au-dessus des filtres pendant une recherche (capture du 30/09/2026) : `div.card-frame` dont le premier
 * paragraphe dit « Recherche active : pas de décompte par rareté ni de total exact… ». Sans recherche, le même
 * cadre montre les compteurs par rareté.
 */
export function findGlobalCollectionSearchNotice(filters: GlobalCollectionFilters): HTMLElement | undefined {
  const frame = filters.area.previousElementSibling;
  if (!(frame instanceof HTMLElement) || !frame.classList.contains('card-frame')) return undefined;
  return textOf(frame.querySelector(':scope > p')).startsWith('Recherche active') ? frame : undefined;
}

/** Roue qui remplace la grille pendant un chargement (sœur du cadre des filtres). */
export function isGlobalCollectionLoading(filters: GlobalCollectionFilters): boolean {
  return Boolean(filters.area.parentElement?.querySelector(':scope > div.py-16 .animate-spin'));
}

/** Choix affichés par les contrôles de la page (tri, raretés, liste de souhaits), sans recherche ni page. */
export function readGlobalCollectionChoice(filters: GlobalCollectionFilters): GlobalCollectionQuery | undefined {
  const sort = findListbox(filters.sort);
  if (!sort) return undefined;
  return { sort: sort.value, search: '', rarities: checkedRarities(filters.pills), wishlist: filters.wishlist?.active ?? false, page: undefined };
}

/** Liste de la page (recherche retenue, délai, mémoire des filtres, pagination). */
export const globalCollectionList: ListSource<GlobalCollectionQuery> = {
  id: 'global-collection',
  isList: isGlobalCollectionList,
  readQuery: readGlobalCollectionQuery,
  sameChoice: sameGlobalCollectionChoice,
  field: () => findGlobalCollectionFilters()?.field,
};
