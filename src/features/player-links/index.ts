import { h, type ComponentChild } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { FACE } from '@/site/cards';
import { findChatList, findChatWindows, readChatDays } from '@/site/dms';
import { findGuildWishRequesters } from '@/site/guild';
import { findAuctionPlayers, findMarketplaceSellers, TILE } from '@/site/marketplace';
import { findTradeComposer } from '@/site/trades';
import { buttonClass } from '@/ui/button';
import { createSlots, type Placement } from '@/ui/mount';
import { ProfileLink } from './ProfileLink';

const SELLER = 'wm-tile-seller';
const CHAT_AVATAR = 'wm-chat-avatar';

const WRAP = 'wm-tile-seller-wrap';

/*
 * Vendeur d'une vignette (ou auteur d'une demande de la liste de souhaits de guilde) : bouton plein (fond opaque,
 * lisible sur toute image) en bas à gauche de l'image de la carte, au survol de la vignette (de la carte) seulement ;
 * toujours affiché sur un écran tactile, qui n'a pas de survol. Plus petit que le petit bouton (demande de
 * l'utilisateur) : il ne doit pas masquer l'image. Avec un état (« reçu aujourd'hui »), il passe à la ligne.
 */
const CSS = `
.wm-profile-link { cursor: pointer; }
.wm-profile-link:not(.wm-button):hover { text-decoration: underline; text-underline-offset: 2px; }
.wm-button.${SELLER} { position: absolute; left: 6px; bottom: 6px; z-index: 35; display: block;
  max-width: calc(100% - 12px); padding: 2px 7px; border-radius: 6px; font-size: 10px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  box-shadow: 0 1px 4px rgb(0 0 0 / 40%); opacity: 0; pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s; }
.wm-button.${WRAP} { white-space: normal; text-align: left; }
${TILE}:hover .${SELLER}, ${FACE}:hover .${SELLER}, .${SELLER}:focus-visible { opacity: 1; pointer-events: auto; }
@media (hover: none) { .wm-button.${SELLER} { opacity: 1; pointer-events: auto; } }
.wm-chat-name { display: block; width: fit-content; max-width: 100%; }
.${CHAT_AVATAR} { position: relative; }
.wm-chat-avatar-link { position: absolute; inset: 0; border-radius: 9999px; }
`;

/**
 * Où poser notre lien : juste après l'élément du site (caché), ou à la fin d'un autre parent (l'élément du site est
 * caché, sauf `keep` : la photo d'une conversation reste, notre lien la recouvre).
 */
type Place = { readonly after: HTMLElement } | { readonly inside: HTMLElement; readonly keep?: boolean };

/** Classes du site d'un élément, sans les nôtres. */
const siteClasses = (element: Element) => [...element.classList].filter((name) => !name.startsWith('wm-')).join(' ');

/**
 * Pseudos en liens vers le profil du joueur : vendeur des vignettes du marché et auteur des demandes de la liste de
 * souhaits de guilde (« @pseudo » sur l'image de la carte, au survol, à la place de la pastille du site) ; sur la page d'une enchère, « Mis en vente par », « Meneur : », « Remportée par » et
 * l'historique des mises (pseudo du site caché, le nôtre posé juste après) ; conversation privée de /dms : pseudo
 * et photo de l'interlocuteur (en-tête, et à côté de chacun de ses messages), photo et pseudo de l'auteur de chaque
 * message de la conversation de guilde ; fenêtre d'échange (ouverte depuis les échanges, les amis, le catalogue) : pseudo de
 * l'ami dans son titre. Aller sur un profil depuis la fenêtre d'échange la ferme (la page change), sans sa question
 * « Modifications non enregistrées ».
 */
export const playerLinks: Feature = {
  id: 'player-links',
  name: 'Liens vers les profils',
  description:
    "Marché : vendeurs, meneur, gagnant et joueurs de l'historique des mises mènent à leur profil. Messages : pseudo et photos de l'interlocuteur, auteurs des messages de guilde. Échanges : pseudo de l'ami. Guilde : auteurs des demandes de la liste de souhaits.",
  category: 'Marché',
  // La fenêtre d'échange s'ouvre sur plusieurs pages.
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    /** Élément du site remplacé → notre lien. */
    const links = createSlots<HTMLElement>(signal);
    const marks = classMarks(signal);

    function place(target: HTMLElement, where: Place, vnode: ComponentChild): void {
      ctx.hide(target, !('keep' in where && where.keep));
      const placement: Placement =
        'after' in where
          ? { parent: where.after.parentElement ?? document.body, after: where.after, inline: true }
          : { parent: where.inside, inline: true };
      links.render(target, vnode, placement);
    }

    const sellerClass = (wrap = false) =>
      `${buttonClass('standard', { tone: 'neutral', fill: 'solid', size: 'sm' })} ${SELLER}${wrap ? ` ${WRAP}` : ''}`;

    function sync(): void {
      const seen = new Set<HTMLElement>();
      const chatAvatars: HTMLElement[] = [];
      for (const { line, username, image } of findMarketplaceSellers()) {
        // Sans image reconnue, le « Vendu par » du site reste.
        if (!image) continue;
        seen.add(line);
        place(line, { inside: image }, h(ProfileLink, { username, label: `@${username}`, className: sellerClass() }));
      }
      for (const { line, username, status, image } of findGuildWishRequesters()) {
        if (!image) continue;
        seen.add(line);
        const label = status ? `@${username} · ${status}` : `@${username}`;
        place(line, { inside: image }, h(ProfileLink, { username, label, className: sellerClass(status !== undefined) }));
      }
      for (const { name, username } of findAuctionPlayers()) {
        seen.add(name);
        place(name, { after: name }, h(ProfileLink, { username, className: siteClasses(name) }));
      }
      for (const { frame, peer, guild } of findChatWindows()) {
        const { name, username } = peer;
        // Conversation de guilde : son en-tête est la guilde, pas un joueur.
        if (!guild) {
          seen.add(name);
          place(name, { after: name }, h(ProfileLink, { username, className: `${siteClasses(name)} wm-chat-name` }));
        }
        // Photo de l'en-tête, puis celle à côté de chaque message (et le pseudo au-dessus, chat de guilde).
        const list = findChatList(frame);
        const messages = list ? readChatDays(list).flat() : [];
        const avatars = guild ? [] : [{ avatar: peer.avatar, username }];
        for (const entry of messages) {
          if (entry.kind !== 'message') continue;
          // Chat de guilde : l'auteur de chaque message (pas encore connu : pas de lien) ; sinon l'interlocuteur.
          const author = guild ? entry.senderName : (entry.senderName ?? username);
          if (!author) continue;
          if (entry.avatar) avatars.push({ avatar: entry.avatar, username: author });
          const label = entry.nameRow?.querySelector<HTMLElement>(':scope > span');
          if (label && entry.senderName) {
            seen.add(label);
            place(label, { after: label }, h(ProfileLink, { username: author, className: siteClasses(label) }));
          }
        }
        for (const { avatar, username: author } of avatars) {
          seen.add(avatar);
          chatAvatars.push(avatar);
          place(avatar, { inside: avatar, keep: true }, h(ProfileLink, { username: author, label: '', className: 'wm-chat-avatar-link' }));
        }
      }
      const trade = findTradeComposer();
      if (trade) {
        const { friendName, friend } = trade;
        seen.add(friendName);
        place(friendName, { after: friendName }, h(ProfileLink, { username: friend, className: siteClasses(friendName) }));
      }
      marks.only(CHAT_AVATAR, chatAvatars);
      for (const target of links.keys()) if (!seen.has(target)) ctx.hide(target, false);
      links.prune((target) => seen.has(target));
    }

    watchDom(sync, { signal });
  },
};
