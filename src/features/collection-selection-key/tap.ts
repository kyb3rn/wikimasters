/**
 * Appui sur Ctrl seul : enfoncé puis relâché sans autre touche, sans clic ni molette entre les deux
 * (Ctrl+C, Ctrl+clic, Ctrl+molette ne comptent pas), sans Maj / Alt / Méta (AltGr envoie aussi Ctrl), et
 * assez vite pour ne pas être un Ctrl gardé enfoncé puis abandonné.
 */
export const TAP_MAX_MS = 800;

export interface KeyTap {
  keydown(event: { readonly key: string; readonly repeat: boolean; readonly shiftKey: boolean; readonly altKey: boolean; readonly metaKey: boolean }, now: number): void;
  /** Vrai : Ctrl relâché après un appui seul. */
  keyup(event: { readonly key: string }, now: number): boolean;
  /** Clic, molette, fenêtre quittée : l'appui en cours ne compte plus. */
  cancel(): void;
}

export function createCtrlTap(): KeyTap {
  let since: number | undefined;
  return {
    keydown(event, now) {
      if (event.key !== 'Control') since = undefined;
      else if (!event.repeat) since = event.shiftKey || event.altKey || event.metaKey ? undefined : now;
    },
    keyup(event, now) {
      if (event.key !== 'Control') return false;
      const tapped = since !== undefined && now - since <= TAP_MAX_MS;
      since = undefined;
      return tapped;
    },
    cancel() {
      since = undefined;
    },
  };
}
