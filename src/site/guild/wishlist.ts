import { isRecord } from '@/core/guards';
import { currentFiberAncestors, fiberOf, stateHooks } from '@/core/react';
import { FACE, FACE_BOTTOM, findFaceImage } from '@/site/cards';

/*
 * Accueil de guilde, cadre « Liste de souhaits » (capture et code du 01/10/2026) : une face `sm` par demande, dans
 * `div.flex.flex-col.items-center.gap-1.5 > div.relative.rounded-xl`. D'abord la sienne (« Ma demande », sans clé
 * React), puis celles des autres membres (composant de clé `id` de la demande). Sous la description, au-dessus
 * d'ATK · DEF :
 *   div.mt-auto.flex.flex-col.items-start.gap-0.5.pt-1
 *     div.min-w-0.max-w-full.shrink-0 > span.rounded-full[title]   pastille : « pseudo » ou « pseudo · reçu aujourd'hui »
 *                                                                  (`bg-black/55`), « Ma demande » (couleur d'accent)
 *     div.flex.justify-between.border-t                           ATK · DEF
 * « reçu aujourd'hui » : `recipient_received_today`, le membre a déjà reçu une carte aujourd'hui.
 * Même emplacement que la pastille « Possédée » (`title="Dans ta collection"`) des annonces du marché : la case de
 * la face distingue les deux.
 */
const WISH_CELL = 'div.flex.flex-col.items-center.gap-1\\.5';
const WISH_FACE = `${WISH_CELL} > div.relative.rounded-xl > ${FACE}`;
const PILL = `${WISH_FACE} ${FACE_BOTTOM} > div > span.rounded-full[title]`;
const REQUESTER_PILL = `${PILL}.bg-black\\/55`;
const OWN_PILL = `${PILL}:not(.bg-black\\/55)`;
const SEPARATOR = ' · ';

export interface GuildWishRequester {
  /** Ligne de la pastille du site (son parent), sous la description. */
  readonly line: HTMLElement;
  readonly username: string;
  /** Suite de la pastille (« reçu aujourd'hui »), s'il y en a une. */
  readonly status: string | undefined;
  /** Zone de l'image de la face. */
  readonly image: HTMLElement | undefined;
}

/** « pseudo » ou « pseudo · état » ; un pseudo ne contient pas « · ». */
export function parseRequesterLabel(label: string): { username: string; status: string | undefined } | undefined {
  const text = label.trim();
  const index = text.indexOf(SEPARATOR);
  const username = (index === -1 ? text : text.slice(0, index)).trim();
  if (!username) return undefined;
  const status = index === -1 ? '' : text.slice(index + SEPARATOR.length).trim();
  return { username, status: status || undefined };
}

/** Auteurs des demandes des autres membres affichées (pas « Ma demande »). */
export function findGuildWishRequesters(root: ParentNode = document): GuildWishRequester[] {
  const requesters: GuildWishRequester[] = [];
  for (const pill of root.querySelectorAll<HTMLElement>(`main ${REQUESTER_PILL}`)) {
    const line = pill.parentElement;
    const parsed = parseRequesterLabel(pill.title || (pill.textContent ?? ''));
    const face = pill.closest(FACE);
    if (!line || !parsed || !face) continue;
    requesters.push({ line, ...parsed, image: findFaceImage(face) });
  }
  return requesters;
}

/** Zone de l'image de sa propre demande (« Ma demande »), si elle est affichée. */
export function findOwnGuildWishImage(root: ParentNode = document): HTMLElement | undefined {
  const face = root.querySelector(`main ${OWN_PILL}`)?.closest(FACE);
  return face ? findFaceImage(face) : undefined;
}

export interface GuildWish {
  readonly face: HTMLElement;
  /** Je possède la carte demandée : la demande liste au moins un de mes exemplaires (`owned_copy_ids`). */
  readonly owned: boolean;
}

/**
 * Demandes des autres membres affichées, lues dans l'état de l'Accueil (`home`, de `GET /api/guilds` puis
 * `GET /api/guilds/home` : `wishlist[]`). « Ma demande » n'y est pas.
 */
export function findGuildWishes(root: ParentNode = document): GuildWish[] {
  const cells = [...root.querySelectorAll<HTMLElement>(`main ${WISH_CELL}:has(> div.relative.rounded-xl > ${FACE})`)];
  const first = cells[0];
  const owned = first && wishlistOwnership(first);
  if (!owned) return [];
  return cells.flatMap((cell) => {
    const face = cell.querySelector<HTMLElement>(`:scope > div.relative.rounded-xl > ${FACE}`);
    // Clé du composant de la demande, parent direct de sa case.
    const key = fiberOf(cell)?.return?.key;
    const isOwned = typeof key === 'string' ? owned.get(key) : undefined;
    return face && isOwned !== undefined ? [{ face, owned: isOwned }] : [];
  });
}

/** Demandes de l'état de l'Accueil : id → je possède la carte. */
function wishlistOwnership(node: Node): Map<string, boolean> | undefined {
  for (const fiber of currentFiberAncestors(node)) {
    for (const { value } of stateHooks(fiber)) {
      if (!isRecord(value) || !Array.isArray(value.wishlist)) continue;
      const owned = new Map<string, boolean>();
      for (const wish of value.wishlist as unknown[]) {
        if (!isRecord(wish) || typeof wish.id !== 'string' || !Array.isArray(wish.owned_copy_ids)) continue;
        owned.set(wish.id, wish.owned_copy_ids.length > 0);
      }
      return owned;
    }
  }
  return undefined;
}
