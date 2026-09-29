import type { Feature } from '@/core/runtime';
import { auctionModalLayout } from './auction-modal';
import { auctionStay } from './auction-stay';
import { cardModalLayout } from './card-modal';
import { cardModalDiscard } from './card-modal-discard';
import { cardModalStats } from './card-modal-stats';
import { cardModalStay } from './card-modal-stay';
import { collectionStay } from './collection-stay';
import { debug } from './debug';
import { disabledCursor } from './disabled-cursor';
import { pullsAuction } from './pulls-auction';
import { pullsBar } from './pulls-bar';
import { pullsCenter } from './pulls-center';
import { pullsDiscardNext } from './pulls-discard';
import { pullsGrid } from './pulls-grid';
import { pullsKeyboard } from './pulls-keyboard';
import { pullsRemaining } from './pulls-remaining';
import { pullsSound } from './pulls-sound';
import { quickDiscard } from './quick-discard';
import { settingsPanel } from './settings';

/**
 * Toutes les fonctionnalités, dans l'ordre de montage (et d'affichage dans les paramètres).
 * Seul fichier (avec main.ts) autorisé à importer depuis features/.
 */
export const features: readonly Feature[] = [
  settingsPanel,
  disabledCursor,
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
  pullsBar,
  auctionModalLayout,
  auctionStay,
  collectionStay,
  // Retiré du fichier de production par le build.
  ...(__DEV__ ? [debug] : []),
];
