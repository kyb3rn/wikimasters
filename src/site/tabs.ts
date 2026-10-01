import { ROOT_CLASS } from '@/core/dom';

/*
 * Menus d'onglets du site (code du 30/09/2026), deux allures :
 * - soulignés (marché, profil d'un joueur, échanges) : rangée `flex border-b border-[var(--color-border)]`,
 *   onglets `py-3 text-sm font-medium`, choisi `text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]`,
 *   les autres `text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]` ;
 * - en segments (guilde, qu'on en ait une ou non) : cadre `flex gap-1 bg-[var(--color-surface-light)] rounded-xl
 *   p-1`, onglets `flex-1 py-2 rounded-lg text-sm font-medium`, choisi `bg-[var(--color-accent)]
 *   text-[var(--color-accent-foreground)]`, les autres comme les soulignés.
 */

/**
 * Onglet souligné : `py-3` dans la page (marché, profil, /trades), `py-2` dans la fenêtre d'échange. Le choisi porte
 * en plus `border-b-2`.
 */
const UNDERLINED_TAB = 'button:is(.py-2, .py-3)';

/** Onglets d'une rangée, sans ce que le script y a posé. */
const tabsOf = (bar: Element) => [...bar.children].filter((child) => !child.classList.contains(ROOT_CLASS));

/** Menus d'onglets soulignés sous `root` : rangée `div.flex.border-b` d'au moins deux onglets, rien d'autre. */
export function findUnderlinedTabBars(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('div.flex.border-b')].filter((bar) => {
    const tabs = tabsOf(bar);
    return tabs.length >= 2 && tabs.every((tab) => tab.matches(UNDERLINED_TAB));
  });
}

/**
 * Classe que la fonctionnalité site-tabs pose sur un menu en segments pour lui donner l'allure des soulignés (cadre
 * sans fond, trait du bas) : une fonctionnalité qui retouche ce trait s'y accroche.
 */
export const RESTYLED_SEGMENT_TABS = 'wm-site-tabs';

/** Onglet en segment : il partage la largeur du cadre avec les autres. */
const SEGMENT_TAB = 'button.flex-1.rounded-lg';

/**
 * Onglet choisi d'un menu en segments, en sélecteur CSS : React change ses classes au clic, un style qui s'y accroche
 * suit sans attendre le script.
 */
export const ACTIVE_SEGMENT_TAB = 'button[class~="bg-[var(--color-accent)]"]';

/** Menus d'onglets en segments de la page (un bouton à nous posé dans la rangée n'en fait pas partie). */
export function findSegmentTabBars(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('div.p-1.rounded-xl')].filter((bar) => {
    const tabs = tabsOf(bar);
    return tabs.length >= 2 && tabs.every((tab) => tab.matches(SEGMENT_TAB));
  });
}
