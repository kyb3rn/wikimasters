import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { textOf } from '@/core/text';
import { findFaceBottomPlace, findModalFaces, readModalView } from '@/site/cards';
import { readCatalogOwnedCards } from '@/site/global-collection';
import { findGuildWishes } from '@/site/guild';
import { findProfileCollectionFaces, readProfileOwnedCards } from '@/site/profile';
import { GLOBAL_COLLECTION_ROUTE, GUILD_ROUTE, PROFILE_ROUTE } from '@/site/routes';
import { createSlots } from '@/ui/mount';
import { siteClass } from '@/ui/site';

/** Pastille du site (vignettes du marché, Toutes les cartes, fenêtre d'échange), à l'identique ; grande face : celle de la page d'une enchère. */
const OwnedBadge = ({ large }: { readonly large: boolean }) =>
  h(
    'div',
    { class: siteClass.faceOverlay },
    h('span', { class: large ? siteClass.faceOwnedLarge : siteClass.faceOwned, title: 'Dans ta collection' }, 'Possédée'),
  );

/**
 * La carte d'une modale ouverte depuis Toutes les cartes ou la collection d'un autre joueur est-elle à moi ? Jamais
 * pour un de mes exemplaires, ni quand le site ne le dit pas (exemplaire d'un ami dans la fenêtre d'échange).
 */
function isModalCardOwned(root: HTMLElement): boolean {
  const view = readModalView(root);
  if (!view || view.from === 'own') return false;
  const owned = view.from === 'catalog' ? readCatalogOwnedCards(root) : readProfileOwnedCards();
  return owned?.has(view.card.id) ?? false;
}

/**
 * « Possédée » là où le site sait que je possède la carte sans l'afficher : demandes des autres membres de la
 * guilde, collection d'un autre joueur, modale d'une carte ouverte depuis Toutes les cartes ou la collection d'un
 * autre joueur. Ailleurs, le site la pose lui-même.
 */
export const ownedBadge: Feature = {
  id: 'owned-badge',
  name: 'Cartes possédées',
  description:
    "« Possédée » sur les cartes que tu possèdes : liste de souhaits de la guilde, collection des autres joueurs, fenêtre d'une carte de Toutes les cartes.",
  category: 'Général',
  routes: [GUILD_ROUTE, PROFILE_ROUTE, GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    const badges = createSlots<HTMLElement>(ctx.signal);
    // Lue une fois par modale (parcours de l'arbre de React), tant que sa carte ne change pas.
    const modals = new WeakMap<HTMLElement, { readonly title: string; readonly owned: boolean }>();

    function isModalOwned(root: HTMLElement, face: HTMLElement): boolean {
      const title = textOf(face.querySelector('h3') ?? face);
      const known = modals.get(root);
      if (known?.title === title) return known.owned;
      // Autre modale du site (choix d'une carte…) : rien, sans relire l'arbre à chaque passage.
      const owned = isModalCardOwned(root);
      modals.set(root, { title, owned });
      return owned;
    }

    watchDom(
      () => {
        const owned = [...findGuildWishes(), ...findProfileCollectionFaces()].flatMap(({ face, owned }) => (owned ? [{ face, large: false }] : []));
        for (const { root, face } of findModalFaces()) if (isModalOwned(root, face)) owned.push({ face, large: true });
        const placed = new Set<HTMLElement>();
        for (const { face, large } of owned) {
          const place = findFaceBottomPlace(face);
          if (!place) continue;
          placed.add(face);
          badges.render(face, h(OwnedBadge, { large }), { ...place, inline: true });
        }
        badges.prune((face) => placed.has(face));
      },
      { signal: ctx.signal },
    );
  },
};
