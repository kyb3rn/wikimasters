import { ROOT_CLASS } from '@/core/dom';
import { hasIcon } from '@/site/dom';
import { ACTIVE_SEGMENT_TAB, findSegmentTabBars } from '@/site/tabs';

/*
 * /guild dans une guilde (capture du 01/10/2026) :
 *   div.flex-1.flex.flex-col.gap-4
 *     div.flex.items-center.justify-between   en-tête : [icône + h1 (nom) + description] · div.flex.items-center.gap-2
 *                                            [span « 52 membres » (`hidden sm:inline`) + button « + Inviter »]
 *     div.flex.gap-1.rounded-xl.p-1          onglets en segments (`overflow-x-auto`) : Accueil, Chat, Membres (n), Classement
 *     …                                      contenu de l'onglet
 * Accueil : son premier cadre (« Semaine en cours ») a en fond un calque `absolute inset-0 bg-gradient-to-br
 * from-[var(--color-accent)]/5 via-transparent to-amber-500/3 pointer-events-none`.
 */

export interface GuildHeader {
  /** « + Inviter » : ouvre « Inviter des amis ». */
  readonly invite: HTMLButtonElement;
  /** Bloc de droite de l'en-tête : nombre de membres et « Inviter ». */
  readonly actions: HTMLElement;
  /** Rangée des onglets. */
  readonly tabBar: HTMLElement;
}

/** Calque en dégradé du fond des cadres de l'Accueil, en sélecteur CSS. */
export const GUILD_GRADIENT_LAYER = 'main .card-frame div.absolute.inset-0.pointer-events-none[class*="bg-gradient-"]';

/** En-tête de la guilde (onglets précédés du titre et du bouton « Inviter ») ; pas sans guilde. */
export function findGuildHeader(root: ParentNode = document): GuildHeader | undefined {
  const main = root.querySelector('main');
  if (!main) return undefined;
  for (const tabBar of findSegmentTabBars(main)) {
    const header = tabBar.previousElementSibling;
    if (!header?.querySelector('h1')) continue;
    const actions = header.lastElementChild;
    if (!(actions instanceof HTMLElement) || actions.classList.contains(ROOT_CLASS)) continue;
    const invite = actions.querySelector<HTMLButtonElement>(':scope > button');
    if (invite) return { invite, actions, tabBar };
  }
  return undefined;
}

export interface GuildChatTab {
  readonly tab: HTMLButtonElement;
  /** Onglet affiché : celui du chat. */
  readonly active: boolean;
  /** Premier des autres onglets (Accueil). */
  readonly home: HTMLButtonElement | undefined;
}

/** Onglet « Chat » de la rangée (reconnu à son icône lucide `message-circle`). */
export function findGuildChatTab(header: GuildHeader): GuildChatTab | undefined {
  const tabs = [...header.tabBar.querySelectorAll<HTMLButtonElement>(':scope > button')];
  const tab = tabs.find((button) => hasIcon(button, 'message-circle'));
  if (!tab) return undefined;
  return { tab, active: tab.matches(ACTIVE_SEGMENT_TAB), home: tabs.find((button) => button !== tab) };
}
