import { isRecord, isSet } from '@/core/guards';
import { currentFiberAncestors, stateHooks, type Fiber } from '@/core/react';
import { FACE, FACE_BOTTOM, parseCardRef, type CardRef } from '@/site/cards';

/*
 * Toutes les cartes (code du site, 01/10/2026) : dans l'emplacement du bas de chaque face de la grille,
 *   div.flex.w-fit.max-w-full.flex-col.gap-0.5
 *     span.rounded-full.bg-emerald-600/90 « Possédée »                    (`ownedCardIds`)
 *     span.inline-flex.rounded-full.bg-sky-300/65 (lucide users)          amis qui l'ont (`friendOwners`) : « pseudo +n »,
 *                                                                        `title` = leurs pseudos séparés par « , »
 * États de la page, dans l'ordre : …, compteurs, amis (`{ <card_id>: [{ id, username }] }`), possédées (`Set` d'ids de
 * cartes), liste de souhaits (`Set`), offres en cours (`Set`), …
 */
const FRIENDS_PILL = `${FACE} ${FACE_BOTTOM} > div > div.flex-col > span.rounded-full.bg-sky-300\\/65`;

export interface FriendOwnersPill {
  readonly face: HTMLElement;
  /** Pastille bleue du site. */
  readonly pill: HTMLElement;
  /** Colonne de l'emplacement du bas (« Possédée », puis elle). */
  readonly stack: HTMLElement;
}

/** Pastilles « amis qui l'ont » de la grille. */
export function findFriendOwnersPills(doc: Document = document): FriendOwnersPill[] {
  return [...doc.querySelectorAll<HTMLElement>(`main ${FRIENDS_PILL}`)].flatMap((pill) => {
    const face = pill.closest<HTMLElement>(FACE);
    const stack = pill.parentElement;
    return face && stack ? [{ face, pill, stack }] : [];
  });
}

export interface FriendOwner {
  readonly id: string;
  readonly username: string;
}

const isFriendOwner = (value: unknown): value is FriendOwner =>
  isRecord(value) && typeof value.id === 'string' && typeof value.username === 'string' && value.username !== '';

/** Objet simple dont chaque valeur est une liste (`friendOwners`), pas un `Set` ni des compteurs. */
const isOwnersRecord = (value: unknown): value is Record<string, unknown[]> =>
  isRecord(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(Array.isArray);

/** Amis, possédées, liste de souhaits : premier composant au-dessus qui a cette suite d'états. */
function pageStates(ancestors: readonly Fiber[]): { owners: Record<string, unknown[]>; owned: Set<unknown> } | undefined {
  for (const fiber of ancestors) {
    const values = stateHooks(fiber).map(({ value }) => value);
    for (let i = 0; i + 2 < values.length; i++) {
      const [owners, owned, wishlist] = values.slice(i, i + 3);
      if (isOwnersRecord(owners) && isSet(owned) && isSet(wishlist)) return { owners, owned };
    }
  }
  return undefined;
}

/**
 * Carte d'une face de la grille et amis qui l'ont, lus dans l'état de la page au moment voulu (clic) : c'est un
 * parcours de l'arbre de React.
 */
export function readFriendOwners(face: Element): { readonly card: CardRef; readonly friends: FriendOwner[] } | undefined {
  const ancestors = currentFiberAncestors(face);
  const card = ancestors.map((fiber) => (isRecord(fiber.memoizedProps) ? parseCardRef(fiber.memoizedProps.card) : undefined)).find(Boolean);
  const states = pageStates(ancestors);
  if (!card || !states) return undefined;
  return { card, friends: (states.owners[card.id] ?? []).filter(isFriendOwner) };
}

/** Cartes que je possède, d'après l'état de la page au-dessus de `node` (modale de carte comprise). */
export function readCatalogOwnedCards(node: Node): ReadonlySet<unknown> | undefined {
  return pageStates(currentFiberAncestors(node))?.owned;
}
