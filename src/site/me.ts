import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net } from '@/core/net';
import { jsonStore } from '@/core/storage';
import { isFriendsList, isMyProfileRpc, parseFriendships, parsePlayer, supabaseUserId } from '@/site/api';

/**
 * Joueur connecté (id, pseudo). Le site ne l'affiche nulle part en entier (son lien de profil est `/profile`) ; il
 * le reçoit dans son profil (`rpc/sync_profile_packs`, `rpc/get_my_profile` : `{ id, username, … }`) et dans ses
 * amitiés (`GET /api/friends` : `requester` / `addressee`, dont lui). Le script ne demande rien : il lit ces
 * réponses et retient le dernier vu, pour le connaître dès le chargement suivant.
 */
export interface Me {
  readonly id: string;
  readonly username: string;
}

const parseMe = (raw: unknown): Me | undefined => {
  const player = parsePlayer(raw);
  return player?.username ? { id: player.id, username: player.username } : undefined;
};

const store = jsonStore<Me | undefined>('wm-me-v1', undefined, parseMe);
const changes = createListeners(createLogger('joueur'));
let tracking = false;

/** Le joueur `userId` dans une réponse de son profil ou de ses amitiés. */
export function findMe(body: unknown, userId: string | undefined): Me | undefined {
  const profile = parseMe(body);
  if (profile) return userId === undefined || profile.id === userId ? profile : undefined;
  if (!userId) return undefined;
  for (const friendship of parseFriendships(body)) {
    for (const player of [friendship.requester, friendship.addressee]) {
      const me = parseMe(player);
      if (me?.id === userId) return me;
    }
  }
  return undefined;
}

function update(me: Me): void {
  const known = store.get();
  if (known?.id === me.id && known.username === me.username) return;
  store.set(me);
  changes.emit();
}

/** Suit le joueur connecté dans les réponses du site, pour toute la vie du script (appelé une fois, au démarrage). */
export function trackMe(): void {
  if (tracking) return;
  tracking = true;
  net.observe(
    (request) => !request.own && (isMyProfileRpc(request) || isFriendsList(request)),
    async (exchange) => {
      if (!exchange.ok) return;
      const me = findMe(await exchange.json().catch(() => undefined), supabaseUserId());
      if (me) update(me);
    },
  );
}

/** Pseudo du joueur connecté, s'il est connu (et que la session du site n'est pas celle d'un autre compte). */
export function myUsername(): string | undefined {
  const me = store.get();
  const userId = supabaseUserId();
  return me && (userId === undefined || userId === me.id) ? me.username : undefined;
}

export function onMeChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}
