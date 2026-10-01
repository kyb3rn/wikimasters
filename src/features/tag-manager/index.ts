import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findCollectionFilters, findManageTagsOption, findTagManager, tagManagerOpener } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { ManageButton } from './ManageButton';

const FRAME = 'wm-tag-manager';
const COUNT = 'wm-tag-count';
/** Cadre de la liste des étiquettes : sa liste et notre engrenage côte à côte. */
const SELECT = 'wm-tag-select';

/**
 * Largeur du site (`max-w-lg`, 512 px) + 20 %, arrondie : les noms longs se lisent mieux. Hors couche,
 * l'emporte sur ses classes Tailwind. « n cartes » ne se coupe plus ni ne rétrécit : quand le nom est long,
 * c'est lui qui est tronqué, et le compte vient se coller aux boutons.
 *
 * L'engrenage, carré, est collé à droite de la liste (coins et trait communs). Sur une ligne, le cadre garde
 * les bornes du site (`md:min-w-[12rem] md:max-w-[16rem]`) plus l'engrenage : la liste ne rétrécit pas.
 */
const CSS = `
.${FRAME} { max-width: 614px; max-height: min(90vh, 900px); }
.${COUNT} { white-space: nowrap; flex-shrink: 0; }
.${SELECT} { display: flex; }
.${SELECT} > button[aria-haspopup="listbox"] { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.wm-button.wm-tag-manage { border-left-width: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
@media (min-width: 768px) {
  .${SELECT} { min-width: calc(12rem + ${tokens.fieldHeight}); max-width: calc(16rem + ${tokens.fieldHeight}); }
}
`;

export const tagManager: Feature = {
  id: 'tag-manager',
  name: 'Gestion des étiquettes',
  description:
    "La gestion des étiquettes s'ouvre par un engrenage plutôt que par la liste des étiquettes. Sa fenêtre est plus large et ne dépasse pas 900 px de haut ; le nombre de cartes reste sur une ligne.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    /** Listes des étiquettes (un bouton par rendu de la page) qui ont l'option « Gérer les étiquettes… ». */
    const manageable = new WeakMap<HTMLButtonElement, boolean>();
    const gear = createSlot(signal);
    const marks = classMarks(signal);

    function open(): void {
      const tag = findCollectionFilters()?.tag;
      const opener = tag && tagManagerOpener(tag);
      if (!tag || !opener) {
        log.warn('option « Gérer les étiquettes » introuvable');
        toast.error("La gestion des étiquettes n'a pas pu s'ouvrir. Rechargez la page.", { title: 'Étiquettes' });
        return;
      }
      // Menu ouvert : le site ne le ferme que sur un clic hors du cadre de la liste, où est l'engrenage.
      if (tag.getAttribute('aria-expanded') === 'true') tag.click();
      opener();
    }

    /** Engrenage collé à la liste des étiquettes, option du menu cachée. Idempotent. */
    function syncGear(): void {
      const tag = findCollectionFilters()?.tag;
      const frame = tag?.parentElement;
      if (tag && frame && !manageable.has(tag)) manageable.set(tag, tagManagerOpener(tag) !== undefined);
      // Sans l'option, rien à remplacer : la liste reste celle du site.
      if (!tag || !frame || !manageable.get(tag)) {
        gear.clear();
        marks.only(SELECT, []);
        return;
      }
      marks.only(SELECT, [frame]);
      const option = findManageTagsOption(tag);
      if (option) ctx.hide(option);
      gear.render(h(ManageButton, { onClick: open }), { parent: frame, inline: true });
    }

    watchDom(() => {
      syncGear();
      const manager = findTagManager();
      if (!manager) return;
      marks.only(FRAME, [manager.frame]);
      marks.only(COUNT, manager.counts);
    }, { signal });
  },
};
