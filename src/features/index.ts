import type { Feature } from '@/core/runtime';
import { auctionLive } from './auction-live';
import { auctionMarket } from './auction-market';
import { auctionNotFound } from './auction-not-found';
import { auctionModalLayout } from './auction-modal';
import { auctionReport } from './auction-report';
import { auctionResult } from './auction-result';
import { auctionStay } from './auction-stay';
import { auctionWishedPrice } from './auction-wished-price';
import { cardFaces } from './card-faces';
import { cardModalLayout } from './card-modal';
import { cardModalDiscard } from './card-modal-discard';
import { cardModalStats } from './card-modal-stats';
import { cardModalStay } from './card-modal-stay';
import { collectionBulkTags } from './collection-bulk-tags';
import { collectionCardDisplay } from './collection-card-display';
import { collectionPrices } from './collection-prices';
import { collectionFilters } from './collection-filters';
import { collectionPagination } from './collection-pagination';
import { collectionMemory } from './collection-memory';
import { collectionSearch } from './collection-search';
import { collectionSearchDelay } from './collection-search-delay';
import { collectionSelection } from './collection-selection';
import { collectionSelectionKey } from './collection-selection-key';
import { collectionStay } from './collection-stay';
import { debug } from './debug';
import { disabledCursor } from './disabled-cursor';
import { dmsLayout } from './dms-layout';
import { dmsGroups } from './dms-groups';
import { dmsTrade } from './dms-trade';
import { guildChat } from './guild-chat';
import { guildChatTab } from './guild-chat-tab';
import { headerBar } from './header-bar';
import { friendsLayout } from './friends-layout';
import { globalCollectionCardDisplay } from './global-collection-card-display';
import { guildCardDisplay } from './guild-card-display';
import { guildCreateModal } from './guild-create-modal';
import { guildLayout } from './guild-layout';
import { globalCollectionFilters } from './global-collection-filters';
import { globalCollectionFriends } from './global-collection-friends';
import { globalCollectionMemory } from './global-collection-memory';
import { globalCollectionPagination } from './global-collection-pagination';
import { globalCollectionSearch } from './global-collection-search';
import { globalCollectionSearchDelay } from './global-collection-search-delay';
import { market } from './market';
import { marketSearch } from './market-search';
import { marketplaceCardDisplay } from './marketplace-card-display';
import { marketplaceFilters } from './marketplace-filters';
import { marketplaceMemory } from './marketplace-memory';
import { marketplaceSearch } from './marketplace-search';
import { marketplaceSearchDelay } from './marketplace-search-delay';
import { marketplacePrices } from './marketplace-prices';
import { marketplaceWipeEnded } from './marketplace-wipe-ended';
import { marketplaceTiles } from './marketplace-tiles';
import { notifications } from './notifications';
import { ownedBadge } from './owned-badge';
import { pageSpinner } from './page-spinner';
import { playerLinks } from './player-links';
import { playerSearch } from './player-search';
import { profileCardDisplay } from './profile-card-display';
import { profileCardPicker } from './profile-card-picker';
import { profileCollectionFilters } from './profile-collection-filters';
import { profileCollectionPagination } from './profile-collection-pagination';
import { profileCollectionSearch } from './profile-collection-search';
import { profileCollectionSearchDelay } from './profile-collection-search-delay';
import { profileHeader } from './profile-header';
import { profileNotFound } from './profile-not-found';
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
import { resale } from './resale';
import { resaleCardDisplay } from './resale-card-display';
import { salesLimit } from './sales-limit';
import { settingsPanel } from './settings';
import { showcase } from './showcase';
import { siteButtons } from './site-buttons';
import { siteFields } from './site-fields';
import { siteModals } from './site-modals';
import { siteTabs } from './site-tabs';
import { tagManager } from './tag-manager';
import { tradeCardsError } from './trade-cards-error';
import { tradeFilters } from './trade-filters';
import { tradeFriendPicker } from './trade-friend-picker';
import { tradeSelection } from './trade-selection';
import { tradeSummary } from './trade-summary';
import { tradeWikibidous } from './trade-wikibidous';
import { tradesCardDisplay } from './trades-card-display';
import { tradesTabLine } from './trades-tab-line';

/**
 * Toutes les fonctionnalités, dans l'ordre de montage : leurs écouteurs, suivis et intercepteurs réseau s'inscrivent
 * dans cet ordre. C'est aussi l'ordre des sections dans un onglet des paramètres (l'ordre des onglets est celui de
 * `TAB_ICONS`, features/settings/tabs.ts). Seul fichier (avec main.ts) autorisé à importer depuis features/.
 */
export const features: readonly Feature[] = [
  settingsPanel,
  headerBar,
  disabledCursor,
  pageSpinner,
  // Avant card-modal-stay : sa garde du fond passe devant les écouteurs de clic des autres fonctionnalités.
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
  // Avant son délai, dont le suivi laisse partir aussitôt les recherches lancées qu'elle marque (Entrée, bouton), et
  // avant la pagination, qui lit les verrous qu'elle pose.
  collectionSearch,
  collectionSearchDelay,
  collectionPagination,
  tagManager,
  collectionFilters,
  collectionSelection,
  collectionSelectionKey,
  collectionBulkTags,
  collectionPrices,
  profileHeader,
  profileUnfriend,
  profileNotFound,
  profileCardPicker,
  friendsLayout,
  playerSearch,
  guildCreateModal,
  guildLayout,
  dmsLayout,
  dmsGroups,
  dmsTrade,
  guildChat,
  guildChatTab,
  collectionCardDisplay,
  tradesCardDisplay,
  tradesTabLine,
  tradeFilters,
  tradeWikibidous,
  tradeCardsError,
  tradeFriendPicker,
  tradeSummary,
  tradeSelection,
  // Comme pour la Collection : la mémoire des filtres, puis la recherche, puis son délai. La recherche avant
  // l'historique des ventes : sa section en tête de l'onglet Marché.
  marketplaceMemory,
  marketplaceSearch,
  marketplaceSearchDelay,
  marketplaceFilters,
  market,
  auctionMarket,
  auctionReport,
  auctionResult,
  auctionNotFound,
  marketplaceTiles,
  marketplacePrices,
  marketplaceWipeEnded,
  auctionLive,
  salesLimit,
  playerLinks,
  ownedBadge,
  marketplaceCardDisplay,
  // Collection d'un ami, comme la Collection (sans filtres retenus) : la recherche, son délai, puis la pagination.
  profileCollectionSearch,
  profileCollectionSearchDelay,
  profileCollectionPagination,
  profileCollectionFilters,
  profileCardDisplay,
  // Comme la Collection : la mémoire des filtres, la recherche, son délai, puis la pagination.
  globalCollectionMemory,
  globalCollectionSearch,
  globalCollectionSearchDelay,
  globalCollectionPagination,
  globalCollectionFilters,
  globalCollectionFriends,
  globalCollectionCardDisplay,
  guildCardDisplay,
  notifications,
  // Développement seulement : en production, `__DEV__` vaut false et esbuild retire ces modules (build.mjs échoue
  // s'il en reste un octet dans le fichier).
  ...(__DEV__ ? [debug, showcase, marketSearch, resale, resaleCardDisplay, auctionWishedPrice] : []),
];
