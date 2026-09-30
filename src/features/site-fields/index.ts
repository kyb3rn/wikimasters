import { injectStyle, ROOT_CLASS, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { COLOR_PICKER, FIELD_HEIGHT, HEX_ROW_BUTTON, LISTBOX_FIELD, SELECT_FIELD, SEND_BUTTON, TEXT_FIELD } from '@/site/fields';

const STYLE = 'site-fields';

/**
 * Hors couche : l'emporte sur les classes du site (Tailwind, en couches). Leurs voisins suivent : bouton
 * « Envoyer » et sélecteur de couleur en carrés de la même hauteur, « Appliquer » étiré dans sa rangée.
 */
const CSS = `
:root { --wm-field-height: ${FIELD_HEIGHT}; }
:is(${TEXT_FIELD}, ${SELECT_FIELD}):not(.${ROOT_CLASS} *) { height: var(--wm-field-height); }
${LISTBOX_FIELD}:not(.${ROOT_CLASS} *) { min-height: var(--wm-field-height); }
${SEND_BUTTON}, ${COLOR_PICKER} { width: var(--wm-field-height); height: var(--wm-field-height); }
${SEND_BUTTON} { display: grid; place-items: center; padding: 0; }
${HEX_ROW_BUTTON} { align-self: stretch; }
`;

export const siteFields: Feature = {
  id: 'site-fields',
  name: 'Champs de saisie',
  description: 'Tous les champs de saisie et listes déroulantes du site ont la même hauteur.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    await whenBody();
    if (ctx.signal.aborted) return;
    injectStyle(STYLE, CSS);
    ctx.onDispose(() => document.getElementById(`wm-style-${STYLE}`)?.remove());
  },
};
