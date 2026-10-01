import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { jsonStore } from '@/core/storage';

/** Notification du script (« Enchère publiée »…), gardée avec celles du site dans la liste de la cloche. */
export interface LocalNotification {
  readonly id: string;
  readonly title?: string;
  readonly message: string;
  readonly variant: LocalVariant;
  /** Horodatage (ms). */
  readonly createdAt: number;
  readonly read: boolean;
  /** Page ouverte par un clic sur la notification. */
  readonly href?: string;
  /** Libellé du lien de son toast (« Voir l'enchère ») ; « Voir » par défaut. */
  readonly actionLabel?: string;
}

export type LocalVariant = 'success' | 'info';

const KEY = 'wm-notifications-v1';
/** Comme la liste du site : les 50 dernières. */
const MAX = 50;

function parseOne(raw: unknown): LocalNotification | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, title, message, variant, createdAt, read, href, actionLabel } = raw;
  if (typeof id !== 'string' || typeof message !== 'string' || typeof createdAt !== 'number') return undefined;
  if (variant !== 'success' && variant !== 'info') return undefined;
  return {
    id,
    ...(typeof title === 'string' && { title }),
    message,
    variant,
    createdAt,
    read: read === true,
    ...(typeof href === 'string' && { href }),
    ...(typeof actionLabel === 'string' && { actionLabel }),
  };
}

const store = jsonStore<readonly LocalNotification[]>(KEY, [], (raw) =>
  Array.isArray(raw) ? raw.flatMap((item) => parseOne(item) ?? []) : undefined,
);

const changes = createListeners(createLogger('notifications'), 'abonné aux notifications du script');
let watchingTabs = false;

/** Plus récentes d'abord. */
export function localNotifications(): readonly LocalNotification[] {
  return store.get();
}

/** Prévenu à chaque changement, ici ou dans un autre onglet. */
export function onLocalNotificationsChange(listener: () => void, options: { signal: AbortSignal }): void {
  if (!watchingTabs) {
    watchingTabs = true;
    window.addEventListener('storage', (event) => {
      if (event.key === KEY) changes.emit();
    });
  }
  changes.on(listener, options);
}

/** Par `notify` seulement : une notification du script est toujours aussi montrée en toast. */
export function addLocalNotification(notification: Omit<LocalNotification, 'id' | 'createdAt' | 'read'>): LocalNotification {
  const added: LocalNotification = {
    ...notification,
    id: `wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    read: false,
  };
  store.update((current) => [added, ...current].slice(0, MAX));
  changes.emit();
  return added;
}

/** Toutes sans `ids`. */
export function markLocalRead(ids?: readonly string[]): void {
  const wanted = ids && new Set(ids);
  const current = store.get();
  if (!current.some((item) => !item.read && (!wanted || wanted.has(item.id)))) return;
  store.set(current.map((item) => (item.read || (wanted && !wanted.has(item.id)) ? item : { ...item, read: true })));
  changes.emit();
}
