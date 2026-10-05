import { jsonSize, storedValueData, type DataSet } from '@/core/data';
import { FILTERS_TAB } from '@/services/list-search';
import { localNotificationsData } from '@/services/notifications';
import { CATEGORIES, FILTER_KEY, filterMemory } from './categories';
import { FRIEND_REQUESTS_KEY, friendRequests, updateFriendRequests, type FriendRequestState } from './friend-requests';
import { forgetRemovedWishes, REMOVED_WISHES_KEY, removedWishes } from './wishlist';

const TAB = 'Notifications';

const STATE_LABELS: Readonly<Record<FriendRequestState, string>> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  gone: 'Plus en attente',
};

const friendRequestsData: DataSet = {
  id: 'friend-requests',
  name: "Demandes d'ami suivies",
  tab: TAB,
  description: 'Les demandes arrivées pendant que le script tournait, pour y répondre depuis la cloche.',
  storage: [FRIEND_REQUESTS_KEY],
  list() {
    return Promise.resolve(
      Object.entries(friendRequests()).map(([id, request]) => ({
        key: id,
        title: "Demande d'ami",
        details: [STATE_LABELS[request.state]],
        date: request.at,
        bytes: jsonSize(request),
      })),
    );
  },
  remove(keys) {
    const gone = new Set(keys);
    updateFriendRequests((requests) => Object.fromEntries(Object.entries(requests).filter(([id]) => !gone.has(id))));
    return Promise.resolve();
  },
  clear() {
    updateFriendRequests(() => ({}));
    return Promise.resolve();
  },
};

const removedWishesData: DataSet = {
  id: 'wishlist-removed',
  name: 'Cartes retirées de la liste de souhaits',
  tab: TAB,
  description: 'Pour savoir quel bouton montrer sous une notification « Liste de souhaits ».',
  storage: [REMOVED_WISHES_KEY],
  list() {
    // Seul l'id de la carte est retenu, pas son titre.
    return Promise.resolve(
      Object.entries(removedWishes()).map(([cardId, at]) => ({ key: cardId, title: `Carte ${cardId.slice(0, 8)}`, date: at, bytes: jsonSize(at) + cardId.length })),
    );
  },
  remove(keys) {
    forgetRemovedWishes(keys);
    return Promise.resolve();
  },
  clear() {
    forgetRemovedWishes(Object.keys(removedWishes()));
    return Promise.resolve();
  },
};

const bellFilterData: DataSet = storedValueData({
  id: 'notifications-filter',
  name: 'Cloche',
  tab: FILTERS_TAB,
  description: 'Les cases cochées dans la liste de la cloche.',
  key: FILTER_KEY,
  store: filterMemory,
  describe: (filter) =>
    filter.length > 0 ? { details: CATEGORIES.flatMap(({ value, label }) => (filter.includes(value) ? [label] : [])) } : undefined,
});

/** Ce que les notifications gardent, dans la fenêtre Mémoire : rien ne s'exporte. */
export const notificationsData: readonly DataSet[] = [localNotificationsData, friendRequestsData, removedWishesData, bellFilterData];
