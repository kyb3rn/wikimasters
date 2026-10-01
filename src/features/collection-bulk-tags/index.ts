import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom } from '@/core/dom';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { notify } from '@/services/notifications';
import { addTagsToCards, createTags, removeTagsFromCards, SiteApiError, siteErrorText, supabaseUserId } from '@/site/api';
import {
  applyTagChange,
  findBulkTagModal,
  findCollectionRefresh,
  randomTagColor,
  TAG_NAME_MAX,
  tagChipStyle,
  type BulkTagModal,
  type BulkTagOption,
} from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';
import { lockControl, unlockAll } from '@/ui/lock';
import { createSlot, type UiSlot } from '@/ui/mount';
import { toast } from '@/ui/toast';
import {
  addPending,
  doneMessage,
  isPendingName,
  removePending,
  submitLabel,
  withCreatedIds,
  type BulkMode,
  type PendingTag,
} from './pending';
import { PendingChips, SubmitButton } from './views';

const OWNER = 'collection-bulk-tags';

type Form = NonNullable<BulkTagModal['form']>;

interface OpenModal {
  readonly overlay: HTMLElement;
  readonly mode: BulkMode;
  readonly controller: AbortController;
  pending: readonly PendingTag[];
  busy: boolean;
  /** Étiquettes choisies, au-dessus du champ. */
  readonly chips: UiSlot;
  /** Bouton d'envoi, en bas. */
  readonly submit: UiSlot;
}

/** Étiquettes existantes déjà choisies : retirées de la liste du site. */
const chosenIds = (state: OpenModal) => new Set(state.pending.flatMap((tag) => (tag.id ? [tag.id] : [])));

/** Première étiquette encore proposée par la liste. */
function firstOption(state: OpenModal, form: Form): BulkTagOption | undefined {
  const chosen = chosenIds(state);
  return form.options.find((option) => !chosen.has(option.id));
}

/**
 * La modale d'étiquetage de la sélection reste celle du site, mais un clic sur une étiquette (ou sur
 * « Créer ») ne l'applique plus : elle rejoint les étiquettes choisies, en pastilles au-dessus du champ,
 * et quitte la liste. Un bouton pleine largeur en bas envoie tout d'un coup (étiquettes nouvelles créées,
 * puis une seule requête pour toutes les cartes), ferme la modale et pose les étiquettes sur les cartes
 * affichées, sans recharger la liste (comme la modale de carte du site).
 * La croix annule tout. Même chose pour le retrait.
 */
export const collectionBulkTags: Feature = {
  id: 'collection-bulk-tags',
  name: 'Étiquetage groupé',
  description: 'Plusieurs étiquettes à ajouter ou retirer sur la sélection, envoyées en une fois.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    let open: OpenModal | undefined;

    if (!(await ctx.ready())) return;

    function choose(state: OpenModal, form: Form, tag: PendingTag): void {
      state.pending = addPending(state.pending, tag);
      setReactInputValue(form.input, '');
      form.input.focus();
      sync();
    }

    function chooseTyped(state: OpenModal, form: Form): void {
      const name = form.input.value.trim();
      if (!form.create || !name || name.length > TAG_NAME_MAX) return;
      const color = form.create.color.value;
      // Comme le site après une création : la suivante aura une autre couleur.
      setReactInputValue(form.create.color, randomTagColor());
      choose(state, form, { name, color, chipStyle: tagChipStyle(color) });
    }

    function unchoose(tag: PendingTag): void {
      if (!open || open.busy) return;
      open.pending = removePending(open.pending, tag);
      sync();
    }

    async function send(state: OpenModal, cardIds: readonly string[]): Promise<void> {
      if (state.mode === 'remove') {
        await removeTagsFromCards(cardIds, state.pending.flatMap((tag) => (tag.id ? [tag.id] : [])));
        return;
      }
      const fresh = state.pending.filter((tag) => tag.id === undefined);
      if (fresh.length > 0) {
        const userId = supabaseUserId();
        if (!userId) throw new SiteApiError('Session du site introuvable : rechargez la page.', 0);
        const created = await createTags(userId, fresh.map(({ name, color }) => ({ name, color: color ?? randomTagColor() })));
        // Gardées même si la suite échoue : un nouvel essai ne les recrée pas.
        state.pending = withCreatedIds(state.pending, created);
      }
      const ids = state.pending.flatMap((tag) => (tag.id ? [tag.id] : []));
      if (ids.length !== state.pending.length) throw new SiteApiError("L'étiquette créée est introuvable.", 0);
      await addTagsToCards(cardIds, ids);
    }

    async function submit(): Promise<void> {
      const state = open;
      const modal = findBulkTagModal();
      if (!state || state.busy || state.pending.length === 0 || modal?.overlay !== state.overlay) return;
      const title = state.mode === 'add' ? 'Étiquetage impossible' : 'Retrait impossible';
      const cardIds = modal.cardIds;
      if (cardIds.length === 0) {
        log.warn('exemplaires sélectionnés illisibles');
        toast.error('Cartes sélectionnées introuvables.', { title });
        return;
      }
      state.busy = true;
      sync();
      try {
        await send(state, cardIds);
      } catch (error) {
        log.warn('envoi refusé', error);
        toast.error(siteErrorText(error), { title });
        state.busy = false;
        sync();
        return;
      }
      log.info(state.mode === 'add' ? 'étiquettes ajoutées' : 'étiquettes retirées', state.pending.length, cardIds.length);
      state.busy = false;
      sync();
      findBulkTagModal()?.close?.click();
      // Sur les cartes affichées, sans recharger la liste ; état de la page illisible : le site recharge.
      const tags = state.pending.flatMap(({ id, name, color }) => (id ? [{ id, name, ...(color !== undefined && { color }) }] : []));
      const change = state.mode === 'add' ? { cardIds, add: tags } : { cardIds, remove: tags.map((tag) => tag.id) };
      if (!applyTagChange(change)) {
        log.warn('état de la page illisible : liste rechargée');
        findCollectionRefresh()?.();
      }
      notify({ message: doneMessage(state.mode, state.pending.length, cardIds.length), variant: 'success' });
    }

    /** Pastilles juste au-dessus du champ, bouton d'envoi en dernier (après l'erreur du site). */
    function place(state: OpenModal, form: Form): void {
      const empty = state.pending.length === 0;
      const chips = state.chips.render(h(PendingChips, { tags: state.pending, busy: state.busy, onRemove: unchoose }), {
        parent: form.body,
        before: form.input,
      });
      if (chips.element.hidden !== empty) chips.element.hidden = empty;
      state.submit.render(
        h(SubmitButton, { label: submitLabel(state.mode, state.pending.length), busy: state.busy, disabled: empty, onClick: () => void submit() }),
        { parent: form.body, before: null },
      );
    }

    function sync(): void {
      const modal = findBulkTagModal();
      if (open && open.overlay !== modal?.overlay) {
        open.controller.abort();
        open = undefined;
      }
      if (!modal) return;
      if (!open) {
        const controller = childController(signal);
        open = {
          overlay: modal.overlay,
          mode: modal.mode,
          controller,
          pending: [],
          busy: false,
          chips: createSlot(controller.signal),
          submit: createSlot(controller.signal),
        };
      }
      const form = modal.form;
      if (!form) return;
      const { busy, pending } = open;
      const lock = { owner: OWNER, locked: busy, reason: 'Envoi en cours' };
      const chosen = chosenIds(open);
      for (const option of form.options) {
        ctx.hide(option.button, chosen.has(option.id));
        lockControl(option.button, lock);
      }
      if (form.create) {
        ctx.hide(form.create.row, isPendingName(pending, form.input.value));
        lockControl(form.create.button, lock);
        lockControl(form.create.color, lock);
      }
      lockControl(form.input, lock);
      if (modal.close) lockControl(modal.close, lock);
      place(open, form);
    }

    window.addEventListener(
      'click',
      (event) => {
        const state = open;
        const modal = state && findBulkTagModal();
        if (!state || !modal || modal.overlay !== state.overlay || !(event.target instanceof Element)) return;
        const target = event.target;
        const form = modal.form;
        const option = form?.options.find((candidate) => candidate.button.contains(target));
        const create = form?.create?.button.contains(target);
        // Pendant l'envoi, le fond ne ferme pas la modale (le site ne le sait pas occupé).
        if (!option && !create && !(state.busy && target === modal.overlay)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (state.busy || !form) return;
        if (option) choose(state, form, { id: option.id, name: option.name, chipStyle: option.chipStyle });
        else chooseTyped(state, form);
      },
      { capture: true, signal },
    );

    // Entrée dans le champ : la première étiquette proposée, sinon le nom tapé (comme la modale de carte).
    window.addEventListener(
      'keydown',
      (event) => {
        const state = open;
        const form = state && findBulkTagModal()?.form;
        if (event.key !== 'Enter' || event.isComposing || !state || !form || event.target !== form.input) return;
        event.preventDefault();
        if (state.busy || !form.input.value.trim()) return;
        const option = firstOption(state, form);
        if (option) choose(state, form, { id: option.id, name: option.name, chipStyle: option.chipStyle });
        else if (form.create && !isPendingName(state.pending, form.input.value)) chooseTyped(state, form);
      },
      { capture: true, signal },
    );

    watchDom(sync, { signal });
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
