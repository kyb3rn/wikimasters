import type { ProfileAvatar, ProfileStat, ProfileTag } from '@/site/profile';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface VisibilityState {
  readonly isPublic: boolean;
  /** Texte du site : « Visible de tous », « Amis seulement ». */
  readonly label: string;
  /** Changement en cours (requête du site). */
  readonly busy: boolean;
}

export interface ProfileHeaderProps {
  readonly name: string;
  readonly avatar: ProfileAvatar | undefined;
  readonly details: readonly string[];
  readonly cards: ProfileStat | undefined;
  readonly unique: ProfileStat | undefined;
  readonly tags: readonly ProfileTag[];
  readonly visibility: VisibilityState | undefined;
  readonly onEditAvatar: () => void;
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
      disabled={state.busy}
      class={`${siteClass.visibilityButton} wm-profile-visibility`}
      onClick={onToggle}
    >
      {state.busy ? <Icon name="spinner" size={14} class="wm-spin" /> : <Icon name={on ? 'globe' : 'lock'} size={14} />}
      <span>{state.label || (on ? 'Visible de tous' : 'Amis seulement')}</span>
      <span class={`${siteClass.switchTrack} ${on ? siteClass.switchTrackOn : siteClass.switchTrackOff}`} aria-hidden="true">
        <span class={`${siteClass.switchKnob} ${on ? siteClass.switchKnobOn : siteClass.switchKnobOff}`} />
      </span>
    </button>
  );
}

/**
 * En-tête de son profil : fond en haut (visibilité dans son coin), photo à cheval sur le bas du fond, pseudo et
 * ancienneté dessous, nombre de cartes à gauche, cartes uniques à droite, étiquettes en bas.
 */
export function ProfileHeader(props: ProfileHeaderProps) {
  return (
    <section class="card-frame overflow-hidden animate-fade-in-up wm-profile-header" aria-label="Profil">
      <div class="wm-profile-cover">
        {props.visibility && <Visibility state={props.visibility} onToggle={props.onToggleVisibility} />}
      </div>
      <div class="wm-profile-main">
        <Stat stat={props.cards} side="left" />
        <div class="wm-profile-identity">
          <div class="wm-profile-avatar">
            <div class={`${siteClass.profileAvatar} wm-profile-photo`}>
              <Photo avatar={props.avatar} />
            </div>
            <button
              type="button"
              class={`${buttonClass('round', { fill: 'solid', size: 'sm' })} wm-profile-avatar-edit`}
              title="Modifier la photo de profil"
              aria-label="Modifier la photo de profil"
              onClick={props.onEditAvatar}
            >
              <Icon name="pencil" size={14} />
            </button>
          </div>
          <h1 class={`${siteClass.profileName} wm-profile-name`} style={{ fontFamily: 'var(--font-heading)' }}>
            {props.name}
          </h1>
          {props.details.length > 0 && <p class={siteClass.profileDetails}>{props.details.join(' · ')}</p>}
        </div>
        <Stat stat={props.unique} side="right" />
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
