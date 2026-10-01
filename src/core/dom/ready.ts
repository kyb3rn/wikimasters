/** Attente partagée de `<body>` : une seule promesse et un seul observateur pour tout le script. */
let pending: Promise<HTMLElement> | undefined;

function bodyArrival(): Promise<HTMLElement> {
  pending ??= new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const { body } = document;
      if (!body) return;
      observer.disconnect();
      pending = undefined;
      resolve(body);
    });
    // Au tout début du chargement, même `<html>` n'existe pas encore : on observe le document.
    observer.observe(document, { childList: true, subtree: true });
  });
  return pending;
}

/**
 * Attend que `document.body` existe. Le script démarre à `document-start`, avant le HTML : tout ce qui touche
 * au DOM commence par là. Avec un signal : `undefined` dès qu'il est interrompu (fonctionnalité démontée).
 */
export function whenBody(): Promise<HTMLElement>;
export function whenBody(signal: AbortSignal): Promise<HTMLElement | undefined>;
export function whenBody(signal?: AbortSignal): Promise<HTMLElement | undefined> {
  if (signal?.aborted) return Promise.resolve(undefined);
  const { body } = document;
  if (body) return Promise.resolve(body);
  const arrival = bodyArrival();
  if (!signal) return arrival;
  return new Promise((resolve) => {
    const abort = () => resolve(undefined);
    signal.addEventListener('abort', abort, { once: true });
    void arrival.then((element) => {
      signal.removeEventListener('abort', abort);
      resolve(signal.aborted ? undefined : element);
    });
  });
}
