import type { Feature } from '@/core/runtime';
import { auctionMarket } from './auction-market';
import { auctionModalLayout } from './auction-modal';
import { auctionReport } from './auction-report';
import { auctionStay } from './auction-stay';
import { cardFaces } from './card-faces';
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
import { friendsLayout } from './friends-layout';
import { globalCollectionCardDisplay } from './global-collection-card-display';
import { guildCreateModal } from './guild-create-modal';
import { globalCollectionFilters } from './global-collection-filters';
import { globalCollectionMemory } from './global-collection-memory';
import { globalCollectionPagination } from './global-collection-pagination';
import { globalCollectionSearch } from './global-collection-search';
import { globalCollectionSearchDelay } from './global-collection-search-delay';
import { market } from './market';
import { marketplaceCardDisplay } from './marketplace-card-display';
import { marketplaceFilters } from './marketplace-filters';
import { marketplaceMemory } from './marketplace-memory';
import { marketplaceSearch } from './marketplace-search';
import { marketplaceSearchDelay } from './marketplace-search-delay';
import { marketplaceTiles } from './marketplace-tiles';
import { pageSpinner } from './page-spinner';
import { playerLinks } from './player-links';
import { profileCardDisplay } from './profile-card-display';
import { profileCardPicker } from './profile-card-picker';
import { profileCollectionFilters } from './profile-collection-filters';
import { profileCollectionPagination } from './profile-collection-pagination';
import { profileCollectionSearch } from './profile-collection-search';
import { profileCollectionSearchDelay } from './profile-collection-search-delay';
import { profileHeader } from './profile-header';
import { profileUnfriend } from './profile-unfriend';
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
import { showcase } from './showcase';
import { siteButtons } from './site-buttons';
import { siteFields } from './site-fields';
import { siteModals } from './site-modals';
import { siteTabs } from './site-tabs';
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
  siteButtons,
  siteTabs,
  cardFaces,
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
  profileUnfriend,
  profileCardPicker,
  friendsLayout,
  guildCreateModal,
  collectionCardDisplay,
  // Taille et espacement des cartes des autres pages : un onglet par page, dans l'ordre de la navigation du site.
  tradesCardDisplay,
  // Comme pour la Collection : la mémoire des filtres avant la recherche (elle lit les requêtes qu'il sert),
  // la recherche avant la pagination (qui lit ses verrous) ; la recherche en tête de son onglet.
  marketplaceMemory,
  marketplaceSearch,
  marketplaceSearchDelay,
  marketplaceFilters,
  market,
  auctionMarket,
  auctionReport,
  marketplaceTiles,
  playerLinks,
  marketplaceCardDisplay,
  // Collection d'un ami, comme la Collection : la recherche avant la pagination (qui lit ses verrous).
  profileCollectionSearch,
  profileCollectionSearchDelay,
  profileCollectionPagination,
  profileCollectionFilters,
  profileCardDisplay,
  globalCollectionMemory,
  globalCollectionSearch,
  globalCollectionSearchDelay,
  globalCollectionPagination,
  globalCollectionFilters,
  globalCollectionCardDisplay,
  // Retirés du fichier de production par le build.
  ...(__DEV__ ? [debug, showcase] : []),
];
