import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { siteRequest } from './request';

export interface DiscardResult {
  /** Nouveau solde de wikibidous (+1), si le site le renvoie. */
  readonly balance: number | undefined;
}

/** Défausse d'un exemplaire : `POST /api/user-cards/<exemplaire>/discard` (bouton « Défausser » de la modale de carte). */
const DISCARD_PATH = /^\/api\/user-cards\/([^/]+)\/discard$/;

/**
 * Défausse un exemplaire (`user_cards.id`, pas l'id de la carte) : même requête que le bouton
 * « Défausser » de la modale de carte du site. 409 si l'exemplaire n'existe plus.
 */
export function discardUserCard(userCardId: string): Promise<DiscardResult> {
  return siteRequest(`/api/user-cards/${encodeURIComponent(userCardId)}/discard`, { method: 'POST' }, (raw) => ({
    balance: isRecord(raw) && typeof raw.balance === 'number' ? raw.balance : undefined,
  }));
}

/** Exemplaire défaussé (par le site ou par le script). */
export function readDiscard(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'POST') return undefined;
  const userCardId = DISCARD_PATH.exec(request.url.pathname)?.[1];
  return userCardId ? { userCardId: decodeURIComponent(userCardId) } : undefined;
}
