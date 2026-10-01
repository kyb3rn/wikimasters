import { useEffect, useRef, useState } from 'preact/hooks';
import type { PickerFriend } from '@/site/trades';
import { buttonClass } from '@/ui/button';
import { Listbox, LoadError } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { DEFAULT_CHOICES, FILTER_OPTIONS, pickFriends, SORT_OPTIONS, type FriendChoices, type FriendFilter, type FriendSort } from './list';

// Deux colonnes dans la largeur de la fenêtre, une seule sur mobile.
export const PICKER_CSS = `
.wm-picker { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.wm-picker-filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 20px 12px; }
.wm-picker-filters > input { flex: 1 1 14rem; min-width: 0; height: ${tokens.fieldHeight}; }
.wm-picker-select { flex: 0 1 12rem; min-width: 10rem; }
.wm-picker-list { flex: 1; min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); padding: 4px 20px 20px; }
.wm-picker-list > .wm-picker-state { grid-column: 1 / -1; }
.wm-picker-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wm-picker-spinner { display: flex; justify-content: center; padding: 32px 0; color: ${tokens.accent}; }
`;

export interface FriendPickerProps {
  readonly friends: readonly PickerFriend[];
  readonly loading: boolean;
  /** Liste qui n'a pas pu se charger. */
  readonly failed: boolean;
  readonly retrying: boolean;
  /** Amis avec un échange en attente ; `undefined` : inconnu (pas de filtre). */
  readonly pending: ReadonlySet<string> | undefined;
  /** Date de chaque amitié (ms), par id de l'ami. */
  readonly dates: ReadonlyMap<string, number>;
  /** Contenu de la photo affichée par le site pour cet ami (floutée selon ses réglages). */
  readonly avatarHtml: (id: string) => string | undefined;
  readonly onSelect: (friend: PickerFriend) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

function Avatar({ friend, html }: { readonly friend: PickerFriend; readonly html: string | undefined }) {
  if (html !== undefined) return <div class={siteClass.friendAvatar} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div class={siteClass.friendAvatar}>
      {friend.avatarUrl ? (
        <img
          src={friend.avatarUrl}
          alt={friend.username}
          class={siteClass.friendAvatarImage}
          style={{ objectPosition: `${friend.avatarPosX}% ${friend.avatarPosY}%` }}
        />
      ) : (
        <span>{friend.username.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function Empty({ text }: { readonly text: string }) {
  return (
    <div class={`${siteClass.emptyFrame} wm-picker-state`}>
      <Icon name="users" size={32} class={siteClass.emptyIcon} />
      <p class={siteClass.emptyText}>{text}</p>
    </div>
  );
}

const countLabel = (count: number) => `${count} ami${count > 1 ? 's' : ''}`;

/** « Choisir un ami » : recherche, filtre et tri, amis sur deux colonnes, « Échanger ». */
export function FriendPickerModal(props: FriendPickerProps) {
  const { friends, loading, failed, retrying, pending, dates } = props;
  const [choices, setChoices] = useState<FriendChoices>(DEFAULT_CHOICES);
  const search = useRef<HTMLInputElement>(null);
  const shown = pickFriends(friends, choices, pending, dates);
  const choose = (change: Partial<FriendChoices>) => setChoices((current) => ({ ...current, ...change }));

  useEffect(() => search.current?.focus(), []);

  let content;
  if (failed && friends.length === 0 && !loading) {
    content = (
      <div class="wm-picker-state">
        <LoadError message="Le chargement de vos amis a échoué." busy={retrying} onRetry={props.onRetry} />
      </div>
    );
  } else if (loading && friends.length === 0) {
    content = (
      <div class="wm-picker-spinner wm-picker-state">
        <Icon name="spinner" size={32} />
      </div>
    );
  } else if (shown.length === 0) {
    content = <Empty text={friends.length === 0 ? 'Aucun ami pour le moment.' : 'Aucun ami ne correspond à la recherche.'} />;
  } else {
    content = shown.map((friend) => (
      <div key={friend.id} class={siteClass.friendRow} onClick={() => props.onSelect(friend)}>
        <Avatar friend={friend} html={props.avatarHtml(friend.id)} />
        <span class={`${siteClass.friendName} wm-picker-name`}>{friend.username}</span>
        {pending?.has(friend.id) && <span class={siteClass.tradePending}>Échange en cours</span>}
        <button type="button" class={buttonClass('standard', { tone: 'accent' })} aria-label={`Échanger avec ${friend.username}`}>
          <Icon name="handshake" size={16} />
          Échanger
        </button>
      </div>
    ));
  }

  return (
    <Modal
      title="Choisir un ami"
      subtitle={friends.length > 0 ? countLabel(friends.length) : undefined}
      width={760}
      maxHeight={900}
      onClose={props.onClose}
    >
      <div class="wm-picker">
        <div class="wm-picker-filters">
          <input
            ref={search}
            type="text"
            class={siteClass.textField}
            placeholder="Rechercher un ami"
            aria-label="Rechercher un ami"
            value={choices.query}
            onInput={(event) => choose({ query: event.currentTarget.value })}
          />
          {pending && (
            <Listbox
              ariaLabel="Filtrer les amis"
              class="wm-picker-select"
              value={choices.filter}
              options={FILTER_OPTIONS}
              onChange={(value) => choose({ filter: value as FriendFilter })}
            />
          )}
          <Listbox
            ariaLabel="Trier les amis"
            class="wm-picker-select"
            value={choices.sort}
            options={SORT_OPTIONS}
            onChange={(value) => choose({ sort: value as FriendSort })}
          />
        </div>
        <div class="wm-picker-list">{content}</div>
      </div>
    </Modal>
  );
}
