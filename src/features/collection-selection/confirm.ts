/**
 * « Défausser tout » en deux clics, comme une carte protégée dans la modale de carte : le premier passe le
 * bouton en « Confirmer ? », inactif un instant (un double-clic ne défausse pas), puis actif un temps.
 */
export const CONFIRM_DELAY_MS = 750;
export const CONFIRM_ACTIVE_MS = 3500;

/** `idle` : « Défausser tout » ; `waiting` : « Confirmer ? » inactif ; `asking` : « Confirmer ? » à cliquer. */
export type ConfirmStage = 'idle' | 'waiting' | 'asking';

export function confirmStage(since: number | undefined, now: number): ConfirmStage {
  if (since === undefined) return 'idle';
  const elapsed = now - since;
  if (elapsed < 0 || elapsed >= CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS) return 'idle';
  return elapsed < CONFIRM_DELAY_MS ? 'waiting' : 'asking';
}

/** « 3 sélectionnées », « 1 sélectionnée », « 0 sélectionnée ». */
export function selectedLabel(count: number): string {
  return count > 1 ? 'sélectionnées' : 'sélectionnée';
}
