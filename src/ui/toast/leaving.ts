import type { Toast } from './store';

export interface ShownToast {
  readonly toast: Toast;
  /** Retiré de la file : il s'efface, puis la pile se referme sur sa place. */
  readonly leaving: boolean;
}

/**
 * Toasts à afficher après un changement de la file : ceux qu'elle vient de retirer restent à leur place, en
 * sortie (sauf sans animation), les nouveaux s'ajoutent au bout (la file n'ajoute qu'au bout).
 */
export function withLeaving(shown: readonly ShownToast[], current: readonly Toast[], animate: boolean): ShownToast[] {
  const byId = new Map(current.map((toast) => [toast.id, toast]));
  const next: ShownToast[] = [];
  for (const item of shown) {
    const toast = byId.get(item.toast.id);
    if (toast) next.push({ toast, leaving: false });
    else if (animate) next.push(item.leaving ? item : { toast: item.toast, leaving: true });
  }
  const known = new Set(shown.map((item) => item.toast.id));
  for (const toast of current) if (!known.has(toast.id)) next.push({ toast, leaving: false });
  return next;
}

/** Sortie finie : le toast quitte l'affichage. */
export function withoutToast(shown: readonly ShownToast[], id: number): ShownToast[] {
  return shown.filter((item) => item.toast.id !== id || !item.leaving);
}
