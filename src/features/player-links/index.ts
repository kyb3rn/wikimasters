import { h, type ComponentChild } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findChatPeers } from '@/site/dms';
import { findAuctionPlayers, findMarketplaceSellers, TILE } from '@/site/marketplace';
import { buttonClass } from '@/ui/button';
import { mountUi, type MountedUi } from '@/ui/mount';
import { ProfileLink } from './ProfileLink';

const SELLER = 'wm-tile-seller';
const CHAT_AVATAR = 'wm-chat-avatar';

/*
 * Vendeur d'une vignette : bouton plein (fond opaque, lisible sur toute image) en bas à gauche de l'image de la
 * carte, au survol de la vignette seulement ; toujours affiché sur un écran tactile, qui n'a pas de survol.
 * Plus petit que le petit bouton (demande de l'utilisateur) : il ne doit pas masquer l'image.
 */
const CSS = `
.wm-hidden { display: none !important; }
.wm-profile-link { cursor: pointer; }
.wm-profile-link:not(.wm-button):hover { text-decoration: underline; text-underline-offset: 2px; }
.wm-button.${SELLER} { position: absolute; left: 6px; bottom: 6px; z-index: 35; display: block;
  max-width: calc(100% - 12px); padding: 2px 7px; border-radius: 6px; font-size: 10px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  box-shadow: 0 1px 4px rgb(0 0 0 / 40%); opacity: 0; pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s; }
${TILE}:hover .${SELLER}, .${SELLER}:focus-visible { opacity: 1; pointer-events: auto; }
@media (hover: none) { .wm-button.${SELLER} { opacity: 1; pointer-events: auto; } }
.wm-chat-name { display: block; width: fit-content; max-width: 100%; }
.${CHAT_AVATAR} { position: relative; }
.wm-chat-avatar-link { position: absolute; inset: 0; border-radius: 9999px; }
`;

interface Slot {
  readonly ui: MountedUi;
  readonly controller: AbortController;
  username: string;
}

/**
 * Où poser notre lien : juste après l'élément du site (caché), ou à la fin d'un autre parent (l'élément du site est
 * caché, sauf `keep` : la photo d'une conversation reste, notre lien la recouvre).
 */
type Place = { readonly after: HTMLElement } | { readonly inside: HTMLElement; readonly keep?: boolean };

/** Classes du site d'un élément, sans les nôtres. */
const siteClasses = (element: Element) => [...element.classList].filter((name) => !name.startsWith('wm-')).join(' ');

/**
 * Pseudos en liens vers le profil du joueur : vendeur des vignettes du marché (« @pseudo » sur l'image de la
 * carte, au survol) ; sur la page d'une enchère, « Mis en vente par », « Meneur : », « Remportée par » et
 * l'historique des mises (pseudo du site caché, le nôtre posé juste après) ; conversation privée de /dms : pseudo
 * et photo de l'interlocuteur.
 */
export const playerLinks: Feature = {
  id: 'player-links',
  name: 'Liens vers les profils',
  description:
    'Marché : vendeurs, meneur, gagnant et joueurs de l’historique des mises mènent à leur profil. Messages : pseudo et photo de l’interlocuteur aussi.',
  category: 'Marché',
  routes: ['/marketplace', '/marketplace/:id', '/dms'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('player-links', CSS);

    /** Élément du site remplacé → notre lien. */
    const slots = new Map<HTMLElement, Slot>();

    function place(target: HTMLElement, username: string, where: Place, vnode: () => ComponentChild): void {
      setClass(target, 'wm-hidden', !('keep' in where && where.keep));
      const slot = slots.get(target);
      const element = slot?.ui.element;
      const placed = 'after' in where ? where.after.nextSibling === element : element?.parentElement === where.inside;
      if (slot && placed) {
        if (slot.username !== username) {
          slot.username = username;
          slot.ui.update(vnode());
        }
        return;
      }
      slot?.controller.abort();
      const controller = childController(signal);
      const [parent, before] =
        'after' in where ? [where.after.parentElement ?? document.body, where.after.nextSibling] : [where.inside, null];
      const ui = mountUi(vnode(), { parent, before, inline: true, signal: controller.signal });
      slots.set(target, { ui, controller, username });
    }

    function release(target: HTMLElement): void {
      setClass(target, 'wm-hidden', false);
      setClass(target, CHAT_AVATAR, false);
    }

    function sync(): void {
      const seen = new Set<HTMLElement>();
      for (const { line, username, image } of findMarketplaceSellers()) {
        // Sans image reconnue, le « Vendu par » du site reste.
        if (!image) continue;
        seen.add(line);
        place(line, username, { inside: image }, () =>
          h(ProfileLink, {
            username,
            label: `@${username}`,
            className: `${buttonClass('standard', { tone: 'neutral', fill: 'solid', size: 'sm' })} ${SELLER}`,
          }),
        );
      }
      for (const { name, username } of findAuctionPlayers()) {
        seen.add(name);
        place(name, username, { after: name }, () =>
          h(ProfileLink, { username, className: siteClasses(name) }),
        );
      }
      for (const { name, avatar, username } of findChatPeers()) {
        seen.add(name).add(avatar);
        place(name, username, { after: name }, () =>
          h(ProfileLink, { username, className: `${siteClasses(name)} wm-chat-name` }),
        );
        setClass(avatar, CHAT_AVATAR, true);
        place(avatar, username, { inside: avatar, keep: true }, () =>
          h(ProfileLink, { username, label: '', className: 'wm-chat-avatar-link' }),
        );
      }
      for (const [target, slot] of slots) {
        if (seen.has(target)) continue;
        release(target);
        slot.controller.abort();
        slots.delete(target);
      }
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      for (const target of slots.keys()) release(target);
      slots.clear();
    });
  },
};
