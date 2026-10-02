import { h } from 'preact';
import { childController } from '@/core/async';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { textOf } from '@/core/text';
import { findFriendOwnersPills, readFriendOwners, type FriendOwner } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { Icon } from '@/ui/icons';
import { createSlots, mountUi } from '@/ui/mount';
import { siteClass } from '@/ui/site';
import { FriendOwnersModal, MODAL_CSS } from './FriendOwnersModal';

const ROW = 'wm-friend-owners-row';

// « Possédée » et la pastille ronde côte à côte (le site les empile).
const CSS = `
div.${ROW} { flex-direction: row; align-items: center; gap: 4px; }
.wm-friend-owners { cursor: pointer; transition: filter 0.15s; }
.wm-friend-owners:hover { filter: brightness(1.15); }
${MODAL_CSS}`;

interface FriendsButtonProps {
  /** Pseudos des amis, séparés par « , » (info-bulle du site). */
  readonly names: string;
  readonly onOpen: () => void;
}

const FriendsButton = ({ names, onOpen }: FriendsButtonProps) =>
  h(
    'button',
    {
      type: 'button',
      class: `${siteClass.faceFriends} wm-friend-owners`,
      title: names,
      'aria-label': "Amis qui l'ont",
      onClick: (event: MouseEvent) => {
        // Le clic ne doit pas ouvrir la modale de la carte.
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      },
    },
    h(Icon, { name: 'users', size: 10, class: siteClass.faceFriendsIcon }),
  );

/** Amis de l'info-bulle du site, si son état est illisible. */
const friendsOfTitle = (names: string): FriendOwner[] =>
  names
    .split(', ')
    .filter(Boolean)
    .map((username) => ({ id: username, username }));

/**
 * Toutes les cartes : la pastille bleue du site (« pseudo +n ») devient une pastille ronde à son icône, à côté de
 * « Possédée » ; un clic ouvre la liste des amis qui ont la carte (demande de l'utilisateur), sans ouvrir la carte.
 */
export const globalCollectionFriends: Feature = {
  id: 'global-collection-friends',
  name: "Amis qui l'ont",
  description: "Toutes les cartes : amis qui ont la carte en pastille ronde, leur liste dans une fenêtre au clic.",
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const buttons = createSlots<HTMLElement>(ctx.signal);
    const marks = classMarks(ctx.signal);
    let open: AbortController | undefined;

    function show(face: HTMLElement, names: string): void {
      const owners = readFriendOwners(face);
      if (!owners) ctx.log.warn('amis de la carte illisibles dans la page : ceux de son info-bulle');
      const friends = owners?.friends.length ? owners.friends : friendsOfTitle(names);
      if (friends.length === 0) return;
      open?.abort();
      const controller = childController(ctx.signal);
      open = controller;
      const cardTitle = owners?.card.title ?? textOf(face.querySelector('h3') ?? face);
      const ui = mountUi(h(FriendOwnersModal, { cardTitle, friends, onClose: () => controller.abort() }), { signal: controller.signal });
      // Le site ne voit pas les gestes faits dans la fenêtre.
      for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
        ui.element.addEventListener(type, (event) => event.stopPropagation());
      }
    }

    watchDom(
      () => {
        const pills = findFriendOwnersPills();
        for (const { face, pill, stack } of pills) {
          ctx.hide(pill);
          const names = pill.title;
          buttons.render(pill, h(FriendsButton, { names, onOpen: () => show(face, names) }), { parent: stack, after: pill, inline: true });
        }
        marks.only(
          ROW,
          pills.map(({ stack }) => stack),
        );
        const shown = new Set(pills.map(({ pill }) => pill));
        buttons.prune((pill) => shown.has(pill));
      },
      { signal: ctx.signal },
    );
  },
};
