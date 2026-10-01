import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { jsonStore } from '@/core/storage';
import { isMyProfileRpc, supabaseUserId } from '@/site/api';

/**
 * Compte PRO ou non (code du site du 30/09/2026). Le site lit `profiles.is_pro` de l'utilisateur
 * (`GET SB /rest/v1/profiles?select=is_pro&id=eq.<uid>`, gardé 5 min, relu au retour sur l'onglet), le reçoit
 * aussi de `rpc/get_my_profile`, de `rpc/sync_profile_packs` et du résumé des ventes (`sales?scope=summary` :
 * `isPro`), et annonce chaque changement par l'événement `wikimasters:is-pro-changed` (detail : booléen).
 * Réservé aux comptes PRO : les ventes d'une carte (`GET /api/marketplace/cards/<id>/sales`, erreur sinon).
 *
 * Le script ne demande rien : il lit ce que le site reçoit. Le dernier statut vu est retenu, pour être connu
 * dès le chargement suivant.
 */
const CHANGE_EVENT = 'wikimasters:is-pro-changed';

const store = jsonStore<boolean | undefined>('wm-pro-v1', undefined, (raw) => (typeof raw === 'boolean' ? raw : undefined));
const changes = createListeners(createLogger('pro'));
let tracking = false;

/** Réponse où le site reçoit le statut de l'utilisateur `userId` (`undefined` : inconnu). */
export function isProStatusRead(request: NetRequest, userId: string | undefined): boolean {
  if (isMyProfileRpc(request)) return true;
  const path = request.url.pathname;
  if (request.method === 'GET' && path.endsWith('/rest/v1/profiles')) {
    return userId !== undefined && request.url.searchParams.get('id') === `eq.${userId}`;
  }
  return request.method === 'GET' && /^\/api\/marketplace\/cards\/[^/]+\/sales$/.test(path) && request.url.searchParams.get('scope') === 'summary';
}

/** Statut lu dans une de ces réponses : `is_pro` du profil (objet ou liste d'un profil), `isPro` du résumé. */
export function parseProStatus(body: unknown): boolean | undefined {
  const record: unknown = Array.isArray(body) ? (body.length === 1 ? (body[0] as unknown) : undefined) : body;
  if (!isRecord(record)) return undefined;
  if (typeof record.is_pro === 'boolean') return record.is_pro;
  return typeof record.isPro === 'boolean' ? record.isPro : undefined;
}

function update(pro: boolean): void {
  if (store.get() === pro) return;
  store.set(pro);
  changes.emit();
}

/** Suit le statut dans les réponses du site, pour toute la vie du script (appelé une fois, au démarrage). */
export function trackProStatus(): void {
  if (tracking) return;
  tracking = true;
  net.observe(
    (request) => !request.own && isProStatusRead(request, supabaseUserId()),
    async (exchange) => {
      if (!exchange.ok) return;
      const pro = parseProStatus(await exchange.json().catch(() => undefined));
      if (pro !== undefined) update(pro);
    },
  );
  window.addEventListener(CHANGE_EVENT, (event) => {
    const detail: unknown = (event as CustomEvent).detail;
    if (typeof detail === 'boolean') update(detail);
  });
}

/** Compte PRO ? `undefined` tant que le site ne l'a jamais dit. */
export function proStatus(): boolean | undefined {
  return store.get();
}

export function onProStatusChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}

/**
 * Ouvre l'offre PRO du site, comme son bouton « Débloquer avec WikiMasters PRO » (code du site du 30/09/2026) :
 * l'événement `wikimasters:open-pro-upgrade`, écouté par sa boutique (celle du solde), qui s'ouvre sur l'abonnement.
 */
export function openProUpgrade(): void {
  window.dispatchEvent(new CustomEvent('wikimasters:open-pro-upgrade'));
}
