import { useEffect, useRef, useState } from 'preact/hooks';
import { injectStyle } from '@/core/dom';
import { FriendSortControl } from '@/services/friends';
import type { Player } from '@/site/api';
import { buttonClass, type ButtonTone } from '@/ui/button';
import { Listbox, LoadError } from '@/ui/controls';
import { Icon, type IconName } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { DEFAULT_CHOICES, FRIEND_FILTERS, pickFriends, type FriendChoices, type FriendFilter } from './list';

// Deux colonnes dans la largeur de la fenêtre, une seule sur mobile.
const CSS = `
.wm-picker { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.wm-picker-filters { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 20px 12px; }
.wm-picker-filters > input { flex: 1 1 14rem; min-width: 0; height: ${tokens.fieldHeight}; }
.wm-picker-select { flex: 0 1 12rem; min-width: 10rem; }
.wm-picker-sort { flex: 0 1 13rem; min-width: 11rem; }
.wm-picker-list { flex: 1; min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); padding: 4px 20px 20px; }
.wm-picker-list > .wm-picker-state { grid-column: 1 / -1; }
.wm-picker-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wm-picker-spinner { display: flex; justify-content: center; padding: 32px 0; color: ${tokens.accent}; }
`;

/** Marque de certains amis (« Échange en cours ») : pastille sur leur ligne, et filtre. */
export interface FriendMark {
  readonly ids: ReadonlySet<string>;
  readonly label: string;
  /** Options du filtre : tous les amis, ceux sans la marque, ceux avec. */
  readonly filterLabels: readonly [string, string, string];
}

/** Bouton de chaque ami. */
export interface FriendAction {
  readonly label: string;
  readonly icon: IconName;
  readonly tone: ButtonTone;
  /** Nom accessible du bouton d'un ami (« Échanger avec Aline »). */
  readonly ariaLabel: (username: string) => string;
}

export interface FriendPickerProps<F extends Player> {
  readonly title: string;
  readonly action: FriendAction;
  readonly friends: readonly F[];
  readonly loading: boolean;
  /** Liste qui n'a pas pu se charger. */
  readonly failed: boolean;
  readonly retrying: boolean;
  /** Inconnue : ni pastille ni filtre. */
  readonly mark?: FriendMark | undefined;
  /** Date de chaque amitié (ms), par id de l'ami. */
  readonly dates: ReadonlyMap<string, number>;
  /** Contenu de la photo affichée par le site pour cet ami (floutée selon ses réglages) ; sinon sa photo, ou ses initiales. */
  readonly avatarHtml?: ((id: string) => string | undefined) | undefined;
  /** Ami choisi, en cours d'ouverture : roue sur son bouton, les autres désactivés, la fenêtre reste ouverte. */
  readonly busyId?: string | undefined;
  readonly onSelect: (friend: F) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

function Avatar({ friend, html }: { readonly friend: Player; readonly html: string | undefined }) {
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

/** Choix d'un ami : recherche, filtre et tri, amis sur deux colonnes, chacun avec son bouton. */
export function FriendPickerModal<F extends Player>(props: FriendPickerProps<F>) {
  injectStyle('friend-picker', CSS);
  const { friends, loading, failed, retrying, mark, dates, action, busyId } = props;
  const [choices, setChoices] = useState<FriendChoices>(DEFAULT_CHOICES);
  const search = useRef<HTMLInputElement>(null);
  const shown = pickFriends(friends, choices, mark?.ids, dates);
  const choose = (change: Partial<FriendChoices>) => setChoices((current) => ({ ...current, ...change }));
  const select = (friend: F) => {
    if (busyId === undefined) props.onSelect(friend);
  };

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
      <div key={friend.id} class={siteClass.friendRow} onClick={() => select(friend)}>
        <Avatar friend={friend} html={props.avatarHtml?.(friend.id)} />
        <span class={`${siteClass.friendName} wm-picker-name`}>{friend.username}</span>
        {mark?.ids.has(friend.id) && <span class={siteClass.tradePending}>{mark.label}</span>}
        <button
          type="button"
          class={buttonClass('standard', { tone: action.tone })}
          aria-label={action.ariaLabel(friend.username)}
          disabled={busyId !== undefined}
          aria-busy={busyId === friend.id || undefined}
        >
          <Icon name={action.icon} busy={busyId === friend.id} size={16} />
          {action.label}
        </button>
      </div>
    ));
  }

  return (
    <Modal
      title={props.title}
      subtitle={friends.length > 0 ? countLabel(friends.length) : undefined}
      width={760}
      maxHeight={900}
      locked={busyId !== undefined}
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
          {mark && (
            <Listbox
              ariaLabel="Filtrer les amis"
              class="wm-picker-select"
              value={choices.filter}
              options={FRIEND_FILTERS.map((value, index) => ({ value, label: mark.filterLabels[index] ?? value }))}
              onChange={(value) => choose({ filter: value as FriendFilter })}
            />
          )}
          <FriendSortControl class="wm-picker-sort" value={choices.sort} onChange={(sort) => choose({ sort })} />
        </div>
        <div class="wm-picker-list">{content}</div>
      </div>
    </Modal>
  );
}
