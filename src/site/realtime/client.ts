import { isRecord } from '@/core/guards';
import { currentFiberAncestors, refHooks } from '@/core/react';

/**
 * Client temps réel du site : celui de Supabase (realtime-js 2.99.2, lu dans le code du site le 02/10/2026), unique
 * pour toutes ses pages. Une WebSocket (`connectionState()`), des canaux (`channels`, `topic` = `realtime:<nom>`,
 * `state` : `closed`, `errored`, `joined`, `joining`, `leaving`). Après une coupure, il retente seul, de plus en plus
 * espacé (1, 2, 5 puis 10 s) : la WebSocket par `connect()`, chaque canal en erreur par `_rejoin()`. Un canal
 * rejoint rappelle son abonnement (`SUBSCRIBED`), à chaque fois : la page relit alors ce qu'elle a pu manquer.
 */
interface Timer {
  reset(): void;
}

interface SiteChannel {
  readonly topic: string;
  readonly state: string;
  readonly rejoinTimer: Timer;
  _rejoin(): void;
}

interface SiteRealtimeClient {
  readonly channels: readonly unknown[];
  connectionState(): string;
  connect(): void;
}

/** En direct, connexion ou abonnement en cours, ou coupé. */
export type RealtimeLink = 'live' | 'connecting' | 'down';

export interface SiteRealtime {
  /** État du canal `realtime:<name>` sur la WebSocket du site. */
  link(name: string): RealtimeLink;
  /**
   * Relance tout de suite ce que le client retenterait plus tard : la WebSocket si elle est fermée, et le canal
   * s'il est en erreur. Le reste suit son cours : nouvel essai espacé en cas d'échec, relecture par la page s'il
   * est rejoint.
   */
  reconnect(name: string): void;
}

const isTimer = (value: unknown): value is Timer => isRecord(value) && typeof value.reset === 'function';

function isChannel(value: unknown): value is SiteChannel {
  return (
    isRecord(value) &&
    typeof value.topic === 'string' &&
    typeof value.state === 'string' &&
    isTimer(value.rejoinTimer) &&
    typeof value._rejoin === 'function'
  );
}

function isClient(value: unknown): value is SiteRealtimeClient {
  return (
    isRecord(value) &&
    Array.isArray(value.channels) &&
    typeof value.connectionState === 'function' &&
    typeof value.connect === 'function'
  );
}

/** Client temps réel (`realtime`) d'un client Supabase du site, s'il a la forme attendue. */
export function readSiteRealtime(supabase: unknown): SiteRealtime | undefined {
  const client = isRecord(supabase) ? supabase.realtime : undefined;
  if (!isClient(client)) return undefined;
  const channel = (name: string) => client.channels.find((item): item is SiteChannel => isChannel(item) && item.topic === `realtime:${name}`);
  return {
    link(name) {
      const socket = client.connectionState();
      if (socket === 'connecting') return 'connecting';
      if (socket !== 'open') return 'down';
      // La page s'abonne une fois le jeton de session relu : pas encore de canal, c'est en cours.
      const state = channel(name)?.state ?? 'joining';
      if (state === 'joined') return 'live';
      return state === 'joining' ? 'connecting' : 'down';
    },
    reconnect(name) {
      // Pendant sa fermeture, le client la croit encore là : une nouvelle WebSocket ferait doublon.
      if (client.connectionState() === 'closed') client.connect();
      const target = channel(name);
      if (target?.state !== 'errored') return;
      // Sinon son prochain essai tomberait pendant le nôtre : le client y verrait un doublon et quitterait le canal.
      target.rejoinTimer.reset();
      target._rejoin();
    },
  };
}

/** Client temps réel du site, pris dans les références (`useRef`) d'un composant au-dessus de `node`. */
export function findSiteRealtime(node: Node): SiteRealtime | undefined {
  for (const fiber of currentFiberAncestors(node)) {
    for (const value of refHooks(fiber)) {
      const realtime = readSiteRealtime(value);
      if (realtime) return realtime;
    }
  }
  return undefined;
}
