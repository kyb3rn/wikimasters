import { textOf } from '@/core/text';
import { findListbox } from '@/site/listbox';
import { findSiteModals } from '@/site/modals';

/**
 * Fenêtre « Gérer les étiquettes » (code du site, 29/09/2026 ; pas encore de capture), ouverte par la liste
 * des étiquettes de /collection : cadre `card-frame-solid … max-h-[90vh] w-full max-w-lg`, en-tête (`h2`),
 * création (couleur, nom, « Créer »), puis la liste défilante. Une ligne par étiquette :
 * `div.flex.items-center.gap-2.min-w-0` > pastille, nom (`truncate`), « n carte(s) » (qui passe à la ligne
 * quand le nom est long), Couleur · Renommer · Supprimer (`ml-auto`).
 */
export interface TagManager {
  readonly frame: HTMLElement;
  /** « n carte(s) » de chaque étiquette. */
  readonly counts: HTMLElement[];
}

export function findTagManager(doc: Document = document): TagManager | undefined {
  for (const { frame } of findSiteModals(doc)) {
    if (!frame || textOf(frame.querySelector('h2')) !== 'Gérer les étiquettes') continue;
    const counts = [...frame.querySelectorAll<HTMLElement>('div.flex.items-center.min-w-0 > span')].filter((span) =>
      /^\d+ cartes?$/.test(textOf(span)),
    );
    return { frame, counts };
  }
  return undefined;
}

/**
 * Valeur de l'option « Gérer les étiquettes… », la dernière de la liste des étiquettes : le `onChange` de la
 * page ouvre alors la fenêtre, sans toucher au filtre.
 */
const MANAGE_TAGS = '__manage_tags__';

/** De quoi ouvrir la fenêtre comme cette option, si la liste des étiquettes l'a. Relit les props à chaque appel. */
export function tagManagerOpener(tag: HTMLButtonElement): (() => void) | undefined {
  const select = findListbox(tag);
  if (!select?.options.some((option) => option.value === MANAGE_TAGS)) return undefined;
  return () => select.onChange(MANAGE_TAGS);
}

/**
 * Option « Gérer les étiquettes… » (son `li`) du menu de la liste des étiquettes, quand il est ouvert. Le menu
 * est rendu dans `body` (`ul[role="listbox"]`, id donné par `aria-controls` du bouton), une option par
 * `li[role="none"] > button[role="option"]`.
 */
export function findManageTagsOption(tag: HTMLButtonElement, doc: Document = document): HTMLElement | undefined {
  const id = tag.getAttribute('aria-controls');
  const menu = id ? doc.getElementById(id) : null;
  if (!menu) return undefined;
  for (const option of menu.querySelectorAll<HTMLElement>('[role="option"]')) {
    if (!textOf(option).startsWith('Gérer les étiquettes')) continue;
    const item = option.parentElement;
    return item && item !== menu ? item : option;
  }
  return undefined;
}
