import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, stateHooks } from '@/core/react';
import { normalizeText, textOf } from '@/core/text';
import { isOwn, siteButtons } from '@/site/dom';

/**
 * En-tête d'un profil : le même composant chez le site pour le sien (`/profile`) et pour celui d'un autre joueur
 * (`/profile/<pseudo>`) ; captures du 29/09 et du 01/10/2026, code du 01/10 :
 *
 *   div.card-frame.p-3.sm:p-4.animate-fade-in-up
 *     div.-mt-0.5.mb-1.flex.justify-end   autre joueur : « Signaler » (lucide `flag`) ; pour un ami,
 *                                         div.flex.items-center.gap-1 › « Signaler », « Retirer des amis » (`user-minus`)
 *     div.flex.items-center.gap-3.flex-wrap
 *       le sien : button[title="Modifier la photo de profil"].group.relative.w-12.h-12.rounded-full (ouvre « Photo de
 *         profil ») ; autre joueur : div.w-12.h-12.rounded-full ; dedans img.w-full.h-full.object-cover (style
 *         `object-position`, flou si photo sensible) ou span initiales (2 premières lettres du pseudo)
 *       div.flex-1.min-w-0
 *         h1 pseudo
 *         p.text-xs › span › span.whitespace-nowrap « 1 416 cartes », « · Depuis sept. 2026 », et pour un ami
 *           « · Vu il y a 10 min » (« · En ligne récemment » sous 5 min)
 *         le sien : div.mt-2.flex.flex-wrap.gap-1 › étiquettes : span pastille (couleurs en style) › span nom, span « ×966 »
 *       le sien : div › span « Visible de tous » / « Amis seulement »,
 *         button[aria-label="Rendre privé" | "Rendre public"] interrupteur : `PATCH /api/profile/<pseudo>` `{ is_public }`
 *
 * Le sien, à part dessous : div.animate-fade-in-up › div.card-frame.p-4.text-center › « 1 416 » / « Cartes uniques ».
 */
export interface ProfileHeader {
  readonly root: HTMLElement;
  /** Son profil : ouvre la fenêtre « Photo de profil » du site. */
  readonly avatarButton: HTMLButtonElement | undefined;
  readonly avatar: ProfileAvatar | undefined;
  readonly name: string;
  readonly cards: ProfileStat | undefined;
  /** Ami : « Vu il y a 10 min », « En ligne récemment ». */
  readonly seen: string | undefined;
  /** Autres textes de la ligne sous le pseudo : « Depuis sept. 2026 »… */
  readonly details: readonly string[];
  readonly tags: readonly ProfileTag[];
  readonly visibility: ProfileVisibility | undefined;
  /** Profil d'un autre joueur : « Signaler », et pour un ami « Retirer des amis ». */
  readonly actions: readonly ProfileAction[];
}

export type ProfileAvatar =
  | { readonly kind: 'image'; readonly src: string; readonly alt: string; readonly style: string }
  | { readonly kind: 'initials'; readonly text: string };

export interface ProfileStat {
  readonly value: string;
  readonly label: string;
}

export interface ProfileTag {
  readonly name: string;
  /** « 966 » (sans le « × » du site). */
  readonly count: string | undefined;
  /** Style en ligne de la pastille du site (ses couleurs). */
  readonly style: string;
}

export interface ProfileVisibility {
  readonly button: HTMLButtonElement;
  readonly isPublic: boolean;
  /** « Visible de tous », « Amis seulement ». */
  readonly label: string;
  /** « Rendre privé », « Rendre public ». */
  readonly action: string;
}

export interface ProfileAction {
  readonly button: HTMLButtonElement;
  /** Icône lucide du site : `flag`, `user-minus`. */
  readonly icon: string | undefined;
  /** « Signaler », « Retirer des amis » (pendant un retrait, le site affiche « … » : c'est alors son `title`). */
  readonly label: string;
  /** « Signaler <pseudo> », « Retirer des amis ». */
  readonly title: string;
}

/** Carte « Cartes uniques » ; `root` : ce qui la porte dans la colonne de la page. */
export interface UniqueCardsStat {
  readonly root: HTMLElement;
  readonly stat: ProfileStat;
}

const COUNT = /^(\d[\d\s]*)\s*(cartes?)$/i;
const SEEN = /^(Vu |En ligne)/;

/**
 * Textes de la ligne sous le pseudo (« 1 416 cartes », « · Depuis sept. 2026 », « · Vu il y a 33 min ») :
 * le nombre de cartes et la dernière activité à part, les autres sans leur « · ».
 */
export function splitProfileLine(parts: readonly string[]): {
  cards: ProfileStat | undefined;
  seen: string | undefined;
  details: string[];
} {
  let cards: ProfileStat | undefined;
  let seen: string | undefined;
  const details: string[] = [];
  for (const part of parts) {
    const clean = part.replace(/^·\s*/, '').trim();
    if (!clean) continue;
    const count = COUNT.exec(clean);
    if (count && !cards) {
      const word = count[2] ?? 'cartes';
      cards = { value: (count[1] ?? '').trim(), label: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() };
    } else if (SEEN.test(clean) && !seen) {
      seen = clean;
    } else {
      details.push(clean);
    }
  }
  return { cards, seen, details };
}

function readAvatar(avatar: Element): ProfileAvatar | undefined {
  const image = avatar.querySelector('img');
  const src = image?.getAttribute('src');
  if (image && src) return { kind: 'image', src, alt: image.alt, style: image.getAttribute('style') ?? '' };
  const initials = textOf(avatar.querySelector(':scope > span:first-child'));
  return initials ? { kind: 'initials', text: initials } : undefined;
}

function readVisibility(root: HTMLElement): ProfileVisibility | undefined {
  for (const button of root.querySelectorAll('button')) {
    const action = button.getAttribute('aria-label') ?? '';
    if (!/^Rendre (privé|public)$/.test(action)) continue;
    const label = [...(button.parentElement?.children ?? [])].find((el) => el !== button && el.tagName === 'SPAN');
    return { button, isPublic: action === 'Rendre privé', label: textOf(label), action };
  }
  return undefined;
}

function readTags(identity: Element): ProfileTag[] {
  return [...identity.querySelectorAll(':scope > div > span')].map((chip) => {
    const count = textOf(chip.children[1]).replace(/^×\s*/, '');
    return { name: textOf(chip.children[0] ?? chip), count: count || undefined, style: chip.getAttribute('style') ?? '' };
  });
}

function readActions(bar: Element | null): ProfileAction[] {
  if (!bar) return [];
  return siteButtons(bar).map((button) => {
    const svg = button.querySelector('svg[class*="lucide-"]');
    const icon = svg && [...svg.classList].find((name) => name.startsWith('lucide-'))?.slice('lucide-'.length);
    const text = textOf(button);
    return { button, icon: icon || undefined, label: /^[.…\s]*$/.test(text) ? button.title : text, title: button.title };
  });
}

/** En-tête d'un profil, le sien ou celui d'un autre joueur ; `undefined` ailleurs et pendant le chargement. */
export function findProfileHeader(doc: Document = document): ProfileHeader | undefined {
  for (const title of doc.querySelectorAll('main .card-frame > div > div > h1')) {
    const identity = title.parentElement;
    const avatar = identity?.previousElementSibling;
    const row = identity?.parentElement;
    const root = row?.parentElement;
    if (isOwn(title) || !identity || !avatar?.classList.contains('rounded-full') || !row || !root) continue;
    const line = [...identity.querySelectorAll(':scope > p span.whitespace-nowrap')].map((part) => textOf(part));
    return {
      root,
      avatarButton: avatar instanceof HTMLButtonElement ? avatar : undefined,
      avatar: readAvatar(avatar),
      name: textOf(title),
      ...splitProfileLine(line),
      tags: readTags(identity),
      visibility: readVisibility(root),
      actions: readActions(row.previousElementSibling),
    };
  }
  return undefined;
}

export function findUniqueCardsStat(doc: Document = document): UniqueCardsStat | undefined {
  for (const frame of doc.querySelectorAll('main .card-frame.text-center')) {
    const [value, label] = frame.children;
    if (frame.children.length !== 2 || textOf(label) !== 'Cartes uniques') continue;
    const parent = frame.parentElement;
    const root = parent?.children.length === 1 && parent.tagName !== 'MAIN' ? parent : frame;
    if (!(root instanceof HTMLElement)) continue;
    return { root, stat: { value: textOf(value), label: textOf(label) } };
  }
  return undefined;
}

export interface ProfilePlayer {
  readonly id: string;
  /** Pseudo exact (l'en-tête le donne normalisé). */
  readonly username: string;
  /** Photo et son cadrage, tels que le site les passe à une conversation (`avatar_url`, `avatar_pos_x`, `avatar_pos_y`). */
  readonly avatarUrl: string | null;
  readonly avatarPosX: number | undefined;
  readonly avatarPosY: number | undefined;
}

const numberOr = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

/**
 * Joueur d'un profil, pris dans l'état de la page du site (`profile` de `GET /api/profile/<pseudo>` : `{ id, username,
 * avatar_url, … }`) : son identifiant, que l'en-tête n'affiche pas.
 */
export function readProfilePlayer(header: Pick<ProfileHeader, 'root' | 'name'>): ProfilePlayer | undefined {
  for (const fiber of currentFiberAncestors(header.root)) {
    for (const { value } of stateHooks(fiber)) {
      if (!isRecord(value) || typeof value.id !== 'string' || typeof value.username !== 'string') continue;
      if (normalizeText(value.username) !== header.name) continue;
      return {
        id: value.id,
        username: value.username,
        avatarUrl: typeof value.avatar_url === 'string' ? value.avatar_url : null,
        avatarPosX: numberOr(value.avatar_pos_x),
        avatarPosY: numberOr(value.avatar_pos_y),
      };
    }
  }
  return undefined;
}

/** Changement de visibilité du profil (`PATCH /api/profile/<pseudo>` `{ is_public }`). */
export function isProfileVisibilityChange(request: NetRequest): boolean {
  return request.method === 'PATCH' && /^\/api\/profile\/[^/]+$/.test(request.url.pathname);
}
