import type { NetRequest } from '@/core/net';

/**
 * En-tête de son propre profil (`/profile`, captures du 29/09/2026) :
 *
 *   div.card-frame.p-3.sm:p-4.animate-fade-in-up
 *     div.flex.items-center.gap-3.flex-wrap
 *       button[title="Modifier la photo de profil"].group.relative.w-12.h-12.rounded-full   ouvre « Photo de profil »
 *         img.w-full.h-full.object-cover (style `object-position`) ou span « VR » (initiales)
 *         span voile au survol, span pastille (lucide `pencil`) au survol
 *       div.flex-1.min-w-0
 *         h1 pseudo
 *         p.text-xs › span › span.whitespace-nowrap « 1 416 cartes », span › span.whitespace-nowrap « · Depuis sept. 2026 »
 *         div.mt-2.flex.flex-wrap.gap-1 › étiquettes : span pastille (couleurs en style) › span nom, span « ×966 »
 *       div
 *         span « Visible de tous » / « Amis seulement »
 *         button[aria-label="Rendre privé" | "Rendre public"] interrupteur : `PATCH /api/profile/<pseudo>` `{ is_public }`
 *         span.sm:hidden « Profil public »
 *
 * Puis, à part : div.animate-fade-in-up › div.card-frame.p-4.text-center › « 1 416 » / « Cartes uniques ».
 * Profil d'un autre joueur : ni bouton de photo, ni interrupteur, ni étiquettes, ni « Cartes uniques ».
 */
export interface OwnProfileHeader {
  readonly root: HTMLElement;
  /** Ouvre la fenêtre « Photo de profil » du site. */
  readonly avatarButton: HTMLButtonElement;
  readonly avatar: ProfileAvatar | undefined;
  readonly name: string;
  readonly cards: ProfileStat | undefined;
  /** « Depuis sept. 2026 »… */
  readonly details: readonly string[];
  readonly tags: readonly ProfileTag[];
  readonly visibility: ProfileVisibility | undefined;
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

/** Carte « Cartes uniques » ; `root` : ce qui la porte dans la colonne de la page. */
export interface UniqueCardsStat {
  readonly root: HTMLElement;
  readonly stat: ProfileStat;
}

const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

const COUNT = /^(\d[\d\s]*)\s*(cartes?)$/i;

/**
 * Textes de la ligne sous le pseudo (« 1 416 cartes », « · Depuis sept. 2026 », « · Vu il y a 33 min ») :
 * le nombre de cartes à part, les autres sans leur « · ».
 */
export function splitProfileLine(parts: readonly string[]): { cards: ProfileStat | undefined; details: string[] } {
  let cards: ProfileStat | undefined;
  const details: string[] = [];
  for (const part of parts) {
    const clean = part.replace(/^·\s*/, '').trim();
    if (!clean) continue;
    const match = COUNT.exec(clean);
    if (match && !cards) {
      const word = match[2] ?? 'cartes';
      cards = { value: (match[1] ?? '').trim(), label: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() };
    } else {
      details.push(clean);
    }
  }
  return { cards, details };
}

function readAvatar(button: HTMLButtonElement): ProfileAvatar | undefined {
  const image = button.querySelector('img');
  const src = image?.getAttribute('src');
  if (image && src) return { kind: 'image', src, alt: image.alt, style: image.getAttribute('style') ?? '' };
  const initials = text(button.querySelector(':scope > span:first-child'));
  return initials ? { kind: 'initials', text: initials } : undefined;
}

function readVisibility(root: HTMLElement): ProfileVisibility | undefined {
  for (const button of root.querySelectorAll('button')) {
    const action = button.getAttribute('aria-label') ?? '';
    if (!/^Rendre (privé|public)$/.test(action)) continue;
    const label = [...(button.parentElement?.children ?? [])].find((el) => el !== button && el.tagName === 'SPAN');
    return { button, isPublic: action === 'Rendre privé', label: text(label), action };
  }
  return undefined;
}

function readTags(identity: Element): ProfileTag[] {
  return [...identity.querySelectorAll(':scope > div > span')].map((chip) => {
    const count = text(chip.children[1]).replace(/^×\s*/, '');
    return { name: text(chip.children[0] ?? chip), count: count || undefined, style: chip.getAttribute('style') ?? '' };
  });
}

/** En-tête de son propre profil ; `undefined` ailleurs, et sur le profil d'un autre joueur. */
export function findOwnProfileHeader(doc: Document = document): OwnProfileHeader | undefined {
  for (const pencil of doc.querySelectorAll('main .card-frame button svg.lucide-pencil')) {
    const avatarButton = pencil.closest('button');
    const root = avatarButton?.closest<HTMLElement>('.card-frame');
    const identity = avatarButton?.nextElementSibling;
    const title = identity?.querySelector(':scope > h1');
    if (!avatarButton || !root || !identity || !title) continue;
    const line = [...identity.querySelectorAll(':scope > p span.whitespace-nowrap')].map((part) => text(part));
    return {
      root,
      avatarButton,
      avatar: readAvatar(avatarButton),
      name: text(title),
      ...splitProfileLine(line),
      tags: readTags(identity),
      visibility: readVisibility(root),
    };
  }
  return undefined;
}

export function findUniqueCardsStat(doc: Document = document): UniqueCardsStat | undefined {
  for (const frame of doc.querySelectorAll('main .card-frame.text-center')) {
    const [value, label] = frame.children;
    if (frame.children.length !== 2 || text(label) !== 'Cartes uniques') continue;
    const parent = frame.parentElement;
    const root = parent?.children.length === 1 && parent.tagName !== 'MAIN' ? parent : frame;
    if (!(root instanceof HTMLElement)) continue;
    return { root, stat: { value: text(value), label: text(label) } };
  }
  return undefined;
}

/** Changement de visibilité du profil (`PATCH /api/profile/<pseudo>` `{ is_public }`). */
export function isProfileVisibilityRequest(request: NetRequest): boolean {
  return request.method === 'PATCH' && /^\/api\/profile\/[^/]+$/.test(request.url.pathname);
}
