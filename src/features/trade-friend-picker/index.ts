import { h } from 'preact';
import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { fetchFriendships, friendshipDates, isFriendsList, parseFriendships, type Friendship } from '@/site/api';
import { TRADES_ROUTE } from '@/site/routes';
import { acceptedFriends, findFriendPicker, type FriendPicker, type PickerFriend } from '@/site/trades';
import { FriendPickerModal, type FriendAction } from '@/services/friend-picker';
import { mirrorSiteDialog } from '@/services/site-dialog';

const TRADE_ACTION: FriendAction = {
  label: 'Échanger',
  icon: 'handshake',
  tone: 'accent',
  ariaLabel: (username) => `Échanger avec ${username}`,
};

const PENDING_FILTERS = ['Tous les amis', 'Sans échange en cours', 'Échange en cours'] as const;

/**
 * « Choisir un ami » de /trades dans notre fenêtre : plus large (deux colonnes d'amis), 900 px de haut au plus,
 * recherche, filtre (échange en cours ou non, d'après les échanges de la page) et tri (nom, date d'amitié), boutons
 * « Échanger » standard. La fenêtre du site, cachée, reste la source : ses amis (et leur photo), son choix, sa
 * fermeture. Liste en échec (le site la montre comme vide) : « Réessayer » relit les amis et les lui donne.
 */
export const tradeFriendPicker: Feature = {
  id: 'trade-friend-picker',
  name: 'Choisir un ami',
  description: "La fenêtre « Choisir un ami » d'un nouvel échange est plus large, avec recherche, filtre et tri.",
  category: 'Échanges',
  routes: [TRADES_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    /** Amitiés de la dernière lecture de `GET /api/friends` (dates des amitiés). */
    let friendships: readonly Friendship[] = [];
    let failed = false;
    let retrying = false;

    const view = (picker: FriendPicker) =>
      h(FriendPickerModal<PickerFriend>, {
        title: 'Choisir un ami',
        action: TRADE_ACTION,
        friends: picker.friends,
        loading: picker.loading,
        failed,
        retrying,
        mark: picker.pendingPartners && { ids: picker.pendingPartners, label: 'Échange en cours', filterLabels: PENDING_FILTERS },
        dates: friendshipDates(friendships, picker.currentUserId),
        avatarHtml: (id) => findFriendPicker()?.avatarOf(id)?.innerHTML,
        onSelect: (friend) => findFriendPicker()?.select(friend),
        onRetry: () => void retry(),
        onClose: () => findFriendPicker()?.close(),
      });
    const dialog = mirrorSiteDialog(ctx, { find: findFriendPicker, render: view });

    const bySite = (request: NetRequest) => isFriendsList(request) && !request.own;
    net.track(
      bySite,
      () => (status) => {
        failed = status === undefined || status >= 400;
        dialog.refresh();
      },
      { signal },
    );
    net.observe(
      bySite,
      async (exchange) => {
        if (!exchange.ok) return;
        friendships = parseFriendships(await exchange.json().catch(() => undefined));
        dialog.refresh();
      },
      { signal },
    );

    async function retry(): Promise<void> {
      if (retrying) return;
      retrying = true;
      dialog.refresh();
      try {
        const read = await fetchFriendships();
        const picker = findFriendPicker();
        if (!picker) return;
        friendships = read;
        failed = false;
        picker.setFriends(acceptedFriends(read, picker.currentUserId));
      } catch (error) {
        ctx.log.warn('amis illisibles', error);
      } finally {
        retrying = false;
        dialog.refresh();
      }
    }
  },
};
