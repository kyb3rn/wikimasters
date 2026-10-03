import { childController, sleep } from '@/core/async';
import { isRecord } from '@/core/guards';
import { findPageReact, renderPageComponent } from '@/core/page-react';
import { currentFiberAncestors, providedContexts } from '@/core/react';
import { pageModules, type ModuleId, type PageModules } from '@/core/turbopack';
import { findNextRouter } from './router';

/*
 * Fenêtres du site (composants rendus en portail dans `body`) ouvertes par le script là où le site ne les offre pas :
 * fenêtre d'échange sur un profil et dans /dms, conversation sur un profil (code du site du 03/10/2026).
 *
 * Le composant est pris parmi les modules de la page. Une page qui ne l'importe pas n'a pas son code : le routeur du
 * site précharge alors en entier une page qui l'importe (`router.prefetch(page, { kind: 'full' })`, comme un lien
 * préchargé, sans rien afficher) ; en lisant la réponse, React charge le code de ses composants (`e.L(<morceau>)`
 * pour chaque morceau listé). Le module n'est demandé qu'une fois ces morceaux exécutés : demandé trop tôt, il
 * échouerait faute d'une dépendance, et Turbopack garderait cet échec, pour le site aussi.
 */

export type ModuleLocation = { readonly module: ModuleId } | { readonly loader: ModuleId };

export interface SiteWindowComponent {
  /** Pour les journaux : « fenêtre d'échange ». */
  readonly name: string;
  /** Son module parmi les fabriques inscrites, sinon le chargeur dynamique d'une enveloppe qui l'importe. */
  readonly locate: (sources: Iterable<readonly [ModuleId, string]>) => ModuleLocation | undefined;
  /** Page du site qui l'importe, préchargée s'il n'est pas dans celle-ci. */
  readonly route: string;
}

/** Le site a changé (composant, React ou routeur introuvable). */
export class SiteWindowUnavailable extends Error {
  override readonly name = 'SiteWindowUnavailable';
}

/** Même nom que l'erreur de Turbopack pour un morceau de code pas reçu : une panne réseau. */
class ChunkLoadError extends Error {
  override readonly name = 'ChunkLoadError';
}

const CHUNK_SCRIPT = 'script[src*="/_next/static/chunks/"]';
const POLL_MS = 200;
/** Le site met jusqu'à 18 s à répondre (README). */
const PREFETCH_TIMEOUT_MS = 20_000;

/** Morceaux de code ajoutés à la page (Turbopack les pose dans `<head>`) : en cours tant qu'ils ne sont pas exécutés. */
function watchChunks(signal: AbortSignal): { readonly pending: () => boolean; readonly failed: () => boolean } {
  const loading = new Set<HTMLScriptElement>();
  let failed = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLScriptElement) || !node.matches(CHUNK_SCRIPT)) continue;
        loading.add(node);
        node.addEventListener('load', () => loading.delete(node), { once: true });
        node.addEventListener(
          'error',
          () => {
            loading.delete(node);
            failed = true;
          },
          { once: true },
        );
      }
    }
  });
  observer.observe(document.head, { childList: true });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  return { pending: () => loading.size > 0, failed: () => failed };
}

async function locateLoaded(modules: PageModules, component: SiteWindowComponent, signal: AbortSignal): Promise<ModuleLocation> {
  const ready = (found: ModuleLocation | undefined): found is ModuleLocation =>
    found !== undefined && ('loader' in found || modules.has(found.module));
  const found = component.locate(modules.sources());
  if (ready(found)) return found;

  const router = findNextRouter();
  if (!router) throw new SiteWindowUnavailable(`${component.name} absente de la page, routeur du site introuvable`);
  const controller = childController(signal);
  try {
    const chunks = watchChunks(controller.signal);
    void router.prefetch(component.route, { kind: 'full' });
    const deadline = performance.now() + PREFETCH_TIMEOUT_MS;
    for (;;) {
      await sleep(POLL_MS, signal);
      if (signal.aborted) throw new SiteWindowUnavailable('page quittée');
      if (chunks.failed()) throw new ChunkLoadError(`morceau de code de ${component.route} pas reçu`);
      const loaded = component.locate(modules.sources());
      if (ready(loaded) && !chunks.pending()) return loaded;
      if (performance.now() >= deadline) {
        throw new SiteWindowUnavailable(`${component.name} introuvable après le préchargement de ${component.route}`);
      }
    }
  } finally {
    controller.abort();
  }
}

function defaultOf(namespace: unknown, name: string): unknown {
  const component = isRecord(namespace) ? namespace.default : undefined;
  if (typeof component !== 'function') throw new SiteWindowUnavailable(`${name} : module sans composant`);
  return component;
}

export interface SiteWindowOptions {
  /** Nœud de l'arbre du site sous lequel lire les contextes à refournir. */
  readonly contextFrom: Node;
  /** Props par lesquelles le site ferme la fenêtre (`onClose`, `onSent` après un envoi…). */
  readonly closeProps: readonly string[];
  /** Ouverture abandonnée (page quittée) : rien n'est rendu, la promesse est rejetée. */
  readonly signal: AbortSignal;
  /** Fenêtre fermée par le site (croix, Annuler, Échap, envoi). */
  readonly onClosed?: () => void;
  /** Erreur pendant un rendu de la fenêtre (elle disparaît). */
  readonly onError?: (error: unknown) => void;
}

export interface OpenedSiteWindow {
  /** Rend la fenêtre avec d'autres props (celles de fermeture restent les nôtres). */
  update(props: Readonly<Record<string, unknown>>): void;
  close(): void;
}

/**
 * Ouvre une fenêtre du site avec ces props. Rejet : `SiteWindowUnavailable` (le site a changé), `ChunkLoadError`
 * (morceau de code pas reçu).
 */
export async function openSiteWindow(
  component: SiteWindowComponent,
  props: Readonly<Record<string, unknown>>,
  { contextFrom, closeProps, signal, onClosed, onError }: SiteWindowOptions,
): Promise<OpenedSiteWindow> {
  const modules = await pageModules();
  if (!modules) throw new SiteWindowUnavailable('modules de la page illisibles');
  const react = findPageReact(modules.loaded());
  if (!react) throw new SiteWindowUnavailable('React de la page introuvable');
  const found = await locateLoaded(modules, component, signal);
  const namespace = 'module' in found ? modules.require(found.module) : await modules.load(found.loader);
  const type = defaultOf(namespace, component.name);
  if (signal.aborted) throw new SiteWindowUnavailable('page quittée');
  const contexts = providedContexts(currentFiberAncestors(contextFrom));

  let open = true;
  const close = (): void => {
    if (!open) return;
    open = false;
    handle.unmount();
  };
  const closedBySite = (): void => {
    if (!open) return;
    close();
    onClosed?.();
  };
  const handlers = Object.fromEntries(closeProps.map((name) => [name, closedBySite]));
  const handle = renderPageComponent(
    react,
    type,
    { ...props, ...handlers },
    {
      contexts,
      onError: (error) => {
        close();
        onError?.(error);
      },
    },
  );
  return {
    update: (next) => {
      if (open) handle.update({ ...next, ...handlers });
    },
    close,
  };
}
