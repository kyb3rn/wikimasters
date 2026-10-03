import { h } from 'preact';
import { childController, later } from '@/core/async';
import { ROOT_CLASS, watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { placeHeaderItem } from '@/services/header-items';
import {
  localNotifications,
  markLocalRead,
  notificationsSettings,
  onLocalNotificationsChange,
  toastNotification,
} from '@/services/notifications';
import {
  addToWishlist,
  answerFriendRequest,
  fetchFriendships,
  isFriendsList,
  isNotificationsList,
  isNotificationsMarkRead,
  isProfileRead,
  isWishlistChange,
  markNotificationsRead,
  parseFriendsList,
  parseProfileFriendship,
  readFriendshipAction,
  readNotificationsMarkRead,
  readWishlistChange,
  removeFromWishlist,
  siteErrorText,
  supabaseUserId,
} from '@/site/api';
import { preciseServerNow } from '@/site/clock';
import { changeFriendsPage, findFriendsPage, type FriendsChange } from '@/site/friends';
import { HEADER_RANKS } from '@/site/header';
import {
  findSiteBells,
  friendRequesterOf,
  SITE_BELL,
  notificationPath,
  notificationText,
  openSiteNotification,
  parseNotificationList,
  readSiteNotifications,
  type SiteNotification,
  type SiteNotificationsState,
} from '@/site/notifications';
import { navigateTo } from '@/site/router';
import { mountUi } from '@/ui/mount';
import { alpha, palette, tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { createArrivals } from './arrivals';
import { saveFilter, savedFilter } from './categories';
import { mergeEntries, siteEntry, siteVariant, type Entry } from './entries';
import {
  friendRequests,
  onFriendRequestsElsewhere,
  updateFriendRequests,
  withAnswer,
  withArrival,
  withFriendships,
  withProfile,
  withSiteAction,
  type FriendRequests,
} from './friend-requests';
import { createCenterStore, type FriendAnswer } from './store';
import { parseTabRead, readElsewhere, type TabRead } from './tabs';
import {
  ACTION_ROW_CLASS,
  ACTIONS_CLASS,
  Bell,
  BELL_CLASS,
  DATE_CLASS,
  FILTERS_CLASS,
  FRIEND_STATUS_CLASS,
  FriendRequestToast,
  OPENER_CLASS,
  Panel,
  ROW_CLASS,
} from './views';
import { forgetReturned, onRemovedWishesElsewhere, rememberWish, removedWishes, wishedIn } from './wishlist';

/** Posée tant que notre cloche remplace celles du site : cachées dès leur arrivée dans la page. */
const TAKEOVER_CSS = `${SITE_BELL}:not(.${ROOT_CLASS} *) { display: none !important; }`;

const CSS = `
.${ROOT_CLASS} .${BELL_CLASS} { position: relative; }
.wm-notifications-panel .wm-button { flex: none; }
.${FILTERS_CLASS} > * { flex: 1; }
.${ROW_CLASS}:not(:hover) .${DATE_CLASS} { display: none; }
.${ACTION_ROW_CLASS} { position: relative; }
.${OPENER_CLASS} { position: absolute; inset: 0; }
.${ACTIONS_CLASS} { position: relative; display: flex; flex-wrap: wrap; gap: 8px; }
.${ROW_CLASS} .${ACTIONS_CLASS} { margin-top: 8px; }
.${FRIEND_STATUS_CLASS} { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; line-height: 18px; }
.${FRIEND_STATUS_CLASS}[data-state="accepted"] { color: ${palette.emerald[400]}; }
.${FRIEND_STATUS_CLASS}[data-state="declined"] { color: ${palette.red[400]}; }
.${FRIEND_STATUS_CLASS}[data-state="gone"] { color: ${alpha(tokens.foreground, 60)}; }
`;

/** Relectures de l'état du site après un évènement : React le met à jour quelques images plus tard. */
const REREAD_DELAYS = [16, 150, 600];
/** Au-delà, l'état du site ne se lit pas : sa cloche reprend la main. */
const UNREADABLE_MS = 5000;
/** Lectures annoncées entre les onglets du site. */
const TABS_CHANNEL = 'wm-notifications-read';

export const notifications: Feature = {
  id: 'notifications',
  name: 'Notifications',
  description: '',
  category: 'Notifications',
  routes: 'all',
  required: true,
  settings: notificationsSettings,
  async mount(ctx) {
    const { signal, log } = ctx;
    const store = createCenterStore();
    const arrivals = createArrivals();
    let site: SiteNotificationsState | undefined;
    let siteBell: HTMLButtonElement | undefined;

    function render(): void {
      const siteList = site?.notifications ?? [];
      const local = localNotifications();
      const entries = mergeEntries(siteList, local);
      // Carte retirée de la liste de souhaits, puis de nouveau notifiée : elle y a été remise.
      forgetReturned(entries.flatMap(({ wishlistCard, time }) => (wishlistCard !== undefined && time > 0 ? [{ cardId: wishlistCard, time }] : [])));
      store.set({
        entries,
        unread: siteList.filter((n) => !n.read).length + local.filter((n) => !n.read).length,
        removed: removedWishes(),
        friendRequests: friendRequests(),
      });
    }

    /** Relit l'état du site ; montre en toast ce qui vient d'arriver. */
    function refresh(): void {
      const bell = findSiteBells()[0];
      const next = bell && readSiteNotifications(bell);
      siteBell = bell;
      if (!next) {
        if (!site) return;
        site = undefined;
        render();
        return;
      }
      if (next.source === site?.source) {
        site = next;
        return;
      }
      site = next;
      render();
      for (const notification of arrivals.seen(next.notifications)) {
        rememberFriendRequest(notification);
        announce(notification);
      }
    }

    function refreshSoon(): void {
      for (const delay of REREAD_DELAYS) later(refresh, delay, signal);
    }

    function announce(notification: SiteNotification): void {
      const entry = siteEntry(notification);
      const { id } = notification;
      toastNotification({
        title: entry.label,
        message: notificationText(notification),
        variant: siteVariant(notification),
        ...(friendRequests()[id]
          ? { content: h(FriendRequestToast, { store, id, onAnswer: (target, answer) => void answerRequest(target, answer) }) }
          : {
              action: {
                label: 'Voir',
                onClick: () => open(entry),
                ...(entry.href !== undefined && { href: entry.href, onOpenElsewhere: () => markRead(entry) }),
              },
            }),
      });
    }

    // Liste montée à l'ouverture seulement : un conteneur posé dans <body> pendant le chargement est retiré par
    // React quand il y affiche la page (constaté le 30/09/2026).
    let panel: AbortController | undefined;
    const close = () => {
      panel?.abort();
      panel = undefined;
      store.set({ anchor: undefined });
    };

    /** Comme la cloche du site : état local, puis `PATCH { ids }` pour une notification du site non lue. */
    function markRead(entry: Entry): void {
      if (entry.kind === 'local') {
        markLocalRead([entry.notification.id]);
        return;
      }
      const { notification } = entry;
      if (notification.read) return;
      site?.markAsRead([notification.id]);
      markNotificationsRead([notification.id]).catch((error: unknown) => log.warn('lecture non enregistrée', error));
      refreshSoon();
    }

    function open(entry: Entry): void {
      close();
      if (entry.kind === 'site' && notificationPath(entry.notification) === undefined) {
        // Sanction : sa fenêtre (texte complet, contestation) est celle du site, ouverte par sa propre liste.
        if (siteBell) void openSiteNotification(siteBell, entry.notification.id, signal).then(refreshSoon);
        return;
      }
      markRead(entry);
      if (entry.href !== undefined) navigateTo(entry.href);
    }

    async function markAll(): Promise<void> {
      markLocalRead();
      const siteUnread = site?.notifications.some((n) => !n.read) ?? false;
      if (!siteUnread) return;
      store.set({ marking: true });
      try {
        await markNotificationsRead();
        site?.markAllAsRead();
        refreshSoon();
      } catch (error) {
        toast.error(siteErrorText(error), { title: 'Notifications non marquées' });
      } finally {
        store.set({ marking: false });
      }
    }

    /** Lecture faite dans un autre onglet : reportée dans l'état du site, sans requête (le serveur la connaît déjà). */
    function applyRead(read: TabRead): void {
      refresh();
      const ids = site ? readElsewhere(site.notifications, read) : [];
      if (ids.length === 0) return;
      site?.markAsRead(ids);
      refreshSoon();
    }

    function setWishing(cardId: string, busy: boolean): void {
      const wishing = new Set(store.get().wishing);
      if (busy) wishing.add(cardId);
      else wishing.delete(cardId);
      store.set({ wishing, removed: removedWishes() });
    }

    /** Comme le bouton de la modale du site : retire la carte de la liste de souhaits, ou l'y remet. */
    async function toggleWish(cardId: string): Promise<void> {
      if (store.get().wishing.has(cardId)) return;
      const wished = wishedIn(removedWishes(), cardId);
      setWishing(cardId, true);
      try {
        await (wished ? removeFromWishlist(cardId) : addToWishlist(cardId));
        rememberWish(cardId, !wished);
      } catch (error) {
        toast.error(siteErrorText(error), { title: wished ? 'Retrait impossible' : 'Ajout impossible' });
      } finally {
        setWishing(cardId, false);
      }
    }

    /** Relit les demandes d'ami retenues : changées ici, ou dans un autre onglet. */
    function syncRequests(): void {
      store.set({ friendRequests: friendRequests() });
    }

    function changeRequests(change: (requests: FriendRequests) => FriendRequests): void {
      updateFriendRequests(change);
      syncRequests();
    }

    /** Demande d'ami arrivée sous nos yeux : seule à recevoir Accepter / Refuser (demande de l'utilisateur). */
    function rememberFriendRequest(notification: SiteNotification): void {
      const requester = friendRequesterOf(notification);
      if (requester !== undefined) changeRequests((requests) => withArrival(requests, notification.id, requester, Date.now()));
    }

    function setAnswering(id: string, answer: FriendAnswer | undefined): void {
      const answering = new Map(store.get().answering);
      if (answer) answering.set(id, answer);
      else answering.delete(id);
      store.set({ answering });
    }

    /** La page Amis ne relit ses amitiés qu'après ses propres actions : une réponse donnée ailleurs y est reportée. */
    function showOnFriendsPage(change: FriendsChange): void {
      const section = findFriendsPage()?.list?.section;
      if (section && !changeFriendsPage(section, change, supabaseUserId())) log.warn('page Amis non mise à jour : état illisible');
    }

    /**
     * Comme Accepter / Refuser de la page Amis (`PATCH`). La notification ne donne que le joueur : l'id de l'amitié
     * est d'abord lu dans les amitiés, par la même lecture que la page (`GET /api/friends`). Répondue : lue.
     */
    async function answerRequest(id: string, answer: FriendAnswer): Promise<void> {
      if (store.get().answering.has(id)) return;
      const title = answer === 'accept' ? 'Acceptation impossible' : 'Refus impossible';
      setAnswering(id, answer);
      try {
        let request = friendRequests()[id];
        if (request?.state === 'pending' && request.friendshipId === undefined) {
          const since = Date.now();
          const friendships = await fetchFriendships();
          changeRequests((requests) => withFriendships(requests, friendships, since));
          request = friendRequests()[id];
        }
        if (request?.state !== 'pending' || request.friendshipId === undefined) {
          // Acceptée ailleurs : c'est fait, rien à signaler.
          if (answer !== 'accept' || request?.state !== 'accepted') toast.error("Cette demande n'est plus en attente.", { title });
          if (request) markSiteRead(id);
          return;
        }
        const { requesterId, friendshipId } = request;
        await answerFriendRequest(friendshipId, answer);
        changeRequests((requests) => withAnswer(requests, requesterId, answer === 'accept' ? 'accepted' : 'declined'));
        markSiteRead(id);
        showOnFriendsPage({ kind: answer, id: friendshipId });
      } catch (error) {
        toast.error(siteErrorText(error), { title });
      } finally {
        setAnswering(id, undefined);
      }
    }

    function markSiteRead(id: string): void {
      const notification = site?.notifications.find((n) => n.id === id);
      if (notification) markRead(siteEntry(notification));
    }

    function toggle(bell: HTMLElement): void {
      if (store.get().anchor === bell) {
        close();
        return;
      }
      // Retraits et filtre relus : un autre onglet a pu les changer.
      store.set({ anchor: bell, removed: removedWishes(), filter: savedFilter() });
      if (!panel) {
        panel = childController(signal);
        mountUi(
          h(Panel, {
            store,
            onOpen: open,
            onOpenElsewhere: markRead,
            onWish: (cardId) => void toggleWish(cardId),
            onAnswer: (id, answer) => void answerRequest(id, answer),
            onMarkAll: () => void markAll(),
            onFilter: (filter) => {
              saveFilter(filter);
              store.set({ filter });
            },
            onClose: close,
          }),
          { signal: panel.signal },
        );
      }
      // Comme la cloche du site : la liste est relue à chaque ouverture.
      site?.fetchNotifications();
    }

    net.observe(
      (request) => isNotificationsList(request) && !request.own,
      async (exchange) => {
        if (!exchange.ok) return;
        const list = parseNotificationList(await exchange.json().catch(() => undefined));
        if (list) arrivals.listed(list.map((n) => n.id));
        refreshSoon();
      },
      { signal },
    );
    // Lecture enregistrée (par le script ou la cloche du site) : annoncée aux autres onglets, dont la pastille
    // garderait sinon l'ancien compte jusqu'à l'ouverture de leur liste (demande de l'utilisateur).
    const tabs = new BroadcastChannel(TABS_CHANNEL);
    ctx.onDispose(() => tabs.close());
    tabs.addEventListener('message', (event) => {
      const read = parseTabRead(event.data);
      if (read) applyRead(read);
    });
    net.observe(
      isNotificationsMarkRead,
      (exchange) => {
        const ids = readNotificationsMarkRead(exchange.request);
        if (!exchange.ok || !ids) return;
        const read: TabRead = ids === 'all' ? { before: exchange.startedAt + preciseServerNow() - Date.now() } : { ids };
        tabs.postMessage(read);
      },
      { signal },
    );
    // Diffusions binaires de Supabase Realtime : une nouvelle notification arrive par là, pas par fetch.
    net.observeSocket(
      (url) => url.pathname.includes('/realtime/'),
      (event) => {
        if (event.type === 'message' && event.direction === 'in' && typeof event.data !== 'string') refreshSoon();
      },
      { signal },
    );
    // Liste de souhaits changée par le site (modale de carte) : le bouton de ses notifications suit. Déjà dans la
    // liste (409, code 23505) : ignoré par le site, la carte y est.
    net.observe(
      (request) => isWishlistChange(request) && !request.own,
      (exchange) => {
        const change = readWishlistChange(exchange.request);
        if (!change || !(exchange.ok || (change.wished && exchange.status === 409))) return;
        rememberWish(change.cardId, change.wished);
        store.set({ removed: removedWishes() });
      },
      { signal },
    );
    // Amitiés lues par le site (page Amis, « Choisir un ami ») ou profil d'un joueur : ses demandes suivent, et l'id
    // de l'amitié, une fois connu, évite une lecture au clic. Pas une relecture servie par friends-layout : faite
    // de l'état de la page, elle n'a pas une demande arrivée depuis son chargement.
    net.observe(
      (request) => !request.own && (isFriendsList(request) || isProfileRead(request)),
      async (exchange) => {
        if (!exchange.ok || exchange.synthetic) return;
        const body: unknown = await exchange.json().catch(() => undefined);
        if (isFriendsList(exchange.request)) {
          const friendships = parseFriendsList(body);
          if (friendships) changeRequests((requests) => withFriendships(requests, friendships, exchange.startedAt));
          return;
        }
        const profile = parseProfileFriendship(body);
        if (profile) changeRequests((requests) => withProfile(requests, profile));
      },
      { signal },
    );
    // Réponse donnée par le site (page Amis, profil) : la notification suit.
    net.observe(
      (request) => !request.own && readFriendshipAction(request) !== undefined,
      (exchange) => {
        const action = readFriendshipAction(exchange.request);
        if (exchange.ok && action) changeRequests((requests) => withSiteAction(requests, action));
      },
      { signal },
    );
    // Réponses et retraits faits dans un autre onglet : la liste et les toasts ouverts suivent (demande de l'utilisateur).
    onFriendRequestsElsewhere(syncRequests, { signal });
    onRemovedWishesElsewhere(() => store.set({ removed: removedWishes() }), { signal });
    onLocalNotificationsChange(render, { signal });
    render();

    // Notre cloche prend la place de celles du site dès le chargement (sinon elles s'affichent le temps que leur
    // état se lise : hydratation, puis première réponse du site), cachées avant d'être dessinées. Illisible trop
    // longtemps : on leur rend la main.
    let gaveUp = false;
    const takeOver = () => ctx.style(gaveUp ? '' : TAKEOVER_CSS, 'takeover');
    takeOver();
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    // Une cloche entre l'engrenage et chaque bouton du solde.
    const bells = placeHeaderItem(HEADER_RANKS.notifications, () => h(Bell, { store, onToggle: toggle }), {
      signal,
      shown: () => !gaveUp,
    });

    // L'hydratation de React relie la cloche à son état sans toucher au DOM : relue tant qu'elle ne se lit pas.
    let unreadableSince: number | undefined;
    const retry = setInterval(() => {
      if (!site && findSiteBells().length > 0) refresh();
      if (site || findSiteBells().length === 0) {
        unreadableSince = undefined;
        if (gaveUp && site) {
          gaveUp = false;
          takeOver();
          bells.sync();
        }
        return;
      }
      unreadableSince ??= Date.now();
      if (!gaveUp && Date.now() - unreadableSince > UNREADABLE_MS) {
        log.warn('état des notifications du site illisible : sa cloche reprend la main');
        gaveUp = true;
        takeOver();
        bells.sync();
      }
    }, 1000);
    ctx.onDispose(() => clearInterval(retry));

    let badge: string | undefined;
    watchDom(
      () => {
        // Pastille du site changée (nombre de non lues) : sa liste a changé.
        const text = findSiteBells()
          .map((bell) => bell.textContent ?? '')
          .join('|');
        if (text === badge) return;
        badge = text;
        refresh();
      },
      { signal },
    );
  },
};
