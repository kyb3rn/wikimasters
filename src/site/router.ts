import { isRecord } from '@/core/guards';
import { findPropsAbove } from '@/core/react';

/**
 * Routeur de Next.js (App Router) : l'objet que renvoie `useRouter()` dans le code du site, fourni
 * par un contexte React. Le site y navigue par `router.push('/marketplace/<id>')` (après une mise aux
 * enchères, par exemple). Trouvé en remontant l'état React depuis `<main>`.
 */
export interface NextRouter {
  push(href: string, options?: unknown): unknown;
  replace(href: string, options?: unknown): unknown;
  prefetch(href: string, options?: unknown): unknown;
}

function isRouter(value: unknown): value is NextRouter {
  return (
    isRecord(value) &&
    typeof value.push === 'function' &&
    typeof value.replace === 'function' &&
    typeof value.prefetch === 'function'
  );
}

export function findNextRouter(doc: Document = document): NextRouter | undefined {
  for (const element of [doc.querySelector('main'), doc.body, doc.documentElement]) {
    const value = element && findPropsAbove(element, (props) => isRouter(props.value))?.props.value;
    if (isRouter(value)) return value;
  }
  return undefined;
}

/** Renvoie vrai pour empêcher la navigation vers `href`. */
export type PushGuard = (href: string) => boolean;

type Push = (href: string, options?: unknown) => unknown;

const guards = new Set<PushGuard>();
/** `push` d'origine de chaque routeur enveloppé, lié à son routeur. */
const originalPush = new WeakMap<NextRouter, Push>();
let router: NextRouter | undefined;
let polling: ReturnType<typeof setInterval> | undefined;

/**
 * Enveloppe `router.push` (le site l'appelle par `router.push(…)`, donc passe par nous) : une
 * navigation qu'une garde refuse n'a pas lieu. Une seule enveloppe par routeur.
 */
export function wrapPush(target: NextRouter, shouldBlock: PushGuard): void {
  if (originalPush.has(target)) return;
  const original: Push = target.push.bind(target);
  originalPush.set(target, original);
  target.push = (href: string, options?: unknown) => {
    if (typeof href === 'string' && shouldBlock(href)) return undefined;
    return original(href, options);
  };
}

function blocked(href: string): boolean {
  for (const guard of [...guards]) {
    try {
      if (guard(href)) return true;
    } catch {
      // Une garde défaillante ne bloque rien.
    }
  }
  return false;
}

/** Trouve le routeur et l'enveloppe ; vrai si c'est fait. */
export function ensureRouterGuards(doc: Document = document): boolean {
  const found = findNextRouter(doc);
  if (found && found !== router) {
    router = found;
    wrapPush(found, blocked);
  }
  return router !== undefined;
}

/**
 * Ajoute une garde sur les navigations du site. Le routeur n'existe qu'une fois React démarré :
 * on le cherche jusqu'à le trouver.
 */
export function guardRouterPush(guard: PushGuard, options: { signal: AbortSignal }): void {
  if (options.signal.aborted) return;
  guards.add(guard);
  options.signal.addEventListener('abort', () => guards.delete(guard), { once: true });
  if (ensureRouterGuards() || polling) return;
  polling = setInterval(() => {
    if (guards.size === 0 || ensureRouterGuards()) {
      clearInterval(polling);
      polling = undefined;
    }
  }, 300);
}

/** Navigation du site vers `href` (sans passer par nos gardes), ou chargement de la page à défaut. */
export function navigateTo(href: string): void {
  const target = router ?? findNextRouter();
  if (!target) {
    location.assign(href);
    return;
  }
  const original = originalPush.get(target);
  if (original) original(href);
  else void target.push(href);
}
