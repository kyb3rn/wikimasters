import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

export interface WishlistToggleProps {
  readonly active: boolean;
  readonly onClick: () => void;
  /** Nom du bouton (« Liste de souhaits » par défaut). */
  readonly label?: string;
  /** Info-bulle quand il est inactif. */
  readonly title?: string;
}

/** Filtre « Liste de souhaits » en bouton carré à la hauteur des champs : gris en contour, vert plein quand il est actif. */
export function WishlistToggle({ active, onClick, label = 'Liste de souhaits', title = 'Seulement ma liste de souhaits' }: WishlistToggleProps) {
  return (
    <button
      type="button"
      class={`${buttonClass('square', active ? { tone: 'accent', fill: 'solid' } : {})} wm-wishlist-toggle`}
      aria-label={label}
      title={active ? 'Afficher toutes les cartes' : title}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon name="bookmark" size={18} />
    </button>
  );
}
