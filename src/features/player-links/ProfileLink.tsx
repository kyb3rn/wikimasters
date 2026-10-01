import { isPlainClick } from '@/core/dom';
import { profilePath } from '@/site/profile';
import { navigateTo } from '@/site/router';

export interface ProfileLinkProps {
  readonly username: string;
  /** Classes du lien (celles du pseudo du site qu'il remplace, ou d'un bouton). */
  readonly className: string;
  /** Texte du lien (par défaut le pseudo). */
  readonly label?: string;
}

/**
 * Pseudo en lien vers le profil du joueur. Dans une vignette du marché, il est lui-même dans le lien de
 * l'annonce : le clic s'arrête ici (le site n'ouvre pas l'annonce) et navigue comme le site, sans recharger.
 * Ctrl, Maj, clic du milieu : le navigateur ouvre le profil (nouvel onglet…).
 */
export function ProfileLink({ username, className, label = username }: ProfileLinkProps) {
  const href = profilePath(username);
  return (
    <a
      href={href}
      class={`${className} wm-profile-link`}
      title={`Profil de ${username}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!isPlainClick(event)) return;
        event.preventDefault();
        navigateTo(href);
      }}
    >
      {label}
    </a>
  );
}
