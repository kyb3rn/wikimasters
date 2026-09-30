import type { Feature } from '@/core/runtime';
import { auctionModalLayout } from './auction-modal';
import { auctionStay } from './auction-stay';
import { cardModalLayout } from './card-modal';
import { cardModalDiscard } from './card-modal-discard';
import { cardModalStats } from './card-modal-stats';
import { cardModalStay } from './card-modal-stay';
import { collectionBulkTags } from './collection-bulk-tags';
import { collectionCardDisplay } from './collection-card-display';
import { collectionFilterLine } from './collection-filter-line';
import { collectionPagination } from './collection-pagination';
import { collectionRarities } from './collection-rarities';
import { collectionMemory } from './collection-memory';
import { collectionSearch } from './collection-search';
import { collectionSearchDelay } from './collection-search-delay';
import { collectionSelection } from './collection-selection';
import { collectionSelectionKey } from './collection-selection-key';
import { collectionStay } from './collection-stay';
import { debug } from './debug';
import { disabledCursor } from './disabled-cursor';
import { globalCollectionCardDisplay } from './global-collection-card-display';
import { market } from './market';
import { marketplaceCardDisplay } from './marketplace-card-display';
import { pageSpinner } from './page-spinner';
import { profileCardDisplay } from './profile-card-display';
import { profileHeader } from './profile-header';
import { pullsAuction } from './pulls-auction';
import { pullsBar } from './pulls-bar';
import { pullsCenter } from './pulls-center';
import { pullsDiscardNext } from './pulls-discard';
import { pullsGrid } from './pulls-grid';
import { pullsHumanCheck } from './pulls-human-check';
import { pullsKeyboard } from './pulls-keyboard';
import { pullsOpenLabel } from './pulls-open-label';
import { pullsPro } from './pulls-pro';
import { pullsRemaining } from './pulls-remaining';
import { pullsSound } from './pulls-sound';
import { quickDiscard } from './quick-discard';
import { settingsPanel } from './settings';
import { siteFields } from './site-fields';
import { siteModals } from './site-modals';
import { tagManager } from './tag-manager';
import { tradesCardDisplay } from './trades-card-display';

/**
 * Toutes les fonctionnalités, dans l'ordre de montage (et d'affichage dans les paramètres).
 * Seul fichier (avec main.ts) autorisé à importer depuis features/.
 */
export const features: readonly Feature[] = [
  settingsPanel,
  disabledCursor,
  pageSpinner,
  siteModals,
  siteFields,
  cardModalLayout,
  quickDiscard,
  pullsGrid,
  pullsSound,
  pullsDiscardNext,
  pullsAuction,
  cardModalStats,
  cardModalStay,
  cardModalDiscard,
  pullsKeyboard,
  pullsRemaining,
  pullsCenter,
  pullsHumanCheck,
  pullsOpenLabel,
  pullsBar,
  pullsPro,
  auctionModalLayout,
  auctionStay,
  collectionStay,
  // Avant collection-search : son suivi marque les requêtes qu'il sert (filtres retenus), que celle-ci lit.
  collectionMemory,
  collectionSearch,
  collectionSearchDelay,
  // Après collection-search : lit les verrous qu'elle pose sur la pagination du site.
  collectionPagination,
  tagManager,
  collectionRarities,
  collectionFilterLine,
  collectionSelection,
  collectionSelectionKey,
  collectionBulkTags,
  profileHeader,
  collectionCardDisplay,
  // Taille et espacement des cartes des autres pages : un onglet par page, dans l'ordre de la navigation du site.
  tradesCardDisplay,
  market,
  marketplaceCardDisplay,
  profileCardDisplay,
  globalCollectionCardDisplay,
  // Retiré du fichier de production par le build.
  ...(__DEV__ ? [debug] : []),
];
