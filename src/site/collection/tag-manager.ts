import { textOf } from '@/core/text';
import { findListbox } from '@/site/listbox';
import { findSiteModals } from '@/site/modals';

/**
 * Fenêtre « Gérer les étiquettes » (capture du 06/10/2026), ouverte par la liste des étiquettes de /collection :
 * cadre `card-frame-solid … max-h-[90vh] w-full max-w-lg`, en-tête (`h2`), création (`div.space-y-3.p-4` :
 * couleur, « Nouvelle étiquette… », « Créer »), puis la liste défilante (`div.min-h-0.flex-1.overflow-y-auto`
 * › `div.space-y-2`), toutes les étiquettes, triées par nom. Une étiquette : `div.rounded-xl.border.p-3` ›
 * `div.flex.items-center.gap-2.min-w-0` › pastille (`span.rounded-full`, couleur en style), nom (`truncate`),
 * « n carte(s) » (« 0 carte »), Couleur · Renommer · Supprimer (`ml-auto`, icônes palette, pencil, trash-2).
 */
export interface TagManager {
  readonly frame: HTMLElement;
  /** « n carte(s) » de chaque étiquette. */
  readonly counts: HTMLElement[];
  /** Zone défilante de la liste. */
  readonly scroller: HTMLElement | undefined;
  /** Liste des étiquettes, une ligne par enfant. */
  readonly list: HTMLElement | undefined;
  readonly rows: TagManagerRow[];
}

export interface TagManagerRow {
  /** Cadre de l'étiquette (sa ligne et, dessous, l'éditeur de couleur ou de nom). */
  readonly root: HTMLElement;
  /** Absent : ligne illisible. */
  readonly name: string | undefined;
  readonly count: number | undefined;
  /** Couleur de la pastille, `[r, g, b]`. */
  readonly color: readonly [number, number, number] | undefined;
}

const COUNT_TEXT = /^(\d+) cartes?$/;

function parseRgb(value: string): [number, number, number] | undefined {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function readRow(root: HTMLElement): TagManagerRow {
  const line = root.querySelector<HTMLElement>(':scope > div.flex.items-center.min-w-0');
  const spans = line ? [...line.querySelectorAll<HTMLElement>(':scope > span')] : [];
  const name = spans.find((span) => span.classList.contains('truncate'));
  const count = spans.map((span) => COUNT_TEXT.exec(textOf(span))?.[1]).find((digits) => digits !== undefined);
  const dot = spans.find((span) => span.classList.contains('rounded-full'));
  return {
    root,
    name: name ? textOf(name) : undefined,
    count: count === undefined ? undefined : Number(count),
    color: dot ? parseRgb(dot.style.backgroundColor) : undefined,
  };
}

export function findTagManager(doc: Document = document): TagManager | undefined {
  for (const { frame } of findSiteModals(doc)) {
    if (!frame || textOf(frame.querySelector('h2')) !== 'Gérer les étiquettes') continue;
    const counts = [...frame.querySelectorAll<HTMLElement>('div.flex.items-center.min-w-0 > span')].filter((span) =>
      COUNT_TEXT.test(textOf(span)),
    );
    const scroller = frame.querySelector<HTMLElement>(':scope > div.overflow-y-auto') ?? undefined;
    const list = scroller?.querySelector<HTMLElement>(':scope > div.space-y-2') ?? undefined;
    const rows = list ? [...list.children].filter((child): child is HTMLElement => child instanceof HTMLElement).map(readRow) : [];
    return { frame, counts, scroller, list, rows };
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
