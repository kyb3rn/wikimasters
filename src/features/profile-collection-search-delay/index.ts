import { injectStyle, setClass, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { trackListDelay } from '@/services/list-search';
import {
  findProfileCollectionFilters,
  hasProfileCollectionCards,
  PROFILE_COLLECTION_SPINNER,
  PROFILE_COLLECTION_TYPING_DELAY,
  profileCollectionList,
} from '@/site/profile';

const WAITING = 'wm-pc-search-waiting';

/** Pendant l'attente, le site est déjà « en chargement » : sa roue au-dessus de la grille ne doit pas tourner. */
const CSS = `html.${WAITING} main ${PROFILE_COLLECTION_SPINNER} { display: none !important; }`;

/**
 * Comme la Collection : un changement de filtre ne charge la liste qu'après un délai sans autre changement
 * (frappe comprise), ses requêtes remplacées n'allant jamais au réseau. Le site affiche toute réponse, même
 * d'une requête remplacée : celles-ci restent sans réponse. Grille vide : la requête part aussitôt, sans quoi
 * la roue du site remplacerait les filtres (et le champ en cours de frappe) pendant toute l'attente ; de même
 * pour la première liste de l'onglet, avant que ses filtres n'apparaissent.
 */
export const profileCollectionSearchDelay: Feature = {
  id: 'profile-collection-search-delay',
  name: 'Recherche',
  description: 'Les filtres ne chargent la liste qu’une fois les changements finis.',
  category: 'Profil',
  routes: ['/profile/:name'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    trackListDelay({
      source: profileCollectionList,
      signal,
      log,
      typing: { delay: PROFILE_COLLECTION_TYPING_DELAY, field: () => findProfileCollectionFilters()?.field },
      staleResponses: 'applied',
      immediate: () => {
        const filters = findProfileCollectionFilters();
        return !filters || !hasProfileCollectionCards(filters);
      },
      onWaiting: (waiting) => {
        if (document.documentElement) setClass(document.documentElement, WAITING, waiting);
      },
    });
    signal.addEventListener('abort', () => document.documentElement.classList.remove(WAITING), { once: true });
    await whenBody();
    if (signal.aborted) return;
    injectStyle('profile-collection-search-delay', CSS);
  },
};
