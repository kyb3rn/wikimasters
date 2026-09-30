import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/** Filtre « Liste de souhaits » en bouton carré à la hauteur des champs : gris en contour, vert plein quand il est actif. */
export function WishlistToggle({ active, onClick }: { readonly active: boolean; readonly onClick: () => void }) {
  return (
    <button
      type="button"
      class={`${buttonClass('square', active ? { tone: 'accent', fill: 'solid' } : {})} wm-wishlist-toggle`}
      aria-label="Liste de souhaits"
      title={active ? 'Afficher toutes les cartes' : 'Seulement ma liste de souhaits'}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon name="bookmark" size={18} />
    </button>
  );
}
