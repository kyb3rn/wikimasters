import { childController, waitUntil } from '@/core/async';
import type { Logger } from '@/core/log';
import { fetchFriendships, friendPlayers, friendshipDates, supabaseUserId, type Player } from '@/site/api';
import { findChatWindows, findDmsPage } from '@/site/dms';
import { friendsOwner } from '@/site/friends';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { FriendPickerModal, type FriendAction } from '@/services/friend-picker';
import { CHAT_WINDOW_ERROR, chatWindowButton } from '@/services/site-window';

/*
 * « Nouveau message » de /dms : choix d'un ami, puis sa conversation. Déjà dans la liste : sa ligne, cliquée comme
 * par l'utilisateur. Sinon la conversation du site, ouverte sur place comme sur un profil (`openChatWindow` ; /dms a
 * son code), après fermeture de celle affichée.
 */

const MESSAGE_ACTION: FriendAction = {
  label: 'Message',
  icon: 'message',
  tone: 'info',
  ariaLabel: (username) => `Écrire à ${username}`,
};

/** « Nouveau message », moyen, vert plein. */
export function NewMessageButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button type="button" class={buttonClass('standard', { tone: 'accent', fill: 'solid' })} onClick={onClick}>
      <Icon name="message" size={16} />
      Nouveau message
    </button>
  );
}

export interface NewMessageOptions {
  /** Page quittée : fenêtre et conversation ouverte par nous fermées. */
  readonly signal: AbortSignal;
  readonly log: Logger;
}

export interface NewMessage {
  /** Ouvre le choix de l'ami ; rien s'il l'est déjà. */
  readonly open: () => void;
}

interface Picker {
  readonly controller: AbortController;
  ui: MountedUi | undefined;
  friends: readonly Player[];
  dates: ReadonlyMap<string, number>;
  loading: boolean;
  failed: boolean;
  retrying: boolean;
  /** Ami choisi, conversation en cours d'ouverture. */
  busyId: string | undefined;
}

export function newMessage({ signal, log }: NewMessageOptions): NewMessage {
  let picker: Picker | undefined;
  let chosen: Player | undefined;
  const chat = chatWindowButton({
    signal,
    log,
    onChange: () => undefined,
    target: () => {
      const page = findDmsPage();
      if (!chosen || !page) return undefined;
      const { id, username, avatarUrl, avatarPosX, avatarPosY } = chosen;
      return { peer: { id, username, avatarUrl: avatarUrl ?? null, avatarPosX, avatarPosY }, contextFrom: page.root };
    },
  });

  const view = (state: Picker) => (
    <FriendPickerModal
      title="Nouveau message"
      action={MESSAGE_ACTION}
      friends={state.friends}
      loading={state.loading}
      failed={state.failed}
      retrying={state.retrying}
      dates={state.dates}
      busyId={state.busyId}
      onSelect={(friend) => void choose(state, friend)}
      onRetry={() => retry(state)}
      onClose={close}
    />
  );

  function refresh(): void {
    if (picker) picker.ui?.update(view(picker));
  }

  function close(): void {
    picker?.controller.abort();
    picker = undefined;
  }

  async function load(state: Picker): Promise<void> {
    try {
      const friendships = await fetchFriendships();
      const me = supabaseUserId() ?? friendsOwner(friendships);
      if (!me) throw new Error('joueur connecté introuvable');
      state.friends = friendPlayers(friendships, me);
      state.dates = friendshipDates(friendships, me);
      state.failed = false;
    } catch (error) {
      if (state === picker) log.warn('amis illisibles', error);
      state.failed = true;
    } finally {
      state.loading = false;
      state.retrying = false;
      refresh();
    }
  }

  function retry(state: Picker): void {
    if (state.retrying) return;
    state.retrying = true;
    refresh();
    void load(state);
  }

  async function choose(state: Picker, friend: Player): Promise<void> {
    const row = findDmsPage()?.rows.find(({ username }) => username === friend.username);
    if (row) {
      close();
      row.button.click();
      return;
    }
    state.busyId = friend.id;
    refresh();
    const shown = findChatWindows().find((window) => !window.guild);
    if (shown) {
      shown.close.click();
      if (!(await waitUntil(() => !shown.overlay.isConnected, { signal: state.controller.signal, timeoutMs: 3000 }))) {
        if (state.controller.signal.aborted) return;
        log.warn(`conversation avec ${friend.username} : celle affichée ne s'est pas fermée`);
        toast.error(CHAT_WINDOW_ERROR, { title: 'Messages' });
        state.busyId = undefined;
        refresh();
        return;
      }
    }
    chosen = friend;
    const opened = await chat.opening();
    if (state !== picker) return;
    state.busyId = undefined;
    if (opened) close();
    else refresh();
  }

  return {
    open: () => {
      if (picker || signal.aborted) return;
      const state: Picker = {
        controller: childController(signal),
        ui: undefined,
        friends: [],
        dates: new Map(),
        loading: true,
        failed: false,
        retrying: false,
        busyId: undefined,
      };
      picker = state;
      state.ui = mountUi(view(state), { signal: state.controller.signal });
      void load(state);
    },
  };
}
