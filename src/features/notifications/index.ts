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
import { isNotificationsList, markNotificationsRead, siteErrorText } from '@/site/api';
import { HEADER_RANKS } from '@/site/header';
import {
  findSiteBells,
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
import { toast } from '@/ui/toast';
import { createArrivals } from './arrivals';
import { mergeEntries, siteEntry, siteVariant, type Entry } from './entries';
import { createCenterStore } from './store';
import { Bell, BELL_CLASS, DATE_CLASS, Panel, ROW_CLASS } from './views';

/** Posée tant que notre cloche remplace celles du site : cachées dès leur arrivée dans la page. */
const TAKEOVER_CSS = `${SITE_BELL}:not(.${ROOT_CLASS} *) { display: none !important; }`;

const CSS = `
.${ROOT_CLASS} .${BELL_CLASS} { position: relative; }
.wm-notifications-panel .wm-button { flex: none; }
.${ROW_CLASS}:not(:hover) .${DATE_CLASS} { display: none; }
`;

/** Relectures de l'état du site après un évènement : React le met à jour quelques images plus tard. */
const REREAD_DELAYS = [16, 150, 600];
/** Au-delà, l'état du site ne se lit pas : sa cloche reprend la main. */
const UNREADABLE_MS = 5000;

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
      store.set({
        entries: mergeEntries(siteList, local),
        unread: siteList.filter((n) => !n.read).length + local.filter((n) => !n.read).length,
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
      for (const notification of arrivals.seen(next.notifications)) announce(notification);
    }

    function refreshSoon(): void {
      for (const delay of REREAD_DELAYS) later(refresh, delay, signal);
    }

    function announce(notification: SiteNotification): void {
      const entry = siteEntry(notification);
      toastNotification({
        title: entry.label,
        message: notificationText(notification),
        variant: siteVariant(notification),
        action: { label: 'Voir', onClick: () => open(entry) },
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

    function toggle(bell: HTMLElement): void {
      if (store.get().anchor === bell) {
        close();
        return;
      }
      store.set({ anchor: bell });
      if (!panel) {
        panel = childController(signal);
        mountUi(h(Panel, { store, onOpen: open, onOpenElsewhere: markRead, onMarkAll: () => void markAll(), onClose: close }), {
          signal: panel.signal,
        });
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
    // Diffusions binaires de Supabase Realtime : une nouvelle notification arrive par là, pas par fetch.
    net.observeSocket(
      (url) => url.pathname.includes('/realtime/'),
      (event) => {
        if (event.type === 'message' && event.direction === 'in' && typeof event.data !== 'string') refreshSoon();
      },
      { signal },
    );
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
