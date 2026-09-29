import type { Logger } from '@/core/log';

/** Journal muet qui garde les messages, pour vérifier qu'une erreur a bien été signalée. */
export function memoryLogger(): Logger & { readonly errors: unknown[][]; readonly warnings: unknown[][] } {
  const errors: unknown[][] = [];
  const warnings: unknown[][] = [];
  return {
    errors,
    warnings,
    debug: () => {},
    info: () => {},
    warn: (...args) => warnings.push(args),
    error: (...args) => errors.push(args),
  };
}

/** Diffusion Supabase Realtime binaire, telle que le serveur l'envoie (voir `site/realtime`). */
export function realtimeFrame(topic: string, event: string, metadata: unknown, payload: unknown): Uint8Array {
  const utf8 = new TextEncoder();
  const [t, e, m, p] = [topic, event, JSON.stringify(metadata), JSON.stringify(payload)].map((s) => utf8.encode(s)) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
  return Uint8Array.from([4, t.length, e.length, m.length, 1, ...t, ...e, ...m, ...p]);
}

/** Laisse passer les microtâches et tâches en attente (observateurs réseau, promesses). */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
