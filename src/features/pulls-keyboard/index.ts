import type { Feature } from '@/core/runtime';
import { findPullsGrid } from '@/services/pulls-grid';
import { isSiteModalOpen } from '@/site/cards';
import { findCarousel, PULLS_ROUTE } from '@/site/pulls';
import { isModalOpen } from '@/ui/modal';

/** Saisie en cours : les flèches servent au texte, pas au carrousel. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export const pullsKeyboard: Feature = {
  id: 'pulls-keyboard',
  name: 'Navigation au clavier',
  toggleLabel: 'Utiliser les flèches du clavier',
  description: 'Flèche gauche : carte précédente. Flèche droite : carte suivante.',
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  mount(ctx) {
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        // Alt+← est le retour arrière du navigateur : aucune combinaison n'est reprise.
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
        if (isTyping(event.target) || isModalOpen() || isSiteModalOpen()) return;
        const carousel = findCarousel();
        // Toutes les cartes affichées d'un coup : plus rien à faire défiler.
        if (!carousel || findPullsGrid(carousel.root)) return;
        event.preventDefault();
        // Le clic passe par le site (et par le verrou du défaussage rapide pendant une défausse).
        const arrow = event.key === 'ArrowLeft' ? carousel.previous : carousel.next;
        if (!arrow.disabled) arrow.click();
      },
      { signal: ctx.signal },
    );
  },
};
