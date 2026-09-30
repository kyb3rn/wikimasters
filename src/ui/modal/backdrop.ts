import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { guardBackdropClicks } from '@/core/dom';

/** Pour nos modales : leur fond ne les ferme que sur un clic appuyé et relâché sur lui, pas au bout d'un glisser. */
export function useBackdropGuard(backdrop: RefObject<HTMLElement>): void {
  useLayoutEffect(() => {
    const controller = new AbortController();
    guardBackdropClicks((element) => element === backdrop.current, controller.signal);
    return () => controller.abort();
  }, [backdrop]);
}
