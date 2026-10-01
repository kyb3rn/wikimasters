import { isRecord } from '@/core/guards';
import { currentFiberAncestors, fiberOf, stateHooks } from '@/core/react';
import { textOf } from '@/core/text';
import { friendOf, parsePlayer, type Friendship, type Player } from '@/site/api';
import { SITE_OVERLAY } from '@/site/modals';

/*
 * « Choisir un ami » de /trades (« Nouvel échange », code du site, 30/09/2026) : portail dans `body`, fond
 * `fixed inset-0 z-50`, cadre `max-w-md max-h-[80vh]`, en-tête (`h2`, croix), champ « Rechercher... » (plus de 3
 * amis ; filtre local sur le pseudo), liste `div.overflow-y-auto` : roue pendant le chargement, « Aucun ami pour le
 * moment. » / « Aucun résultat. », ou une ligne `button` par ami (clé React = id du joueur : photo, pseudo,
 * « Échanger → »). Composant `{ currentUserId, onSelect, onClose }`, états : amis (`{ id, username, avatar_url,
 * avatar_pos_x, avatar_pos_y }`), chargement, recherche. À l'ouverture, `GET /api/friends` (amitiés acceptées,
 * l'autre joueur de chacune) ; réponse en erreur ou échec réseau : liste vide, comme sans ami. Un clic sur une
 * ligne : `onSelect(ami)`, la page ferme la fenêtre et ouvre « Échanger avec … ». Pas d'Échap.
 */

export interface PickerFriend extends Player {
  /** L'ami tel que le site le garde (ce que reçoit `onSelect`). */
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface FriendPicker {
  readonly root: HTMLElement;
  readonly currentUserId: string;
  readonly friends: readonly PickerFriend[];
  readonly loading: boolean;
  select(friend: PickerFriend): void;
  close(): void;
  /** Remplace la liste du site (nouvel essai après un échec) et arrête sa roue. */
  setFriends(friends: readonly Readonly<Record<string, unknown>>[]): void;
  /** Photo affichée par le site pour cet ami (floutée si besoin, selon ses réglages). */
  avatarOf(id: string): HTMLElement | undefined;
  /** Joueurs avec qui un échange est en attente, d'après la page ; `undefined` si illisible. */
  readonly pendingPartners: ReadonlySet<string> | undefined;
}

const TITLE = 'Choisir un ami';

function parseFriend(value: unknown): PickerFriend[] {
  const player = parsePlayer(value);
  return player && isRecord(value) ? [{ ...player, raw: value }] : [];
}

const isTrade = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && typeof value.status === 'string' && typeof value.initiator_id === 'string';

/** Échanges de la page (état de /trades), trouvés au-dessus de la fenêtre. */
function pendingPartnersAbove(fibers: ReturnType<typeof currentFiberAncestors>, me: string): Set<string> | undefined {
  for (const fiber of fibers) {
    const trades = stateHooks(fiber).find((hook) => Array.isArray(hook.value) && hook.value.length > 0 && hook.value.every(isTrade));
    if (!trades) continue;
    const partners = new Set<string>();
    for (const trade of trades.value as Record<string, unknown>[]) {
      if (trade.status !== 'pending') continue;
      const other = trade.initiator_id === me ? trade.recipient_id : trade.initiator_id;
      if (typeof other === 'string') partners.add(other);
    }
    return partners;
  }
  return undefined;
}

export function findFriendPicker(doc: Document = document): FriendPicker | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    const title = root.querySelector(':scope > div > div > h2');
    if (!title || textOf(title) !== TITLE) continue;
    const fibers = currentFiberAncestors(title);
    const index = fibers.findIndex((fiber) => {
      const props = fiber.memoizedProps;
      return isRecord(props) && typeof props.currentUserId === 'string' && typeof props.onSelect === 'function';
    });
    const fiber = fibers[index];
    if (!fiber || !isRecord(fiber.memoizedProps)) continue;
    const props = fiber.memoizedProps;
    const states = stateHooks(fiber);
    const list = states.find((hook) => Array.isArray(hook.value));
    const loading = states.find((hook) => typeof hook.value === 'boolean');
    const me = props.currentUserId as string;
    const onSelect = props.onSelect as (friend: unknown) => void;
    const onClose = typeof props.onClose === 'function' ? (props.onClose as () => void) : undefined;
    const rows = new Map<string, HTMLElement>();
    for (const row of root.querySelectorAll<HTMLElement>('div.overflow-y-auto > button')) {
      const key = fiberOf(row)?.key;
      if (key) rows.set(key, row);
    }
    return {
      root,
      currentUserId: me,
      friends: Array.isArray(list?.value) ? list.value.flatMap(parseFriend) : [],
      loading: loading?.value === true,
      select: (friend) => onSelect(friend.raw),
      close: () => onClose?.(),
      setFriends: (friends) => {
        list?.set([...friends]);
        loading?.set(false);
      },
      avatarOf: (id) => rows.get(id)?.querySelector<HTMLElement>(':scope > div') ?? undefined,
      pendingPartners: pendingPartnersAbove(fibers.slice(index + 1), me),
    };
  }
  return undefined;
}

/** Amis, comme le site les garde : l'autre joueur de chaque amitié acceptée de `me` (`GET /api/friends`). */
export function acceptedFriends(friendships: readonly Friendship[], me: string): Record<string, unknown>[] {
  return friendships.flatMap((friendship) => {
    const other = friendOf(friendship, me).player;
    if (friendship.status !== 'accepted' || !parsePlayer(other) || !isRecord(other)) return [];
    const { id, username, avatar_url, avatar_pos_x, avatar_pos_y } = other;
    return [{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }];
  });
}

/** Date de chaque amitié acceptée de `me` (`created_at`, en ms), par id de l'ami. */
export function friendshipDates(friendships: readonly Friendship[], me: string): Map<string, number> {
  const dates = new Map<string, number>();
  for (const friendship of friendships) {
    const { id } = friendOf(friendship, me);
    const time = typeof friendship.created_at === 'string' ? Date.parse(friendship.created_at) : NaN;
    if (friendship.status === 'accepted' && typeof id === 'string' && Number.isFinite(time)) dates.set(id, time);
  }
  return dates;
}
