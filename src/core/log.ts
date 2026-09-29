export interface Logger {
  /** Détail de mise au point : version de dev seulement. */
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Journal préfixé `[WM <scope>]` (ou `[WM]`), pour filtrer la console du site.
 * Seul module autorisé à écrire directement dans la console.
 */
export function createLogger(scope?: string): Logger {
  const prefix = scope ? `[WM ${scope}]` : '[WM]';
  return {
    debug: (...args) => {
      if (__DEV__) console.log(prefix, ...args);
    },
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

/** Message lisible d'une erreur quelconque. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
