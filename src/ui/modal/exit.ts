import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { GHOST_CLASS, injectStyle, prefersReducedMotion, ROOT_CLASS } from '@/core/dom';
import { cx } from '@/ui/cx';
import { ensureBaseStyle, INLINE_CLASS } from '@/ui/theme';

const LEAVING = 'wm-modal-leaving';
const FRAME = 'wm-modal-leaving-frame';
/** Durée de la sortie : celle de l'entrée de nos modales (`wm-fade-in`). */
const MODAL_EXIT_MS = 180;

/*
 * L'entrée à l'envers : le tout s'efface, le cadre redescend de 6 px. Les autres animations de la copie
 * (entrées du site, roues) sont figées dans leur état final : remise dans la page, elle les rejouerait depuis
 * le début. Sélecteurs doublés de la copie : ils passent devant `animation: none !important` de card-modal-stay.
 */
const CSS = `
.${GHOST_CLASS} .${LEAVING} { pointer-events: none !important;
  animation: wm-modal-out ${MODAL_EXIT_MS}ms ease-in forwards !important; }
.${GHOST_CLASS} .${LEAVING} *:not(.${FRAME}) { animation: none !important; transition: none !important; }
.${GHOST_CLASS} .${LEAVING} .${FRAME} { animation: wm-modal-frame-out ${MODAL_EXIT_MS}ms ease-in forwards !important; }
@keyframes wm-modal-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes wm-modal-frame-out { from { transform: none; } to { transform: translateY(6px); } }
`;

/** Dernière position de défilement de chaque élément : un élément retiré de la page ne la donne plus. */
const scrolls = new WeakMap<Element, { readonly top: number; readonly left: number }>();

/** Retient les défilements de la page, pour rendre aux copies celui des modales que le site retire. */
export function trackScrolls({ signal }: { readonly signal: AbortSignal }): void {
  document.addEventListener(
    'scroll',
    (event) => {
      const target = event.target;
      if (target instanceof Element) scrolls.set(target, { top: target.scrollTop, left: target.scrollLeft });
    },
    { capture: true, passive: true, signal },
  );
}

/** Ce que `cloneNode` ne recopie pas : dessin des canevas, saisies, chargement différé des images. */
function copyLiveState(source: Element, copy: Element): void {
  if (source instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement) {
    try {
      copy.getContext('2d')?.drawImage(source, 0, 0);
    } catch {
      // Canevas vide ou d'un autre contexte : la copie reste blanche le temps du fondu.
    }
  } else if (source instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
    if (source.type !== 'file') copy.value = source.value;
    copy.checked = source.checked;
  } else if (source instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) {
    copy.value = source.value;
  } else if (source instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) {
    copy.selectedIndex = source.selectedIndex;
  } else if (copy instanceof HTMLImageElement) {
    copy.loading = 'eager';
  }
}

function copyScroll(source: Element, copy: Element): void {
  const scroll = source.isConnected ? { top: source.scrollTop, left: source.scrollLeft } : scrolls.get(source);
  if (!scroll || (scroll.top === 0 && scroll.left === 0)) return;
  copy.scrollTop = scroll.top;
  copy.scrollLeft = scroll.left;
}

export interface LeaveOptions {
  /** Où poser la copie : là où était la modale, pour qu'elle garde son ordre d'empilement et ce qui la cache. */
  readonly parent: Node;
  readonly before?: Node | null;
  /** Cadre de la modale : il redescend en s'effaçant. */
  readonly frame?: Element | undefined;
  /** Modale à nous : la copie reçoit notre style de base (`.wm-root`), qu'une modale du site ne doit pas avoir. */
  readonly own?: boolean;
}

/**
 * Fait disparaître une modale en fondu alors qu'elle est déjà (ou va être) retirée de la page : une copie
 * inerte prend sa place le temps de la sortie, puis s'en va. Rien si la modale était cachée (moteur caché d'une
 * fonctionnalité) ou si l'utilisateur a demandé moins d'animations. La modale elle-même n'est pas touchée.
 */
export function leaveSmoothly(overlay: HTMLElement, { parent, before = null, frame, own = false }: LeaveOptions): void {
  if (!parent.isConnected || prefersReducedMotion()) return;
  ensureBaseStyle();
  injectStyle('ui-modal-exit', CSS);

  const clone = overlay.cloneNode(true) as HTMLElement;
  clone.classList.add(LEAVING);
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  const sources = [overlay, ...overlay.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  sources.forEach((source, index) => {
    const copy = copies[index];
    if (copy) copyLiveState(source, copy);
  });
  // Le cadre est marqué sur sa copie : le vrai, encore à React (ou au site), ne reçoit aucune classe.
  if (frame) copies[sources.indexOf(frame)]?.classList.add(FRAME);

  const ghost = document.createElement('div');
  ghost.className = cx(ROOT_CLASS, GHOST_CLASS, !own && INLINE_CLASS);
  ghost.append(clone);
  parent.insertBefore(ghost, before?.parentNode === parent ? before : null);
  if (!clone.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
    ghost.remove();
    return;
  }
  sources.forEach((source, index) => {
    const copy = copies[index];
    if (copy) copyScroll(source, copy);
  });
  setTimeout(() => ghost.remove(), MODAL_EXIT_MS);
}

/** Pour nos modales : à leur fermeture, `overlay` (fond) et `frame` (cadre) s'effacent au lieu de disparaître. */
export function useSmoothExit(overlay: RefObject<HTMLElement>, frame: RefObject<HTMLElement>): void {
  // Nettoyage appelé par Preact avant qu'il ne retire le DOM du composant : la modale est encore affichée.
  useLayoutEffect(
    () => () => {
      // À côté de son conteneur (`mountUi`), qui s'en va avec elle.
      const element = overlay.current;
      const container = element?.parentElement;
      if (!element?.isConnected || !container?.parentNode) return;
      leaveSmoothly(element, { parent: container.parentNode, before: container.nextSibling, frame: frame.current ?? undefined, own: true });
    },
    [overlay, frame],
  );
}
