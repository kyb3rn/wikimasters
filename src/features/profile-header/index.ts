import { h } from 'preact';
import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { watchSiteRefusal } from '@/site/api';
import { findOwnProfileHeader, findUniqueCardsStat, isProfileVisibilityChange } from '@/site/profile';
import { MY_PROFILE_ROUTE, PROFILE_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { ProfileHeader } from './ProfileHeader';

const CSS = `
.wm-profile-header { --wm-avatar: 7rem; }
.wm-profile-cover { position: relative; height: 8rem; background: linear-gradient(180deg, rgb(0 0 0 / 55%), rgb(0 0 0 / 35%)); }
.wm-profile-visibility { position: absolute; top: .75rem; right: .75rem; }
.wm-profile-main {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start;
  column-gap: 1rem; padding: 0 1rem 1rem;
}
.wm-profile-stat { min-width: 0; padding-top: 1.5rem; text-align: center; }
.wm-profile-identity {
  display: flex; flex-direction: column; align-items: center; min-width: 0; text-align: center;
  margin-top: calc(var(--wm-avatar) / -2);
}
/* Fond plein sous la photo (le sien est translucide) : le bord du fond de l'en-tête ne la traverse pas. */
.wm-profile-avatar {
  position: relative; flex: none; width: var(--wm-avatar); height: var(--wm-avatar); border-radius: 9999px;
  background: ${tokens.surface}; box-shadow: 0 0 0 4px ${tokens.surface};
}
.wm-profile-photo { width: 100%; height: 100%; font-size: calc(var(--wm-avatar) * .32); line-height: 1; }
.wm-profile-avatar-edit { position: absolute; right: 0; bottom: 0; box-shadow: 0 1px 3px rgb(0 0 0 / 40%); }
.wm-profile-name { max-width: min(30rem, 45vw); margin: .5rem 0 0; font-family: ${tokens.heading}; }
.wm-profile-identity > p { margin: .125rem 0 0; }
.wm-profile-tags { list-style: none; margin: 0; padding: 0 1rem 1rem; }
@media (max-width: 639px) {
  .wm-profile-header { --wm-avatar: 5.5rem; }
  .wm-profile-cover { height: 6.5rem; }
}
`;

export const profileHeader: Feature = {
  id: 'profile-header',
  name: 'En-tête du profil',
  description:
    "En-tête de son profil sur un fond : photo au centre, pseudo et ancienneté dessous, cartes et cartes uniques de part et d'autre, étiquettes en bas, visibilité du profil en haut à droite.",
  category: 'Profil',
  routes: [MY_PROFILE_ROUTE, PROFILE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const slot = createSlot(signal);
    /** Changements de visibilité en cours : l'interrupteur tourne et ne répond plus. */
    let pending = 0;

    net.track(
      isProfileVisibilityChange,
      () => {
        pending += 1;
        sync();
        return () => {
          pending -= 1;
          sync();
        };
      },
      { signal },
    );
    // L'en-tête du site est caché : un refus qu'il y afficherait ne se verrait pas.
    watchSiteRefusal(isProfileVisibilityChange, (message) => toast.error(message, { title: 'Visibilité du profil' }), { signal });

    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    function toggleVisibility(): void {
      const visibility = findOwnProfileHeader()?.visibility;
      if (visibility && pending === 0 && !visibility.button.disabled) visibility.button.click();
    }

    function sync(): void {
      if (signal.aborted) return;
      const header = findOwnProfileHeader();
      const parent = header?.root.parentElement;
      if (!header || !parent) {
        slot.clear();
        return;
      }
      ctx.hide(header.root);
      const unique = findUniqueCardsStat();
      if (unique) ctx.hide(unique.root);
      const { visibility } = header;
      const vnode = h(ProfileHeader, {
        name: header.name,
        avatar: header.avatar,
        details: header.details,
        cards: header.cards,
        unique: unique?.stat,
        tags: header.tags,
        visibility: visibility && {
          isPublic: visibility.isPublic,
          label: visibility.label,
          busy: pending > 0 || visibility.button.disabled,
        },
        onEditAvatar: () => findOwnProfileHeader()?.avatarButton.click(),
        onToggleVisibility: toggleVisibility,
      });
      slot.render(vnode, { parent, before: header.root });
    }

    watchDom(sync, { signal });
  },
};
