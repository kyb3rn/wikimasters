import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { autoConfirm, confirmStep } from '@/services/site-confirm';
import { createSelectionUi, selectPageAction, siteAction, trackPressedRequests, type SelectionAction } from '@/services/selection';
import {
  findBulkDiscardConfirm,
  findCollectionFaces,
  findCollectionFilters,
  findSelectionMode,
  isBulkDiscard,
  isBulkStarChange,
  LIST_LOADING_VEIL,
} from '@/site/collection';
import { hasIcon } from '@/site/dom';
import { COLLECTION_ROUTE } from '@/site/routes';
import { findSelectionBar, findSelectionToggle, type SelectionBar } from '@/site/selection';
import { toast } from '@/ui/toast';

/** Propriétaire du gris des cartes non cochées (la case à cocher, à côté de la face, ne l'est pas). */
const OWNER = 'collection-selection';
/** « Défausser tout » : notre bouton, qui confirme en deux clics. */
const DISCARD_ALL = 'discard-all';

/* Voile de chargement du site sur la grille : l'anneau d'une carte cochée dépasse de sa case (4 px, plus
   l'agrandissement au survol) et sortirait du voile au bord de la grille. */
const CSS = `main ${LIST_LOADING_VEIL} { inset: -12px; }`;

/**
 * Mode sélection de la Collection (`createSelectionUi`, le même que Toutes les cartes) : bouton au bout de la ligne
 * des filtres, barre du bas réduite à ses boutons, cartes non cochées grisées. « Défausser tout » demande toujours un
 * second clic (« Confirmer ? »), puis la confirmation du site est cachée et acceptée. Favoris : roue pendant leur
 * requête. Le bouton est là dès la ligne des filtres : celui du site attend les compteurs (total non nul), le mode est
 * alors changé dans l'état de la page.
 */
export const collectionSelection: Feature = {
  id: 'collection-selection',
  name: 'Sélection',
  description: 'Mode sélection de la Collection : bouton dans la ligne des filtres, barre de boutons, défausse en deux clics.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const ui = createSelectionUi(ctx, { owner: OWNER, sync });
    const step = confirmStep<typeof DISCARD_ALL>({ onChange: () => sync(), signal });
    const confirm = autoConfirm({
      find: findBulkDiscardConfirm,
      request: isBulkDiscard,
      onRefused: (message, status) => {
        log.warn('défausse de la sélection refusée', status ?? 'sans réponse', message);
        toast.error(message, { title: 'Défausse impossible' });
      },
      onChange: () => sync(),
      signal,
    });
    const stars = trackPressedRequests({ match: isBulkStarChange, signal, onChange: () => sync() });
    /** Dernière action lancée : un refus de la défausse est déjà signalé par autoConfirm, pas celui des favoris. */
    let last: 'discard' | 'star' | undefined;

    function onDiscard(button: HTMLButtonElement): void {
      if (button.disabled || confirm.pending || !step.press(DISCARD_ALL)) return;
      confirm.arm();
      last = 'discard';
      button.click();
      sync();
    }

    /** Les boutons du site dans leur ordre ; « Retirer l'étiquette » (le second `tag`) devient « Désétiqueter ». */
    function actions(bar: SelectionBar): SelectionAction[] {
      const list: SelectionAction[] = [];
      const page = selectPageAction(bar);
      if (page) list.push(page);
      let tags = 0;
      bar.actions.forEach((button, index) => {
        const key = String(index);
        if (hasIcon(button, 'trash-2', 'trash2')) {
          const stage = step.stage(DISCARD_ALL);
          const asking = stage !== 'idle' && !confirm.confirmed;
          list.push({
            key: DISCARD_ALL,
            icon: 'trash',
            label: 'Défausser tout',
            alternate: { label: 'Confirmer ?', shown: asking },
            disabled: button.disabled || stage === 'waiting',
            busy: confirm.confirmed,
            tone: 'danger',
            fill: asking ? 'solid' : 'outline',
            onClick: () => onDiscard(button),
          });
        } else if (hasIcon(button, 'tag') && tags++ > 0) {
          list.push(siteAction(button, key, { label: 'Désétiqueter' }));
        } else if (hasIcon(button, 'star', 'star-off')) {
          list.push(
            siteAction(button, key, {
              busy: stars.busy(key),
              onClick: () => {
                if (button.disabled) return;
                stars.press(key);
                last = 'star';
                button.click();
              },
            }),
          );
        } else {
          list.push(siteAction(button, key));
        }
      });
      return list;
    }

    function sync(): void {
      confirm.sync();
      const bar = findSelectionBar();
      const mode = findSelectionMode();
      const faces = findCollectionFaces();
      // Sans le bouton du site (compteurs pas encore là, ou collection vide) : seulement s'il y a des cartes.
      const visible = mode !== undefined && (mode.active || findSelectionToggle() !== undefined || faces.length > 0);
      const line = findCollectionFilters()?.row.parentElement;
      ui.render({
        mode: visible ? mode : undefined,
        spot: line ? { parent: line, before: null } : undefined,
        bar,
        actions: bar ? actions(bar) : [],
        faces,
        errorTitle: last === 'star' ? 'Favoris' : undefined,
      });
    }

    watchDom(sync, { signal });
  },
};
