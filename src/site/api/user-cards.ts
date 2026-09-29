import { isRecord } from '@/core/guards';
import { siteRequest } from './request';

export interface DiscardResult {
  /** Nouveau solde de wikibidous (+1), si le site le renvoie. */
  readonly balance: number | undefined;
}

/**
 * Défausse un exemplaire (`user_cards.id`, pas l'id de la carte) : même requête que le bouton
 * « Défausser » de la modale de carte du site. 409 si l'exemplaire n'existe plus.
 */
export function discardUserCard(userCardId: string): Promise<DiscardResult> {
  return siteRequest(`/api/user-cards/${encodeURIComponent(userCardId)}/discard`, { method: 'POST' }, (raw) => ({
    balance: isRecord(raw) && typeof raw.balance === 'number' ? raw.balance : undefined,
  }));
}
