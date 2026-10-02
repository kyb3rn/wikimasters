import { h } from 'preact';
import { later } from '@/core/async';
import { classMarks, watchDom } from '@/core/dom';
import { net, type NetRequest } from '@/core/net';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { isPlayerSearch } from '@/site/api';
import { findPlayerSearch } from '@/site/friends';
import { FRIENDS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { SearchField } from './SearchField';
import { settings } from './settings';
import { CSS, FRAME, RESULTS } from './style';

/** Le site ne cherche qu'à partir de 2 caractères (sans les espaces du bout). */
const MIN_LENGTH = 2;
/** Le site attend 350 ms après la frappe : au-delà, sa recherche ne partira plus. */
const START_TIMEOUT = 1500;

/**
 * Fenêtre « Rechercher un joueur » agrandie, joueurs sur deux colonnes. Le site cherche pendant la frappe ; réglage
 * coupé, son champ est caché sous le nôtre, qui ne lui passe le texte qu'à Entrée ou par la loupe : le site lance
 * alors sa recherche comme après une frappe (roue sur la loupe jusqu'à sa réponse).
 */
export const playerSearch: Feature = {
  id: 'player-search',
  name: 'Recherche de joueur',
  description: '',
  category: 'Amis',
  routes: [FRIENDS_ROUTE],
  required: true,
  settings,
  async mount(ctx) {
    const { signal, log } = ctx;
    const slot = createSlot(signal);
    const marks = classMarks(signal);
    /** Texte passé au site par notre champ, dont la recherche n'est pas encore partie. */
    let launched: string | undefined;
    let cancelLaunch = () => {};
    /** Recherche du site lancée par notre champ, en cours. */
    let running: NetRequest | undefined;

    net.track(
      (request) => isPlayerSearch(request) && !request.own,
      (request) => {
        if (launched === undefined) return;
        launched = undefined;
        cancelLaunch();
        running = request;
        sync();
        return () => {
          if (running !== request) return;
          running = undefined;
          sync();
        };
      },
      { signal },
    );

    function launch(text: string): void {
      const field = findPlayerSearch()?.field;
      if (!field || launched !== undefined || running) return;
      if (text.trim().length >= MIN_LENGTH && text !== field.value) {
        launched = text;
        cancelLaunch = later(
          () => {
            if (launched !== text) return;
            log.warn('recherche de joueur lancée, mais partie de rien');
            launched = undefined;
            sync();
          },
          START_TIMEOUT,
          signal,
        );
      }
      setReactInputValue(field, text);
      sync();
    }

    function sync(): void {
      if (signal.aborted) return;
      const search = findPlayerSearch();
      marks.only(FRAME, search ? [search.frame] : []);
      marks.only(RESULTS, search ? [search.results] : []);
      if (!search) {
        slot.clear();
        launched = undefined;
        running = undefined;
        cancelLaunch();
        return;
      }
      const whileTyping = settings.get('whileTyping');
      ctx.hide(search.field, !whileTyping);
      if (whileTyping) {
        slot.clear();
        return;
      }
      const vnode = h(SearchField, {
        searched: search.field.value,
        placeholder: search.field.placeholder,
        busy: launched !== undefined || running !== undefined,
        onSearch: launch,
      });
      slot.render(vnode, { parent: search.frame, before: search.field, inline: true });
    }

    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    onSettingsChange(sync, { signal });
    watchDom(sync, { signal });
  },
};
