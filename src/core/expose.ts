/**
 * `window.wm` : les commandes de console du script.
 *
 * Chaque module déclare les siennes en augmentant `WmApi`, toujours en propriété optionnelle
 * (elles n'existent que tant que le module tourne) :
 *
 *     declare module '@/core/expose' {
 *       interface WmApi { debug?: DebugConsole }
 *     }
 */
export interface WmApi {
  readonly version: string;
  readonly dev: boolean;
}

declare global {
  interface Window {
    wm?: WmApi;
  }
}

type Command = Exclude<keyof WmApi, 'version' | 'dev'>;

export function initConsole(base: WmApi): void {
  window.wm = { ...base };
}

/** Ajoute `window.wm[key]`, retiré quand `signal` est interrompu. */
export function expose<K extends Command>(key: K, value: NonNullable<WmApi[K]>, signal?: AbortSignal): void {
  const wm = window.wm;
  if (!wm || signal?.aborted) return;
  wm[key] = value;
  signal?.addEventListener(
    'abort',
    () => {
      if (wm[key] === value) delete wm[key];
    },
    { once: true },
  );
}
