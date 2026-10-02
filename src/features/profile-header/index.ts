import { h } from 'preact';
import { watchDom } from '@/core/dom';
import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { NETWORK_ERROR, readFriendshipAction, watchSiteRefusal } from '@/site/api';
import {
  findProfileFriendRequest,
  findProfileHeader,
  findUniqueCardsStat,
  isProfileVisibilityChange,
  readProfilePlayer,
  type ProfileFriendRequest,
  type ProfileHeader as SiteHeader,
} from '@/site/profile';
import { MY_PROFILE_ROUTE, PROFILE_ROUTE } from '@/site/routes';
import { openTradeComposer, type OpenedTradeComposer } from '@/site/trades';
import { ICON_NAMES, type IconName } from '@/ui/icons';
import { createSlot } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { ProfileHeader, type FriendRequestView, type HeaderAction } from './ProfileHeader';

const CSS = `
.wm-profile-header { --wm-avatar: 7rem; }
.wm-profile-cover { position: relative; height: 8rem; background: linear-gradient(180deg, rgb(0 0 0 / 55%), rgb(0 0 0 / 35%)); }
.wm-profile-corner { position: absolute; top: .75rem; right: .75rem; }
.wm-profile-main {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start;
  column-gap: 1rem; padding: 0 1rem 1rem;
}
.wm-profile-stat { min-width: 0; padding-top: 1.5rem; text-align: center; }
/* Colonne de droite sur toute la hauteur : ses boutons en bas, jamais sur ce qu'elle affiche au-dessus. */
.wm-profile-right { display: flex; flex-direction: column; align-self: stretch; min-width: 0; }
.wm-profile-actions {
  display: flex; flex-wrap: wrap; justify-content: flex-end; align-self: flex-end; gap: .25rem;
  margin: auto -.25rem -.25rem 0; padding-top: .5rem;
}
.wm-profile-request {
  display: flex; flex-direction: column; align-items: center; gap: .5rem; min-width: 0; padding-top: 1.5rem;
  text-align: center;
}
.wm-profile-request > p { margin: 0; }
.wm-profile-trade { display: flex; justify-content: center; min-width: 0; padding-top: 1.5rem; }
.wm-profile-request-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: .5rem; }
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
  /* Pseudo et sa ligne sur toute la largeur, sous la rangée chiffres / photo : un pseudo long n'écrase plus les chiffres. */
  .wm-profile-identity, .wm-profile-right { display: contents; }
  .wm-profile-actions { grid-column: 1 / -1; justify-self: end; margin-top: 0; }
  .wm-profile-avatar { grid-row: 1; grid-column: 2; margin-top: calc(var(--wm-avatar) / -2); }
  .wm-profile-stat-left { grid-row: 1; grid-column: 1; }
  .wm-profile-stat-right { grid-row: 1; grid-column: 3; }
  .wm-profile-name, .wm-profile-identity > p { grid-column: 1 / -1; max-width: 100%; }
  .wm-profile-stat { padding-top: .75rem; }
  /* « sept. 2026 » en grand ne tient pas à côté de la photo ; sur un écran plus étroit encore, il passe à la ligne. */
  .wm-profile-stat > :first-child { font-size: 1.125rem; line-height: 1.5rem; white-space: normal; }
  /* Trop étroit à côté de la photo : la demande d'ami (comme chez le site) et « Échanger » passent en bas, sur toute la largeur. */
  .wm-profile-request, .wm-profile-trade { grid-column: 1 / -1; padding-top: .75rem; }
  .wm-profile-request > button, .wm-profile-trade > button { width: 100%; }
}
`;

const isIconName = (name: string | undefined): name is IconName =>
  name !== undefined && (ICON_NAMES as readonly string[]).includes(name);

/** Réponse du site à une demande reçue (Accepter, Refuser du profil). */
const answerOf = (request: NetRequest): 'accept' | 'decline' | undefined => {
  if (request.own) return undefined;
  const kind = readFriendshipAction(request)?.kind;
  return kind === 'accept' || kind === 'decline' ? kind : undefined;
};

/** Envoi d'une demande d'ami, ou réponse à une demande reçue, par le site. */
const isRequestAction = (request: NetRequest): boolean =>
  !request.own && (readFriendshipAction(request)?.kind === 'add' || answerOf(request) !== undefined);

/** Ami : le site ne lui met « Retirer des amis » (lucide `user-minus`) que s'il l'est. */
const isFriend = (header: SiteHeader): boolean => header.actions.some((action) => action.icon === 'user-minus');

const TRADE_ERROR = "La fenêtre d'échange du site n'a pas pu s'ouvrir.";

/** Morceau de code du site pas reçu (Turbopack) : panne réseau, comme une requête sans réponse. */
const isChunkLoadError = (error: unknown): boolean => error instanceof Error && error.name === 'ChunkLoadError';

export const profileHeader: Feature = {
  id: 'profile-header',
  name: 'En-tête du profil',
  description:
    "En-tête des profils sur un fond : photo au centre, pseudo et ligne du site dessous (et la dernière activité d'un ami), nombre de cartes à gauche ; à droite, les cartes uniques (le sien), « Échanger » (un ami : fenêtre d'échange du site, sur place) ou la demande d'ami (les autres) ; étiquettes en bas ; visibilité du sien en haut à droite ; « Signaler » et « Retirer des amis » d'un autre joueur en bas à droite.",
  category: 'Profil',
  routes: [MY_PROFILE_ROUTE, PROFILE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const slot = createSlot(signal);
    /** Changements de visibilité en cours : l'interrupteur tourne et ne répond plus. */
    let pending = 0;
    /** Réponse à une demande reçue en cours : le site ne désactive pas ses boutons. */
    let answering: 'accept' | 'decline' | undefined;
    /** « Échanger » : fenêtre en cours d'ouverture, puis ouverte (fermée avec la page). */
    let tradeOpening = false;
    let trade: OpenedTradeComposer | undefined;
    ctx.onDispose(() => trade?.close());

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
    net.track(
      (request) => answerOf(request) !== undefined,
      (request) => {
        answering = answerOf(request);
        sync();
        return () => {
          answering = undefined;
          sync();
        };
      },
      { signal },
    );
    // L'en-tête et la demande d'ami du site sont cachés : un refus qu'ils afficheraient ne se verrait pas (et le
    // site n'en affiche aucun pour une demande d'ami).
    watchSiteRefusal(isProfileVisibilityChange, (message) => toast.error(message, { title: 'Visibilité du profil' }), { signal });
    watchSiteRefusal(isRequestAction, (message) => toast.error(message, { title: 'Amis' }), { signal });

    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    function toggleVisibility(): void {
      const visibility = findProfileHeader()?.visibility;
      if (visibility && pending === 0 && !visibility.button.disabled) visibility.button.click();
    }

    /** Recliqué à son `title` : le site a pu redessiner son bouton depuis. */
    function clickAction(title: string): void {
      const button = findProfileHeader()?.actions.find((action) => action.title === title)?.button;
      if (button && !button.disabled) button.click();
    }

    function actionsOf(header: SiteHeader): HeaderAction[] {
      return header.actions.map((action) => ({
        key: action.title,
        icon: isIconName(action.icon) ? action.icon : undefined,
        label: action.label,
        title: action.title,
        busy: action.button.disabled,
        onClick: () => clickAction(action.title),
      }));
    }

    function currentRequest(): ProfileFriendRequest | undefined {
      const root = findProfileHeader()?.root;
      return root && findProfileFriendRequest(root);
    }

    function answer(kind: 'accept' | 'decline'): void {
      const request = currentRequest();
      if (request?.kind === 'received' && answering === undefined) request[kind].click();
    }

    function requestOf(request: ProfileFriendRequest): FriendRequestView {
      switch (request.kind) {
        case 'send':
          return {
            kind: 'send',
            label: request.label,
            busy: request.button.disabled,
            onSend: () => {
              const current = currentRequest();
              if (current?.kind === 'send' && !current.button.disabled) current.button.click();
            },
          };
        case 'sent':
          return { kind: 'sent', text: request.text };
        case 'received':
          return {
            kind: 'received',
            text: request.text,
            busy: answering,
            onAccept: () => answer('accept'),
            onDecline: () => answer('decline'),
          };
      }
    }

    function tradeFailed(error: unknown): void {
      ctx.log.error("Fenêtre d'échange :", error);
      toast.error(isChunkLoadError(error) ? NETWORK_ERROR : TRADE_ERROR, { title: 'Échanges' });
    }

    /** Fenêtre d'échange du site avec cet ami, ouverte ici comme sur la page Amis (pas de passage par /trades). */
    async function openTrade(): Promise<void> {
      if (tradeOpening || trade) return;
      const header = findProfileHeader();
      const player = header && readProfilePlayer(header);
      if (!header || !player) {
        tradeFailed(new Error('identifiant du joueur introuvable dans la page'));
        return;
      }
      tradeOpening = true;
      sync();
      try {
        const opened = await openTradeComposer(
          { friendUsername: player.username, friendProfileId: player.id },
          {
            contextFrom: header.root,
            onClosed: () => {
              trade = undefined;
            },
            onError: (error) => {
              trade = undefined;
              tradeFailed(error);
            },
          },
        );
        if (signal.aborted) opened.close();
        else trade = opened;
      } catch (error) {
        tradeFailed(error);
      } finally {
        tradeOpening = false;
        sync();
      }
    }

    function sync(): void {
      if (signal.aborted) return;
      const header = findProfileHeader();
      const parent = header?.root.parentElement;
      if (!header || !parent) {
        slot.clear();
        return;
      }
      ctx.hide(header.root);
      const own = header.avatarButton !== undefined;
      const unique = own ? findUniqueCardsStat() : undefined;
      if (unique) ctx.hide(unique.root);
      const request = own ? undefined : findProfileFriendRequest(header.root);
      if (request) ctx.hide(request.root);
      const { visibility } = header;
      const vnode = h(ProfileHeader, {
        name: header.name,
        avatar: header.avatar,
        details: header.details,
        seen: header.seen,
        left: header.cards,
        right: unique?.stat,
        request: request && requestOf(request),
        trade: !own && isFriend(header) ? { busy: tradeOpening, onClick: () => void openTrade() } : undefined,
        tags: header.tags,
        visibility: visibility && {
          isPublic: visibility.isPublic,
          label: visibility.label,
          busy: pending > 0 || visibility.button.disabled,
        },
        actions: actionsOf(header),
        onEditAvatar: own ? () => findProfileHeader()?.avatarButton?.click() : undefined,
        onToggleVisibility: toggleVisibility,
      });
      slot.render(vnode, { parent, before: header.root });
    }

    watchDom(sync, { signal });
  },
};
