import { h } from 'preact';
import { storedValueData } from '@/core/data';
import { classMarks, renameText, watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { confirmUnfriend, sortFriends, type FriendsSort } from '@/services/friends';
import { FILTERS_TAB } from '@/services/list-search';
import { friendshipDatesByName, isFriendsList, removeFriendship, siteErrorText, type FriendshipAction } from '@/site/api';
import { dropFriendship, findFriendsPage, readFriendRow, readFriendsData, type FriendRow, type RowButton } from '@/site/friends';
import { hasIcon } from '@/site/dom';
import { FRIENDS_ROUTE } from '@/site/routes';
import { createSlot, createSlots } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { serveFriendsRefresh } from './refresh';
import { FRIENDS_SORT_KEY, savedSort, sortDetails } from './sort';
import { CSS, EMPTY, EMPTY_INVITE, INCOMING, LIST, ORDER_VAR, REQUESTS, SEARCH } from './style';
import { AcceptAllButton, AnswerActions, CancelButton, FriendActions, InviteButton, SearchTools, type SiteAction } from './views';

const TITLE = 'Amis';
const SITE_ADD = 'Rechercher un joueur';
/** Le même bouton dans le cadre de la liste vide. */
const SITE_EMPTY_ADD = 'Rechercher des joueurs';
const ADD = 'Ajouter un ami';

/** Action d'une demande en attente : annuler (envoyée), accepter ou refuser (reçue). */
type RequestAction = 'cancel' | 'accept' | 'decline';

/** Action du site déclenchée par le bouton d'une ligne. */
const ROW_ACTION: Partial<Record<FriendshipAction['kind'], RequestAction>> = { accept: 'accept', decline: 'decline', delete: 'cancel' };

interface Pending {
  readonly action: RequestAction;
  /** La requête du site, puis sa relecture de la liste. */
  readonly step: 'request' | 'refresh';
}

export const friendsLayout: Feature = {
  id: 'friends-layout',
  name: 'Page Amis',
  description:
    "Amis et demandes en attente sur trois colonnes au plus ; amis triés par nom ou par date d'amitié, dans un sens ou dans l'autre (tri retenu), à droite de la recherche ; Inviter et Ajouter un ami au bout (sans amis : Inviter à côté du bouton Ajouter un ami) ; Message (bleu), Échanger (vert) et retirer un ami (rouge, avec confirmation) en boutons standard ; Accepter (vert), Refuser et Annuler une demande (rouge) ; la liste suit chaque action sans être relue.",
  category: 'Amis',
  routes: [FRIENDS_ROUTE],
  required: true,
  hidden: true,
  data: [
    storedValueData({
      id: 'friends-sort',
      name: 'Amis',
      tab: FILTERS_TAB,
      description: "Le tri de la liste des amis, remis à l'arrivée sur la page.",
      key: FRIENDS_SORT_KEY,
      store: savedSort,
      describe: (sort) => ({ details: sortDetails(sort) }),
    }),
  ],
  async mount(ctx) {
    const { signal } = ctx;
    const search = createSlot(signal);
    const emptyInvite = createSlot(signal);
    const acceptAll = createSlot(signal);
    /** Actions de chaque ligne (ami, demande reçue, demande envoyée), par ligne. */
    const rows = createSlots<HTMLElement>(signal);
    const marks = classMarks(signal);
    /** Demandes en attente dont l'action est en cours (site : aucun état « en cours »). */
    const pending = new Map<HTMLElement, Pending>();
    let sort = savedSort.get();

    serveFriendsRefresh({
      signal,
      log: ctx.log,
      onActionEnd(action, status) {
        const kind = ROW_ACTION[action.kind];
        const ok = status !== undefined && status < 400;
        for (const [row, entry] of pending) {
          if (entry.step !== 'request' || entry.action !== kind) continue;
          if (ok) pending.set(row, { action: entry.action, step: 'refresh' });
          else pending.delete(row);
        }
        sync();
      },
      onRefused: (message) => toast.error(message, { title: TITLE }),
    });
    net.track(
      isFriendsList,
      () => {
        const refreshing = [...pending].filter(([, entry]) => entry.step === 'refresh').map(([row]) => row);
        return () => {
          for (const row of refreshing) pending.delete(row);
          sync();
        };
      },
      { signal },
    );

    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    ctx.onDispose(() => {
      const page = findFriendsPage();
      if (page?.header?.add) renameText(page.header.add, ADD, SITE_ADD);
      if (page?.list?.empty) renameText(page.list.empty.search, ADD, SITE_EMPTY_ADD);
      for (const row of page?.list?.rows ?? []) row.root.style.removeProperty(ORDER_VAR);
    });

    const action = (site: RowButton | undefined): SiteAction | undefined =>
      site && { title: site.button.title, disabled: site.button.disabled, onClick: () => site.button.click() };

    function remove(row: FriendRow): void {
      const friend = readFriendRow(row.root);
      if (!friend) {
        ctx.log.warn("ami de la ligne introuvable dans l'état de la page", row.root.textContent);
        toast.error("Ami non identifié : il n'a pas été retiré.", { title: TITLE });
        return;
      }
      confirmUnfriend(
        friend.username,
        async () => {
          try {
            await removeFriendship(friend.friendshipId);
          } catch (error) {
            toast.error(siteErrorText(error), { title: TITLE });
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

    function chooseSort(next: FriendsSort): void {
      sort = next;
      savedSort.set(next);
      sync();
    }

    /** Rang de chaque ami dans le tri (`order` de sa ligne) ; dates des amitiés lues dans l'état de la page. */
    function orderRows(section: HTMLElement, rows: readonly FriendRow[]): void {
      const dates = sort.sort === 'date' ? friendshipDatesByName(readFriendsData(section)?.friendships ?? []) : undefined;
      for (const [index, { root }] of sortFriends(rows, sort, (row) => dates?.get(row.username)).entries()) {
        const rank = String(index + 1);
        if (root.style.getPropertyValue(ORDER_VAR) !== rank) root.style.setProperty(ORDER_VAR, rank);
      }
    }

    /** Clique le bouton du site (caché) d'une demande, roue jusqu'à la relecture de la liste. */
    function answer(row: HTMLElement, action: RequestAction, button: HTMLButtonElement): void {
      if (pending.has(row)) return;
      pending.set(row, { action, step: 'request' });
      button.click();
      sync();
    }

    function sync(): void {
      if (signal.aborted) return;
      const page = findFriendsPage();
      const header = page?.header;
      const list = page?.list;
      if (header?.add) renameText(header.add, SITE_ADD, ADD);
      if (list?.empty) renameText(list.empty.search, SITE_EMPTY_ADD, ADD);

      const { invite, add } = header ?? {};
      const searchFrame = list?.search;
      const copied = invite ? hasIcon(invite, 'check') : false;
      const actions = searchFrame && invite && add ? { copied, onInvite: () => invite.click(), onAdd: () => add.click() } : undefined;
      // Sans amis, pas de recherche : « Inviter » rejoint « Ajouter un ami » dans le cadre de la liste vide.
      const empty = invite ? list?.empty : undefined;
      marks.only(SEARCH, searchFrame ? [searchFrame] : []);
      marks.only(EMPTY, empty ? [empty.frame] : []);
      // L'en-tête passe sous le cadre du solde : ses boutons ne restent que si les nôtres n'ont pas pu être posés.
      if (header) ctx.hide(header.actions, actions !== undefined || empty !== undefined);
      if (searchFrame) {
        search.render(h(SearchTools, { sort, onSort: chooseSort, actions }), { parent: searchFrame, before: null, inline: true });
      } else {
        search.clear();
      }
      if (empty && invite) {
        const vnode = h(InviteButton, { copied, onClick: () => invite.click(), class: EMPTY_INVITE });
        emptyInvite.render(vnode, { parent: empty.frame, before: empty.search, inline: true });
      } else {
        emptyInvite.clear();
      }

      marks.only(LIST, list ? [list.section] : []);
      if (list) orderRows(list.section, list.rows);
      marks.only(REQUESTS, page?.requests ?? []);
      const seen = new Set<HTMLElement>();
      for (const row of list?.rows ?? []) {
        seen.add(row.root);
        for (const site of [row.message, row.trade]) if (site) ctx.hide(site.slot);
        const vnode = h(FriendActions, { message: action(row.message), trade: action(row.trade), onRemove: () => remove(row) });
        rows.render(row.root, vnode, { parent: row.actions, before: row.message?.slot ?? row.trade?.slot ?? null, inline: true });
      }
      const received = page?.received;
      const all = received?.acceptAll;
      if (all) {
        ctx.hide(all);
        acceptAll.render(h(AcceptAllButton, { busy: all.disabled, onClick: () => all.click() }), {
          parent: all.parentElement ?? all,
          before: all,
          inline: true,
        });
      } else {
        acceptAll.clear();
      }
      marks.only(INCOMING, received?.rows.map((request) => request.root) ?? []);
      for (const { root, actions, accept, decline } of received?.rows ?? []) {
        const busy = pending.get(root)?.action;
        seen.add(root);
        ctx.hide(accept);
        ctx.hide(decline);
        const vnode = h(AnswerActions, {
          busy: busy === 'accept' || busy === 'decline' ? busy : undefined,
          onAccept: () => answer(root, 'accept', accept),
          onDecline: () => answer(root, 'decline', decline),
        });
        rows.render(root, vnode, { parent: actions, before: accept, inline: true });
      }
      for (const { root, cancel } of page?.sent ?? []) {
        seen.add(root);
        ctx.hide(cancel);
        const vnode = h(CancelButton, { busy: pending.has(root), onClick: () => answer(root, 'cancel', cancel) });
        rows.render(root, vnode, { parent: root, before: cancel, inline: true });
      }
      rows.prune((root) => seen.has(root));
      for (const row of pending.keys()) if (!row.isConnected) pending.delete(row);
    }

    watchDom(sync, { signal });
  },
};
