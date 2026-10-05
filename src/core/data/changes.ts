import { isRecord } from '@/core/guards';
import { createListeners, type Listeners } from '@/core/listeners';
import { createLogger } from '@/core/log';

const CHANNEL = 'wm-data';
const log = createLogger('mémoire');
const byId = new Map<string, Listeners<[]>>();
/** `null` : BroadcastChannel indisponible, les autres onglets ne sont pas prévenus. */
let channel: BroadcastChannel | null | undefined;

function listenersOf(id: string): Listeners<[]> {
  let listeners = byId.get(id);
  if (!listeners) {
    listeners = createListeners(log, `abonné à « ${id} »`);
    byId.set(id, listeners);
  }
  return listeners;
}

function connect(): void {
  if (channel !== undefined) return;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isRecord(event.data) && typeof event.data.id === 'string') byId.get(event.data.id)?.emit();
    };
  } catch {
    channel = null;
  }
}

/**
 * Une donnée a changé hors de son module (suppression, import depuis la fenêtre Mémoire) : ceux qui en gardent une
 * copie la relisent, dans cet onglet et dans les autres onglets du site.
 */
export function announceDataChange(id: string): void {
  byId.get(id)?.emit();
  connect();
  channel?.postMessage({ id });
}

/** Prévenu quand la donnée `id` change hors de son module, ici ou dans un autre onglet. */
export function onDataChange(id: string, listener: () => void, options: { signal: AbortSignal }): void {
  connect();
  listenersOf(id).on(listener, options);
}
