import type { SiteNotification } from '@/site/notifications';

export interface Arrivals {
  /** Liste reçue par `GET /api/notifications` : la première sert de point de départ (rien à montrer). */
  listed(ids: readonly string[]): void;
  /** Liste lue dans l'état du site : les notifications non lues qu'on n'avait jamais vues, des plus anciennes aux plus récentes. */
  seen(notifications: readonly SiteNotification[]): SiteNotification[];
}

/**
 * Nouvelles notifications du site, à montrer en toast. Celles déjà là au chargement de la page (ou au montage) ne
 * sont pas nouvelles : la première liste, reçue du réseau ou lue non vide dans l'état du site, les range toutes
 * parmi les connues. Ensuite, toute notification inconnue et non lue est nouvelle : diffusion en temps réel, ou
 * relecture qui rattrape une coupure.
 */
export function createArrivals(): Arrivals {
  const known = new Set<string>();
  let ready = false;
  return {
    listed(ids) {
      if (ready) return;
      for (const id of ids) known.add(id);
      ready = true;
    },
    seen(notifications) {
      const fresh = notifications.filter((notification) => !known.has(notification.id));
      for (const notification of fresh) known.add(notification.id);
      if (!ready) {
        ready = notifications.length > 0;
        return [];
      }
      return fresh.filter((notification) => !notification.read).reverse();
    },
  };
}
