import type { ProfileAvatar, ProfileStat, ProfileTag } from '@/site/profile';
import { buttonClass } from '@/ui/button';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface VisibilityState {
  readonly isPublic: boolean;
  /** Texte du site : « Visible de tous », « Amis seulement ». */
  readonly label: string;
  /** Changement en cours (requête du site). */
  readonly busy: boolean;
}

/** Bouton du site repris en bas à droite de l'en-tête : « Signaler », « Retirer des amis ». */
export interface HeaderAction {
  readonly key: string;
  readonly icon: IconName | undefined;
  readonly label: string;
  readonly title: string;
  /** Requête du site en cours (son bouton désactivé). */
  readonly busy: boolean;
  readonly onClick: () => void;
}

/** Demande d'ami du site (joueur qui n'est pas un ami), à droite de la photo. */
export type FriendRequestView =
  | { readonly kind: 'send'; readonly label: string; readonly busy: boolean; readonly onSend: () => void }
  | { readonly kind: 'sent'; readonly text: string }
  | {
      readonly kind: 'received';
      readonly text: string;
      /** Réponse en cours (requête du site) : sa roue, l'autre bouton désactivé. */
      readonly busy: 'accept' | 'decline' | undefined;
      readonly onAccept: () => void;
      readonly onDecline: () => void;
    };

/** Bouton qui ouvre une fenêtre du site. */
export interface WindowButton {
  /** Fenêtre en cours d'ouverture (code du site à charger). */
  readonly busy: boolean;
  readonly onClick: () => void;
}

/** Ami, à droite de la photo : « Message » (sa conversation) et « Échanger » (la fenêtre d'échange du site). */
export interface FriendView {
  readonly message: WindowButton;
  readonly trade: WindowButton;
}

export interface ProfileHeaderProps {
  readonly name: string;
  readonly avatar: ProfileAvatar | undefined;
  readonly details: readonly string[];
  /** Ami : « Vu il y a 10 min », « En ligne récemment », sous la ligne du pseudo. */
  readonly seen: string | undefined;
  readonly left: ProfileStat | undefined;
  readonly right: ProfileStat | undefined;
  /** À la place du chiffre de droite (l'un ou l'autre). */
  readonly request: FriendRequestView | undefined;
  readonly friend: FriendView | undefined;
  readonly tags: readonly ProfileTag[];
  readonly visibility: VisibilityState | undefined;
  readonly actions: readonly HeaderAction[];
  /** Son profil seulement : pastille crayon sur la photo. */
  readonly onEditAvatar: (() => void) | undefined;
  readonly onToggleVisibility: () => void;
}

function Stat({ stat, side }: { stat: ProfileStat | undefined; side: 'left' | 'right' }) {
  return (
    <div class={`wm-profile-stat wm-profile-stat-${side}`}>
      {stat && (
        <>
          <div class={siteClass.statValue}>{stat.value}</div>
          <div class={siteClass.statLabel}>{stat.label}</div>
        </>
      )}
    </div>
  );
}

function Photo({ avatar }: { avatar: ProfileAvatar | undefined }) {
  if (avatar?.kind === 'image') {
    return <img class={siteClass.profileAvatarImage} src={avatar.src} alt={avatar.alt} style={avatar.style} />;
  }
  if (avatar?.kind === 'initials') return <span class={siteClass.profileAvatarInitials}>{avatar.text}</span>;
  return null;
}

function Visibility({ state, onToggle }: { state: VisibilityState; onToggle: () => void }) {
  const on = state.isPublic;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={state.busy}
      disabled={state.busy}
      class={`${siteClass.visibilityButton} wm-profile-visibility`}
      onClick={onToggle}
    >
      <Icon name={on ? 'globe' : 'lock'} busy={state.busy} size={14} />
      <span>{state.label || (on ? 'Visible de tous' : 'Amis seulement')}</span>
      <span class={`${siteClass.switchTrack} ${on ? siteClass.switchTrackOn : siteClass.switchTrackOff}`} aria-hidden="true">
        <span class={`${siteClass.switchKnob} ${on ? siteClass.switchKnobOn : siteClass.switchKnobOff}`} />
      </span>
    </button>
  );
}

function Action({ action }: { action: HeaderAction }) {
  return (
    <button
      type="button"
      class={buttonClass('standard', { tone: 'danger', fill: 'ghost', size: 'sm' })}
      title={action.title}
      disabled={action.busy}
      aria-busy={action.busy}
      onClick={action.onClick}
    >
      {(action.icon || action.busy) && <Icon name={action.icon ?? 'spinner'} busy={action.busy} size={14} />}
      {action.label}
    </button>
  );
}

function AnswerButton(props: {
  tone: 'accent' | 'danger';
  icon: IconName;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class={buttonClass('standard', { tone: props.tone })}
      disabled={props.busy || props.disabled}
      aria-busy={props.busy}
      onClick={props.onClick}
    >
      <Icon name={props.icon} busy={props.busy} size={16} />
      {props.label}
    </button>
  );
}

function Request({ request }: { request: FriendRequestView }) {
  if (request.kind === 'send') {
    return (
      <div class="wm-profile-request">
        <button
          type="button"
          class={buttonClass('standard', { tone: 'accent' })}
          disabled={request.busy}
          aria-busy={request.busy}
          onClick={request.onSend}
        >
          <Icon name="user-plus" busy={request.busy} size={16} />
          {request.label}
        </button>
      </div>
    );
  }
  return (
    <div class="wm-profile-request">
      <p class={siteClass.profileRequestText}>{request.text}</p>
      {request.kind === 'received' && (
        <div class="wm-profile-request-actions">
          <AnswerButton
            tone="accent"
            icon="check"
            label="Accepter"
            busy={request.busy === 'accept'}
            disabled={request.busy !== undefined}
            onClick={request.onAccept}
          />
          <AnswerButton
            tone="danger"
            icon="close"
            label="Refuser"
            busy={request.busy === 'decline'}
            disabled={request.busy !== undefined}
            onClick={request.onDecline}
          />
        </div>
      )}
    </div>
  );
}

function OpenButton(props: { button: WindowButton; tone: 'info' | 'accent'; icon: IconName; label: string }) {
  const { busy, onClick } = props.button;
  return (
    <button type="button" class={buttonClass('standard', { tone: props.tone })} disabled={busy} aria-busy={busy} onClick={onClick}>
      <Icon name={props.icon} busy={busy} size={16} />
      {props.label}
    </button>
  );
}

function Friend({ friend }: { friend: FriendView }) {
  return (
    <div class="wm-profile-friend">
      <OpenButton button={friend.message} tone="info" icon="message" label="Message" />
      <OpenButton button={friend.trade} tone="accent" icon="handshake" label="Échanger" />
    </div>
  );
}

function Right(props: Pick<ProfileHeaderProps, 'request' | 'friend' | 'right'>) {
  if (props.request) return <Request request={props.request} />;
  if (props.friend) return <Friend friend={props.friend} />;
  return <Stat stat={props.right} side="right" />;
}

/**
 * En-tête d'un profil : fond en haut (visibilité du sien dans son coin), photo à cheval sur le bas du fond, pseudo
 * et ligne du site dessous (puis la dernière activité d'un ami), un chiffre de chaque côté (à droite, « Message » et
 * « Échanger » pour un ami, la demande d'ami d'un autre joueur), boutons du site d'un autre joueur en bas à droite,
 * étiquettes en bas.
 */
export function ProfileHeader(props: ProfileHeaderProps) {
  return (
    <section class={`${siteClass.profileHeaderFrame} wm-profile-header`} aria-label="Profil">
      <div class="wm-profile-cover">
        {props.visibility && (
          <div class="wm-profile-corner">
            <Visibility state={props.visibility} onToggle={props.onToggleVisibility} />
          </div>
        )}
      </div>
      <div class="wm-profile-main">
        <Stat stat={props.left} side="left" />
        <div class="wm-profile-identity">
          <div class="wm-profile-avatar">
            <div class={`${siteClass.profileAvatar} wm-profile-photo`}>
              <Photo avatar={props.avatar} />
            </div>
            {props.onEditAvatar && (
              <button
                type="button"
                class={`${buttonClass('round', { fill: 'solid', size: 'sm' })} wm-profile-avatar-edit`}
                title="Modifier la photo de profil"
                aria-label="Modifier la photo de profil"
                onClick={props.onEditAvatar}
              >
                <Icon name="pencil" size={14} />
              </button>
            )}
          </div>
          <h1 class={`${siteClass.profileName} wm-profile-name`}>{props.name}</h1>
          {props.details.length > 0 && <p class={siteClass.profileDetails}>{props.details.join(' · ')}</p>}
          {props.seen && <p class={`${siteClass.profileDetails} wm-profile-seen`}>{props.seen}</p>}
        </div>
        <div class="wm-profile-right">
          <Right request={props.request} friend={props.friend} right={props.right} />
          {props.actions.length > 0 && (
            <div class="wm-profile-actions">
              {props.actions.map((action) => (
                <Action key={action.key} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>
      {props.tags.length > 0 && (
        <ul class={`${siteClass.profileTags} wm-profile-tags`} aria-label="Étiquettes">
          {props.tags.map((tag) => (
            <li key={tag.name} class={siteClass.profileTag} style={tag.style} title={tag.name}>
              <span class={siteClass.profileTagName}>{tag.name}</span>
              {tag.count && <span class={siteClass.profileTagCount}>×{tag.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
