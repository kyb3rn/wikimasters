import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findOwnProfileHeader, findUniqueCardsStat, isProfileVisibilityRequest } from '@/site/profile';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { ProfileHeader } from './ProfileHeader';

const HIDDEN = 'wm-profile-header-hidden';
const TOAST_TITLE = 'Visibilité du profil';

const CSS = `
.${HIDDEN} { display: none !important; }
.wm-profile-header { --wm-avatar: 7rem; }
.wm-profile-cover { position: relative; height: 8rem; background: linear-gradient(180deg, rgb(0 0 0 / 55%), rgb(0 0 0 / 35%)); }
.wm-profile-visibility { position: absolute; top: .75rem; right: .75rem; }
.wm-profile-main {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start;
  column-gap: 1rem; padding: 0 1rem 1rem;
}
.wm-profile-stat { min-width: 0; padding-top: .75rem; text-align: center; }
.wm-profile-identity {
  display: flex; flex-direction: column; align-items: center; min-width: 0; text-align: center;
  margin-top: calc(var(--wm-avatar) / -2);
}
/* Fond plein sous la photo (le sien est translucide) : le bord du fond de l'en-tête ne la traverse pas. */
.wm-profile-avatar {
  position: relative; flex: none; width: var(--wm-avatar); height: var(--wm-avatar); border-radius: 9999px;
  background: var(--color-surface, #161b22); box-shadow: 0 0 0 4px var(--color-surface, #161b22);
}
.wm-profile-photo { width: 100%; height: 100%; font-size: calc(var(--wm-avatar) * .32); line-height: 1; }
.wm-profile-avatar-edit { position: absolute; right: 0; bottom: 0; width: 2rem; height: 2rem; }
.wm-profile-name { max-width: min(30rem, 45vw); margin: .5rem 0 0; }
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
  routes: ['/profile', '/profile/:name'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    let placed: { readonly ui: MountedUi; readonly controller: AbortController } | undefined;
    /** Changements de visibilité en cours : l'interrupteur tourne et ne répond plus. */
    let pending = 0;

    // L'en-tête du site est caché : un refus qu'il y afficherait ne se verrait pas.
    net.track(
      isProfileVisibilityRequest,
      () => {
        pending += 1;
        sync();
        return (status) => {
          pending -= 1;
          if (status === undefined) toast.error("Erreur réseau : la visibilité du profil n'a pas changé.", { title: TOAST_TITLE });
          sync();
        };
      },
      { signal },
    );
    net.observe(
      isProfileVisibilityRequest,
      async (exchange) => {
        if (exchange.ok) return;
        const body = await exchange.json().catch(() => undefined);
        const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur ${exchange.status} du site.`;
        toast.error(message, { title: TOAST_TITLE });
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('profile-header', CSS);

    function remove(): void {
      placed?.controller.abort();
      placed = undefined;
    }

    function editAvatar(): void {
      findOwnProfileHeader()?.avatarButton.click();
    }

    function toggleVisibility(): void {
      const visibility = findOwnProfileHeader()?.visibility;
      if (visibility && pending === 0 && !visibility.button.disabled) visibility.button.click();
    }

    function sync(): void {
      if (signal.aborted) return;
      const header = findOwnProfileHeader();
      const parent = header?.root.parentElement;
      if (!header || !parent) {
        remove();
        return;
      }
      setClass(header.root, HIDDEN, true);
      const unique = findUniqueCardsStat();
      if (unique) setClass(unique.root, HIDDEN, true);
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
        onEditAvatar: editAvatar,
        onToggleVisibility: toggleVisibility,
      });
      if (placed?.ui.element.parentElement === parent && placed.ui.element.nextElementSibling === header.root) {
        placed.ui.update(vnode);
        return;
      }
      remove();
      const controller = childController(signal);
      placed = { ui: mountUi(vnode, { parent, before: header.root, signal: controller.signal }), controller };
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      remove();
      document.querySelectorAll(`.${HIDDEN}`).forEach((el) => el.classList.remove(HIDDEN));
    });
  },
};
