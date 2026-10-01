import { FACE, FACE_TEXT, findFaceImage } from '@/site/cards';

/*
 * Accueil de guilde, cadre « Liste de souhaits » (capture du 01/10/2026) : une face `sm` par demande d'un membre
 * (`home.wishlist` de `GET /api/guilds`). Sous la description, au-dessus d'ATK · DEF :
 *   div.mt-auto.flex.flex-col.items-start.gap-0.5.pt-1
 *     div.min-w-0.max-w-full.shrink-0 > span.rounded-full.bg-black/55[title]   « pseudo », ou « pseudo · reçu aujourd'hui »
 *     div.flex.justify-between.border-t                                       ATK · DEF
 * « reçu aujourd'hui » : `recipient_received_today`, le membre a déjà reçu une carte aujourd'hui.
 */
const REQUESTER_PILL = `${FACE} ${FACE_TEXT} > div.mt-auto > div > span.rounded-full[title]`;
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

/** Auteurs des demandes de la liste de souhaits de la guilde affichées. */
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
