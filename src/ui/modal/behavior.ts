import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect } from 'preact/hooks';
import { useLatest } from '@/ui/hooks';
import { useBackdropGuard } from './backdrop';
import { useSmoothExit } from './exit';

/** Nos modales ouvertes, de la plus ancienne à celle du dessus. */
const openModals: object[] = [];

/** Une de nos modales est-elle ouverte ? (les raccourcis clavier des fonctionnalités s'effacent alors) */
export function isModalOpen(): boolean {
  return openModals.length > 0;
}

export interface ModalBehavior {
  /** Fond : un clic appuyé et relâché sur lui ferme la modale. */
  readonly overlay: RefObject<HTMLElement>;
  /** Cadre : il reçoit le focus à l'ouverture et redescend en s'effaçant à la fermeture. */
  readonly frame: RefObject<HTMLElement>;
  /** Lu au moment de fermer : une nouvelle fonction à chaque rendu ne réinscrit rien. */
  readonly onClose: () => void;
  /** Action en cours : ni Échap ni le fond ne ferment la modale. */
  readonly locked?: boolean;
}

/**
 * Comportement commun de nos modales : comptée parmi les modales ouvertes, fermée par Échap (celle du dessus
 * seulement, sans que la page ne le reçoive) ou par un clic sur le fond (pas au bout d'un glisser), focus sur le
 * cadre à l'ouverture (sauf si un champ du contenu l'a déjà pris), sortie en fondu.
 */
export function useModalBehavior({ overlay, frame, onClose, locked = false }: ModalBehavior): void {
  const latest = useLatest({ onClose, locked });
  useSmoothExit(overlay, frame);
  useBackdropGuard(overlay);

  // Dès l'affichage : un effet ordinaire attend l'image suivante, un Échap tapé aussitôt serait perdu.
  useLayoutEffect(() => {
    const token = {};
    openModals.push(token);
    const close = () => {
      if (!latest.current.locked) latest.current.onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      // Les modales du dessous voient l'Échap avant celle du dessus (inscrites avant elle) : elles le lui laissent.
      if (event.key !== 'Escape' || openModals.at(-1) !== token) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const element = overlay.current;
    const onClick = (event: MouseEvent) => {
      if (event.target === element) close();
    };
    document.addEventListener('keydown', onKey, true);
    element?.addEventListener('click', onClick);
    return () => {
      openModals.splice(openModals.indexOf(token), 1);
      document.removeEventListener('keydown', onKey, true);
      element?.removeEventListener('click', onClick);
    };
  }, [overlay, latest]);

  // Après les effets du contenu, qui passent avant ceux de la modale.
  useEffect(() => {
    if (!frame.current?.contains(document.activeElement)) frame.current?.focus();
  }, [frame]);
}
