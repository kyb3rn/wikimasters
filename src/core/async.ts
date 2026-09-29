/** Attend `ms` millisecondes ; se termine tout de suite si `signal` est interrompu. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted || ms <= 0) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}

/** Attend la prochaine image (`requestAnimationFrame`) ; tout de suite si `signal` est interrompu. */
export function nextFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const frame = requestAnimationFrame(done);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}

/**
 * Vérifie `test` tout de suite, puis à chaque image, jusqu'à ce qu'il soit vrai.
 * Faux à l'échéance (`timeoutMs`, sans limite par défaut) ou à l'interruption du signal.
 */
export async function waitUntil(test: () => boolean, options: { signal: AbortSignal; timeoutMs?: number }): Promise<boolean> {
  const deadline = performance.now() + (options.timeoutMs ?? Infinity);
  for (;;) {
    if (options.signal.aborted) return false;
    if (test()) return true;
    if (performance.now() >= deadline) return false;
    await nextFrame(options.signal);
  }
}

/** Contrôleur interrompu en même temps que `parent` (et interruptible seul). */
export function childController(parent: AbortSignal): AbortController {
  const controller = new AbortController();
  if (parent.aborted) controller.abort();
  else parent.addEventListener('abort', () => controller.abort(), { once: true, signal: controller.signal });
  return controller;
}
