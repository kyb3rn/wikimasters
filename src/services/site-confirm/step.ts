import { later } from '@/core/async';

/**
 * Action à confirmer d'un second clic (carte protégée dans la modale de carte, « Défausser tout » de la sélection) :
 * le premier passe le bouton en « Confirmer ? », inactif un instant (un double-clic ne confirme pas), puis actif un
 * temps, après quoi tout est oublié.
 */
export const CONFIRM_DELAY_MS = 750;
export const CONFIRM_ACTIVE_MS = 3500;

/** `idle` : rien à confirmer ; `waiting` : « Confirmer ? » inactif ; `asking` : « Confirmer ? » à cliquer. */
export type ConfirmStage = 'idle' | 'waiting' | 'asking';

export function confirmStage(since: number | undefined, now: number): ConfirmStage {
  if (since === undefined) return 'idle';
  const elapsed = now - since;
  if (elapsed < 0 || elapsed >= CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS) return 'idle';
  return elapsed < CONFIRM_DELAY_MS ? 'waiting' : 'asking';
}

/** Confirmation en deux clics d'une action, pour un bouton à la fois (`target`). */
export interface ConfirmStep<T> {
  /** Où en est la confirmation de ce bouton. */
  stage(target: T): ConfirmStage;
  /**
   * Clic sur le bouton : vrai s'il confirme l'action (« Confirmer ? » actif) ; sinon le premier clic commence la
   * confirmation, un clic pendant l'attente ne fait rien.
   */
  press(target: T): boolean;
}

/** `onChange` est appelé quand l'étape change d'elle-même (« Confirmer ? » qui s'active, puis qui expire). */
export function confirmStep<T>(options: { readonly onChange: () => void; readonly signal: AbortSignal }): ConfirmStep<T> {
  let current: { readonly target: T; readonly since: number } | undefined;
  const stage = (target: T) => (current?.target === target ? confirmStage(current.since, Date.now()) : 'idle');
  return {
    stage,
    press(target) {
      const now = stage(target);
      if (now === 'asking') {
        current = undefined;
        return true;
      }
      if (now === 'idle') {
        current = { target, since: Date.now() };
        later(options.onChange, CONFIRM_DELAY_MS + 20, options.signal);
        later(options.onChange, CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS + 20, options.signal);
        options.onChange();
      }
      return false;
    },
  };
}
