import { h, type ComponentChild } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { confirmUnfriend } from '@/services/friends';
import { isFriendsListRequest, isFriendshipDelete, removeFriendship, SiteApiError } from '@/site/api';
import { dropFriendship, findFriendsPage, FRIENDS_ROUTE, readFriendRow, type FriendRow, type RowButton } from '@/site/friends';
import { mountUi, type MountedUi } from '@/ui/mount';
import { ensureBaseStyle } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { CSS, LIST, REQUESTS, SEARCH } from './style';
import { CancelButton, FriendActions, SearchActions, type SiteAction } from './views';

const TITLE = 'Amis';
const SITE_ADD = 'Rechercher un joueur';
const ADD = 'Ajouter un ami';

interface Slot {
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

/** Change le texte d'un bouton du site (son nœud texte : React ne le réécrit que s'il change de son côté). */
function rename(button: HTMLButtonElement, from: string, to: string): void {
  for (const node of button.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === from) node.textContent = ` ${to}`;
  }
}

const errorText = (error: unknown) => {
  const message = error instanceof SiteApiError ? error.message : 'erreur inattendue';
  return `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
};

export const friendsLayout: Feature = {
  id: 'friends-layout',
  name: 'Page Amis',
  description:
    'Amis et demandes en attente sur trois colonnes au plus ; Inviter et Ajouter un ami à droite de la recherche ; Message (bleu), Échanger (vert) et retirer un ami (rouge, avec confirmation) en boutons standard ; Annuler une demande en rouge.',
  category: 'Amis',
  routes: [FRIENDS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    let search: Slot | undefined;
    const rows = new Map<HTMLElement, Slot>();
    /** Demandes envoyées en cours d'annulation : la requête du site, puis sa relecture de la liste. */
    const cancelling = new Map<HTMLElement, 'request' | 'refresh'>();

    net.track(
      (request) => isFriendshipDelete(request) && !request.own,
      () => {
        const started = [...cancelling].filter(([, step]) => step === 'request').map(([row]) => row);
        return (status) => {
          const ok = status !== undefined && status < 400;
          for (const row of started) {
            if (ok) cancelling.set(row, 'refresh');
            else cancelling.delete(row);
          }
          if (status === undefined) toast.error("Erreur réseau : la demande n'a pas été annulée.", { title: TITLE });
          sync();
        };
      },
      { signal },
    );
    // Le site ne montre pas ses refus : la demande resterait là sans explication.
    net.observe(
      (request) => isFriendshipDelete(request) && !request.own,
      async (exchange) => {
        if (exchange.ok) return;
        const body = await exchange.json().catch(() => undefined);
        const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur ${exchange.status} du site.`;
        toast.error(message, { title: TITLE });
      },
      { signal },
    );
    net.track(
      isFriendsListRequest,
      () => {
        const refreshing = [...cancelling].filter(([, step]) => step === 'refresh').map(([row]) => row);
        return () => {
          for (const row of refreshing) cancelling.delete(row);
          sync();
        };
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    ensureBaseStyle();
    injectStyle('friends-layout', CSS);

    /** Monte ou met à jour une interface à nous (conteneur `inline`) ; remontée si React a bougé les choses. */
    function place(current: Slot | undefined, vnode: ComponentChild, parent: Element, before: Element | null): Slot {
      const element = current?.ui.element;
      if (current && element?.parentElement === parent && (before === null || element.nextElementSibling === before)) {
        current.ui.update(vnode);
        return current;
      }
      current?.controller.abort();
      const controller = childController(signal);
      return { ui: mountUi(vnode, { parent, before, inline: true, signal: controller.signal }), controller };
    }

    /** Éléments du site masqués par nous, rendus au démontage. */
    const hidden = new Set<HTMLElement>();
    function hide(element: HTMLElement, on: boolean): void {
      setClass(element, 'wm-hidden', on);
      if (on) hidden.add(element);
      else hidden.delete(element);
    }

    const action = (site: RowButton | undefined): SiteAction | undefined =>
      site && { title: site.button.title, disabled: site.button.disabled, onClick: () => site.button.click() };

    function remove(row: FriendRow): void {
      const friend = readFriendRow(row.root);
      if (!friend) {
        ctx.log.warn('ami de la ligne introuvable dans l’état de la page', row.root.textContent);
        toast.error("Ami non identifié : il n'a pas été retiré.", { title: TITLE });
        return;
      }
      confirmUnfriend(
        friend.username,
        async () => {
          try {
            await removeFriendship(friend.friendshipId);
          } catch (error) {
            toast.error(errorText(error), { title: TITLE });
            return;
          }
          const section = findFriendsPage()?.list?.section ?? row.root;
          if (dropFriendship(section, friend.friendshipId)) return;
          ctx.log.warn('état de la page Amis illisible : rechargement');
          location.reload();
        },
        signal,
      );
    }

    function cancel(row: HTMLElement, button: HTMLButtonElement): void {
      if (cancelling.has(row)) return;
      cancelling.set(row, 'request');
      button.click();
      sync();
    }

    function sync(): void {
      if (signal.aborted) return;
      const page = findFriendsPage();
      const header = page?.header;
      const list = page?.list;
      if (header?.add) rename(header.add, SITE_ADD, ADD);

      const { invite, add } = header ?? {};
      if (list?.search && header && invite && add) {
        setClass(list.search, SEARCH, true);
        hide(header.actions, true);
        search = place(
          search,
          h(SearchActions, {
            copied: invite.querySelector('svg.lucide-check') !== null,
            onInvite: () => invite.click(),
            onAdd: () => add.click(),
          }),
          list.search,
          null,
        );
      } else {
        search?.controller.abort();
        search = undefined;
        // Sans amis, pas de recherche : les boutons restent dans l'en-tête.
        if (header) hide(header.actions, false);
      }

      const seen = new Set<HTMLElement>();
      if (list) setClass(list.section, LIST, true);
      for (const section of page?.requests ?? []) setClass(section, REQUESTS, true);
      for (const row of list?.rows ?? []) {
        seen.add(row.root);
        for (const site of [row.message, row.trade]) if (site) hide(site.slot, true);
        const vnode = h(FriendActions, { message: action(row.message), trade: action(row.trade), onRemove: () => remove(row) });
        rows.set(row.root, place(rows.get(row.root), vnode, row.actions, row.message?.slot ?? row.trade?.slot ?? null));
      }
      for (const request of page?.sent ?? []) {
        seen.add(request.root);
        hide(request.cancel, true);
        const vnode = h(CancelButton, { busy: cancelling.has(request.root), onClick: () => cancel(request.root, request.cancel) });
        rows.set(request.root, place(rows.get(request.root), vnode, request.root, request.cancel));
      }
      for (const [root, slot] of rows) {
        if (seen.has(root)) continue;
        slot.controller.abort();
        rows.delete(root);
      }
      for (const row of cancelling.keys()) if (!row.isConnected) cancelling.delete(row);
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      const page = findFriendsPage();
      if (page?.header?.add) rename(page.header.add, ADD, SITE_ADD);
      for (const name of [LIST, REQUESTS, SEARCH]) document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      for (const element of hidden) element.classList.remove('wm-hidden');
    });
  },
};
